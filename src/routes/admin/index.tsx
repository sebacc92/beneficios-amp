import { component$, useSignal, $, useTask$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  Link,
  z,
  zod$,
  useLocation,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { LuImage, LuTrash2 } from "@qwikest/icons/lucide";
import { eq, desc } from "drizzle-orm";
import { getDB } from "~/db";
import {
  users as usersTable,
  customBenefits as customBenefitsTable,
  sponsors as sponsorsTable,
} from "~/db/schema";
import {
  getSettings,
  saveSettings,
  getSessions,
  deleteSession,
} from "~/server/chatbotDb";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

// --- SECURITY CHECK & LOADERS ---

export const useChatSessions = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  const sessions = await getSessions(event);
  return sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    lastActive: s.lastActive,
    messageCount: s.messages.length,
  }));
});

export const useSettingsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  return await getSettings(event);
});

// Retrieves registered users
export const useAdminUsersLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    const result = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    return result.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      matricula: u.matricula,
      role: u.role,
      createdAt: u.createdAt,
    }));
  } catch (err) {
    console.error("Failed to load admin users:", err);
    return [];
  }
});

// Retrieves custom CRUD benefits
export const useAdminCustomBenefitsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    return await db.select().from(customBenefitsTable).orderBy(desc(customBenefitsTable.createdAt));
  } catch (err) {
    console.error("Failed to load custom benefits:", err);
    return [];
  }
});

// Retrieves sponsors grid data
export const useAdminSponsorsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    return await db.select().from(sponsorsTable).orderBy(sponsorsTable.y, sponsorsTable.x);
  } catch (err) {
    console.error("Failed to load sponsors:", err);
    return [];
  }
});

// --- ACTIONS (CRUD & ROLE MODIFIERS) ---

export const useDeleteChatAction = routeAction$(async (data, requestEvent) => {
  const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

  const id = data.id as string;
  if (!id) return requestEvent.fail(400, { message: "ID no proporcionado." });

  try {
    const success = await deleteSession(requestEvent, id);
    if (!success) return requestEvent.fail(404, { message: "Sesión no encontrada." });
    return { success: true };
  } catch (err) {
    console.error(err);
    return requestEvent.fail(500, { message: "Error interno." });
  }
});

export const useUpdateAiSettingsAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      let uploadedImageUrl = data.aiAvatarUrl || null;

      if (data.image && typeof data.image === "object" && (data.image as Blob).size > 0) {
        const file = data.image as File;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploadsDir = `${process.cwd()}/public/uploads`;
        const fsModule = await import("fs/promises");
        await fsModule.mkdir(uploadsDir, { recursive: true });

        const extension = file.name.split(".").pop() || "png";
        const fileName = `ai-avatar-${Date.now()}.${extension}`;
        const filePath = `${uploadsDir}/${fileName}`;
        await fsModule.writeFile(filePath, buffer);

        uploadedImageUrl = `/uploads/${fileName}`;
      }

      const settings = await getSettings(requestEvent);
      const updatedSettings = {
        ...settings,
        aiEnabled: data.aiEnabled === "on",
        aiTone: data.aiTone || "",
        aiInstructions: data.aiInstructions || "",
        aiKnowledge: data.aiKnowledge || "",
        aiInitialGreeting: data.aiInitialGreeting || "",
        aiCallToAction: data.aiCallToAction || "",
        whatsappNumber: data.whatsappNumber || "542214391300",
        aiAvatarUrl: uploadedImageUrl,
        updatedAt: new Date().toISOString(),
      };

      await saveSettings(requestEvent, updatedSettings);
      return { success: true };
    } catch (e: any) {
      console.error(e);
      return requestEvent.fail(500, { message: e.message || "Error al guardar." });
    }
  },
  zod$({
    aiEnabled: z.string().optional(),
    aiTone: z.string().optional(),
    aiInstructions: z.string().optional(),
    aiKnowledge: z.string().optional(),
    aiInitialGreeting: z.string().optional(),
    aiCallToAction: z.string().optional(),
    whatsappNumber: z.string().optional(),
    aiAvatarUrl: z.string().optional(),
    image: z.any().optional(),
  })
);

// Toggle/Change User Role
export const useChangeUserRoleAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      await db
        .update(usersTable)
        .set({ role: data.role as any })
        .where(eq(usersTable.id, data.userId));

      return { success: true };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Failed to update role." });
    }
  },
  zod$({
    userId: z.string(),
    role: z.enum(["admin", "member", "premium"]),
  })
);

// Create Custom Benefit (CRUD: Alta)
export const useCreateBenefitAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const uuid = "cb-" + Date.now().toString();
      const slug = uuid + "-" + data.titulo.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");

      await db.insert(customBenefitsTable).values({
        id: uuid,
        titulo: data.titulo,
        resumen: data.resumen,
        descripcion: data.descripcion,
        imagen: data.imagen || null,
        slug,
        isFeatured: data.isFeatured === "on",
        isPremiumOnly: data.isPremiumOnly === "on",
        categoryId: Number(data.categoryId),
        locationId: Number(data.locationId),
        offerId: Number(data.offerId),
        couponCode: data.couponCode || null,
        validUntil: data.validUntil || null,
        terms: data.terms || null,
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al crear el beneficio." });
    }
  },
  zod$({
    titulo: z.string().min(3),
    resumen: z.string().min(5),
    descripcion: z.string().min(5),
    imagen: z.string().optional(),
    isFeatured: z.string().optional(),
    isPremiumOnly: z.string().optional(),
    categoryId: z.string(),
    locationId: z.string(),
    offerId: z.string(),
    couponCode: z.string().optional(),
    validUntil: z.string().optional(),
    terms: z.string().optional(),
  })
);

// Delete Custom Benefit (CRUD: Baja)
export const useDeleteBenefitAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      await db.delete(customBenefitsTable).where(eq(customBenefitsTable.id, data.id));
      return { success: true };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al eliminar el beneficio." });
    }
  },
  zod$({
    id: z.string(),
  })
);

