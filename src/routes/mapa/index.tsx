import {
  $,
  component$,
  noSerialize,
  useComputed$,
  useSignal,
  useVisibleTask$,
  type NoSerialize,
} from "@builder.io/qwik";
import {
  routeLoader$,
  Link,
  useLocation,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { searchBenefits, getFilters } from "~/server/cache";
import {
  filterMapBenefits,
  formatDistance,
  parseCoordinates,
  rankMapBenefits,
  type UserPosition,
} from "~/utils/map-benefits";
import {
  LuMapPin,
  LuList,
  LuSearch,
  LuFilter,
  LuRefreshCw,
  LuLocateFixed,
  LuChevronDown,
} from "@qwikest/icons/lucide";

export const useBenefitsMapData = routeLoader$(async (event) => {
  const [searchResult, filters] = await Promise.all([
    searchBenefits({ limit: 1000, requestEvent: event }),
    getFilters(event),
  ]);
  return {
    benefits: searchResult.data.filter((benefit) =>
      parseCoordinates(benefit.latitud, benefit.longitud),
    ),
    filters,
  };
});

export default component$(() => {
  const location = useLocation();
  const data = useBenefitsMapData();
  const searchQuery = useSignal(location.url.searchParams.get("buscar") || "");
  const selectedCategory = useSignal<number | null>(
    Number(location.url.searchParams.get("categoria")) || null,
  );
  const selectedLocation = useSignal<number | null>(
    Number(location.url.searchParams.get("ubicacion")) || null,
  );
  const selectedOffer = useSignal<number | null>(
    Number(location.url.searchParams.get("oferta")) || null,
  );
  const filtersOpen = useSignal(false);
  const selectedBenefit = useSignal<number | null>(null);
  const selectionAttempt = useSignal(0);
  const userPosition = useSignal<UserPosition | null>(null);
  const geoState = useSignal<"idle" | "loading" | "ready" | "error">("idle");
  const geoMessage = useSignal("");
  const geoRequest = useSignal(0);
  const libraryAttempt = useSignal(0);
  const libraryState = useSignal<"loading" | "ready" | "error">("loading");
  const tileState = useSignal<"loading" | "ready" | "error">("loading");
  const mapReady = useSignal(false);
  const mapElement = useSignal<HTMLDivElement>();
  const mapRef = useSignal<NoSerialize<any>>();
  const markersGroupRef = useSignal<NoSerialize<any>>();
  const markersRef = useSignal<NoSerialize<Map<number, any>>>();
  const tilesRef = useSignal<NoSerialize<any>>();

  const filteredBenefits = useComputed$(() =>
    filterMapBenefits(
      data.value.benefits,
      searchQuery.value,
      selectedCategory.value,
      selectedLocation.value,
      selectedOffer.value,
    ),
  );
  const nearbyBenefits = useComputed$(() =>
    rankMapBenefits(filteredBenefits.value, userPosition.value),
  );
  const listadoHref = useComputed$(() => {
    const params = new URLSearchParams();
    if (searchQuery.value.trim())
      params.set("buscar", searchQuery.value.trim());
    if (selectedCategory.value)
      params.set("categoria", String(selectedCategory.value));
    if (selectedLocation.value)
      params.set("ubicacion", String(selectedLocation.value));
    if (selectedOffer.value) params.set("oferta", String(selectedOffer.value));
    return `/beneficios/${params.size ? `?${params}` : ""}`;
  });
  const hasFilters = useComputed$(() =>
    Boolean(
      searchQuery.value.trim() ||
        selectedCategory.value ||
        selectedLocation.value ||
        selectedOffer.value,
    ),
  );
  const locationButtonLabel = useComputed$(() => {
    const loading = geoState.value === "loading";
    const hasPosition = Boolean(userPosition.value);
    return loading
      ? "Buscando ubicación…"
      : hasPosition
        ? "Actualizar mi ubicación"
        : "Usar mi ubicación";
  });

  useVisibleTask$(({ track }) => {
    const query = track(() => searchQuery.value);
    const category = track(() => selectedCategory.value);
    const locality = track(() => selectedLocation.value);
    const offer = track(() => selectedOffer.value);
    const url = new URL(window.location.href);
    for (const [key, value] of [
      ["buscar", query.trim()],
      ["categoria", category],
      ["ubicacion", locality],
      ["oferta", offer],
    ] as const) {
      if (value) url.searchParams.set(key, String(value));
      else url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, "", url.toString());
  });

  useVisibleTask$(({ cleanup }) => {
    cleanup(() => {
      geoRequest.value++;
    });
  });

  // Load Leaflet once, with bounded failures and explicit retry instead of polling.
  useVisibleTask$(({ track, cleanup }) => {
    track(() => libraryAttempt.value);
    libraryState.value = "loading";
    let active = true;
    let loadedResources = 0;
    const listenerCleanup: (() => void)[] = [];
    const timeout = window.setTimeout(() => {
      if (active) libraryState.value = "error";
    }, 12000);
    const settle = () => {
      loadedResources++;
      if (active && loadedResources === 2) {
        window.clearTimeout(timeout);
        libraryState.value = (window as any).L ? "ready" : "error";
      }
    };
    const failed = () => {
      if (active) {
        window.clearTimeout(timeout);
        libraryState.value = "error";
      }
    };
    const loadResource = (
      id: string,
      element: HTMLScriptElement | HTMLLinkElement,
      alreadyLoaded: boolean,
    ) => {
      let existing = document.getElementById(id) as
        | HTMLScriptElement
        | HTMLLinkElement
        | null;
      if (existing?.dataset.failed === "true") {
        existing.remove();
        existing = null;
      }
      const resource = existing || element;
      if (alreadyLoaded || resource.dataset.loaded === "true") {
        settle();
        return;
      }
      const loaded = () => {
        resource.dataset.loaded = "true";
        settle();
      };
      const error = () => {
        resource.dataset.failed = "true";
        failed();
      };
      resource.addEventListener("load", loaded, { once: true });
      resource.addEventListener("error", error, { once: true });
      listenerCleanup.push(() => {
        resource.removeEventListener("load", loaded);
        resource.removeEventListener("error", error);
        if (resource.dataset.loaded !== "true")
          resource.dataset.failed = "true";
      });
      if (!existing) {
        resource.id = id;
        document.head.appendChild(resource);
      }
    };
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    const existingStylesheet = document.getElementById(
      "leaflet-css",
    ) as HTMLLinkElement | null;
    loadResource("leaflet-css", stylesheet, Boolean(existingStylesheet?.sheet));
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    loadResource("leaflet-js", script, Boolean((window as any).L));
    cleanup(() => {
      active = false;
      window.clearTimeout(timeout);
      listenerCleanup.forEach((dispose) => dispose());
    });
  });

  useVisibleTask$(({ track, cleanup }) => {
    const ready = track(() => libraryState.value === "ready");
    if (!ready || !mapElement.value || mapRef.value) return;
    const L = (window as any).L;
    const map = L.map(mapElement.value, {
      scrollWheelZoom: false,
      zoomControl: false,
    }).setView([-34.9214, -57.9545], 13);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.value = noSerialize(map);
    markersGroupRef.value = noSerialize(L.featureGroup().addTo(map));
    markersRef.value = noSerialize(new Map());
    let tileErrors = 0;
    let tileTimeout: ReturnType<typeof setTimeout> | undefined;
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      },
    );
    const loading = () => {
      tileErrors = 0;
      tileState.value = "loading";
      clearTimeout(tileTimeout);
      tileTimeout = setTimeout(() => {
        tileState.value = "error";
      }, 12000);
    };
    tiles.on("loading", loading);
    tiles.on("tileerror", () => {
      tileErrors++;
    });
    tiles.on("load", () => {
      clearTimeout(tileTimeout);
      tileState.value = tileErrors ? "error" : "ready";
    });
    tiles.addTo(map);
    tilesRef.value = noSerialize(tiles);
    mapReady.value = true;
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(mapElement.value);
    cleanup(() => {
      clearTimeout(tileTimeout);
      resizeObserver.disconnect();
      mapReady.value = false;
      mapRef.value = undefined;
      markersGroupRef.value = undefined;
      markersRef.value = undefined;
      tilesRef.value = undefined;
      map.remove();
    });
  });

  useVisibleTask$(({ track }) => {
    const ready = track(() => mapReady.value);
    const benefits = track(() => filteredBenefits.value);
    if (!ready || !mapRef.value || !markersGroupRef.value || !markersRef.value)
      return;
    const L = (window as any).L;
    const group = markersGroupRef.value;
    group.clearLayers();
    markersRef.value.clear();
    benefits.forEach((benefit) => {
      const coordinates = parseCoordinates(benefit.latitud, benefit.longitud)!;
      // Text nodes prevent merchant content from becoming executable popup HTML.
      const popup = document.createElement("div");
      popup.className = "font-sans text-slate-800 min-w-[180px] max-w-[240px]";
      const title = document.createElement("h3");
      title.className = "font-bold text-base mb-2";
      title.textContent = benefit.titulo;
      const summary = document.createElement("p");
      summary.className = "text-sm mb-3";
      summary.textContent =
        benefit.resumen || "Beneficio exclusivo para socios";
      const link = document.createElement("a");
      link.className =
        "block rounded-lg bg-brand-green px-3 py-2.5 text-center font-bold !text-white";
      link.href = `/beneficio/${encodeURIComponent(benefit.url)}/`;
      link.textContent = "Ver beneficio →";
      popup.appendChild(title);
      popup.appendChild(summary);
      popup.appendChild(link);
      const marker = L.marker([coordinates.latitude, coordinates.longitude], {
        title: benefit.titulo,
      })
        .bindPopup(popup)
        .on("click", () => {
          selectedBenefit.value = benefit.id;
        })
        .addTo(group);
      markersRef.value!.set(benefit.id, marker);
    });
    if (selectedBenefit.value && !markersRef.value.has(selectedBenefit.value))
      selectedBenefit.value = null;
    if (benefits.length)
      mapRef.value.fitBounds(group.getBounds(), {
        padding: [35, 35],
        maxZoom: 16,
      });
  });

  useVisibleTask$(({ track }) => {
    track(() => mapReady.value);
    track(() => selectionAttempt.value);
    const selected = track(() => selectedBenefit.value);
    if (!selected || !mapRef.value) return;
    const marker = markersRef.value?.get(selected);
    if (!marker) return;
    mapRef.value.setView(
      marker.getLatLng(),
      Math.max(mapRef.value.getZoom(), 14),
      { animate: false },
    );
    marker.openPopup();
    if (window.matchMedia("(min-width: 1024px)").matches) {
      document
        .getElementById(`map-benefit-${selected}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  });

  useVisibleTask$(({ track, cleanup }) => {
    const ready = track(() => mapReady.value);
    const position = track(() => userPosition.value);
    if (!ready || !position || !mapRef.value) return;
    const L = (window as any).L;
    const map = mapRef.value;
    const point = [position.latitude, position.longitude];
    const accuracy = L.circle(point, {
      radius: position.accuracy,
      color: "#2563eb",
      weight: 1,
      fillOpacity: 0.08,
    }).addTo(map);
    const marker = L.circleMarker(point, {
      radius: 8,
      color: "white",
      weight: 3,
      fillColor: "#2563eb",
      fillOpacity: 1,
    })
      .bindTooltip("Tu ubicación aproximada")
      .addTo(map);
    map.setView(point, 14);
    cleanup(() => {
      accuracy.remove();
      marker.remove();
    });
  });

  const requestLocation = $(() => {
    const requestId = ++geoRequest.value;
    if (!navigator.geolocation || !window.isSecureContext) {
      geoState.value = "error";
      geoMessage.value =
        "Este navegador no puede obtener tu ubicación. Elegí una localidad para buscar.";
      filtersOpen.value = true;
      return;
    }
    geoState.value = "loading";
    geoMessage.value = "Buscando tu ubicación…";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== geoRequest.value) return;
        const coordinates = parseCoordinates(
          position.coords.latitude,
          position.coords.longitude,
        );
        if (
          !coordinates ||
          !Number.isFinite(position.coords.accuracy) ||
          position.coords.accuracy < 0
        ) {
          geoState.value = "error";
          geoMessage.value =
            "No pudimos obtener una ubicación válida. Elegí una localidad o intentá de nuevo.";
          filtersOpen.value = true;
          return;
        }
        userPosition.value = {
          ...coordinates,
          accuracy: position.coords.accuracy,
        };
        geoState.value = "ready";
        geoMessage.value =
          "Ubicación encontrada. Comercios ordenados por cercanía.";
      },
      (error) => {
        if (requestId !== geoRequest.value) return;
        geoState.value = "error";
        geoMessage.value =
          error.code === 1
            ? "No se autorizó la ubicación. Podés habilitarla en tu navegador o elegir una localidad."
            : error.code === 3
              ? "La ubicación tardó demasiado. Intentá de nuevo o elegí una localidad."
              : "No pudimos determinar tu ubicación. Intentá de nuevo o elegí una localidad.";
        filtersOpen.value = true;
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });

  return (
    <div class="bg-slate-50 text-slate-800 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:h-[min(780px,calc(100dvh-128px))] lg:min-h-[620px]">
      <section
        aria-label="Buscar beneficios en el mapa"
        class="relative z-10 border-b border-slate-200 bg-white p-4 lg:col-start-1 lg:row-start-1 lg:border-r"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <h1 class="text-lg font-black text-slate-900">
              Beneficios cerca tuyo
            </h1>
            <p class="text-xs text-slate-500" aria-live="polite">
              {filteredBenefits.value.length}{" "}
              {filteredBenefits.value.length === 1
                ? "comercio encontrado"
                : "comercios encontrados"}
            </p>
          </div>
          <Link
            href={listadoHref.value}
            class="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold hover:bg-slate-50"
          >
            <LuList class="h-4 w-4" />
            Catálogo
          </Link>
        </div>
        <button
          type="button"
          onClick$={requestLocation}
          disabled={geoState.value === "loading"}
          class="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-green-accent px-3 py-2.5 text-sm font-black text-brand-green-dark disabled:opacity-60"
        >
          <LuLocateFixed
            class={`h-4 w-4 ${geoState.value === "loading" ? "animate-pulse" : ""}`}
          />
          <span>{locationButtonLabel.value}</span>
        </button>
        <p
          role="status"
          class={`mt-2 text-xs leading-relaxed ${geoState.value === "error" ? "text-amber-800" : "text-slate-500"}`}
        >
          {geoMessage.value ||
            "Usá tu ubicación o elegí una localidad en los filtros."}
        </p>
        {userPosition.value && (
          <p class="mt-1 text-xs leading-relaxed text-slate-500">
            Precisión aproximada:{" "}
            {formatDistance(userPosition.value.accuracy / 1000)}. Distancias en
            línea recta.
          </p>
        )}
        <button
          type="button"
          onClick$={() => {
            filtersOpen.value = !filtersOpen.value;
          }}
          aria-expanded={filtersOpen.value}
          aria-controls="map-filters"
          class="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 px-3 text-sm font-bold lg:hidden"
        >
          <span class="flex items-center gap-2">
            <LuFilter class="h-4 w-4" />
            Filtros{" "}
            {hasFilters.value && (
              <span class="h-2 w-2 rounded-full bg-brand-green" />
            )}
          </span>
          <LuChevronDown
            class={`h-4 w-4 transition-transform ${filtersOpen.value ? "rotate-180" : ""}`}
          />
        </button>
        <div
          id="map-filters"
          class={`${filtersOpen.value ? "block" : "hidden"} mt-3 space-y-3 lg:block`}
        >
          <div>
            <label
              for="map-search"
              class="mb-1 block text-xs font-bold text-slate-600"
            >
              Buscar comercio o beneficio
            </label>
            <div class="relative">
              <LuSearch class="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                id="map-search"
                type="search"
                placeholder="Café, gimnasio, heladería…"
                value={searchQuery.value}
                onInput$={(_, element) => {
                  searchQuery.value = element.value;
                }}
                class="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/20"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label
                for="map-category"
                class="mb-1 block text-xs font-bold text-slate-600"
              >
                Categoría
              </label>
              <select
                id="map-category"
                value={selectedCategory.value || ""}
                onChange$={(_, element) => {
                  selectedCategory.value = Number(element.value) || null;
                }}
                class="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-sm focus:ring-2 focus:ring-brand-green/20"
              >
                <option value="">Todas las categorías</option>
                {data.value.filters.categorias.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.descripcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                for="map-locality"
                class="mb-1 block text-xs font-bold text-slate-600"
              >
                Localidad
              </label>
              <select
                id="map-locality"
                value={selectedLocation.value || ""}
                onChange$={(_, element) => {
                  selectedLocation.value = Number(element.value) || null;
                }}
                class="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-sm focus:ring-2 focus:ring-brand-green/20"
              >
                <option value="">Todas las localidades</option>
                {data.value.filters.ubicaciones.map((locality) => (
                  <option key={locality.id} value={locality.id}>
                    {locality.descripcion}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label
              for="map-offer"
              class="mb-1 block text-xs font-bold text-slate-600"
            >
              Descuento
            </label>
            <select
              id="map-offer"
              value={selectedOffer.value || ""}
              onChange$={(_, element) => {
                selectedOffer.value = Number(element.value) || null;
              }}
              class="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-sm focus:ring-2 focus:ring-brand-green/20"
            >
              <option value="">Todos los descuentos</option>
              {data.value.filters.ofertas.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.descripcion}
                </option>
              ))}
            </select>
          </div>
          {hasFilters.value && (
            <button
              type="button"
              onClick$={() => {
                searchQuery.value = "";
                selectedCategory.value = null;
                selectedLocation.value = null;
                selectedOffer.value = null;
              }}
              class="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold hover:bg-slate-50"
            >
              <LuRefreshCw class="h-4 w-4" />
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      <section
        aria-label="Mapa de comercios"
        class="relative isolate h-[52svh] min-h-[340px] bg-slate-100 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-full lg:min-h-0"
      >
        <div
          ref={mapElement}
          class="absolute inset-0 z-0"
          aria-label="Mapa interactivo de beneficios"
        />
        {(libraryState.value !== "ready" || tileState.value !== "ready") && (
          <div
            class={`absolute left-3 right-3 top-3 z-[500] rounded-xl border px-3 py-2 text-center text-sm shadow-md ${libraryState.value === "error" || tileState.value === "error" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-white/95 text-slate-600"}`}
            role="status"
          >
            {libraryState.value === "error"
              ? "No pudimos cargar el mapa. La lista de comercios sigue disponible."
              : libraryState.value === "loading"
                ? "Cargando mapa…"
                : tileState.value === "error"
                  ? "Algunas partes del mapa no se cargaron. Podés seguir usando la lista."
                  : "Cargando calles del mapa…"}
            {(libraryState.value === "error" ||
              tileState.value === "error") && (
              <button
                type="button"
                class="ml-2 min-h-11 rounded-lg px-2 font-bold underline"
                onClick$={() => {
                  if (libraryState.value === "error") libraryAttempt.value++;
                  else {
                    tileState.value = "loading";
                    tilesRef.value?.redraw();
                  }
                }}
              >
                Reintentar
              </button>
            )}
          </div>
        )}
        {mapReady.value && (
          <button
            type="button"
            onClick$={() => {
              if (markersGroupRef.value?.getLayers().length)
                mapRef.value?.fitBounds(markersGroupRef.value.getBounds(), {
                  padding: [35, 35],
                  maxZoom: 16,
                });
            }}
            class="absolute bottom-7 left-3 z-[500] flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold shadow-sm"
          >
            <LuMapPin class="h-4 w-4" />
            Ver comercios
          </button>
        )}
      </section>

      <section
        aria-label="Comercios del mapa"
        class="min-h-0 border-t border-slate-200 bg-white lg:col-start-1 lg:row-start-2 lg:overflow-y-auto lg:border-r lg:border-t-0"
      >
        <div class="border-b border-slate-100 bg-white px-4 py-3">
          <h2 class="text-sm font-bold">
            {userPosition.value
              ? "Ordenados por cercanía"
              : "Comercios en el mapa"}
          </h2>
          <p class="text-xs text-slate-500">
            Tocá “Ver en mapa” para ubicar un comercio.
          </p>
        </div>
        {nearbyBenefits.value.length ? (
          <ul class="divide-y divide-slate-100">
            {nearbyBenefits.value.map(({ benefit, distance }) => (
              <li
                key={benefit.id}
                id={`map-benefit-${benefit.id}`}
                class={`p-4 ${selectedBenefit.value === benefit.id ? "bg-brand-green/5 ring-2 ring-inset ring-brand-green" : ""}`}
              >
                <div class="flex items-start justify-between gap-2">
                  <h3 class="text-sm font-black leading-snug text-slate-900">
                    <Link
                      href={`/beneficio/${benefit.url}/`}
                      class="hover:underline"
                    >
                      {benefit.titulo}
                    </Link>
                  </h3>
                  {distance !== null && (
                    <span class="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">
                      {formatDistance(distance)}
                    </span>
                  )}
                </div>
                <p class="mt-1 text-xs text-slate-500">
                  {benefit.ubicacion
                    .map((locality) => locality.descripcion)
                    .join(" · ") || "Ver ubicación en el mapa"}
                </p>
                <p class="mt-2 text-sm font-bold text-brand-green-dark">
                  {benefit.resumen || "Beneficio exclusivo para socios"}
                </p>
                <div class="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!mapReady.value}
                    aria-pressed={selectedBenefit.value === benefit.id}
                    onClick$={() => {
                      selectedBenefit.value = benefit.id;
                      selectionAttempt.value++;
                      if (!window.matchMedia("(min-width: 1024px)").matches)
                        mapElement.value?.scrollIntoView({
                          block: "center",
                          behavior: "smooth",
                        });
                    }}
                    class="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
                  >
                    <LuMapPin class="h-4 w-4" />
                    Ver en mapa
                  </button>
                  <Link
                    href={`/beneficio/${benefit.url}/`}
                    class="flex min-h-11 items-center justify-center rounded-lg bg-brand-green px-2 text-xs font-bold text-white hover:bg-brand-green-dark"
                  >
                    Ver beneficio
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div class="px-5 py-8 text-center">
            <LuSearch class="mx-auto mb-3 h-7 w-7 text-slate-400" />
            <h3 class="font-bold">No encontramos comercios</h3>
            <p class="mt-2 text-sm text-slate-500">
              Probá otra búsqueda, categoría o localidad. El catálogo también
              incluye beneficios sin ubicación en el mapa.
            </p>
            <Link
              href={listadoHref.value}
              class="mt-4 inline-flex min-h-11 items-center rounded-lg bg-brand-green px-4 text-sm font-bold text-white"
            >
              Ver catálogo
            </Link>
          </div>
        )}
      </section>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Mapa de Beneficios - Club LPRC",
  meta: [
    {
      name: "description",
      content:
        "Encontrá beneficios y comercios de La Plata Rugby Club cerca tuyo. Buscá por localidad o usá tu ubicación para ordenar por distancia.",
    },
  ],
};
