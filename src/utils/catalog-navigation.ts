import { parseCatalogSort } from "~/utils/home-benefits";
import { safeReturnPath } from "~/utils/return-path";

export const RESULTS_PARAM = "resultados";

/** Only public catalog controls are carried between views; nested destinations are dropped. */
export function catalogSearchParams(source: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  const query = source.get("buscar")?.replace(/\s+/g, " ").trim();
  if (query) params.set("buscar", query);
  for (const key of ["categoria", "ubicacion", "oferta", "page"]) {
    const value = Number(source.get(key));
    if (Number.isSafeInteger(value) && value > (key === "page" ? 1 : 0)) params.set(key, String(value));
  }
  for (const key of ["gold", "campana"]) {
    if (source.get(key) === "1") params.set(key, "1");
  }
  const sort = parseCatalogSort(source.get("orden"));
  if (sort) params.set("orden", sort);
  return params;
}

export function catalogHref(view: "/beneficios/" | "/mapa/", source: URLSearchParams): string {
  const params = catalogSearchParams(source);
  if (view === "/mapa/" && source.get("vista") === "lista") params.set("vista", "lista");
  const query = params.toString();
  return `${view}${query ? `?${query}` : ""}`;
}

/** A result link can only return to the public list or map, never an external page. */
export function safeResultsPath(raw: string | null | undefined): string | null {
  const path = safeReturnPath(raw);
  if (!path) return null;
  const url = new URL(path, "https://catalog.invalid");
  if (url.origin !== "https://catalog.invalid" || !/^\/(beneficios|mapa)\/?$/.test(url.pathname)) return null;
  return catalogHref(url.pathname.startsWith("/mapa") ? "/mapa/" : "/beneficios/", url.searchParams);
}

export function benefitDetailsHref(slug: string, resultsPath?: string | null): string {
  const path = `/beneficio/${encodeURIComponent(slug)}/`;
  const results = safeResultsPath(resultsPath);
  return results ? `${path}?${RESULTS_PARAM}=${encodeURIComponent(results)}` : path;
}