// Create Sponsor (Alta)
export const useCreateSponsorAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const uuid = "sp-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();

      let uploadedImageUrl = data.imageUrl || "";

      if (data.image && typeof data.image === "object" && (data.image as Blob).size > 0) {
        const file = data.image as File;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploadsDir = `${process.cwd()}/public/uploads`;
        const fsModule = await import("fs/promises");
        await fsModule.mkdir(uploadsDir, { recursive: true });

        const extension = file.name.split(".").pop() || "png";
        const fileName = `sponsor-${Date.now()}.${extension}`;
        const filePath = `${uploadsDir}/${fileName}`;
        await fsModule.writeFile(filePath, buffer);

        uploadedImageUrl = `/uploads/${fileName}`;
      }

      if (!uploadedImageUrl) {
        return requestEvent.fail(400, { message: "Debe proporcionar una imagen o subir un archivo." });
      }

      await db.insert(sponsorsTable).values({
        id: uuid,
        name: data.name,
        imageUrl: uploadedImageUrl,
        linkUrl: data.linkUrl || null,
        x: Number(data.x || 0),
        y: Number(data.y || 0),
        w: Number(data.w || 2),
        h: Number(data.h || 2),
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (err: any) {
      console.error("Create sponsor error:", err);
      return requestEvent.fail(500, { message: err.message || "Error al crear el sponsor." });
    }
  },
  zod$({
    name: z.string().min(2, "El nombre del sponsor debe tener al menos 2 caracteres."),
    imageUrl: z.string().optional(),
    linkUrl: z.string().optional(),
    x: z.string().optional(),
    y: z.string().optional(),
    w: z.string().optional(),
    h: z.string().optional(),
    image: z.any().optional(),
  })
);

// Update Sponsor Position / Size
export const useUpdateSponsorPositionAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const x = Number(data.x);
      const y = Number(data.y);
      const w = Number(data.w);
      const h = Number(data.h);

      if (x < 0 || x > 5 || w < 1 || w > 6 || x + w > 6) {
        return requestEvent.fail(400, { message: "Dimensiones de columna inválidas. Máximo 6 de ancho." });
      }
      if (y < 0 || h < 1) {
        return requestEvent.fail(400, { message: "Dimensiones de fila inválidas." });
      }

      await db
        .update(sponsorsTable)
        .set({ x, y, w, h })
        .where(eq(sponsorsTable.id, data.id));

      return { success: true };
    } catch (err: any) {
      console.error("Update sponsor error:", err);
      return requestEvent.fail(500, { message: "Error al actualizar coordenadas." });
    }
  },
  zod$({
    id: z.string(),
    x: z.string(),
    y: z.string(),
    w: z.string(),
    h: z.string(),
  })
);

// Delete Sponsor
export const useDeleteSponsorAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      await db.delete(sponsorsTable).where(eq(sponsorsTable.id, data.id));
      return { success: true };
    } catch (err: any) {
      console.error("Delete sponsor error:", err);
      return requestEvent.fail(500, { message: "Error al eliminar el sponsor." });
    }
  },
  zod$({
    id: z.string(),
  })
);

// --- VIEW COMPONENT ---

