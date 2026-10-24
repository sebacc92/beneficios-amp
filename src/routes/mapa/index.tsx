import {
  $,
  component$,
  noSerialize,
  useComputed$,
  useSignal,
  useStyles$,
  useTask$,
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
import { getSettings } from "~/server/chatbotDb";
import { campaignTerms, parseCatalogSort, sortCatalog } from "~/utils/home-benefits";
import { benefitDetailsHref, catalogHref, catalogSearchParams } from "~/utils/catalog-navigation";
import {
  MAP_PIN_STYLES,
  benefitImageUrl,
  directionsUrl,
  filterMapBenefits,
  formatDistance,
  mapPinIcon,
  merchantDetails,
  parseCoordinates,
  rankMapBenefits,
  type UserPosition,
} from "~/utils/map-benefits";
import { CLUB } from "~/utils/club";
import { SectionHeading } from "~/components/section-heading/section-heading";
import {
  LuArrowRight,
  LuMap,
  LuMapPin,
  LuList,
  LuNavigation,
  LuSearch,
  LuFilter,
  LuRefreshCw,
  LuLocateFixed,
  LuChevronDown,
} from "@qwikest/icons/lucide";

export const useBenefitsMapData = routeLoader$(async (event) => {
  const [searchResult, filters, settings] = await Promise.all([
    searchBenefits({ limit: 10_000, requestEvent: event }),
    getFilters(event),
    event.url.searchParams.get("campana") === "1" ? getSettings(event) : null,
  ]);
  return {
    benefits: searchResult.data.filter((benefit) =>
      parseCoordinates(benefit.latitud, benefit.longitud),
    ),
    filters,
    catalogQuery: catalogSearchParams(event.url.searchParams).toString(),
    campaignSlugs: settings?.campaignBenefitSlugs ?? [],
    campaignTerms: settings ? campaignTerms(settings.campaignQuery) : undefined,
    campaignTitle: settings?.campaignTitle || "Especiales del club",
  };
});

export default component$(() => {
  useStyles$(MAP_PIN_STYLES);
  const location = useLocation();
  const data = useBenefitsMapData();
  const initialParams = new URLSearchParams(data.value.catalogQuery);
  const catalogPage = useSignal(Number(initialParams.get("page")) || 1);
  const catalogSort = parseCatalogSort(initialParams.get("orden"));
  const selectedGold = useSignal(initialParams.get("gold") === "1");
  const selectedCampaign = useSignal(initialParams.get("campana") === "1");
  const searchQuery = useSignal(initialParams.get("buscar") || "");
  // What the visitor is typing; it reaches searchQuery (and redraws every marker) 250 ms after the last key.
  const searchDraft = useSignal(searchQuery.value);
  useTask$(({ track, cleanup }) => {
    const draft = track(() => searchDraft.value);
    if (draft === searchQuery.value) return;
    const timer = setTimeout(() => (searchQuery.value = draft), 250);
    cleanup(() => clearTimeout(timer));
  });
  const selectedCategory = useSignal<number | null>(
    Number(initialParams.get("categoria")) || null,
  );
  const selectedLocation = useSignal<number | null>(
    Number(initialParams.get("ubicacion")) || null,
  );
  const selectedOffer = useSignal<number | null>(
    Number(initialParams.get("oferta")) || null,
  );
  const filtersOpen = useSignal(false);
  // Phones show the list or the map, not both stacked; desktop always shows both.
  const mobileView = useSignal<"mapa" | "lista">(
    location.url.searchParams.get("vista") === "lista" ? "lista" : "mapa",
  );
  const viewSwitchRef = useSignal<HTMLElement>();
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

  const filteredBenefits = useComputed$(() => {
    const slugs = data.value.campaignSlugs;
    const matches = filterMapBenefits(
      data.value.benefits,
      searchQuery.value,
      selectedCategory.value,
      selectedLocation.value,
      selectedOffer.value,
      {
        gold: selectedGold.value,
        campaignSlugs: selectedCampaign.value ? slugs : undefined,
        campaignTerms: selectedCampaign.value && !slugs.length ? data.value.campaignTerms : undefined,
      },
    );
    const sort = catalogSort;
    return selectedCampaign.value && slugs.length && !sort
      ? [...matches].sort((a, b) => slugs.indexOf(a.url) - slugs.indexOf(b.url))
      : sortCatalog(matches, sort);
  });
  const nearbyBenefits = useComputed$(() =>
    rankMapBenefits(filteredBenefits.value, userPosition.value),
  );
  const resultQuery = useComputed$(() => {
    const params = new URLSearchParams(data.value.catalogQuery);
    for (const [key, value] of [
      ["buscar", searchQuery.value.trim()],
      ["categoria", selectedCategory.value],
      ["ubicacion", selectedLocation.value],
      ["oferta", selectedOffer.value],
      ["gold", selectedGold.value ? 1 : null],
      ["campana", selectedCampaign.value ? 1 : null],
      ["page", catalogPage.value > 1 ? catalogPage.value : null],
    ] as const) {
      if (value) params.set(key, String(value));
      else params.delete(key);
    }
    return params.toString();
  });
  const listadoHref = useComputed$(() => catalogHref("/beneficios/", new URLSearchParams(resultQuery.value)));
  const mapResultsHref = useComputed$(() => {
    const params = new URLSearchParams(resultQuery.value);
    if (mobileView.value === "lista") params.set("vista", "lista");
    return catalogHref("/mapa/", params);
  });
  const hasFilters = useComputed$(() =>
    Boolean(
      searchQuery.value.trim() ||
        selectedCategory.value ||
        selectedLocation.value ||
        selectedOffer.value ||
        selectedGold.value ||
        selectedCampaign.value,
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
    const href = track(() => mapResultsHref.value);
    window.history.replaceState(window.history.state, "", href);
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
    // Top right keeps the zoom buttons clear of the floating chat button.
    L.control.zoom({ position: "topright" }).addTo(map);
    const clubPopup = document.createElement("div");
    clubPopup.className = "min-w-[200px] max-w-[260px] text-slate-800";
    const clubTitle = document.createElement("h3");
    clubTitle.className = "font-display text-base font-bold uppercase leading-tight text-primary";
    clubTitle.textContent = `${CLUB.name} — Sede Gonnet`;
    const clubAddress = document.createElement("p");
    clubAddress.className = "!my-1.5 text-sm";
    clubAddress.textContent = `${CLUB.address}, ${CLUB.locality}. ${CLUB.memberAccess}.`;
    const clubLink = document.createElement("a");
    clubLink.className = "text-sm font-bold !text-primary underline underline-offset-2";
    clubLink.href = CLUB.mapsUrl;
    clubLink.target = "_blank";
    clubLink.rel = "noopener";
    clubLink.textContent = "Cómo llegar";
    [clubTitle, clubAddress, clubLink].forEach((node) => clubPopup.appendChild(node));
    L.marker([CLUB.coordinates.lat, CLUB.coordinates.lng], {
      icon: L.divIcon(mapPinIcon("club")),
      title: `${CLUB.name} — Sede Gonnet`,
      zIndexOffset: 500,
    })
      .bindPopup(clubPopup)
      .addTo(map);
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
    const resultsPath = track(() => mapResultsHref.value);
    if (!ready || !mapRef.value || !markersGroupRef.value || !markersRef.value)
      return;
    const L = (window as any).L;
    const group = markersGroupRef.value;
    group.clearLayers();
    markersRef.value.clear();
    const selectedId = selectedBenefit.value;
    benefits.forEach((benefit) => {
      const coordinates = parseCoordinates(benefit.latitud, benefit.longitud)!;
      const address = merchantDetails(benefit).address;
      // Text nodes prevent merchant content from becoming executable popup HTML.
      const popup = document.createElement("div");
      popup.className = "min-w-[200px] max-w-[260px] text-slate-800";
      const discount = document.createElement("p");
      discount.className = "badge badge-accent !m-0 whitespace-normal";
      discount.textContent = benefit.resumen || "Beneficio para socios";
      const title = document.createElement("h3");
      title.className = "mt-2 font-display text-base font-bold uppercase leading-tight text-primary";
      title.textContent = benefit.titulo;
      popup.appendChild(discount);
      popup.appendChild(title);
      if (address) {
        const place = document.createElement("p");
        place.className = "!my-1.5 text-sm";
        place.textContent = address;
        popup.appendChild(place);
      } else {
        const directions = directionsUrl({ latitud: benefit.latitud, longitud: benefit.longitud });
        if (directions) {
          const directionsLink = document.createElement("a");
          directionsLink.className = "mt-1.5 inline-block text-sm font-bold !text-primary underline underline-offset-2";
          directionsLink.href = directions;
          directionsLink.target = "_blank";
          directionsLink.rel = "noopener";
          directionsLink.textContent = "Ver cómo llegar";
          popup.appendChild(directionsLink);
        }
      }
      const link = document.createElement("a");
      link.className =
        "mt-3 block bg-primary px-3 py-2.5 text-center font-display text-sm font-semibold uppercase tracking-wider !text-white";
      link.href = benefitDetailsHref(benefit.url, resultsPath);
      link.textContent = "Ver beneficio →";
      popup.appendChild(link);
      const marker = L.marker([coordinates.latitude, coordinates.longitude], {
        title: benefit.titulo,
        icon: L.divIcon(mapPinIcon("benefit")),
      })
        .bindPopup(popup)
        .on("click", () => {
          selectedBenefit.value = benefit.id;
        })
        .addTo(group);
      if (benefit.id === selectedId) marker.getElement()?.querySelector(".lprc-pin")?.classList.add("lprc-pin--active");
      markersRef.value!.set(benefit.id, marker);
    });
    if (selectedBenefit.value && !markersRef.value.has(selectedBenefit.value))
      selectedBenefit.value = null;
    // Once the visitor centred the map on their location, filtering must not pull the view away.
    if (benefits.length && !userPosition.value)
      mapRef.value.fitBounds(group.getBounds(), {
        padding: [35, 35],
        maxZoom: 16,
      });
  });

  useVisibleTask$(({ track }) => {
    track(() => mapReady.value);
    track(() => selectionAttempt.value);
    track(() => mobileView.value);
    const selected = track(() => selectedBenefit.value);
    if (!mapRef.value) return;
    markersRef.value?.forEach((item, id) =>
      item.getElement()?.querySelector(".lprc-pin")?.classList.toggle("lprc-pin--active", id === selected),
    );
    if (!selected) return;
    const marker = markersRef.value?.get(selected);
    if (!marker) return;
    // The map may have just been revealed on a phone; measure it before centring.
    mapRef.value.invalidateSize();
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

  // Leaflet cannot fit bounds while hidden, so refit when a phone switches back to the map.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const view = track(() => mobileView.value);
    const map = mapRef.value;
    if (view !== "mapa" || !map) return;
    map.invalidateSize();
    if (!selectedBenefit.value && !userPosition.value && markersGroupRef.value?.getLayers().length)
      map.fitBounds(markersGroupRef.value.getBounds(), { padding: [35, 35], maxZoom: 16 });
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

  const clearFilters = $(() => {
    searchQuery.value = "";
    searchDraft.value = "";
    selectedCategory.value = null;
    selectedLocation.value = null;
    selectedOffer.value = null;
    selectedGold.value = false;
    selectedCampaign.value = false;
    catalogPage.value = 1;
  });

  const showOnMap = $((benefitId: number) => {
    selectedBenefit.value = benefitId;
    selectionAttempt.value++;
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    mobileView.value = "mapa";
    viewSwitchRef.value?.scrollIntoView({ block: "start", behavior: "smooth" });
  });

  const viewButton = (active: boolean) =>
    `flex min-h-11 items-center justify-center gap-2 font-display text-sm font-semibold uppercase tracking-wider transition-colors ${active ? "bg-primary text-white" : "bg-surface text-primary hover:bg-surface-muted"}`;

  return (
    <div class="bg-background text-primary">
      <section aria-label="Buscar beneficios en el mapa" class="relative z-10 border-b border-line bg-surface">
        <div class="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading title="Beneficios cerca tuyo" eyebrow="Cerca mío" as="h1" size="lg" />
            <div class="flex items-center gap-4">
              <p class="text-sm text-slate-600" aria-live="polite">
                <strong class="text-primary">{filteredBenefits.value.length}</strong>{" "}
                {filteredBenefits.value.length === 1 ? "comercio en el mapa" : "comercios en el mapa"}
              </p>
              <Link href={listadoHref.value} class="btn btn-outline btn-sm">
                <LuList class="h-4 w-4" aria-hidden="true" />
                Catálogo
              </Link>
            </div>
          </div>

          <div class="mt-5 flex flex-col gap-3">
            {(selectedGold.value || selectedCampaign.value) && (
              <div class="flex flex-wrap items-center gap-2 text-sm">
                <span class="font-semibold text-slate-600">Filtros del catálogo:</span>
                {selectedGold.value && (
                  <button type="button" class="badge badge-dark min-h-11 max-w-full cursor-pointer gap-2 whitespace-normal text-left" onClick$={() => { selectedGold.value = false; catalogPage.value = 1; }} aria-label="Quitar filtro Socios Gold">
                    Socios Gold <span aria-hidden="true">×</span>
                  </button>
                )}
                {selectedCampaign.value && (
                  <button type="button" class="badge badge-dark min-h-11 max-w-full cursor-pointer gap-2 whitespace-normal text-left" onClick$={() => { selectedCampaign.value = false; catalogPage.value = 1; }} aria-label="Quitar filtro de campaña">
                    {data.value.campaignTitle} <span aria-hidden="true">×</span>
                  </button>
                )}
              </div>
            )}
            <div class="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div class="hidden lg:block lg:flex-1">
                <label for="map-search" class="field-label">Buscar comercio o beneficio</label>
                <div class="relative">
                  <LuSearch class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                  <input
                    id="map-search"
                    type="search"
                    placeholder="Café, gimnasio, heladería…"
                    value={searchDraft.value}
                    onInput$={(_, element) => {
                      searchDraft.value = element.value;
                      catalogPage.value = 1;
                    }}
                    class="field min-h-11 pl-9 text-base sm:text-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick$={requestLocation}
                disabled={geoState.value === "loading"}
                class="btn btn-primary w-full lg:w-auto"
              >
                <LuLocateFixed class={`h-4 w-4 ${geoState.value === "loading" ? "animate-pulse" : ""}`} aria-hidden="true" />
                {locationButtonLabel.value}
              </button>
              <button
                type="button"
                onClick$={() => {
                  filtersOpen.value = !filtersOpen.value;
                }}
                aria-expanded={filtersOpen.value}
                aria-controls="map-filters"
                class="flex min-h-11 w-full items-center justify-between border border-line px-3 text-sm font-bold lg:hidden"
              >
                <span class="flex items-center gap-2">
                  <LuFilter class="h-4 w-4" aria-hidden="true" />
                  Buscar y filtrar
                  {hasFilters.value && (
                    <span class="badge badge-dark">Activos</span>
                  )}
                </span>
                <LuChevronDown class={`h-4 w-4 transition-transform ${filtersOpen.value ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            </div>

            <div id="map-filters" class={`${filtersOpen.value ? "grid" : "hidden"} gap-3 lg:grid lg:grid-cols-3`}>
              <div class="lg:hidden">
                <label for="map-search-mobile" class="field-label">Buscar comercio o beneficio</label>
                <input
                  id="map-search-mobile"
                  type="search"
                  placeholder="Café, gimnasio, heladería…"
                  value={searchDraft.value}
                  onInput$={(_, element) => {
                    searchDraft.value = element.value;
                    catalogPage.value = 1;
                  }}
                  class="field min-h-11 text-base"
                />
              </div>
              <div>
                <label for="map-category" class="field-label">Categoría</label>
                <select
                  id="map-category"
                  value={selectedCategory.value || ""}
                  onChange$={(_, element) => {
                    selectedCategory.value = Number(element.value) || null;
                    catalogPage.value = 1;
                  }}
                  class="field min-h-11 text-base sm:text-sm"
                >
                  <option value="">Todas</option>
                  {data.value.filters.categorias.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.descripcion}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label for="map-locality" class="field-label">Localidad</label>
                <select
                  id="map-locality"
                  value={selectedLocation.value || ""}
                  onChange$={(_, element) => {
                    selectedLocation.value = Number(element.value) || null;
                    catalogPage.value = 1;
                  }}
                  class="field min-h-11 text-base sm:text-sm"
                >
                  <option value="">Todas</option>
                  {data.value.filters.ubicaciones.map((locality) => (
                    <option key={locality.id} value={locality.id}>
                      {locality.descripcion}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label for="map-offer" class="field-label">Descuento</label>
                <select
                  id="map-offer"
                  value={selectedOffer.value || ""}
                  onChange$={(_, element) => {
                    selectedOffer.value = Number(element.value) || null;
                    catalogPage.value = 1;
                  }}
                  class="field min-h-11 text-base sm:text-sm"
                >
                  <option value="">Todos</option>
                  {data.value.filters.ofertas.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.descripcion}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p role="status" class={`text-xs leading-relaxed ${geoState.value === "error" ? "font-semibold text-amber-900" : "text-slate-600"}`}>
                <span>{geoMessage.value || "Usá tu ubicación para ordenar por cercanía, o elegí una localidad."}</span>
                {userPosition.value && (
                  <span> Precisión aproximada: {formatDistance(userPosition.value.accuracy / 1000)}. Distancias en línea recta.</span>
                )}
              </p>
              {hasFilters.value && (
                <button
                  type="button"
                  onClick$={clearFilters}
                  class="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-primary underline-offset-4 hover:underline"
                >
                  <LuRefreshCw class="h-4 w-4" aria-hidden="true" />
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div ref={viewSwitchRef} role="group" aria-label="Ver comercios como" class="scroll-mt-36 grid grid-cols-2 border-b border-primary lg:hidden">
        <button
          type="button"
          aria-pressed={mobileView.value === "lista"}
          onClick$={() => {
            mobileView.value = "lista";
          }}
          class={viewButton(mobileView.value === "lista")}
        >
          <LuList class="h-4 w-4" aria-hidden="true" />
          Lista ({nearbyBenefits.value.length})
        </button>
        <button
          type="button"
          aria-pressed={mobileView.value === "mapa"}
          onClick$={() => {
            mobileView.value = "mapa";
          }}
          class={viewButton(mobileView.value === "mapa")}
        >
          <LuMap class="h-4 w-4" aria-hidden="true" />
          Mapa
        </button>
      </div>

      <div class="lg:grid lg:h-[calc(100dvh-11rem)] lg:min-h-[560px] lg:grid-cols-[26rem_minmax(0,1fr)]">
        <section
          aria-label="Comercios del mapa"
          class={`${mobileView.value === "lista" ? "block" : "hidden"} min-h-0 bg-surface lg:block lg:overflow-y-auto lg:border-r lg:border-line`}
        >
          <div class="border-b border-line px-4 py-3">
            <h2 class="eyebrow text-amber-900">
              {userPosition.value ? "Ordenados por cercanía" : "Comercios en el mapa"}
            </h2>
            <p class="mt-1 text-xs text-slate-600">Tocá un comercio para verlo en el mapa.</p>
          </div>
          {nearbyBenefits.value.length ? (
            <ul class="divide-y divide-line">
              {nearbyBenefits.value.map(({ benefit, distance }) => {
                const thumbnail = benefitImageUrl(benefit.imagen);
                const selected = selectedBenefit.value === benefit.id;
                return (
                  <li
                    key={benefit.id}
                    id={`map-benefit-${benefit.id}`}
                    class={`relative flex gap-3 px-4 py-3 transition-colors ${selected ? "bg-accent/15 shadow-[inset_4px_0_0_var(--color-primary)]" : "hover:bg-surface-muted"}`}
                  >
                    <div class="h-16 w-16 shrink-0 overflow-hidden bg-primary">
                      {thumbnail ? (
                        <img src={thumbnail} alt="" width={64} height={64} loading="lazy" class="h-full w-full object-cover" />
                      ) : (
                        <img src="/lprc.avif" alt="" width={64} height={64} class="h-full w-full object-contain p-2" />
                      )}
                    </div>
                    <div class="min-w-0 flex-1">
                      <h3 class="text-sm font-bold leading-snug text-primary">
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick$={() => showOnMap(benefit.id)}
                          class="cursor-pointer text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary"
                        >
                          {benefit.titulo}
                          <span class="sr-only">: ver en el mapa</span>
                        </button>
                      </h3>
                      <p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                        <span>{benefit.ubicacion.map((locality) => locality.descripcion).join(" · ")}</span>
                        {distance !== null && (
                          <span class="inline-flex items-center gap-1 font-semibold text-primary">
                            <LuNavigation class="h-3 w-3" aria-hidden="true" />
                            {formatDistance(distance)}
                          </span>
                        )}
                      </p>
                      <div class="mt-1.5 flex flex-wrap items-center justify-between gap-x-3">
                        <span class="badge badge-accent whitespace-normal text-left leading-tight">
                          {benefit.resumen || "Beneficio para socios"}
                        </span>
                        <Link
                          href={benefitDetailsHref(benefit.url, mapResultsHref.value)}
                          class="relative z-10 inline-flex min-h-11 items-center gap-1 text-xs font-bold text-primary underline-offset-4 hover:underline"
                        >
                          Ver beneficio
                          <LuArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div class="px-5 py-10 text-center">
              <LuMapPin class="mx-auto mb-3 h-8 w-8 text-amber-900" aria-hidden="true" />
              <h3 class="heading-display text-xl">No encontramos comercios</h3>
              <p class="mx-auto mt-2 max-w-xs text-sm text-slate-600">
                {hasFilters.value
                  ? "Ningún comercio del mapa coincide con tu búsqueda o filtros. Probá con otra categoría o localidad."
                  : "Todavía no hay comercios con ubicación cargada."}{" "}
                El catálogo también incluye beneficios sin dirección.
              </p>
              <div class="mt-5 flex flex-wrap justify-center gap-3">
                {hasFilters.value && (
                  <button type="button" onClick$={clearFilters} class="btn btn-dark btn-sm">
                    Limpiar filtros
                  </button>
                )}
                <Link href={listadoHref.value} class="btn btn-outline btn-sm">
                  Ver catálogo
                </Link>
              </div>
            </div>
          )}
        </section>

        <section
          aria-label="Mapa de comercios"
          class={`${mobileView.value === "mapa" ? "block" : "hidden"} relative isolate h-[68svh] min-h-[360px] bg-surface-muted lg:block lg:h-full lg:min-h-0`}
        >
          <div
            ref={mapElement}
            class="absolute inset-0 z-0"
            role="region"
            aria-label="Mapa interactivo de beneficios"
          />
          {(libraryState.value !== "ready" || tileState.value !== "ready") && (
            <div
              class={`absolute left-3 right-14 top-3 z-[500] border px-3 py-2 text-center text-sm shadow-md ${libraryState.value === "error" || tileState.value === "error" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-line bg-surface text-slate-600"}`}
              role="status"
            >
              {libraryState.value === "error"
                ? "No pudimos cargar el mapa. La lista de comercios sigue disponible."
                : libraryState.value === "loading"
                  ? "Cargando mapa…"
                  : tileState.value === "error"
                    ? "Algunas partes del mapa no se cargaron. Podés seguir usando la lista."
                    : "Cargando calles del mapa…"}
              {(libraryState.value === "error" || tileState.value === "error") && (
                <button
                  type="button"
                  class="ml-2 min-h-11 px-2 font-bold underline"
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
          {mapReady.value && !filteredBenefits.value.length && (
            <div class="absolute inset-x-3 top-16 z-[500] border border-line bg-surface p-4 text-center text-sm shadow-md" role="status">
              <p class="font-semibold">No hay comercios en el mapa para estos filtros.</p>
              {hasFilters.value && (
                <button type="button" onClick$={clearFilters} class="btn btn-dark btn-sm mt-3">
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
          {mapReady.value && filteredBenefits.value.length > 0 && (
            <button
              type="button"
              onClick$={() => {
                if (markersGroupRef.value?.getLayers().length)
                  mapRef.value?.fitBounds(markersGroupRef.value.getBounds(), {
                    padding: [35, 35],
                    maxZoom: 16,
                  });
              }}
              class="absolute bottom-7 left-3 z-[500] inline-flex min-h-11 items-center gap-1.5 border border-primary bg-surface px-3 font-display text-xs font-semibold uppercase tracking-wider text-primary shadow-md hover:bg-surface-muted"
            >
              <LuMapPin class="h-4 w-4" aria-hidden="true" />
              Ver todos
            </button>
          )}
        </section>
      </div>
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
