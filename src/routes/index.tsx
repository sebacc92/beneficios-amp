import { component$, useSignal, $, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$, Link, useLocation, type DocumentHead } from "@builder.io/qwik-city";
import { searchBenefits, getFilters, type Benefit } from "~/server/cache";
import { useLayoutUser } from "./layout";
import { getDB } from "~/db";
import { sponsors as sponsorsTable } from "~/db/schema";

// Loader to fetch sponsors grid layout
export const useSponsorsData = routeLoader$(async (event) => {
  try {
    const db = getDB(event);
    return await db.select().from(sponsorsTable).orderBy(sponsorsTable.y, sponsorsTable.x);
  } catch (err) {
    console.error("Failed to load sponsors on home:", err);
    return [];
  }
});

// Server Loader to retrieve benefits and filters
export const useBenefitsData = routeLoader$(async (event) => {
  const url = new URL(event.url);
  const query = url.searchParams.get("buscar") || "";
  const categoryId = url.searchParams.get("categoria") ? Number(url.searchParams.get("categoria")) : undefined;
  const locationId = url.searchParams.get("ubicacion") ? Number(url.searchParams.get("ubicacion")) : undefined;
  const offerId = url.searchParams.get("oferta") ? Number(url.searchParams.get("oferta")) : undefined;
  const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : 1;

  const searchResult = await searchBenefits({
    query,
    categoryId,
    locationId,
    offerId,
    page,
    limit: 12,
    requestEvent: event
  });

  const filters = await getFilters();

  let curatedRows = null;
  if (!query && !categoryId && !locationId && !offerId && page === 1) {
    try {
      // Fetch a wider set of benefits to populate curated rows
      const all = await searchBenefits({
        limit: 60,
        requestEvent: event
      });
      const items = all.data;
      
      // Curate cafecitos (those belonging to gastronomy/cafes or containing "cafe" or "factura" in description/title)
      const cafecitos = items.filter(b => 
        b.titulo.toLowerCase().includes("café") || 
        b.titulo.toLowerCase().includes("cafe") || 
        b.descripcion.toLowerCase().includes("café") ||
        b.resumen.toLowerCase().includes("café") ||
        b.categorias.some(c => c.descripcion.toLowerCase().includes("gastro") || c.descripcion.toLowerCase().includes("café"))
      ).slice(0, 4);

      // Curate themed rows with distinct slices of live data
      const relevantes = items.slice(0, 6);
      const destacados = items.slice(6, 12);
      const nuevos = items.slice(12, 18);

      curatedRows = {
        relevantes,
        destacados,
        nuevos,
        cafecitos
      };
    } catch (e) {
      console.error("Failed to compile curated rows:", e);
    }
  }

  return {
    searchResult,
    filters,
    curatedRows,
    activeFilters: {
      query,
      categoryId,
      locationId,
      offerId,
      page
    }
  };
});

// Slider Images defining the main promo carousel
const SLIDER_IMAGES = [
  { url: "https://beneficios.amepla.org.ar/images/slider/23-PHOTO-2026-05-05-16-00-15.jpg", title: "Beneficios de Temporada" },
  { url: "https://beneficios.amepla.org.ar/images/slider/24-23-930289de-f986-4060-b33c-2858b5b7ddef.jpg", title: "Salud & Cuidado" },
  { url: "https://beneficios.amepla.org.ar/images/slider/-DAZZLER SLIDE.jpg", title: "Hotelería Dazzler" },
  { url: "https://beneficios.amepla.org.ar/images/slider/26-0e3e1eaa-1394-4eed-a06e-da739f49e404.jpg", title: "Indumentaria & Calzado" },
  { url: "https://beneficios.amepla.org.ar/images/slider/27-PHOTO-2025-11-03-12-09-52.jpg", title: "Estética & Spa" },
  { url: "https://beneficios.amepla.org.ar/images/slider/-Tred Slide.jpg", title: "Gimnasio Tred" }
];

const getCategoryEmoji = (desc: string) => {
  const d = desc.toLowerCase();
  if (d.includes("gastro") || d.includes("restaurante") || d.includes("comida") || d.includes("café")) return "🍔";
  if (d.includes("turismo") || d.includes("viaje") || d.includes("hotel") || d.includes("alojamiento")) return "✈️";
  if (d.includes("moda") || d.includes("ropa") || d.includes("indumentaria") || d.includes("calzado")) return "👕";
  if (d.includes("salud") || d.includes("cuidado") || d.includes("estética") || d.includes("belleza")) return "🏥";
  if (d.includes("deporte") || d.includes("gimnasio") || d.includes("club") || d.includes("fitness")) return "🏋️‍♂️";
  if (d.includes("entretenimiento") || d.includes("cine") || d.includes("teatro") || d.includes("espectáculo")) return "🎬";
  if (d.includes("hogar") || d.includes("deco") || d.includes("mueble")) return "🏡";
  if (d.includes("servicio") || d.includes("auto") || d.includes("seguro")) return "🚗";
  return "🎟️";
};

