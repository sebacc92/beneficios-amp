import { component$, useSignal, useComputed$, useTask$, $, Fragment } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, Link, useLocation, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuPlus, LuTicket, LuTrash2, LuPencil, LuChevronLeft, LuChevronRight, LuSearch, LuKey, LuBell } from "@qwikest/icons/lucide";
import { desc, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { customBenefits as customBenefitsTable, merchants as merchantsTable } from "~/db/schema";
import { getFilters, ensureDbSeeded } from "~/server/cache";
import { hashPassword } from "~/utils/crypto";
import { ensureMerchantsTable } from "~/server/merchant-auth";
import { sendPushToAll } from "~/server/webpush";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

// --- SECURITY & LOADERS ---

export const useAdminCustomBenefitsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    await ensureDbSeeded(db);
    return await db.select().from(customBenefitsTable).orderBy(desc(customBenefitsTable.createdAt));
  } catch (err) {
    console.error("Failed to load custom benefits:", err);
    return [];
  }
});

export const useAdminFiltersLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  return await getFilters();
});

// Accesos de locales (login del comercio) por beneficio, indexados por slug.
export const useBenefitAccessLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") return {} as Record<string, { username: string; isActive: boolean }>;
  try {
    const db = getDB(event);
    await ensureMerchantsTable(db);
    const rows = await db.select().from(merchantsTable);
    const map: Record<string, { username: string; isActive: boolean }> = {};
    for (const m of rows) map[m.benefitSlug] = { username: m.username, isActive: m.isActive };
    return map;
  } catch (err) {
    console.error("Failed to load benefit access:", err);
    return {} as Record<string, { username: string; isActive: boolean }>;
  }
});

// --- ACTIONS ---

export const useSetBenefitAccessAction = routeAction$(
  async (data, event) => {
    const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return event.fail(403, { message: "No autorizado." });
    try {
      const db = getDB(event);
      await ensureMerchantsTable(db);
      const username = data.username.toLowerCase().trim();

      // El usuario no puede estar tomado por OTRO local.
      const [byUser] = await db.select().from(merchantsTable).where(eq(merchantsTable.username, username)).limit(1);
      if (byUser && byUser.benefitSlug !== data.benefitSlug) {
        return event.fail(409, { message: "Ese usuario ya está en uso por otro local." });
      }

      const [existing] = await db.select().from(merchantsTable).where(eq(merchantsTable.benefitSlug, data.benefitSlug)).limit(1);

      if (existing) {
        const values: any = { username, isActive: true };
        if (data.password && data.password.trim()) values.passwordHash = await hashPassword(data.password.trim());
        await db.update(merchantsTable).set(values).where(eq(merchantsTable.benefitSlug, data.benefitSlug));
      } else {
        if (!data.password || data.password.trim().length < 6) {
          return event.fail(400, { message: "La contraseña debe tener al menos 6 caracteres." });
        }
        await db.insert(merchantsTable).values({
          id: "loc-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
          benefitSlug: data.benefitSlug,
          username,
          passwordHash: await hashPassword(data.password.trim()),
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }
      return { success: true };
    } catch (e: any) {
      console.error("Set benefit access error:", e);
      return event.fail(500, { message: "Error al guardar el acceso." });
    }
  },
  zod$({
    benefitSlug: z.string(),
    username: z.string().min(3, "El usuario debe tener al menos 3 caracteres."),
    password: z.string().optional(),
  })
);

export const useToggleBenefitAccessAction = routeAction$(
  async (data, event) => {
    const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return event.fail(403, { message: "No autorizado." });
    const db = getDB(event);
    await db.update(merchantsTable).set({ isActive: data.isActive === "true" }).where(eq(merchantsTable.benefitSlug, data.benefitSlug));
    return { success: true };
  },
  zod$({ benefitSlug: z.string(), isActive: z.string() })
);

export const useRemoveBenefitAccessAction = routeAction$(
  async (data, event) => {
    const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return event.fail(403, { message: "No autorizado." });
    const db = getDB(event);
    await db.delete(merchantsTable).where(eq(merchantsTable.benefitSlug, data.benefitSlug));
    return { success: true };
  },
  zod$({ benefitSlug: z.string() })
);

// Envía una notificación push del beneficio a todos los suscriptos.
export const useSendBenefitNotificationAction = routeAction$(
  async (data, event) => {
    const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return event.fail(403, { message: "No autorizado." });
    try {
      const result = await sendPushToAll(event, {
        title: data.titulo,
        body: data.resumen?.trim() ? data.resumen.trim() : "Nuevo beneficio disponible en AMP+",
        url: `/beneficio/${data.slug}`,
      });
      return { success: true, ...result };
    } catch (err) {
      console.error("Send notification error:", err);
      return event.fail(500, { message: "No se pudo enviar la notificación." });
    }
  },
  zod$({ slug: z.string(), titulo: z.string(), resumen: z.string().optional() })
);


export const useToggleBenefitActiveAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const [existing] = await db.select().from(customBenefitsTable).where(eq(customBenefitsTable.id, data.id));
      if (!existing) return requestEvent.fail(404, { message: "Beneficio no encontrado." });

      const rawValidUntil = existing.validUntil;
      const isDraft = rawValidUntil?.startsWith("draft|") || rawValidUntil === "draft";
      let newValidUntil: string | null = null;
      if (isDraft) {
        newValidUntil = rawValidUntil === "draft" ? null : rawValidUntil!.substring(6);
      } else {
        newValidUntil = `draft|${rawValidUntil || ""}`;
      }

      await db.update(customBenefitsTable)
        .set({ validUntil: newValidUntil })
        .where(eq(customBenefitsTable.id, data.id));

      return { success: true };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al cambiar el estado." });
    }
  },
  zod$({
    id: z.string(),
  })
);

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

