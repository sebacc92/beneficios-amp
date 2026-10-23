/** Run with `node scripts/tests/benefit-filters.mjs`. Uses SQLite memory; no network. */
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
const output = resolve(root, ".cache/test-benefit-filters/backend.mjs");
await mkdir(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/server/benefit-filters.ts'; export * from './src/server/cache.ts'; export * from './src/db/schema.ts';`,
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
const event = () => ({
  sharedMap: new Map([["__drizzle_db", db]]),
  env: { get: () => undefined },
  url: new URL("https://beneficios.example/admin/benefits/"),
});
const tests = [];
const test = async (name, run) => {
  try {
    await run();
    tests.push({ name, ok: true });
  } catch (error) {
    tests.push({ name, ok: false, error });
  }
};

try {
  for (const name of ["benefits", "benefitFilterOptions"]) {
    const { name: tableName, columns } = getTableConfig(backend[name]);
    const definitions = columns.map(
      (column) =>
        `"${column.name}" ${column.getSQLType()}${column.primary ? " primary key" : ""}${column.notNull ? " not null" : ""}`,
    );
    if (name === "benefitFilterOptions")
      definitions.push("unique(type, normalized_name)");
    await local.execute(`create table "${tableName}" (${definitions.join(",")})`);
  }

  const seed = await backend.getFilters();
  const originalSeed = structuredClone(seed);
  const maxSeedId = Math.max(
    0,
    ...Object.values(seed).flatMap((options) => options.map((option) => option.id)),
  );
  const saved = {};

  await test("seed labels are reused without creating a duplicate row", async () => {
    for (const type of ["categorias", "ubicaciones", "ofertas"]) {
      const existing = seed[type][0];
      assert.ok(existing, `Seed has ${type}`);
      const duplicate = await backend.createBenefitFilter(
        event(),
        type,
        `  ${existing.descripcion.toUpperCase().replaceAll(" ", "   ")}  `,
      );
      assert.equal(duplicate.id, existing.id);
      assert.equal(duplicate.descripcion, existing.descripcion);
    }
    const result = await local.execute("select count(*) as total from benefit_filter_options");
    assert.equal(result.rows[0].total, 0);
  });

  await test("invalid option types and labels are rejected before any database write", async () => {
    const before = queries.length;
    for (const type of ["category", "", "toString", "__proto__", null])
      await assert.rejects(
        backend.createBenefitFilter(event(), type, "Nueva opción"),
        (error) => error instanceof backend.BenefitFilterValidationError,
      );
    for (const label of ["", " \n\t ", "x".repeat(101), null, 42, {}])
      await assert.rejects(
        backend.createBenefitFilter(event(), "categorias", label),
        (error) => error instanceof backend.BenefitFilterValidationError,
      );
    assert.equal(queries.slice(before).some((query) => /^insert\b/i.test(query)), false);
  });

  await test("new categories, locations and discounts persist with independent collision-free IDs", async () => {
    const names = {
      categorias: "  Experiencias   de prueba  ",
      ubicaciones: "  Barrio   de prueba  ",
      ofertas: "  3x2   de prueba  ",
    };
    for (const type of Object.keys(names)) {
      saved[type] = await backend.createBenefitFilter(event(), type, names[type]);
      assert.ok(Number.isSafeInteger(saved[type].id));
      assert.ok(saved[type].id > maxSeedId);
      assert.equal(saved[type].descripcion, names[type].trim().replace(/\s+/g, " "));
    }
    assert.equal(new Set(Object.values(saved).map((option) => option.id)).size, 3);
    const result = await local.execute("select count(*) as total from benefit_filter_options");
    assert.equal(result.rows[0].total, 3);
  });

  await test("duplicate labels reuse persisted options and remain distinct between option types", async () => {
    const duplicate = await backend.createBenefitFilter(
      event(),
      "categorias",
      " EXPERIENCIAS   DE PRUEBA ",
    );
    assert.deepEqual(duplicate, saved.categorias);
    const otherType = await backend.createBenefitFilter(
      event(),
      "ubicaciones",
      saved.categorias.descripcion,
    );
    assert.notEqual(otherType.id, duplicate.id);
    assert.equal(otherType.descripcion, duplicate.descripcion);
  });

  await test("concurrent submissions of the same option produce one persistent option", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        backend.createBenefitFilter(event(), "ofertas", "Promo simultánea de prueba"),
      ),
    );
    assert.equal(new Set(results.map((option) => option.id)).size, 1);
    const result = await local.execute({
      sql: "select count(*) as total from benefit_filter_options where type = ? and descripcion = ?",
      args: ["ofertas", "Promo simultánea de prueba"],
    });
    assert.equal(result.rows[0].total, 1);
  });

  await test("fresh requests load saved options and creating an option invalidates the current request memo", async () => {
    const request = event();
    const before = await backend.getFilters(request);
    for (const type of Object.keys(saved))
      assert.ok(before[type].some((option) => option.id === saved[type].id));
    const extra = await backend.createBenefitFilter(request, "categorias", "Nueva tras cargar filtros");
    assert.ok((await backend.getFilters(request)).categorias.some((option) => option.id === extra.id));
    assert.ok((await backend.getFilters(event())).categorias.some((option) => option.id === extra.id));
    assert.deepEqual(await backend.getFilters(), originalSeed);
  });

  await test("benefit selections accept original and saved options without loading benefit rows", async () => {
    for (const options of [seed, Object.fromEntries(Object.entries(saved).map(([type, option]) => [type, [option]]))]) {
      const start = queries.length;
      await backend.validateBenefitFilterSelection(event(), {
        categoryId: String(options.categorias[0].id),
        locationId: String(options.ubicaciones[0].id),
        offerId: String(options.ofertas[0].id),
      });
      assert.equal(queries.slice(start).some((query) => query.includes('from "benefits"')), false);
    }
  });

  await test("invalid, missing and wrong-type benefit options are rejected before a benefit write", async () => {
    const selection = {
      categoryId: String(saved.categorias.id),
      locationId: String(saved.ubicaciones.id),
      offerId: String(saved.ofertas.id),
    };
    const start = queries.length;
    for (const field of Object.keys(selection)) {
      for (const invalid of ["", " ", "0", "-1", "NaN", "Infinity", "1.5", "1e2", "9007199254740992", String(maxSeedId + 100000), null]) {
        await assert.rejects(
          backend.validateBenefitFilterSelection(event(), { ...selection, [field]: invalid }),
          (error) => error instanceof backend.BenefitFilterValidationError && error.field === field,
        );
      }
      const wrongType = field === "categoryId" ? saved.ubicaciones.id : saved.categorias.id;
      await assert.rejects(
        backend.validateBenefitFilterSelection(event(), { ...selection, [field]: String(wrongType) }),
        (error) => error instanceof backend.BenefitFilterValidationError && error.field === field,
      );
    }
    assert.equal(queries.slice(start).some((query) => /^(insert|update)\b/i.test(query)), false);
  });

  await db.insert(backend.benefits).values({
    id: "test-custom-filter-benefit",
    slug: "990001-beneficio-de-prueba",
    titulo: "Comercio con filtros propios",
    resumen: "Promoción para socios",
    descripcion: "Una experiencia disponible en nuestro barrio.",
    isFeatured: false,
    isPremiumOnly: false,
    categoryId: saved.categorias.id,
    locationId: saved.ubicaciones.id,
    offerId: saved.ofertas.id,
    createdAt: new Date().toISOString(),
  });

  await test("public benefit mapping and searches resolve persisted category, location and discount", async () => {
    const request = event();
    const filters = await backend.getFilters(request);
    assert.equal(filters.categorias.find((option) => option.id === saved.categorias.id).beneficios_count, 1);
    const [benefit] = await backend.getCustomBenefits(request);
    assert.deepEqual(benefit.categorias.map(({ id, descripcion }) => ({ id, descripcion })), [saved.categorias]);
    assert.deepEqual(benefit.ubicacion.map(({ id, descripcion }) => ({ id, descripcion })), [saved.ubicaciones]);
    assert.deepEqual(benefit.ofertas.map(({ id, descripcion }) => ({ id, descripcion })), [saved.ofertas]);
    for (const filter of [
      { categoryId: saved.categorias.id },
      { locationId: saved.ubicaciones.id },
      { offerId: saved.ofertas.id },
      { query: saved.categorias.descripcion },
      { query: saved.ubicaciones.descripcion },
    ]) {
      const result = await backend.searchBenefits({ requestEvent: request, ...filter });
      assert.equal(result.total, 1);
      assert.equal(result.data[0].url, "990001-beneficio-de-prueba");
    }
    assert.equal((await backend.searchBenefits({ requestEvent: request, categoryId: maxSeedId + 100000 })).total, 0);
  });

  await test("repeated filters and benefit reads use at most one query per table in a request", async () => {
    const request = event();
    const start = queries.length;
    await Promise.all([
      backend.getCustomBenefitRows(request),
      backend.getFilters(request),
      backend.getCustomBenefits(request),
      backend.getFilters(request),
    ]);
    await backend.getCustomBenefits(request);
    await backend.searchBenefits({ requestEvent: request });
    const selects = queries.slice(start).filter((query) => /^select\b/i.test(query));
    assert.equal(selects.filter((query) => /\bbenefit_filter_options\b/.test(query)).length, 1);
    assert.equal(selects.filter((query) => query.includes('from "benefits"')).length, 1);
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
