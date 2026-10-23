import { $, component$, useComputed$, useSignal } from "@builder.io/qwik";
import {
  routeLoader$,
  Link,
  useNavigate,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { searchBenefits, getFilters, type Benefit } from "~/server/cache";
import { getSettings } from "~/server/chatbotDb";
import { CAMPAIGN_DEFAULTS, campaignTerms } from "~/utils/home-benefits";
import { CategorySlider } from "~/components/category-slider/category-slider";
import { OfferSlider } from "~/components/offer-slider/offer-slider";
import { BenefitCard } from "~/components/ui/BenefitCard";
import { LuList, LuMap } from "@qwikest/icons/lucide";

// Server Loader to retrieve benefits and filters
export const useBenefitsData = routeLoader$(async (event) => {
  const url = new URL(event.url);
  const query = url.searchParams.get("buscar") || "";
  const categoryId = url.searchParams.get("categoria")
    ? Number(url.searchParams.get("categoria"))
    : undefined;
  const locationId = url.searchParams.get("ubicacion")
    ? Number(url.searchParams.get("ubicacion"))
    : undefined;
  const offerId = url.searchParams.get("oferta")
    ? Number(url.searchParams.get("oferta"))
    : undefined;
  const page = url.searchParams.get("page")
    ? Number(url.searchParams.get("page"))
    : 1;

  const isMap = url.searchParams.get("vista") === "mapa";
  const gold = url.searchParams.get("gold") === "1";
  // "Ver todos" of the home campaign: same keywords, same matching, same order as the home block.
  const campaign = url.searchParams.get("campana") === "1";
  const settings = campaign ? await getSettings(event) : null;

  const searchResult = await searchBenefits({
    query,
    categoryId,
    locationId,
    offerId,
    page,
    limit: isMap ? 1000 : 12,
    requestEvent: event,
    isPremiumOnly: gold || undefined,
    campaignTerms: settings ? campaignTerms(settings.campaignQuery) : undefined,
  });

  const filters = await getFilters(event);

  return {
    searchResult,
    filters,
    campaignTitle: settings ? settings.campaignTitle || CAMPAIGN_DEFAULTS.title : null,
    activeFilters: {
      query,
      categoryId,
      locationId,
      offerId,
      gold,
      campaign,
    },
  };
});

export default component$(() => {
  const data = useBenefitsData();
  const filtersOpen = useSignal(false);
  const navigate = useNavigate();

  const { searchResult, filters, activeFilters, campaignTitle } = data.value;
  const { data: benefits, total, totalPages, page, limit } = searchResult;
  const hasActiveFilters =
    activeFilters.query ||
    activeFilters.categoryId ||
    activeFilters.locationId ||
    activeFilters.offerId ||
    activeFilters.gold ||
    activeFilters.campaign;

  // Search and dropdowns navigate in place (no full reload); the form still works without JS.
  const applyFilters = $((form: HTMLFormElement) => {
    const formData = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ["buscar", "categoria", "ubicacion", "oferta", "gold", "campana"]) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    const query = params.toString();
    return navigate(`/beneficios/${query ? `?${query}` : ""}`);
  });

  const displayBenefits = benefits;
  const firstResult = displayBenefits.length > 0 ? (page - 1) * limit + 1 : 0;
  const lastResult = Math.min(firstResult + displayBenefits.length - 1, total);
  const isPageOutOfRange = total > 0 && displayBenefits.length === 0;

  // Calculate dynamic Map URL
  const mapHref = useComputed$(() => {
    const params = new URLSearchParams();
    if (activeFilters.query) params.set("buscar", activeFilters.query);
    if (activeFilters.categoryId)
      params.set("categoria", String(activeFilters.categoryId));
    if (activeFilters.locationId)
      params.set("ubicacion", String(activeFilters.locationId));
    if (activeFilters.offerId)
      params.set("oferta", String(activeFilters.offerId));
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
    gold?: boolean;
    campana?: boolean;
  }) => {
    const searchParams = new URLSearchParams();

    const q = params.buscar !== undefined ? params.buscar : activeFilters.query;
    if (q) searchParams.set("buscar", q);

    const cat =
      params.categoria !== undefined
        ? params.categoria
        : activeFilters.categoryId;
    if (cat) searchParams.set("categoria", String(cat));

    const loc =
      params.ubicacion !== undefined
        ? params.ubicacion
        : activeFilters.locationId;
    if (loc) searchParams.set("ubicacion", String(loc));

    const off =
      params.oferta !== undefined ? params.oferta : activeFilters.offerId;
    if (off) searchParams.set("oferta", String(off));

    if (params.gold ?? activeFilters.gold) searchParams.set("gold", "1");
    if (params.campana ?? activeFilters.campaign) searchParams.set("campana", "1");

    const p = params.page !== undefined ? params.page : 1;
    if (p > 1) searchParams.set("page", String(p));

    const query = searchParams.toString();
    return `/beneficios/${query ? `?${query}` : ""}`;
  };

  return (
    <div class="relative min-h-screen bg-background text-primary">
      {/* Search Header Info */}
      <section class="hidden md:block max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 pt-4 print:hidden text-left">
        {/* Beautiful Horizontal Category Slider Bar */}
        <div class="relative mb-4 pb-2 border-b border-line">
          <CategorySlider
            categorias={filters.categorias}
            activeCategoryId={activeFilters.categoryId}
            sliderId="category-scroll-container"
            filterEmpty={true}
          />
        </div>

        {/* Beautiful Horizontal Offer Slider Bar */}
        <div class="relative mb-5 pb-2 border-b border-line">
          <OfferSlider
            ofertas={filters.ofertas}
            activeOfferId={activeFilters.offerId}
            sliderId="offer-scroll-container"
            filterEmpty={true}
          />
        </div>
      </section>

      {/* Main Catalog View Container */}
      <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 print:hidden">
        <div class="flex items-center justify-between border-b border-line pb-3 mb-4 md:pb-5 md:mb-6 gap-3 text-left">
          <div class="min-w-0">
            <h1 class="text-2xl md:text-3xl font-display font-extrabold text-primary tracking-tight leading-none flex items-center">
              <span class="md:hidden">Beneficios</span>
              <span class="hidden md:inline">Todos los beneficios</span>
            </h1>
            <p role="status" class="text-slate-600 text-sm mt-2 font-medium">
              {`${total} ${total === 1 ? "beneficio encontrado" : "beneficios encontrados"}`}
              {displayBenefits.length > 0 && totalPages > 1 && (
                <span class="block text-xs mt-1">
                  {`Mostrando ${firstResult}–${lastResult} · Página ${page} de ${totalPages}`}
                </span>
              )}
            </p>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            {/* List/Map View Mode Toggle Button */}
            <div class="flex items-center bg-surface p-1 rounded-2xl border border-line shadow-inner z-20 select-none">
              <div class="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-accent text-primary shadow-sm border border-accent/20 flex items-center gap-2">
                <LuList class="w-4 h-4 stroke-[2]" />
                <span class="hidden sm:inline">Listado</span>
              </div>
              <Link
                href={mapHref.value}
                class="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 text-slate-600 hover:text-primary"
              >
                <LuMap class="w-4 h-4 stroke-[2]" />
                <span>Mapa</span>
              </Link>
            </div>
          </div>
        </div>

        <form
          action="/beneficios/"
          method="get"
          role="search"
          aria-label="Buscar y filtrar beneficios"
          preventdefault:submit
          onSubmit$={(_, form) => applyFilters(form)}
          class="mb-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-left shadow-md md:mb-6 md:gap-5 md:rounded-[2rem] md:p-6"
        >
          {activeFilters.gold && <input type="hidden" name="gold" value="1" />}
          {activeFilters.campaign && <input type="hidden" name="campana" value="1" />}
          <div>
            <label
              for="catalog-search-input"
              class="mb-2 block text-xs font-bold text-slate-700"
            >
              Buscá por beneficio o comercio
            </label>
            <div class="flex gap-2">
              <input
                type="search"
                id="catalog-search-input"
                name="buscar"
                placeholder="Ej: gimnasio, hotel, heladería..."
                value={activeFilters.query}
                class="min-w-0 flex-1 rounded-xl border border-line bg-surface-muted px-3 py-3 text-base sm:text-sm text-primary placeholder-slate-500 focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                class="min-h-11 shrink-0 rounded-xl bg-accent px-4 py-3 text-xs font-black uppercase tracking-wide text-primary hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                Buscar
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen.value}
            aria-controls="catalog-filters"
            aria-label={
              filtersOpen.value
                ? "Ocultar filtros"
                : "Mostrar filtros de categoría, ubicación y descuento"
            }
            onClick$={() => (filtersOpen.value = !filtersOpen.value)}
            class="flex min-h-11 items-center justify-between rounded-xl border border-line px-3 text-sm font-bold text-slate-700 md:hidden"
          >
            <span>{filtersOpen.value ? "Ocultar filtros" : "Filtros"}</span>
            <span aria-hidden="true" class="ml-2 text-amber-900">
              {filtersOpen.value ? "−" : "+"}
            </span>
          </button>
          <div
            id="catalog-filters"
            class={`${filtersOpen.value ? "grid" : "hidden"} grid-cols-1 gap-3 md:grid md:grid-cols-3 md:gap-4`}
          >
            <div>
              <label
                for="catalog-category"
                class="mb-2 block text-xs font-bold text-slate-700"
              >
                Categoría
              </label>
              <select
                id="catalog-category"
                name="categoria"
                onChange$={(_, select) => select.form && applyFilters(select.form)}
                class="min-h-11 w-full rounded-xl border border-line bg-surface-muted px-3 py-3 text-base sm:text-sm text-primary focus:border-accent focus:outline-none"
              >
                <option value="">Todas las categorías</option>
                {filters.categorias.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                    selected={activeFilters.categoryId === category.id}
                  >
                    {category.descripcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                for="catalog-location"
                class="mb-2 block text-xs font-bold text-slate-700"
              >
                Ubicación
              </label>
              <select
                id="catalog-location"
                name="ubicacion"
                onChange$={(_, select) => select.form && applyFilters(select.form)}
                class="min-h-11 w-full rounded-xl border border-line bg-surface-muted px-3 py-3 text-base sm:text-sm text-primary focus:border-accent focus:outline-none"
              >
                <option value="">Todas las ubicaciones</option>
                {filters.ubicaciones.map((place) => (
                  <option
                    key={place.id}
                    value={place.id}
                    selected={activeFilters.locationId === place.id}
                  >
                    {place.descripcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                for="catalog-offer"
                class="mb-2 block text-xs font-bold text-slate-700"
              >
                Descuento
              </label>
              <select
                id="catalog-offer"
                name="oferta"
                onChange$={(_, select) => select.form && applyFilters(select.form)}
                class="min-h-11 w-full rounded-xl border border-line bg-surface-muted px-3 py-3 text-base sm:text-sm text-primary focus:border-accent focus:outline-none"
              >
                <option value="">Todos los descuentos</option>
                {filters.ofertas.map((offer) => (
                  <option
                    key={offer.id}
                    value={offer.id}
                    selected={activeFilters.offerId === offer.id}
                  >
                    {offer.descripcion}
                  </option>
                ))}
              </select>
            </div>
            {/* With JS the dropdowns apply on change; this button is only for no-JS visits. */}
            <noscript>
              <button
                type="submit"
                class="min-h-11 rounded-xl bg-accent px-4 py-3 text-xs font-black uppercase tracking-wide text-primary hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:col-span-3 md:justify-self-end"
              >
                Aplicar filtros
              </button>
            </noscript>
          </div>
        </form>

        {/* Active filters pill list */}
        {hasActiveFilters && (
          <div class="mb-4 flex flex-wrap items-center gap-2 md:mb-6">
            <span class="text-xs font-bold text-slate-600 uppercase tracking-wider mr-1">
              Filtros activos:
            </span>

            {activeFilters.query && (
              <span class="inline-flex max-w-full items-center break-words pl-3 pr-1 rounded-full text-xs font-medium bg-accent/10 text-amber-900 border border-accent/20">
                Buscar: "{activeFilters.query}"
                <Link
                  href={getFilterUrl({ buscar: "" })}
                  aria-label="Quitar búsqueda"
                  class="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-amber-900 hover:bg-accent/10"
                >
                  &times;
                </Link>
              </span>
            )}

            {activeFilters.categoryId && (
              <span class="inline-flex max-w-full items-center break-words pl-3 pr-1 rounded-full text-xs font-medium bg-accent/10 text-amber-900 border border-accent/20">
                Categoría:{" "}
                {
                  filters.categorias.find(
                    (c) => c.id === activeFilters.categoryId,
                  )?.descripcion
                }
                <Link
                  href={getFilterUrl({ categoria: null })}
                  aria-label="Quitar categoría"
                  class="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-amber-900 hover:bg-accent/10"
                >
                  &times;
                </Link>
              </span>
            )}

            {activeFilters.locationId && (
              <span class="inline-flex max-w-full items-center break-words pl-3 pr-1 rounded-full text-xs font-medium bg-accent/10 text-amber-900 border border-accent/20">
                Ubicación:{" "}
                {
                  filters.ubicaciones.find(
                    (u) => u.id === activeFilters.locationId,
                  )?.descripcion
                }
                <Link
                  href={getFilterUrl({ ubicacion: null })}
                  aria-label="Quitar ubicación"
                  class="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-amber-900 hover:bg-accent/10"
                >
                  &times;
                </Link>
              </span>
            )}

            {activeFilters.offerId && (
              <span class="inline-flex max-w-full items-center break-words pl-3 pr-1 rounded-full text-xs font-medium bg-accent/10 text-amber-900 border border-accent/20">
                Descuento:{" "}
                {
                  filters.ofertas.find((o) => o.id === activeFilters.offerId)
                    ?.descripcion
                }
                <Link
                  href={getFilterUrl({ oferta: null })}
                  aria-label="Quitar descuento"
                  class="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-amber-900 hover:bg-accent/10"
                >
                  &times;
                </Link>
              </span>
            )}

            {activeFilters.gold && (
              <span class="inline-flex max-w-full items-center break-words pl-3 pr-1 rounded-full text-xs font-medium bg-accent/10 text-amber-900 border border-accent/20">
                Solo Gold
                <Link
                  href={getFilterUrl({ gold: false })}
                  aria-label="Quitar filtro Solo Gold"
                  class="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-amber-900 hover:bg-accent/10"
                >
                  &times;
                </Link>
              </span>
            )}

            {activeFilters.campaign && (
              <span class="inline-flex max-w-full items-center break-words pl-3 pr-1 rounded-full text-xs font-medium bg-accent/10 text-amber-900 border border-accent/20">
                Campaña: {campaignTitle}
                <Link
                  href={getFilterUrl({ campana: false })}
                  aria-label="Quitar filtro de campaña"
                  class="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-amber-900 hover:bg-accent/10"
                >
                  &times;
                </Link>
              </span>
            )}

            <Link
              href="/beneficios/"
              class="inline-flex min-h-9 items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors duration-200"
            >
              Limpiar todo
            </Link>
          </div>
        )}

        {displayBenefits.length === 0 ? (
          <div class="flex flex-col items-center justify-center py-20 bg-surface border border-line rounded-[2.5rem] text-center p-8 max-w-xl mx-auto shadow-sm">
            <span aria-hidden="true" class="text-4xl mb-4">
              🔍
            </span>
            <h3 class="text-lg font-black text-primary uppercase tracking-wider mb-2">
              {isPageOutOfRange
                ? "Esta página no tiene beneficios"
                : hasActiveFilters
                  ? "No se encontraron resultados"
                  : "Pronto habrá nuevos beneficios"}
            </h3>
            <p class="text-sm text-slate-600 font-medium leading-relaxed mb-6">
              {isPageOutOfRange
                ? "Volvé a la primera página para ver los resultados disponibles con tus filtros actuales."
                : hasActiveFilters
                  ? "Probá con otro nombre o quitá algún filtro para ampliar los resultados."
                  : "Estamos preparando más propuestas para vos. Podés sugerir un comercio que te gustaría encontrar acá."}
            </p>
            <div class="flex flex-wrap justify-center gap-3">
              {activeFilters.query && !isPageOutOfRange && (
                <Link
                  href={getFilterUrl({ buscar: "" })}
                  class="inline-flex min-h-11 items-center justify-center px-5 py-3 rounded-full border border-accent text-amber-900 text-xs font-bold hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Quitar búsqueda
                </Link>
              )}
              <Link
                href={
                  isPageOutOfRange
                    ? getFilterUrl({ page: 1 })
                    : hasActiveFilters
                      ? "/beneficios"
                      : "/sugerencias"
                }
                class="inline-flex min-h-11 items-center justify-center px-6 py-3 rounded-full bg-accent hover:bg-accent-hover text-primary text-xs font-black uppercase tracking-wider shadow-md transition-transform active:scale-95 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {isPageOutOfRange
                  ? "Volver a la primera página"
                  : hasActiveFilters
                    ? "Ver todos los beneficios"
                    : "Sugerir un comercio"}
              </Link>
            </div>
          </div>
        ) : (
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
            {displayBenefits.map((benefit: Benefit, idx: number) => {
              const isLocked = false;
              return (
                <div
                  key={benefit.id}
                  class={`animate-fade-in-up animate-stagger-${Math.min(idx + 1, 8)}`}
                >
                  <BenefitCard benefit={benefit} isLocked={isLocked} />
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <nav
            aria-label="Páginas del catálogo de beneficios"
            class="flex flex-wrap items-center justify-center gap-3 mt-12 pt-8 border-t border-line print:hidden select-none"
          >
            <Link
              href={page > 1 ? getFilterUrl({ page: page - 1 }) : undefined}
              aria-disabled={page <= 1 ? "true" : undefined}
              tabIndex={page <= 1 ? -1 : undefined}
              class={`flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-semibold transition-all shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                page > 1
                  ? "border-line bg-surface text-slate-700 hover:bg-surface-muted hover:text-primary active:scale-95 cursor-pointer"
                  : "border-line/40 bg-surface/40 text-slate-600 pointer-events-none"
              }`}
              aria-label="Página anterior"
            >
              <svg
                class="w-4 h-4 stroke-current fill-none stroke-2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 19l-7-7 7-7"
                />
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
                      <span
                        key={`dots-${idx}`}
                        class="w-8 text-center text-slate-500 font-bold select-none"
                      >
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
                      aria-current={isCurrent ? "page" : undefined}
                      aria-label={`Página ${pNum}`}
                      class={`w-11 h-11 flex items-center justify-center rounded-xl text-sm font-extrabold border transition-all shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        isCurrent
                          ? "bg-accent border-accent text-primary shadow-accent/10"
                          : "bg-surface border-line text-slate-700 hover:bg-surface-muted hover:border-slate-500 active:scale-95 cursor-pointer"
                      }`}
                    >
                      {pNum}
                    </Link>
                  );
                });
              })()}
            </div>

            <Link
              href={
                page < totalPages ? getFilterUrl({ page: page + 1 }) : undefined
              }
              aria-disabled={page >= totalPages ? "true" : undefined}
              tabIndex={page >= totalPages ? -1 : undefined}
              class={`flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-semibold transition-all shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                page < totalPages
                  ? "border-line bg-surface text-slate-700 hover:bg-surface-muted hover:text-primary active:scale-95 cursor-pointer"
                  : "border-line/40 bg-surface/40 text-slate-600 pointer-events-none"
              }`}
              aria-label="Próxima página"
            >
              <svg
                class="w-4 h-4 stroke-current fill-none stroke-2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 5l7 7-7 7"
                />
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
    title: "Todos los Beneficios - LPRC",
    meta: [
      {
        name: "description",
        content:
          "Explorá el catálogo completo de beneficios, descuentos exclusivos y locales adheridos de La Plata Rugby Club.",
      },
    ],
  };
};
