import { component$, useSignal, useStore, $, useTask$ } from "@builder.io/qwik";
import { put } from "@vercel/blob";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { 
  LuPlus, 
  LuImage, 
  LuTrash2, 
  LuSparkles, 
  LuPencil, 
  LuEye, 
  LuEyeOff, 
  LuMonitor, 
  LuSmartphone, 
  LuMove,
  LuCheck,
  LuX
} from "@qwikest/icons/lucide";
import { asc, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { heroSlides as heroSlidesTable } from "~/db/schema";
import { ensureHeroSlidesSeeded } from "~/server/cache";
import { ImageFramePreview } from "~/components/image-frame-preview/image-frame-preview";

// Relaciones de aspecto REALES del render del hero (ver hero-slider.tsx):
// desktop 1600×646 (panorámico ~2.48:1) y mobile 480×600 (vertical 4:5).
// Las usamos también para la previsualización con recorte (ImageFramePreview),
// así lo que el admin ve encuadrado coincide con lo que se publica.
const RATIO_DESKTOP = 1600 / 646;
const RATIO_MOBILE = 4 / 5;
// Textos de ayuda por tipo de imagen (tamaño recomendado, formatos, peso).
const HELP_DESKTOP = "Recomendado 2560×1035px (panorámico ~2.48:1) · JPG, PNG o WebP · hasta ~2 MB";
const HELP_MOBILE = "Recomendado 1080×1350px (vertical 4:5) · JPG, PNG o WebP · hasta ~2 MB";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

// --- SECURITY & LOADERS ---

export const useAdminSlidesLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    await ensureHeroSlidesSeeded(db);
    return await db.select().from(heroSlidesTable).orderBy(asc(heroSlidesTable.orderIndex));
  } catch (err) {
    console.error("Failed to load hero slides:", err);
    return [];
  }
});

// --- ACTIONS ---

export const useCreateSlideAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const uuid = "slide-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();

      let uploadedDesktopUrl = data.imageUrl || "";
      let uploadedMobileUrl = data.imageMobileUrl || "";

      const token = process.env.BLOB_READ_WRITE_TOKEN || requestEvent.env.get("BLOB_READ_WRITE_TOKEN");

      // Handle Desktop Image
      if (data.imageDesktop && typeof data.imageDesktop === "object" && (data.imageDesktop as Blob).size > 0) {
        const file = data.imageDesktop as File;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const extension = file.name.split(".").pop() || "png";
        const fileName = `slide-desk-${Date.now()}.${extension}`;
        
        let isBlob = false;
        if (token) {
          try {
            const blob = await put(fileName, file, { access: "public", token });
            uploadedDesktopUrl = blob.url;
            isBlob = true;
          } catch (e) {
            console.error("Vercel Blob failed, fallback to fs", e);
          }
        }

        if (!isBlob) {
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, buffer);
          uploadedDesktopUrl = `/uploads/${fileName}`;
        }
      }

      // Handle Mobile Image
      if (data.imageMobile && typeof data.imageMobile === "object" && (data.imageMobile as Blob).size > 0) {
        const file = data.imageMobile as File;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const extension = file.name.split(".").pop() || "png";
        const fileName = `slide-mob-${Date.now()}.${extension}`;
        
        let isBlob = false;
        if (token) {
          try {
            const blob = await put(fileName, file, { access: "public", token });
            uploadedMobileUrl = blob.url;
            isBlob = true;
          } catch (e) {
            console.error("Vercel Blob failed, fallback to fs", e);
          }
        }

        if (!isBlob) {
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, buffer);
          uploadedMobileUrl = `/uploads/${fileName}`;
        }
      }

      if (!uploadedDesktopUrl) {
        return requestEvent.fail(400, { message: "Debe proporcionar una imagen desktop o subir un archivo." });
      }

      await db.insert(heroSlidesTable).values({
        id: uuid,
        imageUrl: uploadedDesktopUrl,
        imageMobile: uploadedMobileUrl || uploadedDesktopUrl,
        title: data.title,
        preTitle: data.preTitle || "Exclusivo AMP+",
        subtitle: data.subtitle,
        buttonText: data.buttonText || "Explorar",
        buttonLink: data.buttonLink || "/",
        orderIndex: Number(data.orderIndex || 0),
        isActive: data.isActive === "on" ? 1 : 0,
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (err: any) {
      console.error("Create slide error:", err);
      return requestEvent.fail(500, { message: err.message || "Error al crear el slide." });
    }
  },
  zod$({
    preTitle: z.string().optional(),
    title: z.string().min(2, "El título debe tener al menos 2 caracteres."),
    subtitle: z.string().min(2, "El subtítulo debe tener al menos 2 caracteres."),
    buttonText: z.string().optional(),
    buttonLink: z.string().optional(),
    imageUrl: z.string().optional(),
    imageMobileUrl: z.string().optional(),
    orderIndex: z.string().optional(),
    isActive: z.string().optional(),
    imageDesktop: z.any().optional(),
    imageMobile: z.any().optional(),
  })
);

