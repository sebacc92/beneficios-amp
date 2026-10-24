/** Catalog/map parity and return navigation; no network or database. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const output = resolve(root, ".cache/test-catalog-search-navigation/backend.mjs");
await mkdir(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/utils/catalog-search.ts'; export * from './src/utils/catalog-navigation.ts'; export * from './src/utils/map-benefits.ts'; export * from './src/server/cache.ts';`,
    resolveDir: root,
    loader: "ts",
  },
  tsconfig: resolve(root, "tsconfig.json"),
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  outfile: output,
  logLevel: "silent",
});
const fixture = (id, titulo, values = {}) => ({
  id, url: `comercio-${id}`, titulo,
  descripcion: "<p>Promoción   para socios</p>",
  categorias: [{ id: 1, descripcion: "Gastronomía" }],
  ubicacion: [{ id: 2, descripcion: "La Plata" }],
  ofertas: [{ id: 3, descripcion: "20%" }],
  resumen: "20% OFF", latitud: "-34.9", longitud: "-57.9",
  mostrar_app: 1, ...values,
});
const items = [
  fixture(1, "Café   del Río", { isPremiumOnly: true }),
  fixture(2, "CAFE DEL RIO", { ubicacion: [{ id: 4, descripcion: "Gonnet" }] }),
  fixture(3, "Café sin dirección", { latitud: null }),
  fixture(4, "Café oculto", { mostrar_app: 0 }),
];
const originalCache = globalThis.__benefitsCache;
const originalFetch = globalThis.fetch;
globalThis.__benefitsCache = { benefits: items, filters: { categorias: [], ubicaciones: [], ofertas: [] }, lastFetchTime: Date.now() };
globalThis.fetch = async () => { throw new Error("Network forbidden in this test"); };
try {
  const backend = await import(pathToFileURL(output).href);
  const ids = values => values.map(value => value.id);
  for (const query of [" cafe del rio ", "CAFÉ   DEL  RÍO", "cafe\tdel\nrio"]) {
    const catalog = await backend.searchBenefits({ query, limit: 100 });
    const map = backend.filterMapBenefits(items.filter(item => item.mostrar_app !== 0), query, null, null);
    assert.deepEqual(ids(catalog.data), [1, 2]);
    assert.deepEqual(ids(map), [1, 2]);
  }
  assert.deepEqual(ids((await backend.searchBenefits({ query: "promocion para socios", categoryId: 1, locationId: 2, offerId: 3, isPremiumOnly: true })).data), [1]);
  assert.deepEqual(ids(backend.filterMapBenefits(items, "gastronomia", 1, 2, 3, { gold: true })), [1]);
  assert.deepEqual(ids(backend.filterMapBenefits(items, "", null, null, null, { gold: true, campaignSlugs: ["comercio-2"] })), []);
  assert.deepEqual(ids(backend.filterMapBenefits(items, "", null, null, null, { campaignSlugs: ["comercio-2"] })), [2]);
  assert.deepEqual(ids(backend.filterMapBenefits(items, "", null, null, null, { gold: true, campaignTerms: ["café"] })), [1]);

  const originalParams = new URLSearchParams("buscar=+Café++del+Río+&categoria=1&ubicacion=2&oferta=3&gold=1&campana=1&orden=descuento&page=3&rogue=1");
  const list = backend.catalogHref("/beneficios/", originalParams);
  const map = backend.catalogHref("/mapa/", originalParams);
  assert.equal(map.replace("/mapa/", "/beneficios/"), list);
  const details = backend.benefitDetailsHref("cafe-del-rio", map);
  const returnPath = new URL(details, "https://example.test").searchParams.get(backend.RESULTS_PARAM);
  assert.equal(backend.safeResultsPath(returnPath), map);
  assert.equal(backend.catalogHref("/beneficios/", new URL(returnPath, "https://example.test").searchParams), list);
  assert.equal(backend.catalogHref("/mapa/", new URLSearchParams("vista=lista&page=2&orden=az")), "/mapa/?page=2&orden=az&vista=lista");
  for (const unsafe of ["https://evil.test", "//evil.test", "/\\evil.test", "/admin/", "/beneficio/x/", "/mapa/../admin/", "/beneficios/?volver=https://evil.test"]) {
    const destination = backend.safeResultsPath(unsafe);
    if (unsafe.startsWith("/beneficios/?")) assert.equal(destination, "/beneficios/");
    else assert.equal(destination, null, unsafe);
  }
  assert.equal(backend.benefitDetailsHref("cafe-del-rio", "https://evil.test"), "/beneficio/cafe-del-rio/");
  assert.equal(backend.catalogHref("/mapa/", new URLSearchParams("page=-2&categoria=NaN&gold=2&campana=0&orden=bad")), "/mapa/");
  console.log("PASS catalog/map spelling parity, real Gold/campaign intersections, filters/order/page round trip and internal-only return paths");
} finally {
  globalThis.fetch = originalFetch;
  globalThis.__benefitsCache = originalCache;
  await rm(dirname(output), { recursive: true, force: true });
}
