import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$, Link, useLocation, type DocumentHead } from "@builder.io/qwik-city";
import { searchBenefits, getFilters, type Benefit } from "~/server/cache";
import { useLayoutUser } from "../layout";
import { CategorySlider } from "~/components/category-slider/category-slider";
import { BenefitCard } from "~/components/benefit-card/benefit-card";
import {
  LuList,
  LuMap,
  LuCrown
} from "@qwikest/icons/lucide";


// Server Loader to retrieve benefits and filters
export const useBenefitsData = routeLoader$(async (event) => {
  const url = new URL(event.url);
  const query = url.searchParams.get("buscar") || "";
  const categoryId = url.searchParams.get("categoria") ? Number(url.searchParams.get("categoria")) : undefined;
  const locationId = url.searchParams.get("ubicacion") ? Number(url.searchParams.get("ubicacion")) : undefined;
  const offerId = url.searchParams.get("oferta") ? Number(url.searchParams.get("oferta")) : undefined;
  const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : 1;
  const isGoldOnly = url.searchParams.get("gold") === "1";

  const isMap = url.searchParams.get("vista") === "mapa";

  const searchResult = await searchBenefits({
    query,
    categoryId,
    locationId,
    offerId,
    page,
    limit: isMap ? 1000 : 12,
    requestEvent: event,
    isPremiumOnly: isGoldOnly
  });

  const filters = await getFilters();

  return {
    searchResult,
    filters,
    activeFilters: {
      query,
      categoryId,
      locationId,
      offerId
    }
  };
});