export const useUpdateSlideAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const id = data.id as string;
      const existing = await db.select().from(heroSlidesTable).where(eq(heroSlidesTable.id, id)).limit(1);
      if (existing.length === 0) return requestEvent.fail(404, { message: "Slide no encontrado." });

      let uploadedDesktopUrl = data.imageUrl || existing[0].imageUrl;
      let uploadedMobileUrl = data.imageMobileUrl || existing[0].imageMobile || "";

      const token = process.env.BLOB_READ_WRITE_TOKEN || requestEvent.env.get("BLOB_READ_WRITE_TOKEN");

      // Handle Desktop Image
      if (data.imageDesktop && typeof data.imageDesktop === "object" && (data.imageDesktop as Blob).size > 0) {
        const file = data.imageDesktop as File;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const extension = file.name.split(".").pop() || "png";
        const fileName = `slide-desk-${Date.now()}.${extension}`;

        let isBlob = false;
        if (token) {
          try {
            const blob = await put(fileName, file, { access: "public", token });
            uploadedDesktopUrl = blob.url;
            isBlob = true;
          } catch (e) {
            console.error("Vercel Blob failed, fallback to fs", e);
          }
        }

        if (!isBlob) {
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, buffer);
          uploadedDesktopUrl = `/uploads/${fileName}`;
        }
      }

      // Handle Mobile Image
      if (data.imageMobile && typeof data.imageMobile === "object" && (data.imageMobile as Blob).size > 0) {
        const file = data.imageMobile as File;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const extension = file.name.split(".").pop() || "png";
        const fileName = `slide-mob-${Date.now()}.${extension}`;

        let isBlob = false;
        if (token) {
          try {
            const blob = await put(fileName, file, { access: "public", token });
            uploadedMobileUrl = blob.url;
            isBlob = true;
          } catch (e) {
            console.error("Vercel Blob failed, fallback to fs", e);
          }
        }

        if (!isBlob) {
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, buffer);
          uploadedMobileUrl = `/uploads/${fileName}`;
        }
      }

      await db.update(heroSlidesTable).set({
        imageUrl: uploadedDesktopUrl,
        imageMobile: uploadedMobileUrl || uploadedDesktopUrl,
        title: data.title,
        preTitle: data.preTitle || "Exclusivo AMP+",
        subtitle: data.subtitle,
        buttonText: data.buttonText || "Explorar",
        buttonLink: data.buttonLink || "/",
        orderIndex: Number(data.orderIndex || 0),
        isActive: data.isActive === "on" ? 1 : 0,
      }).where(eq(heroSlidesTable.id, id));

      return { success: true };
    } catch (err: any) {
      console.error("Update slide error:", err);
      return requestEvent.fail(500, { message: err.message || "Error al actualizar el slide." });
    }
  },
  zod$({
    id: z.string(),
    preTitle: z.string().optional(),
    title: z.string().min(2, "El título debe tener al menos 2 caracteres."),
    subtitle: z.string().min(2, "El subtítulo debe tener al menos 2 caracteres."),
    buttonText: z.string().optional(),
    buttonLink: z.string().optional(),
    imageUrl: z.string().optional(),
    imageMobileUrl: z.string().optional(),
    orderIndex: z.string().optional(),
    isActive: z.string().optional(),
    imageDesktop: z.any().optional(),
    imageMobile: z.any().optional(),
  })
);

export const useDeleteSlideAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      await db.delete(heroSlidesTable).where(eq(heroSlidesTable.id, data.id));
      return { success: true };
    } catch (err: any) {
      console.error("Delete slide error:", err);
      return requestEvent.fail(500, { message: "Error al eliminar el slide." });
    }
  },
  zod$({
    id: z.string(),
  })
);

export const useToggleActiveAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const id = data.id as string;
      const current = await db.select().from(heroSlidesTable).where(eq(heroSlidesTable.id, id)).limit(1);
      if (current.length === 0) return requestEvent.fail(404, { message: "Slide no encontrado." });

      const newActive = current[0].isActive === 1 ? 0 : 1;
      await db.update(heroSlidesTable).set({ isActive: newActive }).where(eq(heroSlidesTable.id, id));
      return { success: true, isActive: newActive };
    } catch (err: any) {
      console.error("Toggle active error:", err);
      return requestEvent.fail(500, { message: "Error al cambiar estado." });
    }
  },
  zod$({
    id: z.string(),
  })
);

export const useReorderSlidesAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const ids = data.ids as string[];
      for (let i = 0; i < ids.length; i++) {
        await db.update(heroSlidesTable).set({ orderIndex: i + 1 }).where(eq(heroSlidesTable.id, ids[i]));
      }
      return { success: true };
    } catch (err: any) {
      console.error("Reorder error:", err);
      return requestEvent.fail(500, { message: "Error al reordenar slides." });
    }
  },
  zod$({
    ids: z.array(z.string()),
  })
);