export default component$(() => {
  const location = useLocation();
  const data = useBenefitsData();
  const currentSlide = useSignal(0);
  const user = useLayoutUser();
  const showFiltersDrawer = useSignal(false);
  const isMapView = location.url.searchParams.get("vista") === "mapa";

  const isMapLoaded = useSignal(false);
  const mapRef = useSignal<any>(null);
  const markersGroupRef = useSignal<any>(null);

  // Client-side initialization of Leaflet Map assets
  useVisibleTask$(() => {
    const loadMap = () => {
      isMapLoaded.value = true;
    };

    if (document.getElementById("leaflet-css")) {
      loadMap();
    } else {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = loadMap;
      document.head.appendChild(script);
    }
  });

  // Reactive tracker to plot/update Leaflet markers when active filters or benefits change
  useVisibleTask$(({ track }) => {
    const activeBenefits = track(() => data.value.searchResult.data);
    const view = track(() => isMapView);
    const loaded = track(() => isMapLoaded.value);

    if (!view || !loaded || typeof window === "undefined" || !(window as any).L) return;

    const L = (window as any).L;

    // 1. Initialize Map if not already created
    let map = mapRef.value;
    if (!map) {
      map = L.map("leaflet-map", {
        center: [-34.9205, -57.9536], // La Plata central coordinates
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      mapRef.value = map;
      markersGroupRef.value = L.layerGroup().addTo(map);
    }

    // 2. Clear previous markers
    const markersGroup = markersGroupRef.value;
    if (markersGroup) {
      markersGroup.clearLayers();
    }

    // 3. Filter benefits containing lat/lng values
    const mapBenefits = activeBenefits.filter(b => b.latitud && b.longitud);

    if (mapBenefits.length > 0) {
      const latLngs: any[] = [];

      mapBenefits.forEach((b) => {
        const lat = parseFloat(b.latitud!);
        const lng = parseFloat(b.longitud!);

        if (!isNaN(lat) && !isNaN(lng)) {
          latLngs.push([lat, lng]);

          const popupContent = `
            <div style="font-family: system-ui, sans-serif; max-width: 220px; text-align: left; padding: 2px;">
              ${b.imagen ? `<img src="https://beneficios.amepla.org.ar/files/${b.imagen}" style="width: 100%; height: 90px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />` : ''}
              <span style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #12633f; background: rgba(18,99,63,0.06); padding: 2px 6px; border-radius: 99px;">
                ${b.categorias[0]?.descripcion || 'Descuento'}
              </span>
              <h4 style="font-size: 13px; font-weight: 800; color: #072f1d; margin: 6px 0 4px 0; line-height: 1.25;">
                ${b.titulo}
              </h4>
              <p style="font-size: 11px; font-weight: 700; color: #d4a317; margin: 0 0 10px 0;">
                ${b.resumen}
              </p>
              <a href="/beneficio/${b.url}" style="display: block; text-align: center; background: #0a442a; color: white; padding: 6px 12px; border-radius: 8px; text-decoration: none; font-size: 10px; font-weight: bold; transition: all 0.2s;">
                Ver Detalles &rarr;
              </a>
            </div>
          `;

          L.marker([lat, lng])
            .bindPopup(popupContent, { maxWidth: 240 })
            .addTo(markersGroup);
        }
      });

      // Fit bounds to show markers automatically
      if (latLngs.length > 0) {
        map.fitBounds(latLngs, { padding: [40, 40] });
      }
    }
  });

  const { searchResult, filters, activeFilters, curatedRows } = data.value;
  const { data: benefits, total, totalPages, page } = searchResult;

  // Circular sticker label helper
  const extractPercent = (desc: string) => {
    const match = desc.match(/(\d+)%/);
    return match ? `${match[1]}% OFF` : desc.substring(0, 10);
  };

  // Navigation handlers
  const handlePrevSlide = $(() => {
    currentSlide.value = (currentSlide.value - 1 + SLIDER_IMAGES.length) % SLIDER_IMAGES.length;
  });

  const handleNextSlide = $(() => {
    currentSlide.value = (currentSlide.value + 1) % SLIDER_IMAGES.length;
  });

  // Construct URL string helper
  const getFilterUrl = (params: {
    buscar?: string;
    categoria?: number | null;
    ubicacion?: number | null;
    oferta?: number | null;
    page?: number;
    vista?: string | null;
  }) => {
    const searchParams = new URLSearchParams();
    
    // Copy existing active filters unless overridden
    const q = params.buscar !== undefined ? params.buscar : activeFilters.query;
    if (q) searchParams.set("buscar", q);
    
    const cat = params.categoria !== undefined ? params.categoria : activeFilters.categoryId;
    if (cat) searchParams.set("categoria", String(cat));
    
    const loc = params.ubicacion !== undefined ? params.ubicacion : activeFilters.locationId;
    if (loc) searchParams.set("ubicacion", String(loc));
    
    const off = params.oferta !== undefined ? params.oferta : activeFilters.offerId;
    if (off) searchParams.set("oferta", String(off));

    const p = params.page !== undefined ? params.page : 1;
    if (p > 1 && !params.vista) searchParams.set("page", String(p));

    const v = params.vista !== undefined ? params.vista : location.url.searchParams.get("vista");
    if (v && v !== "listado") searchParams.set("vista", v);

    return `/?${searchParams.toString()}`;
  };

  // Check if any filter is active
  const hasActiveFilters = activeFilters.query || activeFilters.categoryId || activeFilters.locationId || activeFilters.offerId;

  return (
    <div class="relative min-h-screen bg-slate-50">
      {/* Main Curated Showcase for Page 1 Home (When not in map mode and no filters are active) */}
      {!isMapView && !hasActiveFilters && page === 1 && curatedRows && (
        <>
          {/* 1. Optimized Hero Slider (Carousel) - Boxed with Curved Corners */}
          <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 pt-6 print:hidden">
            <section class="relative w-full h-[320px] md:h-[460px] bg-[#020617] overflow-hidden rounded-[2.5rem] border border-slate-200/50 shadow-lg group">
              {/* Slides */}
              <div class="relative w-full h-full flex items-center">
                {SLIDER_IMAGES.map((slide, idx) => (
                  <div
                    key={idx}
                    class={`absolute inset-0 w-full h-full transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) ${
                      idx === currentSlide.value ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0 pointer-events-none"
                    }`}
                  >
                    <div class="absolute inset-0 bg-gradient-to-t from-[#020617]/95 via-[#020617]/40 to-transparent z-10" />
                    <img
                      src={slide.url}
                      alt={slide.title}
                      fetchPriority={idx === 0 ? "high" : "low"}
                      loading={idx === 0 ? "eager" : "lazy"}
                      class="w-full h-full object-cover select-none group-hover:scale-105 transition-transform duration-1000"
                      width={1200}
                      height={460}
                    />
                    <div class="absolute bottom-12 left-6 md:left-14 lg:left-20 z-20 max-w-2xl text-white text-left">
                      <span class="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black bg-brand-gold text-brand-green-dark mb-4 shadow-lg tracking-widest uppercase border border-white/10">
                        Exclusivo AMP+
                      </span>
                      <h2 class="text-4xl md:text-5xl font-display font-extrabold tracking-tight drop-shadow-md text-white mb-2 leading-none">
                        {slide.title}
                      </h2>
                      <p class="text-slate-200 text-sm md:text-base drop-shadow font-medium max-w-lg leading-relaxed">
                        Presentá tu credencial digital y disfrutá de los mejores descuentos.
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Carousel Prev/Next Buttons */}
              <button
                onClick$={handlePrevSlide}
                class="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-black/30 hover:bg-brand-gold/80 text-white hover:text-brand-green-dark border border-white/20 hover:border-transparent transition-all duration-300 backdrop-blur-sm cursor-pointer shadow-md"
                aria-label="Slide anterior"
              >
                <svg class="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick$={handleNextSlide}
                class="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-black/30 hover:bg-brand-gold/80 text-white hover:text-brand-green-dark border border-white/20 hover:border-transparent transition-all duration-300 backdrop-blur-sm cursor-pointer shadow-md"
                aria-label="Próximo slide"
              >
                <svg class="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Slide Indicators */}
              <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex space-x-2">
                {SLIDER_IMAGES.map((_, idx) => (
                  <button
                    key={idx}
                    onClick$={() => (currentSlide.value = idx)}
                    class={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      idx === currentSlide.value ? "bg-brand-gold w-6" : "bg-white/55 hover:bg-white/80"
                    }`}
                    aria-label={`Ir al slide ${idx + 1}`}
                  />
                ))}
              </div>
            </section>
          </div>

          {/* Beautiful Horizontal Category Slider Bar */}
          <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 print:hidden text-left">
            <p class="text-[11px] font-black tracking-widest text-slate-400 uppercase mb-5 pl-1">Explorá por Categoría</p>
            <div class="flex items-center space-x-4 overflow-x-auto pb-3 scrollbar-none">
              {filters.categorias
                .filter(c => (c.beneficios_count || 0) > 0)
                .map((cat) => {
                  const emoji = getCategoryEmoji(cat.descripcion);
                  const isSelected = activeFilters.categoryId === cat.id;
                  return (
                    <Link
                      key={cat.id}
                      href={getFilterUrl({ categoria: isSelected ? null : cat.id, page: 1 })}
                      class={[
                        "flex flex-col items-center justify-center text-center p-4 rounded-[2rem] border transition-all duration-300 w-28 h-28 flex-shrink-0 select-none cursor-pointer",
                        isSelected
                          ? "bg-brand-green border-brand-green text-white shadow-lg shadow-brand-green/20 scale-95"
                          : "bg-white border-slate-200 text-slate-700 hover:border-brand-green/30 hover:shadow-md hover:scale-105"
                      ]}
                    >
                      <span class="text-3xl">{emoji}</span>
                      <span class="text-[10px] font-black uppercase tracking-wider mt-3 truncate max-w-[96px]">
                        {cat.descripcion}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </div>

          {/* 3. Themed Curated Rows (Inspired by Club LA NACION) */}
          {/* Row 1: Beneficios Relevantes */}
          <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 print:hidden text-left">
            <div class="flex items-end justify-between border-b border-slate-200/60 pb-3 mb-6">
              <div class="space-y-1">
                <div class="flex items-center space-x-2">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span class="text-[9px] font-black tracking-widest text-emerald-600 uppercase">Tendencias de la semana</span>
                </div>
                <h2 class="text-2xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
                  Beneficios Relevantes
                </h2>
              </div>
              <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Deslizá &rarr;</p>
            </div>
            
            <div class="flex items-center space-x-6 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
              {curatedRows.relevantes.map((benefit: Benefit) => (
                <div key={`rel-${benefit.id}`} class="w-[280px] sm:w-[320px] flex-shrink-0 snap-start select-none">
                  <Link
                    href={`/beneficio/${benefit.url}`}
                    class="group block bg-white border border-slate-100 rounded-[1.8rem] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative h-[300px]"
                  >
                    <div class="relative h-44 bg-slate-100 overflow-hidden flex items-center justify-center">
                      {benefit.imagen ? (
                        <img
                          src={`https://beneficios.amepla.org.ar/files/${benefit.imagen}`}
                          alt={benefit.titulo}
                          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          width={320}
                          height={176}
                          loading="lazy"
                        />
                      ) : (
                        <div class="flex flex-col items-center justify-center p-6 text-center h-full w-full bg-gradient-to-br from-slate-50 to-slate-100">
                          <span class="text-brand-green-dark font-display font-black text-2xl">AMP+</span>
                          <span class="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">{benefit.categorias[0]?.descripcion}</span>
                        </div>
                      )}
                      <div class="absolute top-3.5 left-3.5 z-10">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black bg-black/45 text-white backdrop-blur-sm border border-white/10 uppercase tracking-widest">
                          {benefit.categorias[0]?.descripcion || "Especial"}
                        </span>
                      </div>
                      {benefit.isPremiumOnly && (
                        <div class="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] flex flex-col justify-center items-center z-15 text-white">
                          <span class="text-2xl">🔒</span>
                          <span class="text-[9px] font-black tracking-widest uppercase text-brand-gold mt-1">Exclusivo Premium</span>
                        </div>
                      )}
                    </div>
                    <div class="p-5 flex flex-col justify-between h-[124px] bg-white text-left">
                      <div class="space-y-1">
                        <h3 class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest truncate">
                          {benefit.ubicacion[0]?.descripcion || "La Plata"}
                        </h3>
                        <h4 class="text-sm font-display font-extrabold text-slate-800 line-clamp-2 leading-snug group-hover:text-brand-green transition-colors duration-200">
                          {benefit.titulo}
                        </h4>
                      </div>
                      <div class="flex items-center justify-between pt-3 border-t border-slate-50">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">AMP+ Premium</span>
                        <span class="inline-flex items-center px-3 py-1 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-100/50 shadow-sm uppercase tracking-wide">
                          {benefit.resumen.replace("Descuento del", "").trim()}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* Row 2: Beneficios Destacados */}
          <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 print:hidden text-left">
            <div class="flex items-end justify-between border-b border-slate-200/60 pb-3 mb-6">
              <div class="space-y-1">
                <div class="flex items-center space-x-2">
                  <span class="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse"></span>
                  <span class="text-[9px] font-black tracking-widest text-brand-gold uppercase">Destacados de la semana</span>
                </div>
                <h2 class="text-2xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
                  Beneficios Destacados
                </h2>
              </div>
              <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Deslizá &rarr;</p>
            </div>
            
            <div class="flex items-center space-x-6 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
              {curatedRows.destacados.map((benefit: Benefit) => (
                <div key={`dest-${benefit.id}`} class="w-[280px] sm:w-[320px] flex-shrink-0 snap-start select-none">
                  <Link
                    href={`/beneficio/${benefit.url}`}
                    class="group block bg-white border border-slate-100 rounded-[1.8rem] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative h-[300px]"
                  >
                    <div class="relative h-44 bg-slate-100 overflow-hidden flex items-center justify-center">
                      {benefit.imagen ? (
                        <img
                          src={`https://beneficios.amepla.org.ar/files/${benefit.imagen}`}
                          alt={benefit.titulo}
                          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          width={320}
                          height={176}
                          loading="lazy"
                        />
                      ) : (
                        <div class="flex flex-col items-center justify-center p-6 text-center h-full w-full bg-gradient-to-br from-slate-50 to-slate-100">
                          <span class="text-brand-green-dark font-display font-black text-2xl">AMP+</span>
                          <span class="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">{benefit.categorias[0]?.descripcion}</span>
                        </div>
                      )}
                      <div class="absolute top-3.5 left-3.5 z-10">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black bg-black/45 text-white backdrop-blur-sm border border-white/10 uppercase tracking-widest">
                          {benefit.categorias[0]?.descripcion || "Especial"}
                        </span>
                      </div>
                      {benefit.isPremiumOnly && (
                        <div class="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] flex flex-col justify-center items-center z-15 text-white">
                          <span class="text-2xl">🔒</span>
                          <span class="text-[9px] font-black tracking-widest uppercase text-brand-gold mt-1">Exclusivo Premium</span>
                        </div>
                      )}
                    </div>
                    <div class="p-5 flex flex-col justify-between h-[124px] bg-white text-left">
                      <div class="space-y-1">
                        <h3 class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest truncate">
                          {benefit.ubicacion[0]?.descripcion || "La Plata"}
                        </h3>
                        <h4 class="text-sm font-display font-extrabold text-slate-800 line-clamp-2 leading-snug group-hover:text-brand-green transition-colors duration-200">
                          {benefit.titulo}
                        </h4>
                      </div>
                      <div class="flex items-center justify-between pt-3 border-t border-slate-50">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Destacado AMP+</span>
                        <span class="inline-flex items-center px-3 py-1 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-100/50 shadow-sm uppercase tracking-wide">
                          {benefit.resumen.replace("Descuento del", "").trim()}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* Curated Spotlight Section: Cafecitos & Desayunos */}
          {curatedRows.cafecitos.length > 0 && (
            <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-10 print:hidden text-left">
              <div class="bg-gradient-to-br from-[#0B1527] to-[#020617] border border-slate-800 rounded-[3rem] p-8 md:p-12 shadow-xl grid grid-cols-1 lg:grid-cols-4 gap-8 items-center relative overflow-hidden">
                <div class="absolute -right-16 -top-16 w-60 h-60 bg-brand-gold/10 rounded-full blur-[80px] pointer-events-none" />
                <div class="absolute -left-16 -bottom-16 w-60 h-60 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

                {/* Left column info */}
                <div class="lg:col-span-1 space-y-5 relative z-10 text-white flex flex-col justify-center h-full">
                  <div class="inline-flex items-center space-x-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse"></span>
                    <span class="text-[9px] font-black tracking-widest text-brand-gold uppercase">Selección Gourmet</span>
                  </div>
                  <h2 class="text-3xl md:text-4xl font-display font-extrabold text-white tracking-tight leading-tight">
                    ☕ Cafecitos & Desayunos
                  </h2>
                  <p class="text-xs text-slate-400 font-medium leading-relaxed">
                    Disfrutá del mejor aroma a café, desayunos premium y meriendas increíbles con tu credencial digital AMP+.
                  </p>
                  <div class="pt-2">
                    <Link
                      href={getFilterUrl({ categoria: 1, page: 1 })}
                      class="inline-flex items-center space-x-1 px-4 py-2 rounded-full bg-white/10 hover:bg-white text-white hover:text-slate-900 border border-white/10 hover:border-transparent text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer"
                    >
                      <span>Ver todos</span>
                      <span class="text-sm">&rarr;</span>
                    </Link>
                  </div>
                </div>

                {/* Right column coffee cards grid */}
                <div class="lg:col-span-3">
                  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                    {curatedRows.cafecitos.map((benefit: Benefit) => (
                      <Link
                        key={`coffee-${benefit.id}`}
                        href={`/beneficio/${benefit.url}`}
                        class="group block bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-3xl p-4 transition-all duration-300 hover:-translate-y-1 relative"
                      >
                        <div class="relative h-28 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center">
                          {benefit.imagen ? (
                            <img
                              src={`https://beneficios.amepla.org.ar/files/${benefit.imagen}`}
                              alt={benefit.titulo}
                              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              width={200}
                              height={112}
                              loading="lazy"
                            />
                          ) : (
                            <span class="text-brand-gold font-display font-extrabold text-base">AMP+</span>
                          )}
                          <div class="absolute bottom-2 right-2 z-10">
                            <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black bg-brand-gold text-slate-900 shadow-md tracking-tight">
                              {benefit.resumen.replace("Descuento del", "").trim()}
                            </span>
                          </div>
                        </div>
                        <div class="mt-3.5 text-left">
                          <h4 class="text-[9px] font-bold text-brand-gold uppercase tracking-wider truncate">
                            {benefit.ubicacion[0]?.descripcion || "La Plata"}
                          </h4>
                          <h3 class="text-xs font-display font-extrabold text-slate-100 group-hover:text-white line-clamp-2 mt-1 leading-snug">
                            {benefit.titulo}
                          </h3>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Row 3: Nuevos Beneficios */}
          <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 print:hidden text-left">
            <div class="flex items-end justify-between border-b border-slate-200/60 pb-3 mb-6">
              <div class="space-y-1">
                <div class="flex items-center space-x-2">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span class="text-[9px] font-black tracking-widest text-emerald-600 uppercase">Recién incorporados</span>
                </div>
                <h2 class="text-2xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
                  Nuevos Beneficios
                </h2>
              </div>
              <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Deslizá &rarr;</p>
            </div>
            
            <div class="flex items-center space-x-6 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
              {curatedRows.nuevos.map((benefit: Benefit) => (
                <div key={`new-${benefit.id}`} class="w-[280px] sm:w-[320px] flex-shrink-0 snap-start select-none">
                  <Link
                    href={`/beneficio/${benefit.url}`}
                    class="group block bg-white border border-slate-100 rounded-[1.8rem] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative h-[300px]"
                  >
                    <div class="relative h-44 bg-slate-100 overflow-hidden flex items-center justify-center">
                      {benefit.imagen ? (
                        <img
                          src={`https://beneficios.amepla.org.ar/files/${benefit.imagen}`}
                          alt={benefit.titulo}
                          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          width={320}
                          height={176}
                          loading="lazy"
                        />
                      ) : (
                        <div class="flex flex-col items-center justify-center p-6 text-center h-full w-full bg-gradient-to-br from-slate-50 to-slate-100">
                          <span class="text-brand-green-dark font-display font-black text-2xl">AMP+</span>
                          <span class="text-slate-400 text-[10px] font-bold uppercase tracking-wider mt-1">{benefit.categorias[0]?.descripcion}</span>
                        </div>
                      )}
                      <div class="absolute top-3.5 left-3.5 z-10">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black bg-black/45 text-white backdrop-blur-sm border border-white/10 uppercase tracking-widest">
                          {benefit.categorias[0]?.descripcion || "Especial"}
                        </span>
                      </div>
                      {benefit.isPremiumOnly && (
                        <div class="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px] flex flex-col justify-center items-center z-15 text-white">
                          <span class="text-2xl">🔒</span>
                          <span class="text-[9px] font-black tracking-widest uppercase text-brand-gold mt-1">Exclusivo Premium</span>
                        </div>
                      )}
                    </div>
                    <div class="p-5 flex flex-col justify-between h-[124px] bg-white text-left">
                      <div class="space-y-1">
                        <h3 class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest truncate">
                          {benefit.ubicacion[0]?.descripcion || "La Plata"}
                        </h3>
                        <h4 class="text-sm font-display font-extrabold text-slate-800 line-clamp-2 leading-snug group-hover:text-brand-green transition-colors duration-200">
                          {benefit.titulo}
                        </h4>
                      </div>
                      <div class="flex items-center justify-between pt-3 border-t border-slate-50">
                        <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nuevo Ingreso</span>
                        <span class="inline-flex items-center px-3 py-1 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-100/50 shadow-sm uppercase tracking-wide">
                          {benefit.resumen.replace("Descuento del", "").trim()}
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Editorial Space: Tu espacio Club AMP+ */}
          <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-10 print:hidden text-left">
            <div class="border-t border-slate-200/80 pt-10 mb-8 space-y-2">
              <p class="text-[9px] font-black tracking-widest text-slate-400 uppercase">Beneficios y Novedades</p>
              <h2 class="text-2xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
                Tu espacio Club AMP<span class="text-brand-gold">+</span>
              </h2>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              <div class="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <span class="text-3xl block mb-4">📱</span>
                <h3 class="text-sm font-display font-extrabold text-slate-800 font-semibold">Credencial Digital</h3>
                <p class="text-xs text-slate-500 mt-2 leading-relaxed font-medium">
                  Llevá tu credencial de agremiado siempre con vos en el celular para validar tus descuentos al instante.
                </p>
              </div>

              <div class="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <span class="text-3xl block mb-4">🎁</span>
                <h3 class="text-sm font-display font-extrabold text-slate-800 font-semibold">Sorteos de Fin de Mes</h3>
                <p class="text-xs text-slate-500 mt-2 leading-relaxed font-medium">
                  Participá de manera directa en nuestros sorteos mensuales exclusivos para la comunidad médica platense.
                </p>
              </div>

              <div class="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <span class="text-3xl block mb-4">🛒</span>
                <h3 class="text-sm font-display font-extrabold text-slate-800 font-semibold">Sugerí Comercios</h3>
                <p class="text-xs text-slate-500 mt-2 leading-relaxed font-medium">
                  ¿Querés descuentos en tu negocio favorito? Envianos tu sugerencia y nos encargaremos del resto.
                </p>
              </div>

              <div class="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <span class="text-3xl block mb-4">💬</span>
                <h3 class="text-sm font-display font-extrabold text-slate-800 font-semibold">Asistencia Médica IA</h3>
                <p class="text-xs text-slate-500 mt-2 leading-relaxed font-medium">
                  Conversá con nuestro chatbot inteligente para encontrar beneficios de forma guiada en segundos.
                </p>
              </div>
            </div>
          </section>

          {/* Brands row */}
          <section class="bg-white border-y border-slate-100 py-8 print:hidden my-6">
            <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
              <p class="text-center text-[10px] font-black tracking-widest text-slate-400 uppercase mb-4">Nuestras Marcas Asociadas</p>
              <div class="flex flex-wrap items-center justify-center gap-4 sm:gap-8 md:gap-12">
                <div class="flex items-center space-x-2 bg-slate-50 border border-slate-200/60 px-4 py-2 rounded-full shadow-sm hover:scale-105 transition-all">
                  <span class="text-brand-green font-display font-extrabold text-xs tracking-wider">🏨 DAZZLER HOTELES</span>
                </div>
                <div class="flex items-center space-x-2 bg-slate-50 border border-slate-200/60 px-4 py-2 rounded-full shadow-sm hover:scale-105 transition-all">
                  <span class="text-brand-green font-display font-extrabold text-xs tracking-wider">🏋️‍♀️ TRED GIMNASIO</span>
                </div>
                <div class="flex items-center space-x-2 bg-slate-50 border border-slate-200/60 px-4 py-2 rounded-full shadow-sm hover:scale-105 transition-all">
                  <span class="text-brand-green font-display font-extrabold text-xs tracking-wider">🍽️ MERCADO 55</span>
                </div>
                <div class="flex items-center space-x-2 bg-slate-50 border border-slate-200/60 px-4 py-2 rounded-full shadow-sm hover:scale-105 transition-all">
                  <span class="text-brand-green font-display font-extrabold text-xs tracking-wider">🛒 NINI SUPERMERCADO</span>
                </div>
                <div class="flex items-center space-x-2 bg-slate-50 border border-slate-200/60 px-4 py-2 rounded-full shadow-sm hover:scale-105 transition-all">
                  <span class="text-brand-green font-display font-extrabold text-xs tracking-wider">🛶 FINCA LOS CAUQUENES</span>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* 2. Main Search & Filter Navigation Section */}
      <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Dynamic header / breadcrumb style */}
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-5 mb-8 gap-4">
          <div class="text-left">
            <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
              {isMapView 
                ? "📍 Beneficios Cerca Mío" 
                : hasActiveFilters || page > 1 
                  ? "Resultados de Búsqueda" 
                  : "Explorá toda la cartilla"
              }
            </h1>
            <p class="text-slate-500 text-sm mt-2 font-medium">
              {isMapView 
                ? `${benefits.filter(b => b.latitud && b.longitud).length} sucursales ubicadas en el mapa`
                : `${total} beneficios encontrados en total`
              }
            </p>
          </div>

          {/* List/Map View Mode Toggle Button */}
          <div class="flex items-center bg-slate-200/60 p-1 rounded-2xl border border-slate-200/40 shadow-inner z-20 select-none">
            <Link
              href={getFilterUrl({ vista: "listado" })}
              class={[
                "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                !isMapView
                  ? "bg-white text-brand-green shadow-sm border border-slate-200/20"
                  : "text-slate-500 hover:text-slate-800"
              ]}
            >
              <span>📋</span>
              <span>Listado</span>
            </Link>
            <Link
              href={getFilterUrl({ vista: "mapa" })}
              class={[
                "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                isMapView
                  ? "bg-white text-brand-green shadow-sm border border-slate-200/20"
                  : "text-slate-500 hover:text-slate-800"
              ]}
            >
              <span>🗺️</span>
              <span>Mapa</span>
            </Link>
          </div>

          {/* Active filters pill list */}
          {hasActiveFilters && (
            <div class="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
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

              <Link
                href="/"
                class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors duration-200"
              >
                Limpiar todo
              </Link>
            </div>
          )}
        </div>

        {/* 3. Grid Structure with Sidebar Filters */}
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* A. Desktop Sidebar Filters (Hidden on Mobile) */}
          <aside class="hidden lg:block space-y-6">
            {/* Filter Section Title */}
            <div class="bg-brand-green text-white p-4 rounded-t-xl border border-brand-green flex items-center justify-between shadow-sm">
              <span class="font-display font-bold text-sm tracking-wider uppercase">Filtros Avanzados</span>
              <svg class="w-4 h-4 text-brand-gold" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
            </div>
            
            <div class="bg-white p-5 rounded-b-xl border border-t-0 border-slate-200 shadow-sm space-y-8">
              {/* Category Filter */}
              <div>
                <h3 class="font-display font-semibold text-slate-800 text-sm border-b border-slate-100 pb-2 mb-3">
                  Categorías
                </h3>
                <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {filters.categorias
                    .filter(c => (c.beneficios_count || 0) > 0)
                    .map((cat) => (
                      <Link
                        key={cat.id}
                        href={getFilterUrl({ categoria: activeFilters.categoryId === cat.id ? null : cat.id, page: 1 })}
                        class={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg transition-all ${
                          activeFilters.categoryId === cat.id
                            ? "bg-brand-green text-white font-bold"
                            : "text-slate-600 hover:bg-slate-50 hover:text-brand-green"
                        }`}
                      >
                        <span class="truncate">{cat.descripcion}</span>
                        <span class={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          activeFilters.categoryId === cat.id ? "bg-brand-green-dark text-brand-gold" : "bg-slate-100 text-slate-500"
                        }`}>
                          {cat.beneficios_count}
                        </span>
                      </Link>
                    ))}
                </div>
              </div>

              {/* Location Filter */}
              <div>
                <h3 class="font-display font-semibold text-slate-800 text-sm border-b border-slate-100 pb-2 mb-3">
                  Ubicaciones
                </h3>
                <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {filters.ubicaciones
                    .filter(u => (u.beneficios_count || 0) > 0)
                    .map((loc) => (
                      <Link
                        key={loc.id}
                        href={getFilterUrl({ ubicacion: activeFilters.locationId === loc.id ? null : loc.id, page: 1 })}
                        class={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg transition-all ${
                          activeFilters.locationId === loc.id
                            ? "bg-brand-green text-white font-bold"
                            : "text-slate-600 hover:bg-slate-50 hover:text-brand-green"
                        }`}
                      >
                        <span class="truncate">{loc.descripcion}</span>
                        <span class={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          activeFilters.locationId === loc.id ? "bg-brand-green-dark text-brand-gold" : "bg-slate-100 text-slate-500"
                        }`}>
                          {loc.beneficios_count}
                        </span>
                      </Link>
                    ))}
                </div>
              </div>

              {/* Offers/Discounts Filter */}
              <div>
                <h3 class="font-display font-semibold text-slate-800 text-sm border-b border-slate-100 pb-2 mb-4">
                  Descuentos Exclusivos
                </h3>
                <div class="grid grid-cols-3 gap-2">
                  {filters.ofertas
                    .filter(o => (o.beneficios_count || 0) > 0)
                    .map((off) => {
                      const label = extractPercent(off.descripcion);
                      const isSelected = activeFilters.offerId === off.id;
                      return (
                        <Link
                          key={off.id}
                          href={getFilterUrl({ oferta: isSelected ? null : off.id, page: 1 })}
                          class={`relative flex flex-col items-center justify-center p-2 rounded-2xl border aspect-square text-center transition-all duration-300 transform hover:scale-110 hover:-rotate-3 select-none cursor-pointer ${
                            isSelected
                              ? "bg-brand-gold border-brand-green-dark text-brand-green-dark font-black scale-105 rotate-2 shadow-[3px_3px_0px_#072f1d]"
                              : "bg-white border-slate-200 text-slate-700 hover:border-brand-gold hover:text-brand-green shadow-sm hover:shadow-[3px_3px_0px_rgba(10,68,42,0.15)]"
                          }`}
                        >
                          <span class="text-[11px] font-display font-black leading-none block uppercase tracking-tight">{label}</span>
                          <span class="text-[8px] font-extrabold text-slate-400 block mt-1">({off.beneficios_count})</span>
                        </Link>
                      );
                    })}
                </div>
              </div>
            </div>
          </aside>

          {/* B. Mobile Filter Trigger Button & Accordion (Hidden on Desktop) */}
          <div class="lg:hidden col-span-1">
            <button
              onClick$={() => (showFiltersDrawer.value = !showFiltersDrawer.value)}
              class="w-full flex items-center justify-center space-x-2 bg-brand-green text-white py-3 px-4 rounded-xl shadow-md font-semibold text-sm hover:bg-brand-green-light active:scale-[0.98] transition-all cursor-pointer"
            >
              <svg class="w-5 h-5 text-brand-gold" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              <span>{showFiltersDrawer.value ? "Ocultar Filtros" : "Mostrar Filtros Avanzados"}</span>
            </button>

            {/* Mobile Filters Accordion Drawer */}
            <div class={`transition-all duration-300 overflow-hidden ${
              showFiltersDrawer.value ? "max-h-[1200px] mt-4 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
            }`}>
              <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-6">
                
                {/* Category Mobile */}
                <div>
                  <h4 class="font-semibold text-slate-800 text-xs uppercase tracking-wider border-b pb-1 mb-2">Categorías</h4>
                  <div class="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {filters.categorias
                      .filter(c => (c.beneficios_count || 0) > 0)
                      .map(cat => (
                        <Link
                          key={cat.id}
                          href={getFilterUrl({ categoria: activeFilters.categoryId === cat.id ? null : cat.id, page: 1 })}
                          class={`text-xs px-3 py-1.5 rounded-full transition-all ${
                            activeFilters.categoryId === cat.id
                              ? "bg-brand-green text-white font-bold"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {cat.descripcion} ({cat.beneficios_count})
                        </Link>
                      ))}
                  </div>
                </div>

                {/* Location Mobile */}
                <div>
                  <h4 class="font-semibold text-slate-800 text-xs uppercase tracking-wider border-b pb-1 mb-2">Ubicaciones</h4>
                  <div class="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                    {filters.ubicaciones
                      .filter(u => (u.beneficios_count || 0) > 0)
                      .map(loc => (
                        <Link
                          key={loc.id}
                          href={getFilterUrl({ ubicacion: activeFilters.locationId === loc.id ? null : loc.id, page: 1 })}
                          class={`text-xs px-3 py-1.5 rounded-full transition-all ${
                            activeFilters.locationId === loc.id
                              ? "bg-brand-green text-white font-bold"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {loc.descripcion} ({loc.beneficios_count})
                        </Link>
                      ))}
                  </div>
                </div>

                {/* Offer Mobile */}
                <div>
                  <h4 class="font-semibold text-slate-800 text-xs uppercase tracking-wider border-b pb-1 mb-2">Descuentos</h4>
                  <div class="flex flex-wrap gap-1.5">
                    {filters.ofertas
                      .filter(o => (o.beneficios_count || 0) > 0)
                      .map(off => (
                        <Link
                          key={off.id}
                          href={getFilterUrl({ oferta: activeFilters.offerId === off.id ? null : off.id, page: 1 })}
                          class={`text-xs px-3 py-1.5 rounded-full transition-all ${
                            activeFilters.offerId === off.id
                              ? "bg-brand-green text-white font-bold"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {off.descripcion} ({off.beneficios_count})
                        </Link>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* C. Benefits Grid & Pagination */}
          <div class="lg:col-span-3 space-y-10">
            {isMapView ? (
              /* Interactive Map View Mode */
              <div class="space-y-6 animate-in fade-in duration-300">
                <div class="w-full h-[580px] border border-slate-200 rounded-3xl bg-slate-50 overflow-hidden relative shadow-sm z-10 flex flex-col justify-end">
                  <div id="leaflet-map" class="w-full h-full z-10" />
                  {!isMapLoaded.value && (
                    <div class="absolute inset-0 bg-slate-50 flex flex-col items-center justify-center z-20 space-y-3">
                      <span class="text-3xl animate-bounce">📍</span>
                      <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">Cargando Mapa de Cobertura...</span>
                    </div>
                  )}
                </div>
                <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4 text-left">
                  <span class="text-2xl">💡</span>
                  <div class="text-xs font-semibold text-slate-600">
                    <span class="block text-slate-800 font-extrabold uppercase text-[10px] tracking-wider mb-1">Buscar por Coordenadas</span>
                    Acercá el mapa o filtrá por la categoría deseada usando el panel de la izquierda. Los marcadores te mostrarán las sucursales de descuentos en tiempo real en tu área de cercanía.
                  </div>
                </div>
              </div>
            ) : (
              /* Standard Grid & List View Mode */
              <>

            {benefits.length === 0 ? (
              // Empty State
              <div class="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
                <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 class="text-xl font-display font-bold text-slate-700">No se encontraron beneficios</h3>
                <p class="text-slate-400 text-sm mt-2 max-w-md mx-auto">
                  Prueba cambiando las palabras clave de búsqueda o limpiando los filtros para ver todos los beneficios de la cartilla.
                </p>
                <Link
                  href="/"
                  class="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-brand-green text-white text-sm font-semibold mt-6 hover:bg-brand-green-light transition-all shadow-md"
                >
                  Ver todos los beneficios
                </Link>
              </div>
            ) : (
              // Benefits Grid
              <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {benefits.map((benefit: Benefit) => {
                  const hasImage = benefit.imagen;
                  const imageUrl = hasImage
                    ? `https://beneficios.amepla.org.ar/files/${benefit.imagen}`
                    : null;
                  
                  // Primary Category
                  const primaryCat = benefit.categorias[0]?.descripcion || "Beneficio";
                  // Primary Location
                  const primaryLoc = benefit.ubicacion[0]?.descripcion || "Prov. Buenos Aires";
                  // Primary Discount badge text
                  const discountText = benefit.resumen?.trim() || "Beneficio Exclusivo";

                  const isPremiumOnly = benefit.isPremiumOnly || (benefit.id % 7 === 0);
                  const isLocked = isPremiumOnly && user.value?.role !== "premium";

                  return (
                    <div
                      key={benefit.id}
                      class={`group flex flex-col glass-card border rounded-2xl overflow-hidden shadow-sm relative transition-all duration-300 ${
                        isPremiumOnly
                          ? "border-amber-200/60 hover:shadow-amber-100"
                          : "border-slate-200"
                      }`}
                    >
                      {/* Benefit Card Image Container */}
                      <div class="relative h-48 bg-brand-green-dark flex items-center justify-center overflow-hidden border-b border-slate-100">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={benefit.titulo}
                            loading="lazy"
                            class={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out ${
                              isLocked ? "blur-[3px] opacity-75" : ""
                            }`}
                            width={400}
                            height={192}
                          />
                        ) : (
                          // Premium dark fallback card
                          <div class={`flex flex-col items-center justify-center p-6 text-center h-full select-none ${isLocked ? "blur-[3px] opacity-75" : ""}`}>
                            <span class="text-brand-gold text-4xl font-display font-black tracking-tight leading-none">
                              AMP<span class="text-white">+</span>
                            </span>
                            <span class="text-white text-xs font-bold uppercase tracking-wider mt-2">
                              {primaryCat}
                            </span>
                          </div>
                        )}

                        {/* Lock Overlay for Standard Users on Premium Benefits */}
                        {isLocked && (
                          <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex flex-col justify-center items-center z-20 text-white animate-fade-in">
                            <span class="text-3xl">🔒</span>
                            <span class="text-[10px] font-extrabold tracking-widest uppercase text-brand-gold mt-1.5">
                              Exclusivo Premium
                            </span>
                          </div>
                        )}

                        {/* Floating Offer Badge */}
                        <div class="absolute top-3.5 right-3.5 z-10">
                          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-brand-gold text-brand-green-dark border border-brand-gold shadow-md tracking-wide">
                            {discountText.replace("Descuento del", "").trim()}
                          </span>
                        </div>

                        {/* Floating Category Pill */}
                        <div class="absolute bottom-3 left-3 z-10">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-black/45 text-white backdrop-blur-sm border border-white/10 uppercase tracking-wide">
                            {primaryCat}
                          </span>
                        </div>
                      </div>

                      {/* Benefit Card Body */}
                      <div class="flex-grow p-5 flex flex-col justify-between">
                        <div class="space-y-2">
                          {/* Location pin badge */}
                          <div class="flex items-center text-brand-green-light space-x-1">
                            <svg class="w-3.5 h-3.5 text-brand-gold fill-current" viewBox="0 0 24 24">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                            </svg>
                            <span class="text-[11px] font-bold uppercase tracking-wider">
                              {primaryLoc}
                            </span>
                          </div>

                          <h3 class="text-base font-display font-extrabold text-slate-800 leading-snug line-clamp-2 group-hover:text-brand-green-light transition-colors duration-300">
                            {benefit.titulo}
                          </h3>

                          {/* Short descriptions using a safe text slicer snippet */}
                          <p class="text-xs text-slate-500 line-clamp-3">
                            {benefit.descripcion
                              ? benefit.descripcion.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
                              : "No hay descripción disponible para este beneficio."}
                          </p>
                        </div>

                        {/* Action Link Button */}
                        <div class="pt-5 border-t border-slate-100 mt-4">
                          {isLocked ? (
                            <Link
                              href="/perfil"
                              class="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-brand-gold text-slate-900 font-extrabold text-xs shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer animate-pulse"
                            >
                              <span>👑 Desbloquear Premium</span>
                            </Link>
                          ) : (
                            <Link
                              href={`/beneficio/${benefit.url}`}
                              class="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-50 group-hover:bg-brand-green hover:bg-brand-green text-slate-700 group-hover:text-white font-bold text-xs shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
                            >
                              <span>Ver Detalles</span>
                              <svg class="w-3.5 h-3.5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* D. Centered Pagination Controls */}
            {totalPages > 1 && (
              <nav class="flex items-center justify-center space-x-1.5 pt-8 border-t border-slate-200">
                {/* Prev Button */}
                <Link
                  href={page > 1 ? getFilterUrl({ page: page - 1 }) : undefined}
                  class={`p-2.5 rounded-xl border text-sm font-semibold transition-all shadow-sm ${
                    page > 1
                      ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer"
                      : "border-slate-100 bg-slate-50 text-slate-300 pointer-events-none"
                  }`}
                  aria-label="Página anterior"
                >
                  <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>

                {/* Page indicators */}
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNum = idx + 1;
                  // Show current page, previous, next, first and last page, plus ellipsis if needed
                  const isCurrent = pageNum === page;
                  const isNear = Math.abs(pageNum - page) <= 1;
                  const isEdge = pageNum === 1 || pageNum === totalPages;

                  if (!isNear && !isEdge) {
                    // Render ellipsis only once
                    if (pageNum === 2 || pageNum === totalPages - 1) {
                      return <span key={pageNum} class="text-slate-400 text-xs px-1">...</span>;
                    }
                    return null;
                  }

                  return (
                    <Link
                      key={pageNum}
                      href={getFilterUrl({ page: pageNum })}
                      class={`w-10 h-10 flex items-center justify-center text-xs font-bold rounded-xl transition-all shadow-sm ${
                        isCurrent
                          ? "bg-brand-green text-white border border-brand-green"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 active:scale-95 cursor-pointer"
                      }`}
                    >
                      {pageNum}
                    </Link>
                  );
                })}

                {/* Next Button */}
                <Link
                  href={page < totalPages ? getFilterUrl({ page: page + 1 }) : undefined}
                  class={`p-2.5 rounded-xl border text-sm font-semibold transition-all shadow-sm ${
                    page < totalPages
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
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Portal de Beneficios Oficial - Agremiación Médica Platense",
  meta: [
    {
      name: "description",
      content: "Exclusivo club de beneficios para agremiados y empleados de la AMP. Disfrutá de más de 250 comercios con descuentos especiales, promociones, y sorteos increíbles."
    },
    {
      property: "og:title",
      content: "Portal de Beneficios Oficial - Agremiación Médica Platense"
    },
    {
      property: "og:description",
      content: "Ahorrá y disfrutá con la cartilla de beneficios médicos de la AMP. Descuentos en turismo, gastronomía, indumentaria, belleza y mucho más."
    }
  ]
};
