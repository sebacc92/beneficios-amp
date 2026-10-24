/** Admin/public featured parity and failed-load recovery. SQLite memory; no network. */
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
const output = resolve(root, ".cache/test-admin-catalog/backend.mjs");
await mkdir(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/server/admin-benefits.ts'; export * from './src/server/cache.ts'; export * from './src/utils/home-benefits.ts'; export * from './src/db/schema.ts';`,
    resolveDir: root,
    loader: "ts",
  },
  tsconfig: resolve(root, "tsconfig.json"), bundle: true, packages: "external",
  platform: "node", format: "esm", outfile: output, logLevel: "silent",
});
const backend = await import(pathToFileURL(output).href);
const local = createClient({ url: "file::memory:" });
const queries = [];
const db = drizzle(local, { schema: backend, logger: { logQuery: (query) => queries.push(query) } });
const event = (database = db) => ({ sharedMap: new Map([["__drizzle_db", database]]) });
const createTables = async (client) => {
  for (const table of [backend.benefits, backend.coupons, backend.benefitFilterOptions]) {
    const { name, columns } = getTableConfig(table);
    const definitions = columns.map((column) =>
      `"${column.name}" ${column.getSQLType()}${column.primary ? " primary key" : ""}${column.notNull ? " not null" : ""}`,
    );
    await client.execute(`create table "${name}" (${definitions.join(",")})`);
  }
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Network requests are forbidden in this test."); };
let checked = 0;
const test = async (name, run) => { await run(); checked++; console.log(`PASS ${name}`); };

try {
  await createTables(local);
  await test("an empty catalog is a successful load, not an error", async () => {
    assert.deepEqual(await backend.loadAdminBenefits(event()), { rows: [], loadError: false });
  });

  const records = Array.from({ length: 70 }, (_, index) => ({
    id: `fixture-${index}`, slug: `fixture-${index}`, titulo: `Comercio ${index}`,
    resumen: "20% OFF", descripcion: "Beneficio de prueba", isFeatured: index >= 58,
    isPremiumOnly: false, categoryId: 1, locationId: 1, offerId: 1,
    createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    validUntil: index === 69 ? "draft|2099-12-31" : index === 68 ? "1900-01-01" : null,
  }));
  await db.insert(backend.benefits).values(records);
  await db.insert(backend.coupons).values({
    id: "fixture-coupon", code: "ABC123", benefitId: "fixture-67", benefitTitle: "Comercio 67",
    benefitResumen: "20% OFF", userId: "fixture-member", userName: "Socio de prueba",
    status: "active", createdAt: "2026-01-01T00:00:00Z",
  });

  await test("admin names the exact six public featured benefits beyond 60, excluding drafts and expired ones", async () => {
    const request = event();
    const queryStart = queries.length;
    const admin = await backend.loadAdminBenefits(request);
    assert.equal(admin.loadError, false);
    assert.equal(admin.rows.length, 70);
    const home = admin.rows.filter((row) => row.featuredPlacement === "home").map((row) => row.slug);
    assert.deepEqual(home, [67, 66, 65, 64, 63, 62].map((index) => `fixture-${index}`));
    const queryEnd = queries.length;
    assert.deepEqual(home, backend.selectHomeBenefits(await backend.getCustomBenefits(request)).gold.map((row) => row.url));
    assert.equal(queries.length, queryEnd, "public selection reuses the loaded catalog");
    assert.equal(queries.slice(queryStart).filter((query) => /from "benefits"/i.test(query)).length, 1, "one catalog query for raw and public rows");
    assert.equal(admin.rows.find((row) => row.id === "fixture-67").couponCount, 1);
    assert.equal(admin.rows.find((row) => row.id === "fixture-69").featuredPlacement, "draft");
    assert.equal(admin.rows.find((row) => row.id === "fixture-68").featuredPlacement, "expired");
    assert.equal(admin.rows.find((row) => row.id === "fixture-61").featuredPlacement, "overflow");
    assert.equal(admin.rows.find((row) => row.id === "fixture-0").featuredPlacement, null);
  });

  await test("unpublishing a featured benefit promotes the next one on the next request", async () => {
    await local.execute("update benefits set valid_until = 'draft|' where id = 'fixture-67'");
    const admin = await backend.loadAdminBenefits(event());
    assert.equal(admin.rows.find((row) => row.id === "fixture-67").featuredPlacement, "draft");
    assert.equal(admin.rows.find((row) => row.id === "fixture-61").featuredPlacement, "home");
    assert.equal(admin.rows.filter((row) => row.featuredPlacement === "home").length, 6);
  });

  await test("failed database reads remain errors, and a new request can retry successfully", async () => {
    const broken = createClient({ url: "file::memory:" });
    const recoveringDb = drizzle(broken, { schema: backend });
    const originalError = console.error;
    try {
      console.error = () => {};
      assert.deepEqual(await backend.loadAdminBenefits(event(recoveringDb)), { rows: [], loadError: true });
      await createTables(broken);
      assert.deepEqual(await backend.loadAdminBenefits(event(recoveringDb)), { rows: [], loadError: false });
    } finally {
      console.error = originalError;
      broken.close();
    }
  });
  console.log(`\n${checked} admin catalog checks passed.`);
} finally {
  globalThis.fetch = originalFetch;
  local.close();
  await rm(dirname(output), { recursive: true, force: true });
}