export default component$(() => {
  const customBenefits = useAdminCustomBenefitsLoader();
  const adminFilters = useAdminFiltersLoader();
  const deleteBenefitAction = useDeleteBenefitAction();
  const toggleBenefitActiveAction = useToggleBenefitActiveAction();
  const benefitAccess = useBenefitAccessLoader();
  const setAccessAction = useSetBenefitAccessAction();
  const toggleAccessAction = useToggleBenefitAccessAction();
  const removeAccessAction = useRemoveBenefitAccessAction();
  const sendNotifAction = useSendBenefitNotificationAction();
  const accessForSlug = useSignal<string | null>(null);
  const location = useLocation();

  // Pagination & Search state
  const currentPage = useSignal(1);
  const searchQuery = useSignal("");
  const statusFilter = useSignal<"all" | "active" | "inactive">("all");
  const categoryFilter = useSignal<string>("all");
  const locationFilter = useSignal<string>("all");

  // Cualquier cambio de filtro/búsqueda vuelve a la primera página.
  useTask$(({ track }) => {
    track(() => searchQuery.value);
    track(() => statusFilter.value);
    track(() => categoryFilter.value);
    track(() => locationFilter.value);
    currentPage.value = 1;
  });

  const itemsPerPage = 25;

  const filteredBenefits = useComputed$(() => {
    const isDraft = (b: any) => b.validUntil?.startsWith("draft|") || b.validUntil === "draft";
    let items = customBenefits.value;
    if (statusFilter.value === "active") {
      items = items.filter(b => !isDraft(b));
    } else if (statusFilter.value === "inactive") {
      items = items.filter(b => isDraft(b));
    }
    if (categoryFilter.value !== "all") {
      const catId = Number(categoryFilter.value);
      items = items.filter((b) => b.categoryId === catId);
    }
    if (locationFilter.value !== "all") {
      const locId = Number(locationFilter.value);
      items = items.filter((b) => b.locationId === locId);
    }
    const query = searchQuery.value.toLowerCase().trim();
    if (query) {
      items = items.filter(
        (b) =>
          b.titulo.toLowerCase().includes(query) ||
          b.resumen?.toLowerCase().includes(query) ||
          b.descripcion?.toLowerCase().includes(query)
      );
    }
    // Mostrar primero los activos y luego los inactivos (orden estable).
    return [...items].sort((a, b) => Number(isDraft(a)) - Number(isDraft(b)));
  });

  const hasActiveFilters = useComputed$(
    () =>
      searchQuery.value.trim() !== "" ||
      statusFilter.value !== "all" ||
      categoryFilter.value !== "all" ||
      locationFilter.value !== "all"
  );

  const totalPages = useComputed$(() => {
    const count = filteredBenefits.value.length;
    return Math.max(1, Math.ceil(count / itemsPerPage));
  });

  const paginatedBenefits = useComputed$(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredBenefits.value.slice(start, end);
  });

  const changePage = $((page: number) => {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  });

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      {/* Dynamic Header Area (No duplication) */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              Administración / Catálogo
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Gestión de Beneficios
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Creá y eliminá beneficios del portal local e integrá cupones de descuento.
          </p>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search Input Box */}
          <div class="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar por título..."
              value={searchQuery.value}
              onInput$={(ev) => {
                searchQuery.value = (ev.target as HTMLInputElement).value;
              }}
              class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-3 pl-9 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
            />
            <LuSearch class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {searchQuery.value && (
              <button
                type="button"
                onClick$={() => {
                  searchQuery.value = "";
                }}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 font-bold text-sm"
              >
                &times;
              </button>
            )}
          </div>



          {/* Category Filter */}
          <div class="relative w-full sm:w-44">
            <select
              value={categoryFilter.value}
              onChange$={(ev, el) => { categoryFilter.value = el.value; }}
              class="w-full bg-white text-slate-700 text-xs px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:outline-none transition-all cursor-pointer font-bold shadow-sm"
            >
              <option value="all">Todas las categorías</option>
              {adminFilters.value.categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.descripcion}</option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
          <div class="relative w-full sm:w-44">
            <select
              value={locationFilter.value}
              onChange$={(ev, el) => { locationFilter.value = el.value; }}
              class="w-full bg-white text-slate-700 text-xs px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:outline-none transition-all cursor-pointer font-bold shadow-sm"
            >
              <option value="all">Todas las ubicaciones</option>
              {adminFilters.value.ubicaciones.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.descripcion}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div class="relative w-full sm:w-44">
            <select
              value={statusFilter.value}
              onChange$={(ev, el) => {
                statusFilter.value = el.value as any;
              }}
              class="w-full bg-white text-slate-700 text-xs px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:outline-none transition-all cursor-pointer font-bold shadow-sm"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Borradores</option>
            </select>
          </div>

          <Link
            href="/admin/benefits/nuevo"
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <LuPlus class="w-4 h-4" />
            <span>Crear Beneficio</span>
          </Link>
        </div>
      </div>

      <div class="space-y-6 animate-in fade-in duration-300 text-left">
        {/* Action Feedback alerts */}
        {location.url.searchParams.get("ok") === "created" && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-fade-in">
            ✓ Beneficio creado exitosamente e integrado en el catálogo general.
          </div>
        )}

        {location.url.searchParams.get("ok") === "edited" && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-fade-in">
            ✓ Beneficio modificado exitosamente y actualizado en el catálogo.
          </div>
        )}

        {toggleBenefitActiveAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-fade-in">
            ✓ Estado de activación del beneficio modificado con éxito.
          </div>
        )}



        {/* Filtered count summary */}
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <p class="text-xs font-semibold text-slate-500">
            Mostrando <span class="font-black text-slate-800">{filteredBenefits.value.length}</span> de{" "}
            <span class="font-black text-slate-800">{customBenefits.value.length}</span> beneficios
          </p>
          {hasActiveFilters.value && (
            <button
              type="button"
              onClick$={() => {
                searchQuery.value = "";
                statusFilter.value = "all";
                categoryFilter.value = "all";
                locationFilter.value = "all";
              }}
              class="text-[11px] font-bold text-brand-green hover:text-brand-green-light hover:underline cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* List Table of Custom benefits */}
        <div class="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col">
          <table class="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th class="px-6 py-4">Título</th>
                <th class="px-6 py-4">Resumen / Desc.</th>
                <th class="px-6 py-4">Filtros (Categoría/Ubicación)</th>
                <th class="px-6 py-4 text-center">Estado</th>
                <th class="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium">
              {paginatedBenefits.value.length === 0 ? (
                <tr>
                  <td colSpan={5} class="px-6 py-12 text-center text-slate-450">
                    <div class="flex items-center justify-center gap-2">
                      <LuTicket class="w-5 h-5 text-purple-400" />
                      <span>
                        {hasActiveFilters.value
                          ? "Ningún beneficio coincide con los filtros aplicados. Probá ajustarlos o limpiarlos."
                          : "Aún no has creado beneficios propios. Hacé clic en \"Crear Beneficio\" para registrar el primero."}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedBenefits.value.map((benefit) => {
                  const catDesc = adminFilters.value.categorias.find(c => c.id === benefit.categoryId)?.descripcion || `Cat #${benefit.categoryId}`;
                  const locDesc = adminFilters.value.ubicaciones.find(l => l.id === benefit.locationId)?.descripcion || `Loc #${benefit.locationId}`;
                  const isActive = !(benefit.validUntil?.startsWith("draft|") || benefit.validUntil === "draft");

                  const access = benefitAccess.value[benefit.slug];
                  const isAccessOpen = accessForSlug.value === benefit.slug;

                  return (
                    <Fragment key={benefit.id}>
                    <tr class="hover:bg-slate-50 transition-colors">
                      <td class="px-6 py-4 font-bold text-slate-800">
                        <div class="flex items-center gap-2">
                          <span>{benefit.titulo}</span>
                          {benefit.pdfUrl && (
                            <span
                              class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-red-50 text-red-600 border border-red-200 uppercase tracking-wider"
                              title="Contiene documento PDF adjunto"
                            >
                              PDF
                            </span>
                          )}
                        </div>
                      </td>
                      <td class="px-6 py-4 text-slate-500">{benefit.resumen}</td>
                      <td class="px-6 py-4 text-slate-500 font-bold">
                        {catDesc} <span class="text-slate-300 mx-1">|</span> <span class="font-normal text-slate-400">{locDesc}</span>
                      </td>
                      {/* Estado Toggle Column */}
                      <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center">
                          <label class="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange$={$(async () => {
                                await toggleBenefitActiveAction.submit({ id: benefit.id });
                              })}
                              class="sr-only peer"
                            />
                            <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-green"></div>
                            <span class="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 min-w-[50px] text-left">
                              {isActive ? "Activo" : "Borrador"}
                            </span>
                          </label>
                        </div>
                      </td>
                      <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                          {/* Send Push Notification Button */}
                          <button
                            type="button"
                            onClick$={$(async () => {
                              if (!confirm(`¿Enviar una notificación push del beneficio "${benefit.titulo}" a todos los suscriptos?`)) return;
                              const r = await sendNotifAction.submit({ slug: benefit.slug, titulo: benefit.titulo, resumen: benefit.resumen || "" });
                              const v: any = r.value;
                              if (v?.success) alert(`Notificación enviada.\nEnviadas: ${v.sent}/${v.total}${v.removed ? ` · ${v.removed} suscripciones expiradas eliminadas` : ""}.`);
                              else alert(v?.message || "No se pudo enviar la notificación.");
                            })}
                            class="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-all cursor-pointer"
                            title="Enviar notificación push"
                          >
                            <LuBell class="w-4 h-4" />
                          </button>

                          {/* Local Access Button */}
                          <button
                            type="button"
                            onClick$={() => {
                              accessForSlug.value = isAccessOpen ? null : benefit.slug;
                            }}
                            class={[
                              "p-2 rounded-full transition-all cursor-pointer relative",
                              access
                                ? "text-brand-green hover:bg-emerald-50"
                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
                            ]}
                            title="Acceso del local"
                          >
                            <LuKey class="w-4 h-4" />
                            {access && (
                              <span class={[
                                "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white",
                                access.isActive ? "bg-emerald-500" : "bg-slate-300",
                              ]} />
                            )}
                          </button>

                          {/* Edit Button */}
                          <Link
                            href={`/admin/benefits/${benefit.id}/editar`}
                            class="p-2 text-brand-green hover:text-brand-green-light hover:bg-emerald-50 rounded-full transition-all cursor-pointer"
                            title="Editar Beneficio"
                          >
                            <LuPencil class="w-4 h-4" />
                          </Link>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick$={$(async () => {
                              if (confirm(`¿Está seguro de que desea eliminar el beneficio "${benefit.titulo}" de forma permanente?`)) {
                                await deleteBenefitAction.submit({ id: benefit.id });
                              }
                            })}
                            class="p-2 text-red-500 hover:text-red-705 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                            title="Eliminar Beneficio"
                          >
                            <LuTrash2 class="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isAccessOpen && (
                      <tr class="bg-slate-50/70">
                        <td colSpan={5} class="px-6 py-5">
                          <div class="max-w-2xl">
                            <div class="flex items-center justify-between mb-3">
                              <h4 class="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                <LuKey class="w-3.5 h-3.5" /> Acceso del local — {benefit.titulo}
                              </h4>
                              {access && (
                                <span class={[
                                  "inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                  access.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500",
                                ]}>
                                  {access.isActive ? "Activo" : "Inactivo"}
                                </span>
                              )}
                            </div>
                            <p class="text-[11px] text-slate-400 font-medium mb-4">
                              Con estas credenciales el local ingresa a <span class="font-mono">/comercios</span> y registra los usos de descuento de los agremiados.
                            </p>

                            <Form
                              action={setAccessAction}
                              onSubmitCompleted$={() => { if (setAccessAction.value?.success) accessForSlug.value = null; }}
                              class="flex flex-col sm:flex-row sm:items-end gap-3"
                            >
                              <input type="hidden" name="benefitSlug" value={benefit.slug} />
                              <div class="space-y-1.5 flex-1">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Usuario</label>
                                <input
                                  name="username"
                                  type="text"
                                  autoComplete="off"
                                  value={access?.username || ""}
                                  placeholder="usuario del local"
                                  class="w-full text-sm font-semibold border border-slate-200 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-brand-green bg-white"
                                />
                              </div>
                              <div class="space-y-1.5 flex-1">
                                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                  Contraseña {access && <span class="text-slate-300 normal-case font-bold">(dejar vacío para no cambiar)</span>}
                                </label>
                                <input
                                  name="password"
                                  type="text"
                                  autoComplete="off"
                                  placeholder={access ? "••••••" : "mín. 6 caracteres"}
                                  class="w-full text-sm font-semibold border border-slate-200 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-brand-green bg-white"
                                />
                              </div>
                              <button type="submit" disabled={setAccessAction.isRunning} class="px-5 py-2.5 rounded-xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-extrabold uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap">
                                {setAccessAction.isRunning ? "Guardando..." : access ? "Actualizar" : "Crear acceso"}
                              </button>
                            </Form>

                            {setAccessAction.value?.failed && (
                              <p class="text-xs font-bold text-red-600 mt-2">{setAccessAction.value.message}</p>
                            )}

                            {access && (
                              <div class="flex items-center gap-2 mt-3">
                                <Form action={toggleAccessAction}>
                                  <input type="hidden" name="benefitSlug" value={benefit.slug} />
                                  <input type="hidden" name="isActive" value={access.isActive ? "false" : "true"} />
                                  <button type="submit" class="px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wider text-slate-500 hover:bg-slate-200 transition-all">
                                    {access.isActive ? "Desactivar" : "Activar"}
                                  </button>
                                </Form>
                                <Form action={removeAccessAction}>
                                  <input type="hidden" name="benefitSlug" value={benefit.slug} />
                                  <button type="submit" class="px-3 py-1.5 rounded-lg text-[11px] font-extrabold uppercase tracking-wider text-red-500 hover:bg-red-50 transition-all">
                                    Quitar acceso
                                  </button>
                                </Form>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages.value > 1 && (
            <div class="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50">
              <span class="text-xs text-slate-500">
                Página <span class="font-bold text-slate-800">{currentPage.value}</span> de <span class="font-bold text-slate-800">{totalPages.value}</span> ({filteredBenefits.value.length} beneficios)
              </span>
              <div class="flex items-center gap-1">
                <button
                  onClick$={() => changePage(currentPage.value - 1)}
                  disabled={currentPage.value === 1}
                  class="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-slate-650"
                  title="Página Anterior"
                >
                  <LuChevronLeft class="w-4 h-4" />
                </button>
                <button
                  onClick$={() => changePage(currentPage.value + 1)}
                  disabled={currentPage.value === totalPages.value}
                  class="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-slate-650"
                  title="Página Siguiente"
                >
                  <LuChevronRight class="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "AMP+ Club - Gestión de Beneficios",
  meta: [
    {
      name: "description",
      content: "Administrar catálogo de beneficios propios del club.",
    },
  ],
};