export default component$(() => {
  const slidesLoader = useAdminSlidesLoader();
  const createSlideAction = useCreateSlideAction();
  const updateSlideAction = useUpdateSlideAction();
  const deleteSlideAction = useDeleteSlideAction();
  const toggleActiveAction = useToggleActiveAction();
  const reorderSlidesAction = useReorderSlidesAction();

  const isCreateSlideOpen = useSignal(false);
  
  // Drag and Drop Uploader State (Creation Form)
  const desktopPreview = useSignal<string | null>(null);
  const mobilePreview = useSignal<string | null>(null);
  const desktopInputRef = useSignal<HTMLInputElement | undefined>(undefined);
  const mobileInputRef = useSignal<HTMLInputElement | undefined>(undefined);
  const isDragOverDesktop = useSignal(false);
  const isDragOverMobile = useSignal(false);

  // Textos en vivo para la miniatura WYSIWYG del hero (form de creación).
  const createPreTitle = useSignal("");
  const createTitle = useSignal("");
  const createSubtitle = useSignal("");
  const createBtnText = useSignal("Explorar");

  // Drag and Drop Uploader State (Edition Form Modal)
  const editingSlide = useSignal<any | null>(null);
  const editDesktopPreview = useSignal<string | null>(null);
  const editMobilePreview = useSignal<string | null>(null);
  const editDesktopInputRef = useSignal<HTMLInputElement | undefined>(undefined);
  const editMobileInputRef = useSignal<HTMLInputElement | undefined>(undefined);
  const isDragOverEditDesktop = useSignal(false);
  const isDragOverEditMobile = useSignal(false);
  // Textos en vivo para la miniatura WYSIWYG del hero (modal de edición).
  const editPreTitle = useSignal("");
  const editTitle = useSignal("");
  const editSubtitle = useSignal("");
  const editBtnText = useSignal("");

  // Client-side Visual Array of Slides for HTML5 Drag & Drop sorting
  const localSlides = useStore<{ list: any[] }>({ list: [] });
  useTask$(({ track }) => {
    track(() => slidesLoader.value);
    localSlides.list = [...slidesLoader.value];
  });

  // HTML5 Drag & Drop Card indices tracking
  const draggedIdx = useSignal<number | null>(null);
  const draggedOverIdx = useSignal<number | null>(null);

  // File Upload Handlers (Standard change events)
  const handleFileChange = $((event: Event, target: "desktop" | "mobile" | "edit-desktop" | "edit-mobile") => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const previewUrl = URL.createObjectURL(file);

    if (target === "desktop") {
      desktopPreview.value = previewUrl;
    } else if (target === "mobile") {
      mobilePreview.value = previewUrl;
    } else if (target === "edit-desktop") {
      editDesktopPreview.value = previewUrl;
    } else if (target === "edit-mobile") {
      editMobilePreview.value = previewUrl;
    }
  });

  // Drop Event Handlers
  const handleDrop = $((event: DragEvent, target: "desktop" | "mobile" | "edit-desktop" | "edit-mobile") => {
    if (!event.dataTransfer || event.dataTransfer.files.length === 0) return;
    const file = event.dataTransfer.files[0];
    if (!file.type.startsWith("image/")) return;

    const previewUrl = URL.createObjectURL(file);

    if (target === "desktop") {
      isDragOverDesktop.value = false;
      desktopPreview.value = previewUrl;
      if (desktopInputRef.value) desktopInputRef.value.files = event.dataTransfer.files;
    } else if (target === "mobile") {
      isDragOverMobile.value = false;
      mobilePreview.value = previewUrl;
      if (mobileInputRef.value) mobileInputRef.value.files = event.dataTransfer.files;
    } else if (target === "edit-desktop") {
      isDragOverEditDesktop.value = false;
      editDesktopPreview.value = previewUrl;
      if (editDesktopInputRef.value) editDesktopInputRef.value.files = event.dataTransfer.files;
    } else if (target === "edit-mobile") {
      isDragOverEditMobile.value = false;
      editMobilePreview.value = previewUrl;
      if (editMobileInputRef.value) editMobileInputRef.value.files = event.dataTransfer.files;
    }
  });

  // Reset form visual previews
  const resetPreviews = $(() => {
    desktopPreview.value = null;
    mobilePreview.value = null;
    if (desktopInputRef.value) desktopInputRef.value.value = "";
    if (mobileInputRef.value) mobileInputRef.value.value = "";
  });

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto bg-slate-50/50">
      {/* SaaS Dashboard layout header */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              Administración / Personalización
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Carrusel Hero Promocional
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Modificá de forma dinámica las imágenes, etiquetas superiores, títulos, subtítulos y enlaces del carrusel de la página principal.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick$={() => {
              isCreateSlideOpen.value = !isCreateSlideOpen.value;
              resetPreviews();
            }}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <LuPlus class="w-4 h-4" />
            <span>{isCreateSlideOpen.value ? "Cerrar Panel" : "Añadir Slide"}</span>
          </button>
        </div>
      </div>

      <div class="space-y-8 animate-in fade-in duration-300 text-left">
        {/* Action feedback alerts */}
        {createSlideAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-bounce">
            ✓ Slide promocional agregado exitosamente al carrusel principal.
          </div>
        )}
        {updateSlideAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-bounce">
            ✓ Slide promocional actualizado exitosamente.
          </div>
        )}

        {/* Form panel with double column optimized layout */}
        {isCreateSlideOpen.value && (
          <Form
            action={createSlideAction}
            enctype="multipart/form-data"
            onSubmit$={resetPreviews}
            class="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-md grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-top-6 duration-300"
          >
            {/* Left Column: Metadata fields */}
            <div class="space-y-5">
              <div class="border-b border-slate-100 pb-3">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <LuSparkles class="w-4 h-4 text-brand-gold fill-brand-gold animate-pulse" />
                  Información Textual del Slide
                </h4>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Etiqueta Superior (Pre-Título)</label>
                  <input
                    type="text"
                    name="preTitle"
                    bind:value={createPreTitle}
                    placeholder="Ej: La Plata y City Bell"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-medium"
                  />
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Orden de Visualización</label>
                  <input
                    type="number"
                    name="orderIndex"
                    value={localSlides.list.length + 1}
                    min="1"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Título Principal</label>
                <input
                  type="text"
                  name="title"
                  required
                  bind:value={createTitle}
                  placeholder="Ej: Temporada de Invierno AMP+"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-bold"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Descripción (Subtítulo)</label>
                <textarea
                  name="subtitle"
                  required
                  rows={2}
                  bind:value={createSubtitle}
                  placeholder="Ej: Presentá tu credencial digital y disfrutá de los mejores descuentos..."
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-medium"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Texto del Botón</label>
                  <input
                    type="text"
                    name="buttonText"
                    bind:value={createBtnText}
                    placeholder="Explorar"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-semibold"
                  />
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Enlace de Redirección (URL)</label>
                  <input
                    type="text"
                    name="buttonLink"
                    placeholder="/beneficios"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div class="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div class="space-y-0.5">
                  <span class="text-xs font-bold text-slate-700 uppercase tracking-wider block">Activar Slide Inmediatamente</span>
                  <span class="text-[10px] text-slate-400 font-semibold">Desmarcar para guardar como borrador oculto.</span>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="isActive" checked={true} class="sr-only peer" />
                  <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
                </label>
              </div>
            </div>

            {/* Right Column: Interactive Image Uploader Zones */}
            <div class="space-y-5">
              <div class="border-b border-slate-100 pb-3">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <LuImage class="w-4 h-4 text-brand-green" />
                  Multimedia & Adaptabilidad Móvil
                </h4>
              </div>

              {/* Desktop Upload Zone (panorámico ~2.48:1, igual que el hero real) */}
              <div class="space-y-2">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Imagen Horizontal Desktop (panorámico ~2.48:1)</span>
                <div
                  preventdefault:dragover={true}
                  onDragOver$={() => {
                    isDragOverDesktop.value = true;
                  }}
                  onDragLeave$={() => (isDragOverDesktop.value = false)}
                  onDrop$={$(ev => handleDrop(ev, "desktop"))}
                  class={[
                    "relative group aspect-[1600/646] w-full rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden flex flex-col items-center justify-center p-4 cursor-pointer text-center",
                    isDragOverDesktop.value
                      ? "border-brand-green bg-emerald-50/50 scale-[1.01]"
                      : "border-slate-250 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400",
                  ]}
                  onClick$={() => desktopInputRef.value?.click()}
                >
                  <input
                    type="file"
                    name="imageDesktop"
                    accept="image/*"
                    ref={desktopInputRef}
                    onChange$={(ev) => handleFileChange(ev, "desktop")}
                    stoppropagation:click={true}
                    class="hidden"
                  />

                  {desktopPreview.value ? (
                    <>
                      <ImageFramePreview src={desktopPreview.value} targetRatio={RATIO_DESKTOP} preTitle={createPreTitle.value} title={createTitle.value} subtitle={createSubtitle.value} buttonText={createBtnText.value} />
                      <div class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2 z-30 backdrop-blur-xs">
                        <LuImage class="w-5 h-5" />
                        Reemplazar Imagen Desktop
                      </div>
                    </>
                  ) : (
                    <div class="flex flex-col items-center gap-2 text-slate-450 z-10">
                      <LuMonitor class="w-10 h-10 text-slate-400 stroke-1 group-hover:scale-110 transition-transform duration-300" />
                      <div class="text-xs font-bold text-slate-650">Arrastrá la imagen desktop aquí</div>
                      <div class="text-[10px] text-slate-400 font-semibold">Aspecto panorámico ~2.48:1 (marco real de la vista)</div>
                      <span class="inline-flex px-3 py-1 bg-white border border-slate-200 text-slate-650 text-[10px] font-black uppercase rounded-full shadow-xs mt-1">
                        Buscar Archivo
                      </span>
                    </div>
                  )}
                </div>
                <p class="text-[10px] text-slate-400 font-semibold">{HELP_DESKTOP}</p>
                <input
                  type="text"
                  name="imageUrl"
                  placeholder="Ó ingresá URL de Imagen Desktop Externa"
                  class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-medium font-mono"
                />
              </div>

              {/* Mobile Upload Zone (vertical 4:5, igual que el hero real) */}
              <div class="space-y-2">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Imagen Vertical Mobile (4:5)</span>
                <div
                  preventdefault:dragover={true}
                  onDragOver$={() => {
                    isDragOverMobile.value = true;
                  }}
                  onDragLeave$={() => (isDragOverMobile.value = false)}
                  onDrop$={$(ev => handleDrop(ev, "mobile"))}
                  class={[
                    "relative group aspect-[4/5] w-full max-w-[220px] mx-auto rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden flex flex-col items-center justify-center p-4 cursor-pointer text-center",
                    isDragOverMobile.value
                      ? "border-brand-green bg-emerald-50/50 scale-[1.01]"
                      : "border-slate-250 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400",
                  ]}
                  onClick$={() => mobileInputRef.value?.click()}
                >
                  <input
                    type="file"
                    name="imageMobile"
                    accept="image/*"
                    ref={mobileInputRef}
                    onChange$={(ev) => handleFileChange(ev, "mobile")}
                    stoppropagation:click={true}
                    class="hidden"
                  />

                  {mobilePreview.value ? (
                    <>
                      <ImageFramePreview src={mobilePreview.value} targetRatio={RATIO_MOBILE} preTitle={createPreTitle.value} title={createTitle.value} subtitle={createSubtitle.value} buttonText={createBtnText.value} />
                      <div class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2 z-30 backdrop-blur-xs">
                        <LuImage class="w-5 h-5" />
                        Reemplazar Imagen Mobile
                      </div>
                    </>
                  ) : (
                    <div class="flex flex-col items-center gap-2 text-slate-400 z-10">
                      <LuSmartphone class="w-10 h-10 text-slate-400 stroke-1 group-hover:scale-110 transition-transform duration-300" />
                      <div class="text-xs font-bold text-slate-650">Arrastrá la imagen mobile aquí</div>
                      <div class="text-[10px] text-slate-400 font-semibold">Aspecto 4:5 (marco real de la vista)</div>
                      <span class="inline-flex px-3 py-1 bg-white border border-slate-200 text-slate-650 text-[10px] font-black uppercase rounded-full shadow-xs mt-1">
                        Buscar Archivo
                      </span>
                    </div>
                  )}
                </div>
                <p class="text-[10px] text-slate-400 font-semibold text-center">{HELP_MOBILE}</p>
                <input
                  type="text"
                  name="imageMobileUrl"
                  placeholder="Ó ingresá URL de Imagen Mobile Externa"
                  class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-medium font-mono"
                />
              </div>
            </div>

            {/* Bottom Actions Row spanning 2 columns */}
            <div class="lg:col-span-2 bg-slate-50 p-5 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 flex justify-end border-t border-slate-150 gap-3">
              <button
                type="button"
                onClick$={() => {
                  isCreateSlideOpen.value = false;
                  resetPreviews();
                }}
                class="px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={createSlideAction.isRunning}
                class="px-6 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95"
              >
                {createSlideAction.isRunning ? "Registrando..." : "💾 Registrar Slide"}
              </button>
            </div>
          </Form>
        )}

        {/* Drag & Drop Visual Deck Info Badge */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl gap-3 text-slate-600 font-medium">
          <div class="flex items-center gap-2 text-xs text-left">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-gold text-brand-green-dark text-[10px] font-black">!</span>
            <span>
              <strong>Ordenamiento Visual Nativo</strong>: Arrastrá y soltá las tarjetas para reordenarlas de forma inmediata. El sistema sincronizará los cambios automáticamente.
            </span>
          </div>
          {reorderSlidesAction.isRunning && (
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-brand-green text-[10px] font-bold uppercase tracking-wide rounded-full animate-pulse">
              Sincronizando orden...
            </span>
          )}
        </div>

        {/* Visual Slide Deck Preview Grid (Draggable Cards) */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {localSlides.list.length === 0 ? (
            <div class="col-span-full h-64 border-2 border-dashed border-slate-250 rounded-3xl flex flex-col items-center justify-center text-slate-450 gap-2 font-medium">
              <span>🎠 No hay slides promocionales configurados en el sistema.</span>
            </div>
          ) : (
            localSlides.list.map((slide, idx) => {
              const isDragged = idx === draggedIdx.value;
              const isOver = idx === draggedOverIdx.value;
              return (
                <div
                  key={slide.id}
                  draggable={true}
                  preventdefault:dragover={true}
                  onDragStart$={(ev) => {
                    draggedIdx.value = idx;
                    if (ev.dataTransfer) {
                      ev.dataTransfer.effectAllowed = "move";
                    }
                  }}
                  onDragOver$={() => {
                    draggedOverIdx.value = idx;
                  }}
                  onDrop$={$(() => {
                    if (draggedIdx.value === null || draggedOverIdx.value === null) return;
                    if (draggedIdx.value === draggedOverIdx.value) return;

                    const items = [...localSlides.list];
                    const [draggedItem] = items.splice(draggedIdx.value, 1);
                    items.splice(draggedOverIdx.value, 0, draggedItem);

                    localSlides.list = items;

                    // Bulk reorder update action on server
                    reorderSlidesAction.submit({ ids: items.map((x) => x.id) });

                    draggedIdx.value = null;
                    draggedOverIdx.value = null;
                  })}
                  onDragEnd$={() => {
                    draggedIdx.value = null;
                    draggedOverIdx.value = null;
                  }}
                  class={[
                    "bg-white rounded-3xl border overflow-hidden shadow-sm flex flex-col group hover:shadow-md transition-all duration-300 relative",
                    isDragged ? "opacity-35 scale-95 border-brand-green border-dashed border-2" : "border-slate-200",
                    isOver && !isDragged ? "border-brand-gold border-dashed border-2 scale-[1.02]" : "",
                  ]}
                >
                  {/* Drag Handle Overlay bar */}
                  <div class="absolute top-2 left-2 z-20 opacity-40 group-hover:opacity-150 transition-opacity bg-black/55 backdrop-blur-xs p-1.5 rounded-lg cursor-grab active:cursor-grabbing text-white" title="Arrastrar para reordenar">
                    <LuMove class="w-3.5 h-3.5" />
                  </div>

                  {/* Header Badges */}
                  <div class="absolute top-2 right-2 z-20 flex gap-1.5 items-center">
                    <span class={[
                      "inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase backdrop-blur-md shadow-xs border text-white",
                      slide.isActive === 1 
                        ? "bg-emerald-500/80 border-emerald-400" 
                        : "bg-red-500/80 border-red-400"
                    ]}>
                      {slide.isActive === 1 ? "Activo" : "Borrador"}
                    </span>
                  </div>

                  {/* Background Desktop image mockup overlay */}
                  <div class="h-44 bg-slate-900 relative overflow-hidden flex items-center justify-center select-none border-b border-slate-100">
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      class="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                      width={320}
                      height={160}
                    />
                    
                    {/* Shadow overlay gradient */}
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent flex flex-col justify-end p-4 text-left">
                      <span class="text-[9px] font-black uppercase text-brand-gold tracking-widest mb-0.5 inline-flex items-center gap-1">
                        <LuSparkles class="w-2.5 h-2.5 text-brand-gold fill-brand-gold animate-pulse" />
                        {slide.preTitle || "Exclusivo AMP+"}
                      </span>
                      <h3 class="text-sm font-black text-white leading-tight font-display">{slide.title}</h3>
                      <p class="text-[10px] text-slate-200 line-clamp-1 mt-0.5">{slide.subtitle}</p>
                    </div>
                  </div>

                  {/* Body actions row */}
                  <div class="p-4 flex-grow flex flex-col justify-between text-left space-y-4 bg-white">
                    <div class="text-[10px] font-bold text-slate-500 space-y-1">
                      <div>
                        <span class="uppercase tracking-widest text-slate-400">Texto Botón:</span>{" "}
                        <span class="text-slate-700 font-semibold">{slide.buttonText || "Explorar"}</span>
                      </div>
                      <div class="truncate">
                        <span class="uppercase tracking-widest text-slate-400">Link Destino:</span>{" "}
                        <span class="text-slate-700 font-semibold font-mono">{slide.buttonLink || "/"}</span>
                      </div>
                      {slide.imageMobile && (
                        <div class="truncate flex items-center gap-1 mt-1 text-[9px] text-emerald-700 font-black">
                          <LuSmartphone class="w-3 h-3" />
                          Tiene Imagen Mobile
                        </div>
                      )}
                    </div>

                    {/* Premium action buttons suite */}
                    <div class="flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
                      <span class="text-[10px] font-bold text-slate-400 font-mono">
                        #{slide.orderIndex || idx + 1}
                      </span>
                      <div class="flex items-center gap-1.5">
                        {/* Edit Button */}
                        <button
                          onClick$={() => {
                            editingSlide.value = slide;
                            editDesktopPreview.value = slide.imageUrl;
                            editMobilePreview.value = slide.imageMobile || slide.imageUrl;
                            editPreTitle.value = slide.preTitle || "";
                            editTitle.value = slide.title || "";
                            editSubtitle.value = slide.subtitle || "";
                            editBtnText.value = slide.buttonText || "";
                          }}
                          class="p-2 text-slate-650 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full border border-slate-200/60 shadow-xs transition-all cursor-pointer active:scale-90"
                          title="Editar Slide"
                        >
                          <LuPencil class="w-3.5 h-3.5" />
                        </button>

                        {/* Visibility Toggle Button */}
                        <Form action={toggleActiveAction}>
                          <input type="hidden" name="id" value={slide.id} />
                          <button
                            type="submit"
                            class={[
                              "p-2 rounded-full border shadow-xs transition-all cursor-pointer active:scale-90",
                              slide.isActive === 1 
                                ? "text-emerald-650 hover:text-emerald-800 bg-emerald-50 border-emerald-100 hover:bg-emerald-100" 
                                : "text-slate-450 hover:text-slate-600 bg-slate-50 border-slate-200/60 hover:bg-slate-100"
                            ]}
                            title={slide.isActive === 1 ? "Desactivar (Ocultar)" : "Activar (Mostrar)"}
                          >
                            {slide.isActive === 1 ? <LuEye class="w-3.5 h-3.5" /> : <LuEyeOff class="w-3.5 h-3.5" />}
                          </button>
                        </Form>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick$={$(async () => {
                            if (confirm(`¿Eliminar el slide "${slide.title}"? Esta acción no se puede deshacer.`)) {
                              await deleteSlideAction.submit({ id: slide.id });
                            }
                          })}
                          class="p-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-full border border-red-100 shadow-xs transition-all cursor-pointer active:scale-90"
                          title="Eliminar Slide"
                        >
                          <LuTrash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Editing Slide Modal Overlay */}
      {editingSlide.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-300">
          <div class="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div class="bg-brand-green text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 class="font-display font-extrabold text-base text-brand-gold flex items-center gap-1.5">
                  <LuPencil class="w-4 h-4" />
                  Editar Slide Promocional
                </h3>
                <p class="text-[10px] text-slate-200 uppercase tracking-wider font-semibold">
                  Slide ID: {editingSlide.value.id}
                </p>
              </div>
              <button
                onClick$={() => {
                  editingSlide.value = null;
                  editDesktopPreview.value = null;
                  editMobilePreview.value = null;
                }}
                class="p-1 text-slate-200 hover:text-white rounded-full transition-colors cursor-pointer"
              >
                <LuX class="w-6 h-6" />
              </button>
            </div>

            {/* Modal Scrollable Content Form */}
            <Form
              action={updateSlideAction}
              enctype="multipart/form-data"
              onSubmit$={() => {
                editingSlide.value = null;
                editDesktopPreview.value = null;
                editMobilePreview.value = null;
              }}
              class="flex flex-col flex-1 min-h-0"
            >
              <input type="hidden" name="id" value={editingSlide.value.id} />

              {/* Contenido scrolleable: solo esto scrollea, el footer queda fijo. */}
              <div class="flex-1 overflow-y-auto p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
              {/* Modal Left Col: Metadata fields */}
              <div class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Etiqueta Superior</label>
                    <input
                      type="text"
                      name="preTitle"
                      bind:value={editPreTitle}
                      placeholder="Ej: Exclusivo AMP+"
                      class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-semibold"
                    />
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Orden de Visualización</label>
                    <input
                      type="number"
                      name="orderIndex"
                      value={editingSlide.value.orderIndex}
                      min="1"
                      class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-semibold"
                    />
                  </div>
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Título Principal</label>
                  <input
                    type="text"
                    name="title"
                    required
                    bind:value={editTitle}
                    placeholder="Ej: Temporada de Invierno"
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-extrabold"
                  />
                </div>

                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Descripción (Subtítulo)</label>
                  <textarea
                    name="subtitle"
                    required
                    rows={2}
                    bind:value={editSubtitle}
                    placeholder="Ej: Descuentos increíbles..."
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-semibold"
                  />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Texto del Botón</label>
                    <input
                      type="text"
                      name="buttonText"
                      bind:value={editBtnText}
                      placeholder="Explorar"
                      class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-bold"
                    />
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Enlace del Botón</label>
                    <input
                      type="text"
                      name="buttonLink"
                      value={editingSlide.value.buttonLink || ""}
                      placeholder="/"
                      class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                <div class="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div class="space-y-0.5">
                    <span class="text-xs font-bold text-slate-700 uppercase tracking-wider block">Slide Activo</span>
                    <span class="text-[10px] text-slate-400 font-semibold">Tildar para mostrar en la web inmediatamente.</span>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={editingSlide.value.isActive === 1}
                      class="sr-only peer"
                    />
                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
                  </label>
                </div>
              </div>

              {/* Modal Right Col: Multimedia & drag-drop editing zones */}
              <div class="space-y-4">
                {/* Desktop editing zone */}
                <div class="space-y-2">
                  <span class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Imagen Desktop (panorámico ~2.48:1)</span>
                  <div
                    preventdefault:dragover={true}
                    onDragOver$={() => {
                      isDragOverEditDesktop.value = true;
                    }}
                    onDragLeave$={() => (isDragOverEditDesktop.value = false)}
                    onDrop$={$(ev => handleDrop(ev, "edit-desktop"))}
                    class={[
                      "relative group aspect-[1600/646] w-full rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden flex flex-col items-center justify-center p-3 cursor-pointer text-center",
                      isDragOverEditDesktop.value
                        ? "border-brand-green bg-emerald-50/50 scale-[1.01]"
                        : "border-slate-250 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400",
                    ]}
                    onClick$={() => editDesktopInputRef.value?.click()}
                  >
                    <input
                      type="file"
                      name="imageDesktop"
                      accept="image/*"
                      ref={editDesktopInputRef}
                      onChange$={(ev) => handleFileChange(ev, "edit-desktop")}
                      stoppropagation:click={true}
                      class="hidden"
                    />

                    {editDesktopPreview.value ? (
                      <>
                        <ImageFramePreview src={editDesktopPreview.value} targetRatio={RATIO_DESKTOP} preTitle={editPreTitle.value} title={editTitle.value} subtitle={editSubtitle.value} buttonText={editBtnText.value} />
                        <div class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2 z-30 backdrop-blur-xs">
                          <LuImage class="w-4 h-4" />
                          Cambiar Imagen Desktop
                        </div>
                      </>
                    ) : (
                      <div class="flex flex-col items-center gap-1.5 text-slate-405 z-10">
                        <LuMonitor class="w-8 h-8 text-slate-400 stroke-1" />
                        <span class="text-xs font-bold text-slate-650">Soltá la nueva imagen desktop aquí</span>
                      </div>
                    )}
                  </div>
                  <p class="text-[10px] text-slate-400 font-semibold">{HELP_DESKTOP}</p>
                  <input
                    type="text"
                    name="imageUrl"
                    value={editingSlide.value.imageUrl}
                    placeholder="URL de Imagen Desktop Externa"
                    class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-mono"
                  />
                </div>

                {/* Mobile editing zone */}
                <div class="space-y-2">
                  <span class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Imagen Mobile (4:5)</span>
                  <div
                    preventdefault:dragover={true}
                    onDragOver$={() => {
                      isDragOverEditMobile.value = true;
                    }}
                    onDragLeave$={() => (isDragOverEditMobile.value = false)}
                    onDrop$={$(ev => handleDrop(ev, "edit-mobile"))}
                    class={[
                      "relative group aspect-[4/5] w-full max-w-[200px] mx-auto rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden flex flex-col items-center justify-center p-3 cursor-pointer text-center",
                      isDragOverEditMobile.value
                        ? "border-brand-green bg-emerald-50/50 scale-[1.01]"
                        : "border-slate-250 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400",
                    ]}
                    onClick$={() => editMobileInputRef.value?.click()}
                  >
                    <input
                      type="file"
                      name="imageMobile"
                      accept="image/*"
                      ref={editMobileInputRef}
                      onChange$={(ev) => handleFileChange(ev, "edit-mobile")}
                      stoppropagation:click={true}
                      class="hidden"
                    />

                    {editMobilePreview.value ? (
                      <>
                        <ImageFramePreview src={editMobilePreview.value} targetRatio={RATIO_MOBILE} preTitle={editPreTitle.value} title={editTitle.value} subtitle={editSubtitle.value} buttonText={editBtnText.value} />
                        <div class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2 z-30 backdrop-blur-xs">
                          <LuImage class="w-4 h-4" />
                          Cambiar Imagen Mobile
                        </div>
                      </>
                    ) : (
                      <div class="flex flex-col items-center gap-1.5 text-slate-400 z-10">
                        <LuSmartphone class="w-8 h-8 text-slate-400 stroke-1" />
                        <span class="text-xs font-bold text-slate-650">Soltá la nueva imagen mobile aquí</span>
                      </div>
                    )}
                  </div>
                  <p class="text-[10px] text-slate-400 font-semibold text-center">{HELP_MOBILE}</p>
                  <input
                    type="text"
                    name="imageMobileUrl"
                    value={editingSlide.value.imageMobile || ""}
                    placeholder="URL de Imagen Mobile Externa"
                    class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              </div>{/* fin contenido scrolleable */}

              {/* Footer fijo: Guardar/Cancelar siempre visibles, no scrollea. */}
              <div class="shrink-0 bg-slate-50 px-6 sm:px-8 py-4 flex justify-end border-t border-slate-200 gap-3">
                <button
                  type="button"
                  onClick$={() => {
                    editingSlide.value = null;
                    editDesktopPreview.value = null;
                    editMobilePreview.value = null;
                  }}
                  class="px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updateSlideAction.isRunning}
                  class="px-6 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <LuCheck class="w-4 h-4" />
                  {updateSlideAction.isRunning ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "AMP+ Club - Carrusel Hero",
  meta: [
    {
      name: "description",
      content: "Administrar slides dinámicos con adaptabilidad móvil y ordenamiento visual nativo drag-and-drop.",
    },
  ],
};