export default component$(() => {
  const sessionsLoader = useChatSessions();
  const deleteAction = useDeleteChatAction();
  const settings = useSettingsLoader();
  const aiSettingsAction = useUpdateAiSettingsAction();
  
  const adminUsers = useAdminUsersLoader();
  const customBenefits = useAdminCustomBenefitsLoader();
  const changeUserRoleAction = useChangeUserRoleAction();
  const createBenefitAction = useCreateBenefitAction();
  const deleteBenefitAction = useDeleteBenefitAction();

  const sponsorsLoader = useAdminSponsorsLoader();
  const createSponsorAction = useCreateSponsorAction();
  const updateSponsorPositionAction = useUpdateSponsorPositionAction();
  const deleteSponsorAction = useDeleteSponsorAction();

  const location = useLocation();
  const activeTab = useSignal<"audit" | "config" | "benefits" | "users" | "stats" | "sponsors">("stats");

  useTask$(({ track }) => {
    const tab = track(() => location.url.searchParams.get("tab"));
    if (tab) {
      activeTab.value = tab as any;
    }
  });

  // AI settings
  const s = settings.value;
  const avatarUrl = useSignal(s.aiAvatarUrl || "");
  const previewUrl = useSignal<string | null>(null);

  // Custom benefits CRUD state
  const isCreateBenefitOpen = useSignal(false);

  // Sponsors Grid CRUD state
  const isCreateSponsorOpen = useSignal(false);
  const sponsorPreviewUrl = useSignal<string | null>(null);

  const handleFileChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const file = element.files[0];
    previewUrl.value = URL.createObjectURL(file);
    avatarUrl.value = "";
  });

  // Client-side CSV download utility
  const downloadCSV = $((dataList: any[], filename: string) => {
    if (dataList.length === 0) return;
    const headers = Object.keys(dataList[0]).join(",");
    const rows = dataList.map((row) =>
      Object.values(row)
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  const tabDetails = {
    stats: {
      category: "Administración / Monitoreo",
      title: "Estadísticas Generales",
      description: "Visualizá métricas clave, descargas de cupones y rendimiento general del club de beneficios.",
    },
    sponsors: {
      category: "Administración / Personalización",
      title: "Grilla de Sponsors",
      description: "Organizá de manera visual e interactiva la disposición 2D de tus auspiciantes en la página de inicio.",
    },
    benefits: {
      category: "Administración / Catálogo",
      title: "Gestión de Beneficios",
      description: "Agregá, editá y eliminá beneficios del catálogo público y configura cupones exclusivos.",
    },
    users: {
      category: "Administración / Personal",
      title: "Usuarios y Roles",
      description: "Administrá los permisos de los médicos agremiados y gestioná accesos de administradores.",
    },
    audit: {
      category: "Administración / Inteligencia Artificial",
      title: "Auditoría de Conversaciones",
      description: "Supervisá los registros históricos de interacción de los socios con el asistente inteligente AMP+.",
    },
    config: {
      category: "Administración / Inteligencia Artificial",
      title: "Personalidad del Asistente",
      description: "Modificá las instrucciones de la IA, su base de conocimiento y los accesos de WhatsApp.",
    },
  };

  const currentDetails = tabDetails[activeTab.value] || tabDetails.stats;

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      
      {/* Dynamic Header Area (SaaS Dashboard layout) */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              {currentDetails.category}
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            {currentDetails.title}
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            {currentDetails.description}
          </p>
        </div>

        {/* Tab-specific Actions */}
        <div class="flex items-center gap-2">
          {activeTab.value === "sponsors" && (
            <button
              onClick$={() => (isCreateSponsorOpen.value = true)}
              class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <span>➕</span>
              <span>Añadir Sponsor</span>
            </button>
          )}

          {activeTab.value === "benefits" && (
            <button
              onClick$={() => (isCreateBenefitOpen.value = true)}
              class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <span>➕</span>
              <span>Crear Beneficio</span>
            </button>
          )}

          {activeTab.value === "stats" && (
            <button
              onClick$={() => downloadCSV(adminUsers.value, `reporte-usuarios-${Date.now()}.csv`)}
              class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
            >
              <span>📥</span>
              <span>Exportar Usuarios</span>
            </button>
          )}

          {activeTab.value === "users" && (
            <button
              onClick$={() => downloadCSV(adminUsers.value, `usuarios-roles-${Date.now()}.csv`)}
              class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
            >
              <span>📥</span>
              <span>Exportar CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* --- TAB CONTENT: STATS --- */}
      {activeTab.value === "stats" && (
        <div class="space-y-8 animate-in fade-in duration-300">
          {/* Metrics row */}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase block">Total Usuarios</span>
                <span class="text-3xl font-display font-black text-slate-800">{adminUsers.value.length}</span>
              </div>
              <span class="text-3xl">👥</span>
            </div>

            <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase block">Miembros Premium</span>
                <span class="text-3xl font-display font-black text-amber-600">
                  {adminUsers.value.filter((u) => u.role === "premium").length}
                </span>
              </div>
              <span class="text-3xl">👑</span>
            </div>

            <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase block">Beneficios CRUD</span>
                <span class="text-3xl font-display font-black text-slate-800">{customBenefits.value.length}</span>
              </div>
              <span class="text-3xl">🎟️</span>
            </div>

            <div class="bg-white p-6 rounded-3xl border border-slate-250 shadow-sm flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase block">Chats Auditados</span>
                <span class="text-3xl font-display font-black text-emerald-700">{sessionsLoader.value.length}</span>
              </div>
              <span class="text-3xl">💬</span>
            </div>
          </div>

          {/* Banners & Reports layout */}
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
            {/* Interactive SVG Chart (Left 2 cols) */}
            <div class="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 class="text-base font-bold text-slate-800 uppercase tracking-wide">Tendencia de Uso Semanal</h3>
                <p class="text-xs text-slate-400 font-medium">Visualización de interacciones del chatbot e ingresos al portal.</p>
              </div>

              {/* Breathtaking Pure SVG Interactive Chart */}
              <div class="w-full h-56 bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-center relative">
                <svg viewBox="0 0 400 150" class="w-full h-full text-brand-green">
                  <defs>
                    <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="var(--color-emerald-500, #10b981)" stop-opacity="0.25" />
                      <stop offset="100%" stop-color="var(--color-emerald-500, #10b981)" stop-opacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Grid Lines */}
                  <line x1="20" y1="20" x2="380" y2="20" stroke="#f1f5f9" stroke-width="1" />
                  <line x1="20" y1="60" x2="380" y2="60" stroke="#f1f5f9" stroke-width="1" />
                  <line x1="20" y1="100" x2="380" y2="100" stroke="#f1f5f9" stroke-width="1" />
                  
                  {/* Shaded Area */}
                  <path
                    d="M 20 120 L 70 90 L 140 100 L 210 50 L 280 70 L 350 30 L 380 40 L 380 120 Z"
                    fill="url(#chart-grad)"
                  />
                  
                  {/* Line Chart */}
                  <path
                    d="M 20 120 L 70 90 L 140 100 L 210 50 L 280 70 L 350 30 L 380 40"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />

                  {/* Nodes */}
                  <circle cx="70" cy="90" r="4" fill="currentColor" />
                  <circle cx="210" cy="50" r="4" fill="currentColor" />
                  <circle cx="350" cy="30" r="4" fill="currentColor" />

                  {/* SVG Labels */}
                  <text x="20" y="140" fill="#94a3b8" font-size="8" font-weight="bold">LUN</text>
                  <text x="140" y="140" fill="#94a3b8" font-size="8" font-weight="bold">MIE</text>
                  <text x="280" y="140" fill="#94a3b8" font-size="8" font-weight="bold">VIE</text>
                  <text x="360" y="140" fill="#94a3b8" font-size="8" font-weight="bold">DOM</text>
                </svg>
              </div>
            </div>

            {/* Downloader Reports Panel (Right 1 col) */}
            <div class="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 class="text-base font-bold text-slate-800 uppercase tracking-wide">Reportes Descargables</h3>
                <p class="text-xs text-slate-400 font-medium">Exportaciones directas inmediatas en formato CSV.</p>
              </div>

              <div class="flex flex-col gap-3 pt-2">
                <button
                  onClick$={() => downloadCSV(adminUsers.value, `users_report_${Date.now()}.csv`)}
                  class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-slate-700"
                >
                  <span>👥 Reporte de Usuarios</span>
                  <span>⬇️ CSV</span>
                </button>

                <button
                  onClick$={() => downloadCSV(customBenefits.value, `custom_benefits_report_${Date.now()}.csv`)}
                  class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-slate-700"
                >
                  <span>🎟️ Reporte de Beneficios CRUD</span>
                  <span>⬇️ CSV</span>
                </button>

                <button
                  onClick$={() => downloadCSV(sessionsLoader.value, `chatbot_audit_report_${Date.now()}.csv`)}
                  class="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-slate-700"
                >
                  <span>💬 Reporte de Auditoría de Chats</span>
                  <span>⬇️ CSV</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: SPONSORS GRID SYSTEM --- */}
      {activeTab.value === "sponsors" && (
        <div class="space-y-6 animate-in fade-in duration-300 text-left">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <div>
              <h3 class="text-lg font-bold text-slate-800">Grilla Modular de Sponsors</h3>
              <p class="text-xs text-slate-400">Manipulá visualmente la posición y dimensión de las marcas patrocinadoras en la Home.</p>
            </div>
            <button
              onClick$={() => (isCreateSponsorOpen.value = !isCreateSponsorOpen.value)}
              class="px-5 py-2.5 rounded-full bg-brand-green hover:bg-brand-green-light text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer"
            >
              {isCreateSponsorOpen.value ? "Cerrar Panel" : "➕ Cargar Sponsor"}
            </button>
          </div>

          {/* Create Sponsor Form Panel */}
          {isCreateSponsorOpen.value && (
            <Form action={createSponsorAction} enctype="multipart/form-data" class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-5 animate-in slide-in-from-top-6 duration-300">
              <h4 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Nuevo Sponsor Publicitario</h4>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nombre de la Marca</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Ej: Dazzler Hoteles"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Enlace de Redirección (Link)</label>
                  <input
                    type="url"
                    name="linkUrl"
                    placeholder="Ej: https://dazzler.com"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Uploader Image Options */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Logotipo del Sponsor</label>
                  <div class="flex items-center gap-4">
                    <div class="w-16 h-16 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {sponsorPreviewUrl.value ? (
                        <img src={sponsorPreviewUrl.value} alt="Preview" width={64} height={64} class="w-full h-full object-contain" />
                      ) : (
                        <span class="text-2xl text-slate-350">🏢</span>
                      )}
                    </div>
                    <label class="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-extrabold rounded-full transition-all cursor-pointer flex items-center gap-1.5 shadow-sm">
                      <LuImage class="w-4 h-4" />
                      Subir Logo Local
                      <input
                        type="file"
                        name="image"
                        accept="image/*"
                        onChange$={$((event: Event) => {
                          const element = event.target as HTMLInputElement;
                          if (!element.files || element.files.length === 0) return;
                          const file = element.files[0];
                          sponsorPreviewUrl.value = URL.createObjectURL(file);
                        })}
                        class="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Ó ingresar URL de Imagen Externa</label>
                  <input
                    type="text"
                    name="imageUrl"
                    placeholder="https://ejemplo.com/logo.png"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                  />
                  <p class="text-[10px] text-slate-400 font-medium">Recomendable: imágenes horizontales o cuadradas en formato SVG o PNG transparente.</p>
                </div>
              </div>

              {/* Initial coordinates */}
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Columna inicial (X)</label>
                  <select name="x" class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none">
                    <option value="0">Columna 1 (Cero)</option>
                    <option value="1">Columna 2</option>
                    <option value="2">Columna 3</option>
                    <option value="3">Columna 4</option>
                    <option value="4">Columna 5</option>
                    <option value="5">Columna 6</option>
                  </select>
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Fila inicial (Y)</label>
                  <input
                    type="number"
                    name="y"
                    value="0"
                    min="0"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none"
                  />
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Ancho inicial (Celdas)</label>
                  <select name="w" class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none">
                    <option value="1">1 Columna</option>
                    <option value="2" selected>2 Columnas (Mediano)</option>
                    <option value="3">3 Columnas (Grande)</option>
                    <option value="4">4 Columnas</option>
                    <option value="6">6 Columnas (Completo)</option>
                  </select>
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Alto inicial (Celdas)</label>
                  <select name="h" class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none">
                    <option value="1">1 Fila (Banda)</option>
                    <option value="2" selected>2 Filas (Caja)</option>
                    <option value="3">3 Filas (Caja Alta)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={createSponsorAction.isRunning}
                class="py-3 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
              >
                {createSponsorAction.isRunning ? "Registrando..." : "Cargar en Grilla"}
              </button>
            </Form>
          )}

          {/* Action Feedbacks */}
          {createSponsorAction.value?.success && (
            <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm">
              ✓ Sponsor agregado exitosamente y posicionado en la grilla.
            </div>
          )}

          {/* VISUAL EDITOR GRIDS */}
          <div>
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Tablero Organizador (Grilla Interactiva 6x)</h4>
              <div class="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                <span class="inline-flex items-center gap-1">
                  <span class="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300 inline-block"></span> Columnas (w)
                </span>
                <span class="inline-flex items-center gap-1">
                  <span class="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300 inline-block"></span> Filas (h)
                </span>
              </div>
            </div>

            {(() => {
              const sponsors = sponsorsLoader.value;
              const maxRow = sponsors.reduce((max, sp) => Math.max(max, sp.y + sp.h), 0);
              const totalRows = Math.max(6, maxRow + 1);

              return (
                <div class="relative w-full rounded-3xl border border-slate-200 bg-slate-50/60 p-4 min-h-[500px] overflow-x-auto select-none shadow-inner">
                  {/* Grid Guides (Dashed Background Layer) */}
                  <div class="grid grid-cols-6 gap-3 w-full h-full absolute inset-0 p-4 pointer-events-none">
                    {Array.from({ length: totalRows * 6 }).map((_, i) => {
                      const col = i % 6;
                      const row = Math.floor(i / 6);
                      return (
                        <div
                          key={`guide-${i}`}
                          style={{
                            gridColumn: `${col + 1} / span 1`,
                            gridRow: `${row + 1} / span 1`
                          }}
                          class="border border-dashed border-slate-250 bg-slate-100/30 rounded-2xl flex flex-col items-center justify-center text-[9px] font-bold text-slate-300 h-24 shadow-sm"
                        >
                          <span class="opacity-50">C{col + 1}, F{row + 1}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Active Sponsors Interactive Layer */}
                  <div class="grid grid-cols-6 gap-3 w-full h-full relative z-10">
                    {sponsors.length === 0 ? (
                      <div class="col-span-6 h-96 flex flex-col items-center justify-center text-slate-400 text-xs font-semibold gap-2">
                        <span>🧱 La grilla de sponsors está vacía en este momento.</span>
                        <span class="text-[10px] text-slate-350">Hacé clic en "Cargar Sponsor" para agregar logotipos publicitarios.</span>
                      </div>
                    ) : (
                      sponsors.map((sp) => {
                        const minHeightPx = sp.h * 96 + (sp.h - 1) * 12; // cell height is 96px, gap-3 is 12px
                        return (
                          <div
                            key={sp.id}
                            style={{
                              gridColumn: `${sp.x + 1} / span ${sp.w}`,
                              gridRow: `${sp.y + 1} / span ${sp.h}`,
                              minHeight: `${minHeightPx}px`
                            }}
                            class="bg-white rounded-2xl border border-slate-200/90 shadow-md flex flex-col items-center justify-between p-3 relative group/card transition-all hover:shadow-xl hover:border-slate-350 hover:-translate-y-0.5 overflow-hidden animate-fade-in"
                          >
                            {/* Brand Header */}
                            <div class="w-full flex justify-between items-start gap-1">
                              <span class="text-[9px] font-black uppercase text-slate-400 tracking-wider bg-slate-100 rounded px-1.5 py-0.5 max-w-[70%] truncate">
                                {sp.name}
                              </span>
                              <span class="text-[8px] font-mono font-bold text-[#0a442a] bg-emerald-50 rounded px-1 tracking-tighter">
                                {sp.w}x{sp.h}
                              </span>
                            </div>

                            {/* Logo Display */}
                            <div class="flex-grow flex items-center justify-center p-2 max-h-[50%]">
                              <img
                                src={sp.imageUrl}
                                alt={sp.name}
                                class="max-h-16 max-w-full object-contain pointer-events-none"
                                width={120}
                                height={64}
                              />
                            </div>

                            {/* Visual Dynamic Shifting & Resizing Panel */}
                            <div class="w-full space-y-2 mt-2 pt-2 border-t border-slate-100">
                              {/* Position Moving Arrows Row */}
                              <div class="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-150 gap-1.5">
                                <span class="text-[8px] font-bold text-slate-400 uppercase tracking-widest pl-1">Posición</span>
                                <div class="flex items-center gap-1">
                                  {/* Left */}
                                  <Form action={updateSponsorPositionAction} class="inline">
                                    <input type="hidden" name="id" value={sp.id} />
                                    <input type="hidden" name="x" value={String(Math.max(0, sp.x - 1))} />
                                    <input type="hidden" name="y" value={String(sp.y)} />
                                    <input type="hidden" name="w" value={String(sp.w)} />
                                    <input type="hidden" name="h" value={String(sp.h)} />
                                    <button
                                      type="submit"
                                      disabled={sp.x === 0}
                                      class="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-emerald-50 hover:text-brand-green border border-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none text-xs font-black shadow-sm transition-all cursor-pointer active:scale-90"
                                      title="Mover Izquierda"
                                    >
                                      ←
                                    </button>
                                  </Form>
                                  
                                  {/* Down */}
                                  <Form action={updateSponsorPositionAction} class="inline">
                                    <input type="hidden" name="id" value={sp.id} />
                                    <input type="hidden" name="x" value={String(sp.x)} />
                                    <input type="hidden" name="y" value={String(sp.y + 1)} />
                                    <input type="hidden" name="w" value={String(sp.w)} />
                                    <input type="hidden" name="h" value={String(sp.h)} />
                                    <button
                                      type="submit"
                                      class="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-emerald-50 hover:text-brand-green border border-slate-200 text-slate-600 text-xs font-black shadow-sm transition-all cursor-pointer active:scale-90"
                                      title="Mover Abajo"
                                    >
                                      ↓
                                    </button>
                                  </Form>
                                  
                                  {/* Up */}
                                  <Form action={updateSponsorPositionAction} class="inline">
                                    <input type="hidden" name="id" value={sp.id} />
                                    <input type="hidden" name="x" value={String(sp.x)} />
                                    <input type="hidden" name="y" value={String(Math.max(0, sp.y - 1))} />
                                    <input type="hidden" name="w" value={String(sp.w)} />
                                    <input type="hidden" name="h" value={String(sp.h)} />
                                    <button
                                      type="submit"
                                      disabled={sp.y === 0}
                                      class="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-emerald-50 hover:text-brand-green border border-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none text-xs font-black shadow-sm transition-all cursor-pointer active:scale-90"
                                      title="Mover Arriba"
                                    >
                                      ↑
                                    </button>
                                  </Form>

                                  {/* Right */}
                                  <Form action={updateSponsorPositionAction} class="inline">
                                    <input type="hidden" name="id" value={sp.id} />
                                    <input type="hidden" name="x" value={String(Math.min(6 - sp.w, sp.x + 1))} />
                                    <input type="hidden" name="y" value={String(sp.y)} />
                                    <input type="hidden" name="w" value={String(sp.w)} />
                                    <input type="hidden" name="h" value={String(sp.h)} />
                                    <button
                                      type="submit"
                                      disabled={sp.x + sp.w >= 6}
                                      class="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-emerald-50 hover:text-brand-green border border-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none text-xs font-black shadow-sm transition-all cursor-pointer active:scale-90"
                                      title="Mover Derecha"
                                    >
                                      →
                                    </button>
                                  </Form>
                                </div>
                              </div>

                              {/* Size Stretching Row */}
                              <div class="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-150 gap-1.5">
                                <span class="text-[8px] font-bold text-slate-400 uppercase tracking-widest pl-1">Tamaño</span>
                                <div class="flex items-center gap-1.5">
                                  {/* Columns w */}
                                  <div class="flex border border-slate-200 rounded overflow-hidden shadow-sm">
                                    {/* w- */}
                                    <Form action={updateSponsorPositionAction} class="inline">
                                      <input type="hidden" name="id" value={sp.id} />
                                      <input type="hidden" name="x" value={String(sp.x)} />
                                      <input type="hidden" name="y" value={String(sp.y)} />
                                      <input type="hidden" name="w" value={String(Math.max(1, sp.w - 1))} />
                                      <input type="hidden" name="h" value={String(sp.h)} />
                                      <button
                                        type="submit"
                                        disabled={sp.w <= 1}
                                        class="w-6 h-5 flex items-center justify-center bg-white text-emerald-800 hover:bg-emerald-50 disabled:opacity-30 text-[9px] font-black cursor-pointer border-r border-slate-200"
                                        title="Reducir Ancho"
                                      >
                                        -w
                                      </button>
                                    </Form>
                                    {/* w+ */}
                                    <Form action={updateSponsorPositionAction} class="inline">
                                      <input type="hidden" name="id" value={sp.id} />
                                      <input type="hidden" name="x" value={String(sp.x)} />
                                      <input type="hidden" name="y" value={String(sp.y)} />
                                      <input type="hidden" name="w" value={String(Math.min(6 - sp.x, sp.w + 1))} />
                                      <input type="hidden" name="h" value={String(sp.h)} />
                                      <button
                                        type="submit"
                                        disabled={sp.x + sp.w >= 6}
                                        class="w-6 h-5 flex items-center justify-center bg-white text-emerald-800 hover:bg-emerald-50 disabled:opacity-30 text-[9px] font-black cursor-pointer"
                                        title="Aumentar Ancho"
                                      >
                                        +w
                                      </button>
                                    </Form>
                                  </div>

                                  {/* Rows h */}
                                  <div class="flex border border-slate-200 rounded overflow-hidden shadow-sm">
                                    {/* h- */}
                                    <Form action={updateSponsorPositionAction} class="inline">
                                      <input type="hidden" name="id" value={sp.id} />
                                      <input type="hidden" name="x" value={String(sp.x)} />
                                      <input type="hidden" name="y" value={String(sp.y)} />
                                      <input type="hidden" name="w" value={String(sp.w)} />
                                      <input type="hidden" name="h" value={String(Math.max(1, sp.h - 1))} />
                                      <button
                                        type="submit"
                                        disabled={sp.h <= 1}
                                        class="w-6 h-5 flex items-center justify-center bg-white text-amber-800 hover:bg-amber-50 disabled:opacity-30 text-[9px] font-black cursor-pointer border-r border-slate-200"
                                        title="Reducir Alto"
                                      >
                                        -h
                                      </button>
                                    </Form>
                                    {/* h+ */}
                                    <Form action={updateSponsorPositionAction} class="inline">
                                      <input type="hidden" name="id" value={sp.id} />
                                      <input type="hidden" name="x" value={String(sp.x)} />
                                      <input type="hidden" name="y" value={String(sp.y)} />
                                      <input type="hidden" name="w" value={String(sp.w)} />
                                      <input type="hidden" name="h" value={String(sp.h + 1)} />
                                      <button
                                        type="submit"
                                        class="w-6 h-5 flex items-center justify-center bg-white text-amber-800 hover:bg-amber-50 text-[9px] font-black cursor-pointer"
                                        title="Aumentar Alto"
                                      >
                                        +h
                                      </button>
                                    </Form>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Floating Delete button */}
                            <Form action={deleteSponsorAction} class="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity z-20">
                              <input type="hidden" name="id" value={sp.id} />
                              <button
                                type="submit"
                                class="p-1 text-red-500 hover:text-red-700 bg-white hover:bg-red-50 rounded-full border border-slate-200 shadow-sm transition-all cursor-pointer"
                                title="Eliminar Sponsor"
                              >
                                <LuTrash2 class="w-3 h-3" />
                              </button>
                            </Form>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: BENEFITS CRUD --- */}
      {activeTab.value === "benefits" && (
        <div class="space-y-6 animate-in fade-in duration-300 text-left">
          <div class="flex justify-between items-center pb-4 border-b border-slate-100">
            <div>
              <h3 class="text-lg font-bold text-slate-800">Beneficios Propios</h3>
              <p class="text-xs text-slate-400">Creá y eliminá beneficios del portal local.</p>
            </div>
            <button
              onClick$={() => (isCreateBenefitOpen.value = !isCreateBenefitOpen.value)}
              class="px-5 py-2.5 rounded-full bg-brand-green hover:bg-brand-green-light text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer"
            >
              {isCreateBenefitOpen.value ? "Cerrar Formulario" : "➕ Crear Beneficio"}
            </button>
          </div>

          {/* Action Feedback alerts */}
          {createBenefitAction.value?.success && (
            <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-fade-in">
              ✓ Beneficio creado exitosamente e integrado en el catálogo general.
            </div>
          )}

          {/* Form Modal mock inside Layout */}
          {isCreateBenefitOpen.value && (
            <Form action={createBenefitAction} class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-5 animate-in slide-in-from-top-6 duration-300">
              <h4 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Nuevo Beneficio Propio</h4>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Título</label>
                  <input
                    type="text"
                    name="titulo"
                    required
                    placeholder="Ej: Spa Platense Masajes"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Resumen (badge descuento)</label>
                  <input
                    type="text"
                    name="resumen"
                    required
                    placeholder="Ej: 20% de descuento"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Descripción Detallada</label>
                <textarea
                  name="descripcion"
                  required
                  rows={3}
                  placeholder="Escribí los detalles completos del descuento, dirección y condiciones..."
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Categoría ID</label>
                  <select
                    name="categoryId"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                  >
                    <option value="1">🏥 Estética y Cuidado</option>
                    <option value="2">🏨 Turismo y Recreación</option>
                    <option value="3">🏪 Comercios varios</option>
                  </select>
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Ubicación ID</label>
                  <select
                    name="locationId"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                  >
                    <option value="1">La Plata</option>
                    <option value="2">Gran La Plata</option>
                    <option value="3">Interior Prov.</option>
                  </select>
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Oferta ID</label>
                  <select
                    name="offerId"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                  >
                    <option value="1">Descuento Directo</option>
                    <option value="2">Promoción Especial</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="isFeatured"
                    name="isFeatured"
                    class="rounded border-slate-300 text-brand-green focus:ring-brand-green h-4 w-4"
                  />
                  <label for="isFeatured" class="text-xs font-bold text-slate-600 cursor-pointer">
                    ✨ Destacado de la Semana (Jerarquizar en Home)
                  </label>
                </div>

                <div class="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="isPremiumOnly"
                    name="isPremiumOnly"
                    class="rounded border-slate-300 text-brand-green focus:ring-brand-green h-4 w-4"
                  />
                  <label for="isPremiumOnly" class="text-xs font-bold text-slate-600 cursor-pointer">
                    👑 Premium Only (Segmentación)
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={createBenefitAction.isRunning}
                class="py-3 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
              >
                {createBenefitAction.isRunning ? "Creando..." : "Crear Beneficio"}
              </button>
            </Form>
          )}

          {/* List Table of Custom benefits */}
          <div class="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table class="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th class="px-6 py-4">Título</th>
                  <th class="px-6 py-4">Resumen / Desc.</th>
                  <th class="px-6 py-4">Segmentación</th>
                  <th class="px-6 py-4">Filtros (Categoría/Ubicación)</th>
                  <th class="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-medium">
                {customBenefits.value.length === 0 ? (
                  <tr>
                    <td colSpan={5} class="px-6 py-12 text-center text-slate-400">
                      🎟️ Aún no has creado beneficios propios. Hacé clic en "Crear Beneficio" para registrar el primero.
                    </td>
                  </tr>
                ) : (
                  customBenefits.value.map((benefit) => (
                    <tr key={benefit.id} class="hover:bg-slate-50 transition-colors">
                      <td class="px-6 py-4 font-bold text-slate-800">{benefit.titulo}</td>
                      <td class="px-6 py-4 text-slate-500">{benefit.resumen}</td>
                      <td class="px-6 py-4">
                        <span
                          class={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                            benefit.isPremiumOnly
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-100"
                          }`}
                        >
                          {benefit.isPremiumOnly ? "👑 Premium" : "General"}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-slate-400">
                        Cat: {benefit.categoryId} / Loc: {benefit.locationId}
                      </td>
                      <td class="px-6 py-4 text-center">
                        <Form action={deleteBenefitAction}>
                          <input type="hidden" name="id" value={benefit.id} />
                          <button
                            type="submit"
                            class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                          >
                            <LuTrash2 class="w-4 h-4" />
                          </button>
                        </Form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: USERS --- */}
      {activeTab.value === "users" && (
        <div class="space-y-6 animate-in fade-in duration-300 text-left">
          <div>
            <h3 class="text-lg font-bold text-slate-800">Gestión de Usuarios</h3>
            <p class="text-xs text-slate-400">Administrá y promové los perfiles médicos registrados en Turso.</p>
          </div>

          {/* Users Table */}
          <div class="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table class="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th class="px-6 py-4">Nombre</th>
                  <th class="px-6 py-4">Correo</th>
                  <th class="px-6 py-4">Matrícula</th>
                  <th class="px-6 py-4">Rol Actual</th>
                  <th class="px-6 py-4 text-center">Modificar Nivel</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-medium">
                {adminUsers.value.map((userItem) => (
                  <tr key={userItem.id} class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-800">{userItem.name}</td>
                    <td class="px-6 py-4 text-slate-500">{userItem.email}</td>
                    <td class="px-6 py-4 text-slate-500 font-mono">{userItem.matricula || "S/M"}</td>
                    <td class="px-6 py-4">
                      <span
                        class={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                          userItem.role === "admin"
                            ? "bg-purple-50 text-purple-700 border-purple-100"
                            : userItem.role === "premium"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {userItem.role}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <Form action={changeUserRoleAction} class="flex items-center justify-center gap-1.5">
                        <input type="hidden" name="userId" value={userItem.id} />
                        <select
                          name="role"
                          onChange$={(e, el) => {
                            // Submits form automatically on select change
                            el.form?.requestSubmit();
                          }}
                          class="bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs p-1"
                        >
                          <option value="member" selected={userItem.role === "member"}>Member</option>
                          <option value="premium" selected={userItem.role === "premium"}>👑 Premium</option>
                          <option value="admin" selected={userItem.role === "admin"}>🛡️ Admin</option>
                        </select>
                      </Form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: AUDITORIA CHATS --- */}
      {activeTab.value === "audit" && (
        <div class="space-y-6 animate-in fade-in duration-300 text-left">
          <div>
            <h2 class="text-lg font-bold text-slate-800">Historial de Conversaciones Auditadas</h2>
            <p class="text-xs text-slate-400">Revisá las consultas de los profesionales agremiados con la IA.</p>
          </div>

          <div class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table class="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th class="px-6 py-4">Sesión ID</th>
                  <th class="px-6 py-4">Iniciada</th>
                  <th class="px-6 py-4">Última Actividad</th>
                  <th class="px-6 py-4 text-center">Interacciones</th>
                  <th class="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 font-medium">
                {sessionsLoader.value.length === 0 ? (
                  <tr>
                    <td colSpan={5} class="px-6 py-10 text-center text-slate-400">
                      Aún no hay conversaciones registradas en la base de datos.
                    </td>
                  </tr>
                ) : (
                  sessionsLoader.value.map((session) => (
                    <tr key={session.id} class="hover:bg-slate-50 transition-colors">
                      <td class="px-6 py-4 font-mono text-xs text-[#0a442a] font-bold truncate max-w-[120px]">
                        <Link href={`/admin/chats/${session.id}`} class="hover:underline">
                          {session.id}
                        </Link>
                      </td>
                      <td class="px-6 py-4 text-slate-500">
                        {new Date(session.createdAt).toLocaleDateString("es-AR")}{" "}
                        {new Date(session.createdAt).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td class="px-6 py-4 text-slate-500">
                        {new Date(session.lastActive).toLocaleDateString("es-AR")}{" "}
                        {new Date(session.lastActive).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td class="px-6 py-4 text-center">
                        <span class="inline-flex h-5 items-center justify-center rounded-full bg-emerald-50 border border-emerald-150 px-2.5 text-[10px] font-bold text-emerald-800">
                          {session.messageCount}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center space-x-2">
                          <Link
                            href={`/admin/chats/${session.id}`}
                            class="px-3 py-1.5 bg-slate-100 hover:bg-[#0a442a] hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-all"
                          >
                            Auditar
                          </Link>
                          <Form action={deleteAction}>
                            <input type="hidden" name="id" value={session.id} />
                            <button
                              type="submit"
                              class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                            >
                              <LuTrash2 class="w-4 h-4" />
                            </button>
                          </Form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: PERSONALIDAD IA --- */}
      {activeTab.value === "config" && (
        <div class="space-y-6 animate-in fade-in duration-300 text-left">
          {aiSettingsAction.value?.success && (
            <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm">
              ✓ Configuración de personalidad de IA guardada exitosamente.
            </div>
          )}

          <Form action={aiSettingsAction} enctype="multipart/form-data" class="space-y-8">
            <input type="hidden" name="aiAvatarUrl" value={avatarUrl.value} />
            
            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div class="flex items-center justify-between border-b border-slate-100 bg-brand-green px-8 py-5 text-white">
                <div>
                  <h2 class="flex items-center gap-2 text-lg font-display font-extrabold text-brand-gold">
                    🤖 AMP+ Asistente Virtual
                  </h2>
                  <p class="text-[10px] font-bold tracking-wider text-slate-200 uppercase mt-0.5">
                    Definición de personalidad, avatar y reglas de la IA.
                  </p>
                </div>
              </div>

              <div class="p-8 space-y-6">
                <div class="flex items-center justify-between border-b border-slate-100 pb-5">
                  <div class="space-y-0.5">
                    <span class="text-xs font-bold text-slate-800 uppercase tracking-wider block">Chatbot de IA Activo</span>
                    <span class="text-[11px] text-slate-400 font-semibold">Habilitá o deshabilitá el asistente virtual flotante.</span>
                  </div>
                  <input
                    type="checkbox"
                    name="aiEnabled"
                    checked={s.aiEnabled}
                    class="rounded border-slate-300 text-brand-green focus:ring-brand-green h-4 w-4"
                  />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Avatar del Asistente</label>
                    <div class="flex items-center gap-4">
                      <div class="w-14 h-14 bg-slate-150 rounded-full border-2 border-slate-250 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {previewUrl.value ? (
                          <img src={previewUrl.value} alt="Preview" width={56} height={56} class="w-full h-full object-cover" />
                        ) : avatarUrl.value ? (
                          <img src={avatarUrl.value} alt="Avatar" width={56} height={56} class="w-full h-full object-cover" />
                        ) : (
                          <span class="text-2xl">🤖</span>
                        )}
                      </div>
                      <label class="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-extrabold rounded-full transition-all cursor-pointer flex items-center gap-1.5 shadow-sm">
                        <LuImage class="w-4 h-4" />
                        Subir Archivo
                        <input
                          type="file"
                          name="image"
                          accept="image/*"
                          onChange$={handleFileChange}
                          class="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Teléfono WhatsApp de Consulta</label>
                    <input
                      type="text"
                      name="whatsappNumber"
                      value={s.whatsappNumber || "542214391300"}
                      class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tono del Asistente</label>
                  <input
                    type="text"
                    name="aiTone"
                    value={s.aiTone || ""}
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Instrucciones Operativas</label>
                  <textarea
                    name="aiInstructions"
                    rows={4}
                    value={s.aiInstructions || ""}
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Base de Conocimientos</label>
                  <textarea
                    name="aiKnowledge"
                    rows={4}
                    value={s.aiKnowledge || ""}
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Saludo Inicial</label>
                    <textarea
                      name="aiInitialGreeting"
                      rows={2}
                      value={s.aiInitialGreeting || ""}
                      class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                    />
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Llamado a la Acción</label>
                    <textarea
                      name="aiCallToAction"
                      rows={2}
                      value={s.aiCallToAction || ""}
                      class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div class="bg-slate-50 px-8 py-5 flex justify-end border-t border-slate-100">
                <button
                  type="submit"
                  disabled={aiSettingsAction.isRunning}
                  class="py-3 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
                >
                  {aiSettingsAction.isRunning ? "Guardando..." : "💾 Guardar Ajustes"}
                </button>
              </div>
            </div>
          </Form>
        </div>
      )}

    </div>
  );
});

export const head: DocumentHead = {
  title: "Gestión Administrativa - Portal de Beneficios AMP",
  meta: [
    {
      name: "description",
      content: "Panel de administración exclusivo de la Agremiación Médica Platense.",
    },
  ],
};