export default component$(() => {
  const location = useLocation();
  const data = useBenefitsData();
  const user = useLayoutUser();
  const isMapView = location.url.searchParams.get("vista") === "mapa";

  const isMapLoaded = useSignal(false);
  const mapRef = useSignal<any>(null);
  const markersGroupRef = useSignal<any>(null);

  // Client-side initialization of Leaflet Map assets
  useVisibleTask$(() => {
    const checkAndLoad = () => {
      if (typeof window !== "undefined" && (window as any).L) {
        isMapLoaded.value = true;
      } else {
        setTimeout(checkAndLoad, 50);
      }
    };

    if (document.getElementById("leaflet-css") && typeof window !== "undefined" && (window as any).L) {
      isMapLoaded.value = true;
    } else {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => {
        checkAndLoad();
      };
      document.head.appendChild(script);
    }
  });

  // Re-run map builder when map is loaded, or when view mode changes
  useVisibleTask$(({ track }) => {
    track(() => isMapLoaded.value);
    track(() => isMapView);
    track(() => data.value.searchResult.data);

    if (!isMapLoaded.value || !isMapView || typeof window === "undefined") return;

    const L = (window as any).L;
    if (!L) return;

    const initMap = () => {
      const mapContainer = document.getElementById("map-view-container");
      if (!mapContainer) return false;

      // Clean up previous map if exists
      if (mapRef.value) {
        try {
          mapRef.value.remove();
        } catch (e) {
          console.error("Failed to clean up map:", e);
        }
        mapRef.value = null;
        markersGroupRef.value = null;
      }

      // Filter benefits that have valid coordinates
      const mapBenefits = data.value.searchResult.data.filter(
        (b) => b.latitud && b.longitud && !isNaN(Number(b.latitud)) && !isNaN(Number(b.longitud))
      );

      // Default center: La Plata, Argentina
      const defaultCenter = [-34.9214, -57.9545];
      const map = L.map("map-view-container", {
        scrollWheelZoom: true,
        zoomControl: true
      }).setView(defaultCenter, 13);

      mapRef.value = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20
      }).addTo(map);

      const markersGroup = L.featureGroup().addTo(map);
      markersGroupRef.value = markersGroup;

      const goldIcon = L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      const greenIcon = L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      });

      mapBenefits.forEach((benefit) => {
        const lat = Number(benefit.latitud);
        const lng = Number(benefit.longitud);

        const discountText = benefit.resumen || "Descuento Exclusivo";
        const primaryCat = benefit.categorias[0]?.descripcion || "Beneficios";
        const imageSrc = benefit.imagen
          ? (benefit.imagen.startsWith("http") || benefit.imagen.startsWith("/") ? benefit.imagen : `https://beneficios.amepla.org.ar/files/${benefit.imagen}`)
          : "";

        const popupHTML = `
          <div class="font-sans max-w-[240px] text-slate-800 text-left p-1">
            ${imageSrc ? `<img src="${imageSrc}" alt="${benefit.titulo}" class="w-full h-24 object-cover rounded-xl mb-2.5 shadow-sm" />` : ""}
            <span class="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black ${benefit.isPremiumOnly ? "bg-brand-gold text-slate-950" : "bg-brand-green/10 text-brand-green"} uppercase tracking-wider mb-1">
              ${primaryCat} ${benefit.isPremiumOnly ? "★ GOLD" : ""}
            </span>
            <h3 class="text-sm font-extrabold text-slate-900 leading-tight mb-1 line-clamp-2">${benefit.titulo}</h3>
            <p class="text-xs font-black text-brand-green-dark bg-emerald-50 border border-emerald-100/50 rounded-lg py-1 px-2 mb-2 text-center uppercase tracking-wide">
              ${discountText.replace("Descuento del", "").trim()}
            </p>
            <a href="/beneficio/${benefit.url}" class="block text-center text-xs font-bold text-white bg-brand-green hover:bg-brand-green-light py-2 rounded-xl transition-colors shadow-sm">
              Ver beneficio &rarr;
            </a>
          </div>
        `;

        L.marker([lat, lng], { icon: benefit.isPremiumOnly ? goldIcon : greenIcon })
          .bindPopup(popupHTML)
          .addTo(markersGroup);
      });

      if (mapBenefits.length > 0) {
        try {
          map.fitBounds(markersGroup.getBounds(), { padding: [40, 40] });
        } catch (e) {
          console.error("Error setting bounds:", e);
        }
      }

      return true;
    };

    if (!initMap()) {
      setTimeout(() => {
        initMap();
      }, 100);
    }
  });

  const { searchResult, filters, activeFilters } = data.value;
  const { data: benefits, total, totalPages, page } = searchResult;
  const isGoldOnly = location.url.searchParams.get("gold") === "1";
  const hasActiveFilters = activeFilters.query || activeFilters.categoryId || activeFilters.locationId || activeFilters.offerId || isGoldOnly;

  const displayBenefits = benefits;

  // Construct URL string helper
  const getFilterUrl = (params: {
    buscar?: string;
    categoria?: number | null;
    ubicacion?: number | null;
    oferta?: number | null;
    page?: number;
    vista?: string | null;
    ver?: string | null;
    gold?: string | null;
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

    const g = params.gold !== undefined ? params.gold : location.url.searchParams.get("gold");
    if (g) searchParams.set("gold", g);

    const p = params.page !== undefined ? params.page : 1;
    if (p > 1 && !params.vista) searchParams.set("page", String(p));

    const v = params.vista !== undefined ? params.vista : location.url.searchParams.get("vista");
    if (v && v !== "listado") searchParams.set("vista", v);

    return `/beneficios?${searchParams.toString()}`;
  };
  return (
    <div class="relative min-h-screen bg-slate-50">
      {/* Search Header Info */}
      <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 pt-8 print:hidden text-left">
        {/* Beautiful Horizontal Category Slider Bar */}
        <div class="relative mb-8 pb-3 border-b border-slate-200/50">
          <CategorySlider
            categorias={filters.categorias}
            activeCategoryId={activeFilters.categoryId}
            sliderId="category-scroll-container"
            title="Explorar por Categoría"
          />
        </div>
      </section>

      {/* Main Catalog View Container */}
      <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 print:hidden">
        <div class="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-250 pb-5 mb-8 gap-4 text-left">
          <div>
            <h1 class="text-3xl font-display font-black text-brand-green-dark tracking-tight leading-none flex items-center">
              {isMapView ? (
                <>
                  <LuMap class="w-7 h-7 text-brand-green mr-2 stroke-[2]" />
                  <span>Beneficios Cerca Mío</span>
                </>
              ) : (
                "Ver todos los beneficios"
              )}
            </h1>
            <p class="text-slate-500 text-sm mt-2 font-medium">
              {isMapView
                ? `${benefits.filter(b => b.latitud && b.longitud).length} sucursales ubicadas en el mapa`
                : `${total} beneficios encontrados en total`
              }
            </p>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            {/* Gold Filter Toggle Button */}
            <Link
              href={getFilterUrl({ gold: isGoldOnly ? null : "1", page: 1 })}
              class={[
                "px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border shadow-sm select-none",
                isGoldOnly
                  ? "bg-brand-gold text-slate-950 border-brand-gold shadow-brand-gold/15"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              ]}
            >
              <LuCrown class={["w-4 h-4", isGoldOnly ? "text-slate-950" : "text-amber-500"]} />
              <span>Beneficios Gold</span>
            </Link>

            {/* List/Map View Mode Toggle Button */}
            <div class="flex items-center bg-slate-200/60 p-1 rounded-2xl border border-slate-200/40 shadow-inner z-20 select-none">
              <Link
                href={getFilterUrl({ vista: "listado" })}
                class={[
                  "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
                  !isMapView
                    ? "bg-white text-brand-green shadow-sm border border-slate-200/20"
                    : "text-slate-500 hover:text-slate-800"
                ]}
              >
                <LuList class="w-4 h-4 stroke-[2]" />
                <span>Listado</span>
              </Link>
              <Link
                href={getFilterUrl({ vista: "mapa" })}
                class={[
                  "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
                  isMapView
                    ? "bg-white text-brand-green shadow-sm border border-slate-200/20"
                    : "text-slate-500 hover:text-slate-800"
                ]}
              >
                <LuMap class="w-4 h-4 stroke-[2]" />
                <span>Mapa</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Row 2: Unified Search and Filters Bar (Full Width & Generous Spacing) */}
        <div class="bg-white rounded-[2rem] border border-slate-200/60 p-6 md:p-8 mb-8 shadow-sm flex flex-col gap-6 text-left">
          {/* Keyword Search - Spanning Full Width */}
          <div class="w-full relative text-left">
            <label class="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2.5 pl-1">Buscar por palabra clave o marca</label>
            <div class="relative flex items-center">
              <input
                type="text"
                id="catalog-search-input"
                placeholder="Ej: Gimnasio, Hoteles, Restaurante, Heladería..."
                value={activeFilters.query || ""}
                onKeyDown$={(ev, el) => {
                  if (ev.key === "Enter") {
                    const searchParams = new URLSearchParams(window.location.search);
                    if (el.value.trim()) {
                      searchParams.set("buscar", el.value.trim());
                    } else {
                      searchParams.delete("buscar");
                    }
                    searchParams.set("page", "1");
                    window.location.href = `/beneficios?${searchParams.toString()}`;
                  }
                }}
                class="w-full bg-slate-50 text-slate-800 text-sm pl-12 pr-28 py-4 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all placeholder-slate-400 font-medium"
              />
              <span class="absolute left-4.5 text-slate-400">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <button
                type="button"
                onClick$={() => {
                  const input = document.getElementById("catalog-search-input") as HTMLInputElement | null;
                  if (input) {
                    const searchParams = new URLSearchParams(window.location.search);
                    if (input.value.trim()) {
                      searchParams.set("buscar", input.value.trim());
                    } else {
                      searchParams.delete("buscar");
                    }
                    searchParams.set("page", "1");
                    window.location.href = `/beneficios?${searchParams.toString()}`;
                  }
                }}
                class="absolute right-2 px-6 py-2.5 bg-brand-green hover:bg-brand-green-light text-xs font-black uppercase tracking-wider text-white rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
              >
                Buscar
              </button>
            </div>
          </div>

          {/* Filters Selectors Grid - Two Equal Columns with beautiful chevrons */}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {/* Location Dropdown Filter */}
            <div class="text-left w-full">
              <label class="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2.5 pl-1">Filtrar por Ubicación</label>
              <div class="relative w-full">
                <select
                  onChange$={(ev, el) => {
                    const searchParams = new URLSearchParams(window.location.search);
                    if (el.value) {
                      searchParams.set("ubicacion", el.value);
                    } else {
                      searchParams.delete("ubicacion");
                    }
                    searchParams.set("page", "1");
                    window.location.href = `/beneficios?${searchParams.toString()}`;
                  }}
                  class="w-full bg-slate-50 text-slate-800 text-sm pl-4 pr-10 py-4 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none appearance-none cursor-pointer font-medium"
                >
                  <option value="">Todas las ubicaciones</option>
                  {filters.ubicaciones.map((loc) => (
                    <option
                      key={loc.id}
                      value={loc.id}
                      selected={activeFilters.locationId === loc.id}
                    >
                      {loc.descripcion}
                    </option>
                  ))}
                </select>
                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                  <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Offer type / Discount Dropdown Filter */}
            <div class="text-left w-full">
              <label class="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2.5 pl-1">Filtrar por Descuento</label>
              <div class="relative w-full">
                <select
                  onChange$={(ev, el) => {
                    const searchParams = new URLSearchParams(window.location.search);
                    if (el.value) {
                      searchParams.set("oferta", el.value);
                    } else {
                      searchParams.delete("oferta");
                    }
                    searchParams.set("page", "1");
                    window.location.href = `/beneficios?${searchParams.toString()}`;
                  }}
                  class="w-full bg-slate-50 text-slate-800 text-sm pl-4 pr-10 py-4 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none appearance-none cursor-pointer font-medium"
                >
                  <option value="">Todos los descuentos</option>
                  {filters.ofertas.map((off) => (
                    <option
                      key={off.id}
                      value={off.id}
                      selected={activeFilters.offerId === off.id}
                    >
                      {off.descripcion}
                    </option>
                  ))}
                </select>
                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                  <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Active filters pill list */}
          {hasActiveFilters && (
            <div class="flex flex-wrap items-center gap-2 mt-4 md:mt-0 mb-6">
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
                Filtros activos:
              </span>

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

              {isGoldOnly && (
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand-gold/15 text-amber-700 border border-brand-gold/30">
                  <LuCrown class="w-3.5 h-3.5 mr-1 text-amber-550" />
                  Membresía: Gold
                  <Link href={getFilterUrl({ gold: null })} class="ml-1.5 text-amber-600 hover:text-amber-850 font-extrabold">&times;</Link>
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

        {isMapView ? (
          <div
            id="map-view-container"
            class="w-full h-[550px] rounded-[2.5rem] border border-slate-200 bg-slate-100 shadow-sm relative overflow-hidden"
          />
        ) : (
          <>
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
                {displayBenefits.map((benefit: Benefit) => {
                  const isLocked = benefit.isPremiumOnly && !user.value;
                  return (
                    <BenefitCard key={benefit.id} benefit={benefit} isLocked={isLocked} />
                  );
                })}
              </div>
            )}

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
          </>
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
