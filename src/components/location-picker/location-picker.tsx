import { component$, useSignal, useVisibleTask$, $, type Signal } from "@builder.io/qwik";
import { server$ } from "@builder.io/qwik-city";

interface LocationPickerProps {
  lat: Signal<string>;
  lng: Signal<string>;
  mapId: string;
  // Señal opcional de dirección (texto). Si se pasa, el buscador la usa como
  // fuente y al mover el marker se autocompleta vía reverse-geocoding.
  address?: Signal<string>;
}

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
}

// Default: La Plata centro
const DEFAULT_LAT = -34.92145;
const DEFAULT_LNG = -57.95453;

function loadLeaflet(): Promise<any> {
  return new Promise((resolve) => {
    const w = window as any;
    if (w.L) return resolve(w.L);
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    let script = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    const check = (): void => {
      if (w.L) {
        resolve(w.L);
        return;
      }
      setTimeout(check, 50);
    };
    if (!script) {
      script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      document.head.appendChild(script);
    }
    script.addEventListener("load", check);
    check();
  });
}

// Genera variantes de la dirección, de más específica a más general, para
// maximizar las chances de geocodificar con el botón "Buscar" (fallback).
function buildAddressCandidates(raw: string): string[] {
  const cleaned = raw
    .replace(/\bav\b\.?/gi, "Avenida")
    .replace(/\bdr\b\.?/gi, "Doctor")
    .replace(/\bsta\b\.?/gi, "Santa")
    .replace(/\bgral\b\.?/gi, "General")
    .replace(/provincia de /gi, "")
    // Código postal argentino (CPA), ej: B7167 / C1425ABC. No tocar números de altura.
    .replace(/\b[A-Za-z]\d{4}[A-Za-z]{0,3}\b/g, "")
    .replace(/\s*,\s*,+/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/^,|,$/g, "")
    .trim();

  const noNumber = cleaned
    .replace(/\b\d{1,5}\b/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .trim();

  return [cleaned, raw.trim(), noNumber].filter((v, i, a) => v && a.indexOf(v) === i);
}

async function geocodeNominatim(query: string): Promise<Array<{ lat: string; lon: string }>> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=ar&q=${encodeURIComponent(query)}`,
    { headers: { Accept: "application/json" } }
  );
  return (await res.json()) as Array<{ lat: string; lon: string }>;
}

// Construye una etiqueta legible a partir de las propiedades de Photon.
function photonLabel(p: any): string {
  const street = p.street || p.name;
  const line1 = [street, p.housenumber].filter(Boolean).join(" ");
  const locality = p.city || p.town || p.village || p.county || p.district || "";
  const region = p.state || "";
  const parts = [line1 || p.name, locality, region].filter(Boolean) as string[];
  return [...new Set(parts)].join(", ");
}

// Autocomplete con Photon (komoot), pensado para typeahead. Sesga a Argentina
// vía lat/lon y prioriza resultados con countrycode AR.
async function suggestPhoton(query: string, biasLat: number, biasLon: number): Promise<Suggestion[]> {
  const res = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=es&lat=${biasLat}&lon=${biasLon}`,
    { headers: { Accept: "application/json" } }
  );
  const data = (await res.json()) as { features?: any[] };
  const feats = data.features || [];
  const ar = feats.filter((f) => f.properties?.countrycode === "AR");
  const chosen = (ar.length ? ar : feats).slice(0, 5);
  return chosen
    .map((f) => ({
      label: photonLabel(f.properties || {}),
      lat: f.geometry?.coordinates?.[1],
      lon: f.geometry?.coordinates?.[0],
    }))
    .filter((s) => s.label && typeof s.lat === "number" && typeof s.lon === "number");
}

// Limpia la dirección formateada de Google: saca país y código postal (CPA).
function cleanGoogleAddress(a: string): string {
  return (a || "")
    .replace(/,\s*Argentina\s*$/i, "")
    .replace(/\s*,?\s*[A-Z]\d{4}[A-Za-z]{0,3}\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*$/, "")
    .trim();
}

// --- Proxies server-side (la API key de Google NUNCA llega al navegador) ---

