import { component$, useComputed$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { routeLoader$, Link, useLocation, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { searchBenefits, getFilters, type Benefit } from "~/server/cache";
import { getSettings } from "~/server/chatbotDb";
import { CategorySlider } from "~/components/category-slider/category-slider";
import { OfferSlider } from "~/components/offer-slider/offer-slider";
import { BenefitCard } from "~/components/benefit-card/benefit-card";
import {
  LuList,
  LuMap
} from "@qwikest/icons/lucide";


// Server Loader to retrieve benefits and filters
export const useBenefitsData = routeLoader$(async (event) => {
  const url = new URL(event.url);
  const query = url.searchParams.get("buscar") || "";
  const categoryId = url.searchParams.get("categoria") ? Number(url.searchParams.get("categoria")) : undefined;
  const locationId = url.searchParams.get("ubicacion") ? Number(url.searchParams.get("ubicacion")) : undefined;
  const offerId = url.searchParams.get("oferta") ? Number(url.searchParams.get("oferta")) : undefined;
  const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : 1;
  const isCampaign = url.searchParams.get("campana") === "true" || url.searchParams.get("campana") === "1";

  const isMap = url.searchParams.get("vista") === "mapa";

  const searchResult = await searchBenefits({
    query,
    categoryId,
    locationId,
    offerId,
    page,
    limit: isMap ? 1000 : 12,
    requestEvent: event,
    isCampaignOnly: isCampaign
  });

  const filters = await getFilters(event);
  const settings = await getSettings(event).catch(() => null);

  return {
    searchResult,
    filters,
    activeFilters: {
      query,
      categoryId,
      locationId,
      offerId,
      isCampaign,
      campaignTitle: settings?.campaignTitle || "Especial"
    }
  };
});

export default component$(() => {
  const data = useBenefitsData();

  const { searchResult, filters, activeFilters } = data.value;
  const { data: benefits, total, totalPages, page } = searchResult;
  const hasActiveFilters = activeFilters.query || activeFilters.categoryId || activeFilters.locationId || activeFilters.offerId || activeFilters.isCampaign;

  const displayBenefits = benefits;

  const loc = useLocation();
  const nav = useNavigate();

  // Scroll suave a la barra de resultados cuando cambia el filtro (el search de la
  // URL) DENTRO de /beneficios. No scrollea en la carga inicial (baseline) ni al
  // navegar al detalle de un beneficio (pathname distinto).
  const prevSearch = useSignal<string | null>(null);
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const pathname = track(() => loc.url.pathname);
    const search = track(() => loc.url.search);
    if (pathname !== "/beneficios") return;
    if (prevSearch.value === null) {
      prevSearch.value = search; // baseline: primera carga, no scrollear
      return;
    }
    if (search !== prevSearch.value) {
      prevSearch.value = search;
      document.getElementById("resultados-bar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  // Navegación SPA (useNavigate) para tener feedback (loading + scroll) al filtrar.
  const submitSearch = $((raw: string) => {
    const sp = new URLSearchParams(loc.url.search);
    const q = raw.trim();
    if (q) sp.set("buscar", q); else sp.delete("buscar");
    sp.set("page", "1");
    nav(`/beneficios?${sp.toString()}`);
  });

  const setLocationFilter = $((value: string) => {
    const sp = new URLSearchParams(loc.url.search);
    if (value) sp.set("ubicacion", value); else sp.delete("ubicacion");
    sp.set("page", "1");
    nav(`/beneficios?${sp.toString()}`);
  });

  // Calculate dynamic Map URL
  const mapHref = useComputed$(() => {
    const params = new URLSearchParams();
    if (activeFilters.query) params.set("buscar", activeFilters.query);
    if (activeFilters.categoryId) params.set("categoria", String(activeFilters.categoryId));
    if (activeFilters.isCampaign) params.set("campana", "true");
    return `/mapa?${params.toString()}`;
  });

  // Construct URL string helper
  const getFilterUrl = (params: {
    buscar?: string;
    categoria?: number | null;
    ubicacion?: number | null;
    oferta?: number | null;
    page?: number;
    ver?: string | null;
    campana?: string | null;
  }) => {
    const searchParams = new URLSearchParams();

    const q = params.buscar !== undefined ? params.buscar : activeFilters.query;
    if (q) searchParams.set("buscar", q);

    const cat = params.categoria !== undefined ? params.categoria : activeFilters.categoryId;
    if (cat) searchParams.set("categoria", String(cat));

    const loc = params.ubicacion !== undefined ? params.ubicacion : activeFilters.locationId;
    if (loc) searchParams.set("ubicacion", String(loc));

    const off = params.oferta !== undefined ? params.oferta : activeFilters.offerId;
    if (off) searchParams.set("oferta", String(off));

    const camp = params.campana !== undefined ? params.campana : (activeFilters.isCampaign ? "true" : null);
    if (camp) searchParams.set("campana", camp);

    const p = params.page !== undefined ? params.page : 1;
    if (p > 1) searchParams.set("page", String(p));

    return `/beneficios?${searchParams.toString()}`;
  };

  return (
    <div class="relative min-h-screen bg-slate-50">
      {/* Search Header Info */}
      <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 pt-4 print:hidden text-left">
        {/* Beautiful Horizontal Category Slider Bar */}
        <div class="relative mb-3 pb-1 border-b border-slate-200/50">
          <CategorySlider
            categorias={filters.categorias}
            activeCategoryId={activeFilters.categoryId}
            sliderId="category-scroll-container"
            title="Explorar por Categoría"
          />
        </div>

        {/* Beautiful Horizontal Offer Slider Bar */}
        <div class="relative mb-3 pb-1 border-b border-slate-200/50">
          <OfferSlider
            ofertas={filters.ofertas}
            activeOfferId={activeFilters.offerId}
            sliderId="offer-scroll-container"
            title="Explorar por Descuento"
          />
        </div>
      </section>

      {/* Main Catalog View Container */}
      <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 print:hidden">
        {/* Título + toggle Listado/Mapa */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 text-left">
          <h1 class="text-2xl sm:text-3xl font-display font-black text-brand-green-dark tracking-tight leading-none">
            Ver todos los beneficios
          </h1>

          <div class="flex items-center bg-slate-200/60 p-1 rounded-2xl border border-slate-200/40 shadow-inner z-20 select-none self-start sm:self-auto">
            <div class="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-white text-brand-green shadow-sm border border-slate-200/20 flex items-center gap-2">
              <LuList class="w-4 h-4 stroke-[2]" />
              <span>Listado</span>
            </div>
            <Link
              href={mapHref.value}
              class="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 text-slate-500 hover:text-slate-800"
            >
              <LuMap class="w-4 h-4 stroke-[2]" />
              <span>Mapa</span>
            </Link>
          </div>
        </div>

        {/* Búsqueda en una sola fila: input + ubicación + Buscar (hace wrap en mobile) */}
        <form
          preventdefault:submit
          onSubmit$={(_, form) => {
            const q = new FormData(form).get("buscar");
            submitSearch(String(q || ""));
          }}
          class="flex flex-wrap items-stretch gap-2 sm:gap-3 mb-5"
        >
          <div class="relative flex-1 min-w-[200px]">
            <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              name="buscar"
              aria-label="Buscar beneficios por palabra clave o marca"
              placeholder="Buscar beneficio, marca o categoría..."
              value={activeFilters.query || ""}
              class="w-full bg-white text-slate-800 text-sm pl-11 pr-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:outline-none transition-all placeholder-slate-400 font-medium shadow-sm"
            />
          </div>

          <div class="relative w-full sm:w-56">
            <select
              aria-label="Filtrar por ubicación"
              onChange$={(_, el) => setLocationFilter(el.value)}
              class="w-full h-full bg-white text-slate-800 text-sm pl-4 pr-10 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:outline-none appearance-none cursor-pointer font-medium shadow-sm"
            >
              <option value="">Todas las ubicaciones</option>
              {filters.ubicaciones.map((locItem) => (
                <option key={locItem.id} value={locItem.id} selected={activeFilters.locationId === locItem.id}>
                  {locItem.descripcion}
                </option>
              ))}
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
              <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>

          <button
            type="submit"
            class="px-6 py-3 bg-brand-green hover:bg-brand-green-light text-xs font-black uppercase tracking-wider text-white rounded-2xl transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
          >
            Buscar
          </button>
        </form>

        {/* Barra de resultados (ancla del scroll): contador + filtros activos */}
        <div
          id="resultados-bar"
          class="scroll-mt-28 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/70 pb-4 mb-6 text-left"
        >
          <p class="text-sm font-bold text-slate-600 shrink-0">
            <span class={["text-brand-green-dark font-black transition-opacity duration-200", loc.isNavigating ? "opacity-40" : "opacity-100"]}>
              {total}
            </span>{" "}
            {total === 1 ? "beneficio encontrado" : "beneficios encontrados"}
          </p>

          {hasActiveFilters && (
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">Filtros:</span>

              {activeFilters.isCampaign && (
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  Campaña: {activeFilters.campaignTitle}
                  <Link href={getFilterUrl({ campana: null })} class="ml-1.5 text-amber-600 hover:text-amber-800 font-extrabold">&times;</Link>
                </span>
              )}

              {activeFilters.query && (
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-green-light/10 text-brand-green border border-brand-green-light/20">
                  Buscar: "{activeFilters.query}"
                  <Link href={getFilterUrl({ buscar: "" })} class="ml-1.5 text-brand-green-light hover:text-brand-green-dark font-extrabold">&times;</Link>
                </span>
              )}

              {activeFilters.categoryId && (
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-green-light/10 text-brand-green border border-brand-green-light/20">
                  Cat: {filters.categorias.find(c => c.id === activeFilters.categoryId)?.descripcion}
                  <Link href={getFilterUrl({ categoria: null })} class="ml-1.5 text-brand-green-light hover:text-brand-green-dark font-extrabold">&times;</Link>
                </span>
              )}

              {activeFilters.locationId && (
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-green-light/10 text-brand-green border border-brand-green-light/20">
                  Loc: {filters.ubicaciones.find(u => u.id === activeFilters.locationId)?.descripcion}
                  <Link href={getFilterUrl({ ubicacion: null })} class="ml-1.5 text-brand-green-light hover:text-brand-green-dark font-extrabold">&times;</Link>
                </span>
              )}

              {activeFilters.offerId && (
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-green-light/10 text-brand-green border border-brand-green-light/20">
                  Desc: {filters.ofertas.find(o => o.id === activeFilters.offerId)?.descripcion}
                  <Link href={getFilterUrl({ oferta: null })} class="ml-1.5 text-brand-green-light hover:text-brand-green-dark font-extrabold">&times;</Link>
                </span>
              )}

              <Link
                href="/beneficios"
                class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors duration-200"
              >
                Limpiar todo
              </Link>
            </div>
          )}
        </div>

        <div class={["transition-opacity duration-200", loc.isNavigating ? "opacity-40 pointer-events-none" : "opacity-100"]}>
        {displayBenefits.length === 0 ? (
          <div class="flex flex-col items-center justify-center py-20 bg-white border border-slate-100 rounded-[2.5rem] text-center p-8 max-w-xl mx-auto shadow-sm">
            <span class="text-4xl mb-4">🔍</span>
            <h3 class="text-lg font-black text-slate-800 uppercase tracking-wider mb-2">No se encontraron resultados</h3>
            <p class="text-sm text-slate-500 font-medium leading-relaxed mb-6">
              Intentá modificando los filtros de búsqueda o seleccioná otra categoría para encontrar descuentos activos.
            </p>
            <Link href="/beneficios" class="px-6 py-2.5 rounded-full bg-brand-green hover:bg-brand-green-light text-white text-xs font-black uppercase tracking-wider shadow-md transition-transform active:scale-95 cursor-pointer">
              Limpiar filtros
            </Link>
          </div>
        ) : (
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {displayBenefits.map((benefit: Benefit, idx: number) => {
              const isLocked = false;
              return (
                <div key={benefit.id} class={`animate-fade-in-up animate-stagger-${Math.min(idx + 1, 8)}`}>
                  <BenefitCard benefit={benefit} isLocked={isLocked} />
                </div>
              );
            })}
          </div>
        )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <nav class="flex flex-wrap items-center justify-center gap-3 mt-12 pt-8 border-t border-slate-200/60 print:hidden select-none">
            <Link
              href={page > 1 ? getFilterUrl({ page: page - 1 }) : undefined}
              class={`p-2.5 rounded-xl border text-sm font-semibold transition-all shadow-sm ${page > 1
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer"
                : "border-slate-100 bg-slate-50 text-slate-300 pointer-events-none"
                }`}
              aria-label="Página anterior"
            >
              <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

            <div class="flex flex-wrap items-center justify-center gap-1.5 max-w-full px-2">
              {(() => {
                // Smart pagination subset to avoid rendering a long strip of 20+ buttons
                const range = [];
                const maxVisible = 5;
                let start = Math.max(1, page - Math.floor(maxVisible / 2));
                const end = Math.min(totalPages, start + maxVisible - 1);

                if (end - start + 1 < maxVisible) {
                  start = Math.max(1, end - maxVisible + 1);
                }

                if (start > 1) {
                  range.push(1);
                  if (start > 2) range.push("...");
                }

                for (let i = start; i <= end; i++) {
                  range.push(i);
                }

                if (end < totalPages) {
                  if (end < totalPages - 1) range.push("...");
                  range.push(totalPages);
                }

                return range.map((p, idx) => {
                  if (p === "...") {
                    return (
                      <span key={`dots-${idx}`} class="w-8 text-center text-slate-400 font-bold select-none">
                        ...
                      </span>
                    );
                  }

                  const pNum = p as number;
                  const isCurrent = pNum === page;
                  return (
                    <Link
                      key={`page-${pNum}`}
                      href={getFilterUrl({ page: pNum })}
                      class={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-extrabold border transition-all shadow-sm ${isCurrent
                        ? "bg-brand-green border-brand-green text-white shadow-brand-green/10"
                        : "bg-white border-slate-200 text-slate-750 hover:bg-slate-50 hover:border-slate-300 active:scale-95 cursor-pointer"
                        }`}
                    >
                      {pNum}
                    </Link>
                  );
                });
              })()}
            </div>

            <Link
              href={page < totalPages ? getFilterUrl({ page: page + 1 }) : undefined}
              class={`p-2.5 rounded-xl border text-sm font-semibold transition-all shadow-sm ${page < totalPages
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer"
                : "border-slate-100 bg-slate-50 text-slate-300 pointer-events-none"
                }`}
              aria-label="Próxima página"
            >
              <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </nav>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = () => {
  return {
    title: "Todos los Beneficios - AMP+",
    meta: [
      {
        name: "description",
        content: "Explorá el catálogo completo de beneficios, descuentos exclusivos y locales adheridos de la Mutual AMP+."
      }
    ]
  };
};
