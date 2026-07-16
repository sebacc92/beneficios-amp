import { component$, useSignal, useVisibleTask$, useComputed$, $ } from "@builder.io/qwik";
import { routeLoader$, Link, useLocation, type DocumentHead } from "@builder.io/qwik-city";
import { searchBenefits, getFilters, type Benefit } from "~/server/cache";

import { LuMapPin, LuList, LuSearch, LuFilter, LuRefreshCw } from "@qwikest/icons/lucide";

// Server Loader to fetch all benefits that have coordinates and all filters
export const useBenefitsMapData = routeLoader$(async (event) => {
  const searchResult = await searchBenefits({
    limit: 1000,
    requestEvent: event
  });
  
  const filters = await getFilters();

  return {
    benefits: searchResult.data.filter(b => b.latitud && b.longitud && !isNaN(Number(b.latitud)) && !isNaN(Number(b.longitud))),
    filters
  };
});

export default component$(() => {
  const location = useLocation();
  const data = useBenefitsMapData();


  // Reactive state signals for client-side filtering
  const searchQuery = useSignal(location.url.searchParams.get("buscar") || "");
  const selectedCategory = useSignal<number | null>(
    location.url.searchParams.get("categoria") ? Number(location.url.searchParams.get("categoria")) : null
  );

  const visibleCount = useSignal(0);
  const isMapLoaded = useSignal(false);
  const mapRef = useSignal<any>(null);
  const markersGroupRef = useSignal<any>(null);
  // Markers indexados por slug del beneficio (para sincronizar con la lista).
  const markersByUrlRef = useSignal<Record<string, any>>({});
  // Beneficio actualmente resaltado (por hover/click en lista o marker).
  const activeUrl = useSignal<string | null>(null);

  // Beneficios filtrados (misma lógica que los markers). Alimenta la lista de
  // sugerencias y el rearmado de markers.
  const filteredBenefits = useComputed$(() => {
    const query = searchQuery.value.toLowerCase().trim();
    const catId = selectedCategory.value;
    return data.value.benefits.filter((b: Benefit) => {
      if (catId && !b.categorias.some((c) => c.id === catId)) return false;
      if (query) {
        const titleMatch = b.titulo.toLowerCase().includes(query);
        const descMatch = b.descripcion.toLowerCase().includes(query);
        const catMatch = b.categorias.some((c) => c.descripcion.toLowerCase().includes(query));
        return titleMatch || descMatch || catMatch;
      }
      return true;
    });
  });

  // Sugerencias visibles bajo el buscador (máx 6, sólo mientras se tipea).
  const suggestions = useComputed$(() =>
    searchQuery.value.trim() ? filteredBenefits.value.slice(0, 6) : []
  );

  // Centra el mapa en el marker del beneficio y lo resalta (hover/focus en lista).
  const focusBenefit = $((url: string) => {
    activeUrl.value = url;
    const marker = markersByUrlRef.value[url];
    if (marker && mapRef.value) {
      mapRef.value.panTo(marker.getLatLng(), { animate: true });
    }
  });

  // Centra + abre el popup del marker (click en la lista).
  const openBenefit = $((url: string) => {
    activeUrl.value = url;
    const marker = markersByUrlRef.value[url];
    if (marker && mapRef.value) {
      const targetZoom = Math.max(mapRef.value.getZoom() || 13, 15);
      mapRef.value.setView(marker.getLatLng(), targetZoom, { animate: true });
      marker.openPopup();
    }
  });

  // Sync state signals to URL parameters without reloading
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => searchQuery.value);
    track(() => selectedCategory.value);

    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    if (searchQuery.value.trim()) {
      url.searchParams.set("buscar", searchQuery.value.trim());
    } else {
      url.searchParams.delete("buscar");
    }

    if (selectedCategory.value) {
      url.searchParams.set("categoria", String(selectedCategory.value));
    } else {
      url.searchParams.delete("categoria");
    }

    window.history.replaceState({}, "", url.toString());
  });

  // Calculate dynamic Listado URL
  const listadoHref = useComputed$(() => {
    const params = new URLSearchParams();
    if (searchQuery.value.trim()) params.set("buscar", searchQuery.value.trim());
    if (selectedCategory.value) params.set("categoria", String(selectedCategory.value));
    return `/beneficios?${params.toString()}`;
  });

  // Loader for Leaflet JS and CSS stylesheets
  // eslint-disable-next-line qwik/no-use-visible-task
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

  // Initialize the Leaflet map object
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => isMapLoaded.value);

    if (!isMapLoaded.value || typeof window === "undefined" || mapRef.value) return;

    const L = (window as any).L;
    if (!L) return;

    // Center coordinates for La Plata, Argentina
    const defaultCenter = [-34.9214, -57.9545];
    const map = L.map("map-view-container", {
      scrollWheelZoom: true,
      zoomControl: false
    }).setView(defaultCenter, 13);

    // Place zoom controls on bottom-right to avoid overlap with floating panel
    L.control.zoom({
      position: "bottomright"
    }).addTo(map);

    mapRef.value = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    }).addTo(map);

    const markersGroup = L.featureGroup().addTo(map);
    markersGroupRef.value = markersGroup;
  });

  // Re-build markers dynamically based on filter values
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => isMapLoaded.value);
    track(() => filteredBenefits.value);

    if (!isMapLoaded.value || !mapRef.value || !markersGroupRef.value) return;

    const L = (window as any).L;
    const markersGroup = markersGroupRef.value;
    markersGroup.clearLayers();

    const greenIcon = L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    const filtered = filteredBenefits.value;
    const nextMarkers: Record<string, any> = {};

    filtered.forEach((benefit) => {
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
          <span class="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black bg-brand-green/10 text-brand-green uppercase tracking-wider mb-1">
            ${primaryCat}
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

      const marker = L.marker([lat, lng], { icon: greenIcon })
        .bindPopup(popupHTML)
        .addTo(markersGroup);

      // Hover/click en el marker → resalta el ítem en la lista.
      marker.on("mouseover", () => { activeUrl.value = benefit.url; });
      marker.on("click", () => { activeUrl.value = benefit.url; });

      nextMarkers[benefit.url] = marker;
    });

    markersByUrlRef.value = nextMarkers;
    visibleCount.value = filtered.length;

    if (filtered.length > 0) {
      try {
        setTimeout(() => {
          mapRef.value.fitBounds(markersGroup.getBounds(), { padding: [40, 40] });
        }, 50);
      } catch (e) {
        console.error("Error setting bounds:", e);
      }
    }
  });

  // Resalta el marker activo (icono dorado) y desplaza la lista al ítem.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => activeUrl.value);
    if (!isMapLoaded.value || typeof window === "undefined") return;

    const L = (window as any).L;
    if (!L) return;

    const greenIcon = L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
    });
    const goldIcon = L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
    });

    const markers = markersByUrlRef.value;
    for (const [url, marker] of Object.entries(markers)) {
      const isActive = url === activeUrl.value;
      (marker as any).setIcon(isActive ? goldIcon : greenIcon);
      if (isActive) (marker as any).setZIndexOffset(1000);
      else (marker as any).setZIndexOffset(0);
    }

    // Desplazar el ítem de la lista a la vista si hace falta.
    if (activeUrl.value) {
      const el = document.getElementById(`sug-${activeUrl.value}`);
      if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  return (
    <div class="relative w-full h-[calc(100vh-140px)] min-h-[500px] md:h-[650px] overflow-hidden flex flex-col">
      {/* Map Container Element */}
      <div id="map-view-container" class="absolute inset-0 w-full h-full z-0" />

      {/* Floating Modern Glassmorphism Controls Card */}
      <div class="absolute top-4 left-4 z-10 max-w-sm w-[90%] bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-3xl p-5 flex flex-col gap-4 text-slate-800 pointer-events-auto animate-slide-in-left">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2">
          <div class="flex items-center space-x-2">
            <div class="w-8 h-8 rounded-full bg-brand-green/10 flex items-center justify-center">
              <LuMapPin class="w-4 h-4 text-brand-green" />
            </div>
            <div>
              <h2 class="text-sm font-black uppercase tracking-wider text-slate-900 leading-none">Beneficios AMP+</h2>
              <span class="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5 block">
                {visibleCount.value} sucursales visibles
              </span>
            </div>
          </div>
          <Link
            href={listadoHref.value}
            class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-brand-green bg-slate-50 hover:bg-brand-green/5 text-slate-600 hover:text-brand-green text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer"
          >
            <LuList class="w-3.5 h-3.5" />
            <span>Listado</span>
          </Link>
        </div>

        {/* Text Search Box */}
        <div class="relative">
          <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Buscar</label>
          <div class="relative flex items-center">
            <input
              type="text"
              placeholder="Ej: Gimnasio, Helado, Cafetería..."
              value={searchQuery.value}
              onInput$={(ev, el) => {
                searchQuery.value = el.value;
              }}
              class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
            />
            <LuSearch class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
          </div>

          {/* Sugerencias sincronizadas con los markers (máx 6). */}
          {suggestions.value.length > 0 && (
            <ul
              class="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm"
              onMouseLeave$={() => { activeUrl.value = null; }}
            >
              {suggestions.value.map((b) => {
                const isActive = activeUrl.value === b.url;
                return (
                  <li key={b.url} id={`sug-${b.url}`}>
                    <button
                      type="button"
                      onMouseEnter$={() => focusBenefit(b.url)}
                      onFocus$={() => focusBenefit(b.url)}
                      onClick$={() => openBenefit(b.url)}
                      class={[
                        "w-full text-left px-3 py-2 flex items-center gap-2 transition-colors cursor-pointer",
                        isActive ? "bg-brand-green/10" : "hover:bg-slate-50",
                      ]}
                    >
                      <LuMapPin class={["w-3.5 h-3.5 flex-shrink-0", isActive ? "text-brand-green" : "text-slate-400"]} />
                      <span class="min-w-0 flex-1">
                        <span class="block text-xs font-bold text-slate-800 truncate">{b.titulo}</span>
                        <span class="block text-[10px] text-slate-400 font-semibold truncate">
                          {b.categorias[0]?.descripcion || "Beneficio"}
                          {b.resumen ? ` · ${b.resumen.trim()}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Category Select Input */}
        <div>
          <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Categoría</label>
          <div class="relative flex items-center">
            <select
              value={selectedCategory.value || ""}
              onChange$={(ev, el) => {
                selectedCategory.value = el.value ? Number(el.value) : null;
              }}
              class="w-full bg-slate-50 text-slate-800 text-xs px-8 py-2.5 rounded-xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all appearance-none cursor-pointer"
            >
              <option value="">Todas las categorías</option>
              {data.value.filters.categorias.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.descripcion}</option>
              ))}
            </select>
            <LuFilter class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <div class="absolute right-3 pointer-events-none text-slate-400 text-xs">▼</div>
          </div>
        </div>

        {/* Reset Filters button */}
        {(searchQuery.value.trim() || selectedCategory.value) && (
          <button
            onClick$={() => {
              searchQuery.value = "";
              selectedCategory.value = null;
            }}
            class="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl border border-slate-200 hover:border-red-200 bg-white hover:bg-red-50 text-slate-650 hover:text-red-700 text-xs font-bold transition-all cursor-pointer"
          >
            <LuRefreshCw class="w-3.5 h-3.5" />
            <span>Restablecer Filtros</span>
          </button>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Mapa de Beneficios - Club AMP+",
  meta: [
    {
      name: "description",
      content: "Explorá todos los beneficios y descuentos de la Agremiación Médica Platense cerca tuyo en el mapa.",
    },
  ],
};
