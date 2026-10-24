import { $, component$ } from "@builder.io/qwik";
import {
  routeLoader$,
  Link,
  useNavigate,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { LuMapPin, LuNavigation, LuSearch, LuX } from "@qwikest/icons/lucide";
import {
  searchBenefits,
  getFilters,
  type Benefit,
  type SearchParams,
} from "~/server/cache";
import { getSettings } from "~/server/chatbotDb";
import {
  CAMPAIGN_DEFAULTS,
  CATALOG_SORTS,
  campaignTerms,
  commonLocation,
  offerLabel,
  parseCatalogSort,
  sortCatalog,
  withLiveCounts,
} from "~/utils/home-benefits";
import { CategorySlider } from "~/components/category-slider/category-slider";
import { OfferSlider } from "~/components/offer-slider/offer-slider";
import { BenefitCard } from "~/components/ui/BenefitCard";
import { SectionHeading } from "~/components/section-heading/section-heading";
import { catalogHref } from "~/utils/catalog-navigation";

const PAGE_SIZE = 12;
// Larger than the catalog: results are sorted here, after filtering, and paged afterwards.
const WHOLE_CATALOG = 10_000;
const FORM_KEYS = [
  "buscar",
  "categoria",
  "ubicacion",
  "oferta",
  "gold",
  "campana",
  "orden",
];

function positiveId(value: string | null): number | undefined {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export const useBenefitsData = routeLoader$(async (event) => {
  const params = event.url.searchParams;
  const query = (params.get("buscar") || "").trim();
  const categoryId = positiveId(params.get("categoria"));
  const locationId = positiveId(params.get("ubicacion"));
  const offerId = positiveId(params.get("oferta"));
  const page = positiveId(params.get("page")) ?? 1;
  const sort = parseCatalogSort(params.get("orden"));
  const gold = params.get("gold") === "1";
  // "Ver todos" of the home campaign: the admin's hand-picked benefits, or the same keyword match.
  const campaign = params.get("campana") === "1";
  const settings = campaign ? await getSettings(event) : null;
  const campaignSlugs = settings?.campaignBenefitSlugs ?? [];

  const base: SearchParams = {
    query,
    categoryId,
    locationId,
    offerId,
    page: 1,
    limit: WHOLE_CATALOG,
    requestEvent: event,
    isPremiumOnly: gold || undefined,
    campaignTerms:
      settings && !campaignSlugs.length
        ? campaignTerms(settings.campaignQuery)
        : undefined,
  };
  const inCampaign = (items: Benefit[]) =>
    campaignSlugs.length
      ? items.filter((item) => campaignSlugs.includes(item.url))
      : items;

  // Each group counts its options with the other filters applied, so no chip leads to an empty page.
  const [results, byCategory, byLocation, byOffer, savedFilters] =
    await Promise.all([
      searchBenefits(base),
      searchBenefits({ ...base, categoryId: undefined }),
      searchBenefits({ ...base, locationId: undefined }),
      searchBenefits({ ...base, offerId: undefined }),
      getFilters(event),
    ]);
  const filters = {
    categorias: withLiveCounts(savedFilters, inCampaign(byCategory.data))
      .categorias,
    ubicaciones: withLiveCounts(savedFilters, inCampaign(byLocation.data))
      .ubicaciones,
    ofertas: withLiveCounts(savedFilters, inCampaign(byOffer.data)).ofertas,
  };

  const matches = inCampaign(results.data);
  const ordered =
    campaignSlugs.length && !sort
      ? [...matches].sort(
          (a, b) => campaignSlugs.indexOf(a.url) - campaignSlugs.indexOf(b.url),
        )
      : sortCatalog(matches, sort);
  const total = ordered.length;
  const sharedLocation = commonLocation(ordered);

  return {
    searchResult: {
      data: ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
      page,
      limit: PAGE_SIZE,
    },
    filters,
    resultsPath: catalogHref("/beneficios/", params),
    mapHref: catalogHref("/mapa/", params),
    campaignTitle: settings
      ? settings.campaignTitle || CAMPAIGN_DEFAULTS.title
      : null,
    // Cards skip the city most results share; a single note above the grid says it once.
    location: sharedLocation
      ? {
          name: sharedLocation,
          everywhere: ordered.every(
            (item) =>
              item.ubicacion[0]?.descripcion?.trim().toLowerCase() ===
              sharedLocation.toLowerCase(),
          ),
        }
      : null,
    activeFilters: {
      query,
      categoryId,
      locationId,
      offerId,
      gold,
      campaign,
      sort,
    },
  };
});

export default component$(() => {
  const data = useBenefitsData();
  const navigate = useNavigate();

  const { searchResult, filters, activeFilters, campaignTitle, location, resultsPath, mapHref } =
    data.value;
  const { data: benefits, total, totalPages, page, limit } = searchResult;
  const hasActiveFilters = Boolean(
    activeFilters.query ||
      activeFilters.categoryId ||
      activeFilters.locationId ||
      activeFilters.offerId ||
      activeFilters.gold ||
      activeFilters.campaign,
  );

  // Search and dropdowns navigate in place (no full reload); the form still works without JS.
  const applyFilters = $((form: HTMLFormElement) => {
    const formData = new FormData(form);
    const params = new URLSearchParams();
    for (const key of FORM_KEYS) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    const query = params.toString();
    return navigate(`/beneficios/${query ? `?${query}` : ""}`);
  });

  const firstResult = benefits.length > 0 ? (page - 1) * limit + 1 : 0;
  const lastResult = Math.min(firstResult + benefits.length - 1, total);
  const isPageOutOfRange = total > 0 && benefits.length === 0;

  const getFilterUrl = (params: {
    buscar?: string;
    categoria?: number | null;
    ubicacion?: number | null;
    oferta?: number | null;
    page?: number;
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
    if (params.campana ?? activeFilters.campaign)
      searchParams.set("campana", "1");
    if (activeFilters.sort) searchParams.set("orden", activeFilters.sort);
    const p = params.page ?? 1;
    if (p > 1) searchParams.set("page", String(p));
    const query = searchParams.toString();
    return `/beneficios/${query ? `?${query}` : ""}`;
  };

  // A group with nothing to pick (e.g. a search without matches) is left out entirely.
  const available = <T extends { id: number; beneficios_count?: number }>(
    options: T[],
    activeId?: number,
  ) =>
    options.filter(
      (option) => (option.beneficios_count || 0) > 0 || option.id === activeId,
    );
  const locations = available(filters.ubicaciones, activeFilters.locationId);
  const hasCategories =
    available(filters.categorias, activeFilters.categoryId).length > 0;
  const hasOffers =
    available(filters.ofertas, activeFilters.offerId).length > 0;
  const activeOffer = filters.ofertas.find(
    (offer) => offer.id === activeFilters.offerId,
  );
  const activeChips = [
    activeFilters.query && {
      key: "buscar",
      label: `"${activeFilters.query}"`,
      href: getFilterUrl({ buscar: "" }),
    },
    activeFilters.categoryId && {
      key: "categoria",
      label:
        filters.categorias.find(
          (category) => category.id === activeFilters.categoryId,
        )?.descripcion || "Rubro",
      href: getFilterUrl({ categoria: null }),
    },
    activeFilters.offerId && {
      key: "oferta",
      label: activeOffer ? offerLabel(activeOffer.descripcion) : "Descuento",
      href: getFilterUrl({ oferta: null }),
    },
    activeFilters.locationId && {
      key: "ubicacion",
      label:
        filters.ubicaciones.find(
          (place) => place.id === activeFilters.locationId,
        )?.descripcion || "Ubicación",
      href: getFilterUrl({ ubicacion: null }),
    },
    activeFilters.gold && {
      key: "gold",
      label: "Solo Gold",
      href: getFilterUrl({ gold: false }),
    },
    activeFilters.campaign && {
      key: "campana",
      label: `Campaña: ${campaignTitle}`,
      href: getFilterUrl({ campana: false }),
    },
  ].filter((chip): chip is { key: string; label: string; href: string } =>
    Boolean(chip),
  );

  // Saved locations are often typed in capitals ("LA PLATA"); prose reads better in title case.
  const locationName = location
    ? location.name === location.name.toUpperCase()
      ? location.name
          .toLowerCase()
          .replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase())
      : location.name
    : "";

  const pageButton =
    "flex h-11 w-11 items-center justify-center border text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <div class="relative min-h-screen bg-background text-primary">
      <div class="mx-auto max-w-[90rem] px-4 py-8 text-left sm:px-6 md:py-10 lg:px-8 print:hidden">
        <SectionHeading
          as="h1"
          eyebrow={activeFilters.campaign ? "Campaña" : "Catálogo para socios"}
          title={
            activeFilters.campaign && campaignTitle
              ? campaignTitle
              : "Todos los beneficios"
          }
          size="lg"
        >
          <p role="status" class="mt-4 text-sm font-medium text-slate-600">
            {`${total} ${total === 1 ? "beneficio" : "beneficios"} ${
              hasActiveFilters
                ? total === 1
                  ? "encontrado"
                  : "encontrados"
                : total === 1
                  ? "vigente"
                  : "vigentes"
            }`}
            {benefits.length > 0 &&
              totalPages > 1 &&
              ` · Mostrando ${firstResult}–${lastResult}, página ${page} de ${totalPages}`}
          </p>
        </SectionHeading>

        <form
          action="/beneficios/"
          method="get"
          role="search"
          aria-label="Buscar y filtrar beneficios"
          preventdefault:submit
          onSubmit$={(_, form) => applyFilters(form)}
          class="mt-8 space-y-5 border-t border-line pt-6"
        >
          {/* Chips are links; these keep their filters when the form is submitted. */}
          {activeFilters.categoryId && (
            <input
              type="hidden"
              name="categoria"
              value={activeFilters.categoryId}
            />
          )}
          {activeFilters.offerId && (
            <input type="hidden" name="oferta" value={activeFilters.offerId} />
          )}
          {activeFilters.gold && <input type="hidden" name="gold" value="1" />}
          {activeFilters.campaign && (
            <input type="hidden" name="campana" value="1" />
          )}

          <div class="max-w-3xl">
            <label for="catalog-search-input" class="field-label">
              Buscá por beneficio o comercio
            </label>
            <div class="flex gap-2">
              <input
                type="search"
                id="catalog-search-input"
                name="buscar"
                placeholder="Ej: gimnasio, hotel, heladería..."
                value={activeFilters.query}
                class="field min-w-0 flex-1 text-base sm:text-sm"
              />
              <button type="submit" class="btn btn-dark shrink-0 px-4 sm:px-6">
                <LuSearch class="h-4 w-4" aria-hidden="true" />
                <span class="sr-only sm:not-sr-only">Buscar</span>
              </button>
            </div>
          </div>

          {hasCategories && (
            <div>
              <p class="field-label" aria-hidden="true">
                Rubro
              </p>
              <CategorySlider
                variant="chips"
                title="Filtrar por rubro"
                categorias={filters.categorias}
                activeCategoryId={activeFilters.categoryId}
                sliderId="catalog-category-chips"
                filterEmpty={true}
              />
            </div>
          )}

          {hasOffers && (
            <div>
              <p class="field-label" aria-hidden="true">
                Descuento
              </p>
              <OfferSlider
                variant="chips"
                title="Filtrar por descuento"
                ofertas={filters.ofertas}
                activeOfferId={activeFilters.offerId}
                sliderId="catalog-offer-chips"
                filterEmpty={true}
              />
            </div>
          )}

          <div class="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
            {(locations.length > 1 || activeFilters.locationId) && (
              <div class="sm:w-60">
                <label for="catalog-location" class="field-label">
                  Ubicación
                </label>
                <select
                  id="catalog-location"
                  name="ubicacion"
                  onChange$={(_, select) =>
                    select.form && applyFilters(select.form)
                  }
                  class="field min-h-11 text-base sm:text-sm"
                >
                  <option value="">Todas</option>
                  {locations.map((place) => (
                    <option
                      key={place.id}
                      value={place.id}
                      selected={activeFilters.locationId === place.id}
                    >
                      {`${place.descripcion} (${place.beneficios_count || 0})`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div class="sm:w-60">
              <label for="catalog-sort" class="field-label">
                Ordenar por
              </label>
              <select
                id="catalog-sort"
                name="orden"
                onChange$={(_, select) =>
                  select.form && applyFilters(select.form)
                }
                class="field min-h-11 text-base sm:text-sm"
              >
                {CATALOG_SORTS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    selected={activeFilters.sort === option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Link
              href={mapHref}
              class="btn btn-outline col-span-2 sm:col-span-1"
            >
              <LuNavigation class="h-4 w-4" aria-hidden="true" />
              Ordenar por cercanía
              <span class="sr-only"> (abre el mapa)</span>
            </Link>
            {/* With JS the dropdowns apply on change; this button is only for no-JS visits. */}
            <noscript>
              <button type="submit" class="btn btn-dark">
                Aplicar
              </button>
            </noscript>
          </div>
        </form>

        {activeChips.length > 0 && (
          <div class="mt-6 flex flex-wrap items-center gap-2">
            <span class="eyebrow mr-1 text-slate-600">Filtros activos</span>
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                class="inline-flex max-w-full items-center border border-primary bg-surface pl-3 text-sm font-semibold text-primary"
              >
                <span class="truncate">{chip.label}</span>
                <Link
                  href={chip.href}
                  aria-label={`Quitar filtro ${chip.label}`}
                  class="ml-1 flex h-10 w-10 shrink-0 items-center justify-center transition-colors hover:bg-primary hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <LuX class="h-4 w-4" aria-hidden="true" />
                </Link>
              </span>
            ))}
            <Link
              href={
                activeFilters.sort
                  ? `/beneficios/?orden=${activeFilters.sort}`
                  : "/beneficios/"
              }
              class="inline-flex min-h-10 items-center px-2 text-sm font-semibold text-secondary underline underline-offset-4 hover:text-primary"
            >
              Limpiar todo
            </Link>
          </div>
        )}

        {location && benefits.length > 0 && (
          <p class="mt-6 flex items-center gap-1.5 text-sm text-slate-600">
            <LuMapPin
              class="h-4 w-4 shrink-0 text-secondary"
              aria-hidden="true"
            />
            {location.everywhere
              ? `Todos en ${locationName}.`
              : `En ${locationName}, salvo que la tarjeta indique otra ubicación.`}
          </p>
        )}

        {benefits.length === 0 ? (
          <div class="card mx-auto mt-8 max-w-xl p-8 text-center">
            <span class="mx-auto flex h-12 w-12 items-center justify-center bg-accent text-primary">
              <LuSearch class="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 class="heading-display mt-4 text-2xl text-primary">
              {isPageOutOfRange
                ? "Esta página no tiene beneficios"
                : hasActiveFilters
                  ? "No se encontraron resultados"
                  : "Pronto habrá nuevos beneficios"}
            </h2>
            <p class="mt-3 text-sm leading-relaxed text-slate-600">
              {isPageOutOfRange
                ? "Volvé a la primera página para ver los resultados disponibles con tus filtros actuales."
                : hasActiveFilters
                  ? "Probá con otro nombre o quitá algún filtro para ampliar los resultados."
                  : "Estamos preparando más propuestas para vos. Podés sugerir un comercio que te gustaría encontrar acá."}
            </p>
            <div class="mt-6 flex flex-wrap justify-center gap-3">
              {activeFilters.query && !isPageOutOfRange && (
                <Link
                  href={getFilterUrl({ buscar: "" })}
                  class="btn btn-outline"
                >
                  Quitar búsqueda
                </Link>
              )}
              <Link
                href={
                  isPageOutOfRange
                    ? getFilterUrl({ page: 1 })
                    : hasActiveFilters
                      ? "/beneficios/"
                      : "/sugerencias/"
                }
                class="btn btn-primary"
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
          <div class="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {benefits.map((benefit: Benefit, idx: number) => (
              <div
                key={benefit.id}
                class={`animate-fade-in-up animate-stagger-${Math.min(idx + 1, 8)}`}
              >
                <BenefitCard
                  benefit={benefit}
                  commonLocation={location?.name}
                  resultsPath={resultsPath}
                />
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav
            aria-label="Páginas del catálogo de beneficios"
            class="mt-12 flex flex-wrap items-center justify-center gap-2 border-t border-line pt-8 select-none print:hidden"
          >
            <Link
              href={page > 1 ? getFilterUrl({ page: page - 1 }) : undefined}
              aria-disabled={page <= 1 ? "true" : undefined}
              tabIndex={page <= 1 ? -1 : undefined}
              class={`${pageButton} ${
                page > 1
                  ? "border-primary bg-surface text-primary hover:bg-primary hover:text-white"
                  : "pointer-events-none border-line bg-surface text-slate-400"
              }`}
              aria-label="Página anterior"
            >
              <svg
                class="h-4 w-4 fill-none stroke-current stroke-2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path stroke-linecap="square" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>

            <div class="flex max-w-full flex-wrap items-center justify-center gap-1.5 px-2">
              {(() => {
                // Smart pagination subset to avoid rendering a long strip of 20+ buttons
                const range: (number | "...")[] = [];
                const maxVisible = 5;
                let start = Math.max(1, page - Math.floor(maxVisible / 2));
                const end = Math.min(totalPages, start + maxVisible - 1);
                if (end - start + 1 < maxVisible)
                  start = Math.max(1, end - maxVisible + 1);
                if (start > 1) {
                  range.push(1);
                  if (start > 2) range.push("...");
                }
                for (let i = start; i <= end; i++) range.push(i);
                if (end < totalPages) {
                  if (end < totalPages - 1) range.push("...");
                  range.push(totalPages);
                }

                return range.map((p, idx) =>
                  p === "..." ? (
                    <span
                      key={`dots-${idx}`}
                      class="w-8 text-center font-bold text-slate-500 select-none"
                    >
                      ...
                    </span>
                  ) : (
                    <Link
                      key={`page-${p}`}
                      href={getFilterUrl({ page: p })}
                      aria-current={p === page ? "page" : undefined}
                      aria-label={`Página ${p}`}
                      class={`${pageButton} ${
                        p === page
                          ? "border-primary bg-primary text-white"
                          : "border-line bg-surface text-primary hover:border-primary"
                      }`}
                    >
                      {p}
                    </Link>
                  ),
                );
              })()}
            </div>

            <Link
              href={
                page < totalPages ? getFilterUrl({ page: page + 1 }) : undefined
              }
              aria-disabled={page >= totalPages ? "true" : undefined}
              tabIndex={page >= totalPages ? -1 : undefined}
              class={`${pageButton} ${
                page < totalPages
                  ? "border-primary bg-surface text-primary hover:bg-primary hover:text-white"
                  : "pointer-events-none border-line bg-surface text-slate-400"
              }`}
              aria-label="Próxima página"
            >
              <svg
                class="h-4 w-4 fill-none stroke-current stroke-2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path stroke-linecap="square" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </nav>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Todos los beneficios - La Plata Rugby Club",
  meta: [
    {
      name: "description",
      content:
        "Catálogo de beneficios para socios de La Plata Rugby Club: buscá por comercio, rubro, descuento o ubicación y generá tu cupón.",
    },
  ],
};
