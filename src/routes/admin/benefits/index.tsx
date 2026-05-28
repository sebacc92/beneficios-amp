import { component$, useSignal, useComputed$, $ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuPlus, LuTicket, LuCrown, LuTrash2, LuSparkles, LuChevronLeft, LuChevronRight } from "@qwikest/icons/lucide";
import { desc, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { customBenefits as customBenefitsTable } from "~/db/schema";
import { getFilters, ensureDbSeeded } from "~/server/cache";
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

// --- ACTIONS ---

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
  const createBenefitAction = useCreateBenefitAction();
  const deleteBenefitAction = useDeleteBenefitAction();

  const isCreateBenefitOpen = useSignal(false);

  // Pagination state
  const currentPage = useSignal(1);
  const itemsPerPage = 8;

  const totalPages = useComputed$(() => {
    const count = customBenefits.value.length;
    return Math.max(1, Math.ceil(count / itemsPerPage));
  });

  const paginatedBenefits = useComputed$(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return customBenefits.value.slice(start, end);
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

        <div class="flex items-center gap-2">
          <button
            onClick$={() => {
              isCreateBenefitOpen.value = !isCreateBenefitOpen.value;
            }}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <LuPlus class="w-4 h-4" />
            <span>{isCreateBenefitOpen.value ? "Cerrar Formulario" : "Crear Beneficio"}</span>
          </button>
        </div>
      </div>

      <div class="space-y-6 animate-in fade-in duration-300 text-left">
        {/* Action Feedback alerts */}
        {createBenefitAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-fade-in">
            ✓ Beneficio creado exitosamente e integrado en el catálogo general.
          </div>
        )}

        {/* Form Modal Panel */}
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
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Categoría</label>
                <select
                  name="categoryId"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all cursor-pointer"
                >
                  {adminFilters.value.categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Ubicación</label>
                <select
                  name="locationId"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all cursor-pointer"
                >
                  {adminFilters.value.ubicaciones.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Oferta / Descuento</label>
                <select
                  name="offerId"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all cursor-pointer"
                >
                  {adminFilters.value.ofertas.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.descripcion}
                    </option>
                  ))}
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
                <label for="isFeatured" class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                  <LuSparkles class="w-4 h-4 text-brand-gold fill-brand-gold animate-pulse" />
                  <span>Destacado de la Semana (Jerarquizar en Home)</span>
                </label>
              </div>

              <div class="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isPremiumOnly"
                  name="isPremiumOnly"
                  class="rounded border-slate-300 text-brand-green focus:ring-brand-green h-4 w-4"
                />
                <label for="isPremiumOnly" class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                  <LuCrown class="w-4 h-4 text-amber-500" />
                  <span>Premium Only (Segmentación)</span>
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
        <div class="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col">
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
              {paginatedBenefits.value.length === 0 ? (
                <tr>
                  <td colSpan={5} class="px-6 py-12 text-center text-slate-450">
                    <div class="flex items-center justify-center gap-2">
                      <LuTicket class="w-5 h-5 text-purple-400" />
                      <span>Aún no has creado beneficios propios. Hacé clic en "Crear Beneficio" para registrar el primero.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedBenefits.value.map((benefit) => {
                  const catDesc = adminFilters.value.categorias.find(c => c.id === benefit.categoryId)?.descripcion || `Cat #${benefit.categoryId}`;
                  const locDesc = adminFilters.value.ubicaciones.find(l => l.id === benefit.locationId)?.descripcion || `Loc #${benefit.locationId}`;

                  return (
                    <tr key={benefit.id} class="hover:bg-slate-50 transition-colors">
                      <td class="px-6 py-4 font-bold text-slate-800">{benefit.titulo}</td>
                      <td class="px-6 py-4 text-slate-500">{benefit.resumen}</td>
                      <td class="px-6 py-4">
                        <span
                          class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${benefit.isPremiumOnly
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-100"
                          }`}
                        >
                          {benefit.isPremiumOnly ? (
                            <>
                              <LuCrown class="w-2.5 h-2.5" />
                              <span>Premium</span>
                            </>
                          ) : (
                            <span>General</span>
                          )}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-slate-500 font-bold">
                        {catDesc} <span class="text-slate-300 mx-1">|</span> <span class="font-normal text-slate-400">{locDesc}</span>
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
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages.value > 1 && (
            <div class="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50">
              <span class="text-xs text-slate-500">
                Página <span class="font-bold text-slate-800">{currentPage.value}</span> de <span class="font-bold text-slate-800">{totalPages.value}</span> ({customBenefits.value.length} beneficios totales)
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
