/** Run with `node scripts/tests/home-benefits.mjs`. SQLite memory; no network. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getTableConfig } from "drizzle-orm/sqlite-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const output = resolve(root, ".cache/test-home-benefits/backend.mjs");
await mkdir(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/utils/home-benefits.ts'; export * from './src/server/cache.ts'; export * from './src/db/schema.ts';`,
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

const backend = await import(pathToFileURL(output).href);
const local = createClient({ url: "file::memory:" });
const queries = [];
const db = drizzle(local, {
  schema: backend,
  logger: { logQuery: (query) => queries.push(query) },
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("Network requests are forbidden in this test.");
};
const tests = [];
const test = async (name, run) => {
  try {
    await run();
    tests.push({ name, ok: true });
  } catch (error) {
    tests.push({ name, ok: false, error });
  }
};
const fixture = (url, values = {}) => ({
  id: 1,
  url,
  titulo: "Comercio de prueba",
  resumen: "20% de descuento",
  descripcion: "Beneficio para socios",
  imagen: null,
  latitud: null,
  longitud: null,
  categorias: [{ id: 1, descripcion: "Compras" }],
  ubicacion: [{ id: 1, descripcion: "La Plata" }],
  ofertas: [],
  mostrar_app: 1,
  isActive: true,
  created_at: "2026-01-01T00:00:00.000Z",
  ...values,
});
const slugs = (benefits) => benefits.map((benefit) => benefit.url);

try {
  await test("nuevos skip featured benefits and the catalog's first day without changing the source", () => {
    const items = [
      fixture("old", { created_at: "2025-01-01T00:00:00Z" }),
      fixture("same-day", { created_at: "2025-01-01T20:00:00Z" }),
      fixture("featured", { created_at: "2026-10-01T00:00:00Z", isFeatured: true }),
      fixture("recent", { created_at: "2026-09-01T00:00:00Z" }),
      fixture("undated", { created_at: "" }),
    ];
    const original = structuredClone(items);
    const rows = backend.selectHomeBenefits(items);
    assert.deepEqual(slugs(rows.gold), ["featured"]);
    assert.deepEqual(slugs(rows.nuevos), ["recent"]);
    assert.deepEqual(items, original);
  });

  await test("a catalog loaded in a single day has no nuevos", () => {
    const items = [
      fixture("a", { created_at: "2026-10-23T09:00:00Z" }),
      fixture("b", { created_at: "2026-10-23T12:00:00Z" }),
      fixture("c", { created_at: "2026-10-23T15:00:00Z", isFeatured: true }),
    ];
    assert.deepEqual(backend.selectHomeBenefits(items).nuevos, []);
    assert.deepEqual(backend.selectHomeBenefits([fixture("only")]).nuevos, []);
  });

  await test("invalid and absent dates sort last and ties use stable slugs", () => {
    const items = [
      fixture("invalid-z", { created_at: "not-a-date" }),
      fixture("valid-b", { id: 2 }),
      fixture("invalid-a", { created_at: undefined }),
      fixture("valid-a", { id: 999 }),
      fixture("empty", { created_at: "" }),
    ];
    const expected = ["valid-a", "valid-b", "empty", "invalid-a", "invalid-z"];
    assert.deepEqual(slugs(backend.sortCatalog(items, "nuevos")), expected);
    assert.deepEqual(slugs(backend.sortCatalog([...items].reverse(), "nuevos")), expected);
  });

  await test("inactive benefits are absent from every homepage row", () => {
    const items = [
      fixture("active", { titulo: "Café activo", isFeatured: true }),
      fixture("hidden", { titulo: "Café oculto", mostrar_app: 0, isFeatured: true }),
      fixture("draft", { titulo: "Café borrador", isActive: false, isFeatured: true }),
    ];
    const rows = backend.selectHomeBenefits(items);
    for (const row of Object.values(rows)) assert.ok(slugs(row).every((slug) => slug === "active"));
    assert.deepEqual(slugs(rows.gold), ["active"]);
  });

  await test("campaign terms still match title, summary, description and category in catalog order", () => {
    const items = [
      fixture("title", { titulo: "PLAN ESPECIAL" }),
      fixture("summary", { resumen: "Promo especial" }),
      fixture("description", { descripcion: "Cupón especial" }),
      fixture("category", { categorias: [{ id: 1, descripcion: "Categoría especial" }] }),
      fixture("fifth", { titulo: "Otro especial" }),
      fixture("other"),
    ];
    assert.deepEqual(slugs(backend.selectHomeBenefits(items, " especial, inexistente ").cafecitos), ["title", "summary", "description", "category"]);
    assert.deepEqual(backend.selectHomeBenefits(items, "sin coincidencias").cafecitos, []);
    assert.deepEqual(backend.selectHomeBenefits([]), { gold: [], nuevos: [], cafecitos: [], mas: [] });
  });

  await test("campaign and more-benefits blocks prefer benefits not shown above, then fill", () => {
    const items = [
      fixture("cafe-featured", { titulo: "Café destacado", isFeatured: true }),
      fixture("cafe-a", { titulo: "Café A" }),
      fixture("gym", { titulo: "Gimnasio" }),
      fixture("cafe-b", { titulo: "Café B", isFeatured: true }),
      fixture("store", { titulo: "Tienda" }),
    ];
    const rows = backend.selectHomeBenefits(items, "café");
    assert.deepEqual(slugs(rows.gold), ["cafe-b", "cafe-featured"]);
    assert.deepEqual(slugs(rows.cafecitos), ["cafe-a", "cafe-featured", "cafe-b"]);
    assert.deepEqual(slugs(rows.mas), ["gym", "store", "cafe-featured", "cafe-a"]);
  });

  await test("hand-picked campaigns keep the admin's order even when repeated above", () => {
    const items = [fixture("a", { isFeatured: true }), fixture("b"), fixture("c")];
    const rows = backend.selectHomeBenefits(items, null, ["c", "missing", "a"]);
    assert.deepEqual(slugs(rows.cafecitos), ["c", "a"]);
    assert.deepEqual(slugs(rows.mas), ["b", "a", "c"]);
  });

  await test("discount labels read the same however they were typed", () => {
    const cases = {
      "10 % OFF": "10% OFF",
      "15% Off": "15% OFF",
      "20% off en compras": "20% OFF en compras",
      "Descuento del 25 % en cuotas": "25% en cuotas",
      "10% de descuento": "10% OFF",
      "25% y 10% de descuento": "25% y 10% OFF",
      "Socios Free": "Socios Free",
      "  ": "Exclusivo",
    };
    for (const [input, expected] of Object.entries(cases)) assert.equal(backend.formatDiscount(input), expected, input);
    assert.equal(backend.offerLabel("25%"), "25% OFF");
    assert.equal(backend.offerLabel("50% OFF - 10% OFF"), "50% OFF - 10% OFF");
    assert.equal(backend.offerLabel("SOCIOS FREE"), "SOCIOS FREE");
    assert.equal(backend.offerLabel("Promociones 2x1"), "Promociones");
  });

  await test("catalog sorts by discount, title and featured-first default", () => {
    const items = [
      fixture("ten", { titulo: "beta", resumen: "10% OFF" }),
      fixture("free", { titulo: "Zorzal", resumen: "Socios Free" }),
      fixture("none", { titulo: "Álamo", resumen: "2x1" }),
      fixture("combo", { titulo: "alfa", resumen: "10% y 25% de descuento", isFeatured: true }),
    ];
    assert.deepEqual(slugs(backend.sortCatalog(items, "descuento")), ["free", "combo", "ten", "none"]);
    // Accents and case do not change alphabetical order ("Álamo" before "alfa").
    assert.deepEqual(slugs(backend.sortCatalog(items, "az")), ["none", "combo", "ten", "free"]);
    assert.deepEqual(slugs(backend.sortCatalog(items, "")), ["combo", "ten", "free", "none"]);
    assert.equal(backend.parseCatalogSort("cualquiera"), "");
    assert.equal(backend.parseCatalogSort("az"), "az");
  });

  await test("common location and live filter counts", () => {
    const laPlata = { id: 1, descripcion: "La Plata" };
    const club = { id: 2, descripcion: "EN EL CLUB" };
    const items = [
      fixture("a", { ubicacion: [laPlata] }),
      fixture("b", { ubicacion: [laPlata] }),
      fixture("c", { ubicacion: [club], ofertas: [{ id: 7, descripcion: "SOCIOS FREE" }] }),
      fixture("hidden", { ubicacion: [club], mostrar_app: 0 }),
    ];
    assert.equal(backend.commonLocation(items.slice(0, 3)), "La Plata");
    assert.equal(backend.commonLocation([items[0], items[2]]), null);
    assert.ok(backend.isClubLocation("EN EL CLUB"));
    const counted = backend.withLiveCounts(
      { categorias: [{ id: 1, descripcion: "Compras", beneficios_count: 99 }], ubicaciones: [laPlata, club], ofertas: [{ id: 7, descripcion: "SOCIOS FREE" }] },
      items,
    );
    assert.deepEqual(counted.categorias.map((option) => option.beneficios_count), [3]);
    assert.deepEqual(counted.ubicaciones.map((option) => option.beneficios_count), [2, 1]);
    assert.deepEqual(counted.ofertas.map((option) => option.beneficios_count), [1]);
  });

  for (const name of ["benefits", "benefitFilterOptions"]) {
    const { name: tableName, columns } = getTableConfig(backend[name]);
    const definitions = columns.map((column) =>
      `"${column.name}" ${column.getSQLType()}${column.primary ? " primary key" : ""}${column.notNull ? " not null" : ""}`,
    );
    await local.execute(`create table "${tableName}" (${definitions.join(",")})`);
  }
  const filters = await backend.getFilters();
  const records = Array.from({ length: 70 }, (_, index) => ({
    id: `test-${index}`,
    slug: `${100000 + index}-beneficio-de-prueba`,
    titulo: index >= 60 ? `Café ${index}` : `Comercio ${index}`,
    resumen: "20% de descuento",
    descripcion: "Un beneficio para socios.",
    isFeatured: index >= 60,
    isPremiumOnly: false,
    categoryId: filters.categorias[0].id,
    locationId: filters.ubicaciones[0].id,
    offerId: filters.ofertas[0].id,
    createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    validUntil: index === 69 ? "draft|" : null,
  }));
  // An unrelated category keeps this test's campaign matches beyond the old cutoff.
  await db.insert(backend.benefitFilterOptions).values({
    id: 900001,
    type: "categorias",
    descripcion: "Compras de prueba",
    normalizedName: "compras de prueba",
  });
  await db.insert(backend.benefits).values(records.map((record) => ({ ...record, categoryId: 900001 })));

  await test("the full catalog finds featured and campaign benefits past 60 without extra queries", async () => {
    const event = {
      sharedMap: new Map([["__drizzle_db", db]]),
      env: { get: () => undefined },
      url: new URL("https://beneficios.example/"),
    };
    const queryStart = queries.length;
    const page = await backend.searchBenefits({ requestEvent: event, limit: 12 });
    assert.equal(page.total, 69);
    assert.equal(page.data.length, 12);
    const beforeCuratedRows = queries.length;
    const catalog = await backend.getCustomBenefits(event);
    const rows = backend.selectHomeBenefits(catalog);
    assert.equal(queries.length, beforeCuratedRows, "Curated rows reuse the request's loaded catalog");
    const expectedRecent = [68, 67, 66, 65, 64, 63].map((index) => records[index].slug);
    assert.deepEqual(slugs(rows.gold), expectedRecent);
    assert.deepEqual(slugs(rows.nuevos), [62, 61, 60, 59, 58, 57].map((index) => records[index].slug));
    assert.deepEqual(slugs(rows.cafecitos), [60, 61, 62, 63].map((index) => records[index].slug));
    assert.ok(Object.values(rows).every((row) => !slugs(row).includes(records[69].slug)), "Drafts never appear");
    const selects = queries.slice(queryStart).filter((query) => /^select\b/i.test(query));
    assert.equal(selects.filter((query) => query.includes('from "benefits"')).length, 1);
    assert.equal(selects.filter((query) => query.includes('from "benefit_filter_options"')).length, 1);
    assert.equal(selects.length, 2);
  });

  for (const result of tests) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
    if (!result.ok) console.error(result.error);
  }
  const failures = tests.filter((result) => !result.ok);
  console.log(`${tests.length - failures.length}/${tests.length} checks passed; SQLite in memory; no network.`);
  if (failures.length) process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  local.close();
  await rm(dirname(output), { recursive: true, force: true });
}