// Forward geocoding con Google. Devuelve coords + dirección formateada, o null.
const googleForward = server$(async function (query: string) {
  const key = this.env.get("GOOGLE_GEOCODING_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&language=es&region=ar&components=country:AR&key=${key}`
    );
    const j: any = await res.json();
    if (j.status !== "OK" || !j.results?.length) return null;
    const r = j.results[0];
    return { lat: r.geometry.location.lat as number, lng: r.geometry.location.lng as number, address: cleanGoogleAddress(r.formatted_address) };
  } catch {
    return null;
  }
});

// Reverse geocoding con Google. Devuelve dirección formateada, o null.
const googleReverse = server$(async function (lat: number, lng: number) {
  const key = this.env.get("GOOGLE_GEOCODING_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=es&region=ar&key=${key}`
    );
    const j: any = await res.json();
    if (j.status !== "OK" || !j.results?.length) return null;
    return cleanGoogleAddress(j.results[0].formatted_address);
  } catch {
    return null;
  }
});

export const LocationPicker = component$<LocationPickerProps>(({ lat, lng, mapId, address }) => {
  const internalAddress = useSignal("");
  const addr = address ?? internalAddress;
  const searching = useSignal(false);
  const searchError = useSignal<string | null>(null);
  const mapRef = useSignal<any>(null);
  const markerRef = useSignal<any>(null);

  // Autocomplete state
  const suggestions = useSignal<Suggestion[]>([]);
  const showSuggestions = useSignal(false);
  const activeIndex = useSignal(-1);
  const debounceTimer = useSignal<any>(null);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ cleanup }) => {
    const L = await loadLeaflet();
    const el = document.getElementById(mapId);
    if (!el || mapRef.value) return;

    const startLat = parseFloat(lat.value) || DEFAULT_LAT;
    const startLng = parseFloat(lng.value) || DEFAULT_LNG;

    const map = L.map(el).setView([startLat, startLng], parseFloat(lat.value) ? 16 : 13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap, © CARTO",
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
    mapRef.value = map;
    markerRef.value = marker;

    // Reverse-geocoding: completar el campo de dirección a partir del pin.
    // Primero Google (más completo); si falla, fallback a Nominatim (OSM).
    const reverseFill = async (la: number, lo: number) => {
      if (!address) return;
      let result: string | null = null;
      try {
        result = await googleReverse(la, lo);
      } catch {
        // sigue con el fallback
      }
      if (!result) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&zoom=18&lat=${la}&lon=${lo}`,
            { headers: { Accept: "application/json" } }
          );
          const data = (await res.json()) as { display_name?: string };
          if (data && data.display_name) {
            result = data.display_name
              .replace(/,\s*Argentina\s*$/i, "")
              .replace(/,\s*[A-Za-z]?\d{4}[A-Za-z]{0,3}\s*(?=,|$)/g, "")
              .trim();
          }
        } catch {
          // Silencioso: el reverse-geocoding es un extra.
        }
      }
      if (result) address.value = result;
    };

    const setFromLatLng = (latlng: any) => {
      lat.value = latlng.lat.toFixed(8);
      lng.value = latlng.lng.toFixed(8);
      reverseFill(latlng.lat, latlng.lng);
    };
    map.on("click", (e: any) => {
      marker.setLatLng(e.latlng);
      setFromLatLng(e.latlng);
    });
    marker.on("dragend", () => setFromLatLng(marker.getLatLng()));

    // El mapa puede montarse dentro de un modal: recalcular tamaño.
    setTimeout(() => map.invalidateSize(), 250);

    cleanup(() => {
      map.remove();
      mapRef.value = null;
      markerRef.value = null;
    });
  });

  const moveTo = $((la: number, lo: number) => {
    lat.value = la.toFixed(8);
    lng.value = lo.toFixed(8);
    if (mapRef.value && markerRef.value) {
      markerRef.value.setLatLng([la, lo]);
      mapRef.value.setView([la, lo], 16);
    }
  });

  const fetchSuggestions = $(async (q: string) => {
    try {
      const biasLat = parseFloat(lat.value) || DEFAULT_LAT;
      const biasLng = parseFloat(lng.value) || DEFAULT_LNG;
      const results = await suggestPhoton(q, biasLat, biasLng);
      suggestions.value = results;
      showSuggestions.value = results.length > 0;
      activeIndex.value = -1;
    } catch {
      suggestions.value = [];
      showSuggestions.value = false;
    }
  });

  const onAddressInput = $((value: string) => {
    addr.value = value;
    searchError.value = null;
    if (debounceTimer.value) clearTimeout(debounceTimer.value);
    const q = value.trim();
    if (q.length < 4) {
      suggestions.value = [];
      showSuggestions.value = false;
      return;
    }
    debounceTimer.value = setTimeout(() => fetchSuggestions(q), 350);
  });

  const selectSuggestion = $((s: Suggestion) => {
    addr.value = s.label;
    suggestions.value = [];
    showSuggestions.value = false;
    activeIndex.value = -1;
    searchError.value = null;
    moveTo(s.lat, s.lon);
  });

  // "Buscar": geocodifica con Google (preciso); si falla, fallback a Nominatim.
  const searchAddress = $(async () => {
    showSuggestions.value = false;
    const raw = addr.value.trim();
    if (!raw) return;
    searching.value = true;
    searchError.value = null;
    try {
      // 1) Google forward (vía proxy server-side).
      let g: { lat: number; lng: number; address: string } | null = null;
      try {
        g = await googleForward(raw);
      } catch {
        // sigue con el fallback
      }
      if (g) {
        await moveTo(g.lat, g.lng);
        return;
      }
      // 2) Fallback: Nominatim con limpieza de CPA/abreviaturas.
      for (const candidate of buildAddressCandidates(raw)) {
        const results = await geocodeNominatim(candidate);
        if (results.length) {
          await moveTo(parseFloat(results[0].lat), parseFloat(results[0].lon));
          return;
        }
      }
      searchError.value = "No se encontró la dirección. Probá agregar la ciudad o quitar el código postal.";
    } catch {
      searchError.value = "Error al buscar la dirección. Intentá de nuevo.";
    } finally {
      searching.value = false;
    }
  });

  const onKeyDown = $((e: KeyboardEvent) => {
    if (showSuggestions.value && suggestions.value.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex.value = (activeIndex.value + 1) % suggestions.value.length;
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex.value = (activeIndex.value - 1 + suggestions.value.length) % suggestions.value.length;
        return;
      }
      if (e.key === "Escape") {
        showSuggestions.value = false;
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex.value >= 0) {
          selectSuggestion(suggestions.value[activeIndex.value]);
          return;
        }
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      searchAddress();
    }
  });

  return (
    <div class="space-y-2">
      <div class="relative z-10 flex gap-2">
        <div class="relative flex-grow">
          <input
            type="text"
            value={addr.value}
            onInput$={(e) => onAddressInput((e.target as HTMLInputElement).value)}
            onKeyDown$={onKeyDown}
            onFocus$={() => { if (suggestions.value.length) showSuggestions.value = true; }}
            onBlur$={() => { setTimeout(() => (showSuggestions.value = false), 200); }}
            placeholder="Dirección (ej: Av. Divisadero 1470, Cariló)"
            autoComplete="off"
            class="w-full text-sm font-semibold border border-slate-200 py-2.5 px-3.5 rounded-xl focus:outline-none focus:border-brand-green"
          />
          {showSuggestions.value && suggestions.value.length > 0 && (
            <ul class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {suggestions.value.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick$={() => selectSuggestion(s)}
                    onMouseEnter$={() => (activeIndex.value = i)}
                    class={[
                      "w-full text-left text-xs font-medium px-3.5 py-2.5 transition-colors border-b border-slate-50 last:border-b-0",
                      i === activeIndex.value ? "bg-brand-green/10 text-brand-green-dark" : "text-slate-600 hover:bg-slate-50",
                    ]}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick$={searchAddress}
          disabled={searching.value}
          class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
        >
          {searching.value ? "Buscando..." : "Buscar"}
        </button>
      </div>
      {searchError.value && <p class="text-xs font-bold text-red-600">{searchError.value}</p>}

      <div id={mapId} class="w-full h-64 rounded-xl border border-slate-200 overflow-hidden z-0" />

      <p class="text-[11px] text-slate-400 font-medium">
        Escribí la dirección y elegí una sugerencia, hacé clic en el mapa o arrastrá el pin para ajustar.{" "}
        {lat.value && lng.value ? (
          <span class="font-mono text-slate-500">
            {parseFloat(lat.value).toFixed(5)}, {parseFloat(lng.value).toFixed(5)}
          </span>
        ) : (
          <span>Sin ubicación seleccionada.</span>
        )}
      </p>
    </div>
  );
});
