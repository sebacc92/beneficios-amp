/** Run with `node scripts/tests/admin-coupons.mjs`. SQLite memory; no network. */
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
const output = resolve(root, ".cache/test-admin-coupons/backend.mjs");
await mkdir(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/server/admin-coupons.ts'; export * from './src/db/schema.ts'; export { eq } from 'drizzle-orm';`,
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
const db = drizzle(local, { schema: backend });
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("Network requests are forbidden in this test.");
};
const event = () => ({ sharedMap: new Map([["__drizzle_db", db]]) });
const query = (search = "") => backend.parseAdminCouponQuery(new URL(`https://beneficios.example/admin/cupones/${search}`));
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
  for (const name of ["benefits", "coupons"]) {
    const { name: table, columns } = getTableConfig(backend[name]);
    const definitions = columns.map(
      (column) => `"${column.name}" ${column.getSQLType()}${column.primary ? " primary key" : ""}${column.notNull ? " not null" : ""}`,
    );
    await local.execute(`create table "${table}" (${definitions.join(",")})`);
  }
  const benefitBase = { resumen: "10%", descripcion: "Beneficio", isFeatured: false, isPremiumOnly: false, categoryId: 1, locationId: 1, offerId: 1, createdAt: "2026-01-01T00:00:00.000Z" };
  await db.insert(backend.benefits).values({ ...benefitBase, id: "open", titulo: "Café Central", slug: "1-cafe", validUntil: null });
  await db.insert(backend.benefits).values({ ...benefitBase, id: "past", titulo: "Pizzería Vieja", slug: "2-pizza", validUntil: "2020-01-01" });
  const couponBase = { benefitResumen: "10%", userId: "u1", numeroSocio: "30111222", createdAt: "" };
  const rows = [];
  for (let i = 0; i < 30; i += 1)
    rows.push({ ...couponBase, id: `a${i}`, code: `ACT${String(i).padStart(3, "0")}`, benefitId: "open", benefitTitle: "Café Central", userName: "Socia Prueba", status: "active", createdAt: `2026-10-01T10:${String(i).padStart(2, "0")}:00.000Z` });
  rows.push({ ...couponBase, id: "u1", code: "USED01", benefitId: "open", benefitTitle: "Café Central", userName: "Socio Canje", status: "used", usedAt: "2026-10-02T10:00:00.000Z", createdAt: "2026-10-02T09:00:00.000Z" });
  rows.push({ ...couponBase, id: "x1", code: "OLD001", benefitId: "past", benefitTitle: "Pizzería Vieja", userName: "Otra Socia", numeroSocio: "27999888", status: "active", createdAt: "2026-09-01T10:00:00.000Z" });
  for (const row of rows) await db.insert(backend.coupons).values(row);

  await test("query params are parsed defensively", async () => {
    assert.deepEqual(query(), { status: "all", search: "", page: 1, period: "todo", benefit: "" });
    assert.deepEqual(query("?estado=used&buscar=%20cafe%20&pagina=2&periodo=30&beneficio=open"), { status: "used", search: "cafe", page: 2, period: "30", benefit: "open" });
    assert.deepEqual(query("?estado=raro&pagina=-3&periodo=365"), { status: "all", search: "", page: 1, period: "todo", benefit: "" });
  });

  await test("pages hold 25 rows newest first and clamp out-of-range pages", async () => {
    const first = await backend.getAdminCouponPage(event(), query());
    assert.equal(first.total, 32);
    assert.equal(first.pages, 2);
    assert.equal(first.records.length, 25);
    assert.equal(first.records[0].code, "USED01");
    const last = await backend.getAdminCouponPage(event(), query("?pagina=99"));
    assert.equal(last.page, 2);
    assert.equal(last.records.length, 7);
    assert.equal(last.records.at(-1).code, "OLD001");
  });

  await test("metrics cover every coupon and expired benefits count as Vencido", async () => {
    const { stats } = await backend.getAdminCouponPage(event(), query("?estado=used"));
    assert.equal(stats.total, 32);
    assert.equal(stats.redeemed, 1);
    assert.equal(stats.active, 30);
    assert.equal(stats.expired, 1);
    assert.equal(stats.rate, 3);
    assert.deepEqual(stats.topBenefits, [
      { benefitId: "open", title: "Café Central", slug: "1-cafe", generated: 31, redeemed: 1 },
      { benefitId: "past", title: "Pizzería Vieja", slug: "2-pizza", generated: 1, redeemed: 0 },
    ], "generated and redeemed are counted apart");
    const expired = await backend.getAdminCouponPage(event(), query("?estado=expired"));
    assert.deepEqual(expired.records.map((row) => [row.code, row.status]), [["OLD001", "expired"]]);
  });

  await test("search matches code, member, DNI and benefit, combined with the status filter", async () => {
    assert.deepEqual((await backend.getAdminCouponPage(event(), query("?buscar=used0"))).records.map((r) => r.code), ["USED01"]);
    assert.equal((await backend.getAdminCouponPage(event(), query("?buscar=27999"))).total, 1);
    assert.equal((await backend.getAdminCouponPage(event(), query("?buscar=PIZZER"))).total, 1);
    assert.equal((await backend.getAdminCouponPage(event(), query("?buscar=socia&estado=active"))).total, 30);
    assert.equal((await backend.getAdminCouponPage(event(), query("?buscar=%25"))).total, 32, "LIKE wildcards are ignored");
  });

  await test("the period narrows metrics and list; the benefit filter narrows both too", async () => {
    const now = new Date("2026-10-05T00:00:00.000Z");
    const week = await backend.getAdminCouponPage(event(), query("?periodo=7"), now);
    assert.equal(week.total, 31, "the September coupon is outside the last 7 days");
    assert.equal(week.stats.total, 31);
    assert.equal(week.stats.expired, 0);
    assert.deepEqual(week.stats.topBenefits.map((row) => row.benefitId), ["open"]);
    const all = await backend.getAdminCouponPage(event(), query("?periodo=90"), now);
    assert.equal(all.total, 32);
    const pizza = await backend.getAdminCouponPage(event(), query("?beneficio=past"));
    assert.equal(pizza.total, 1);
    assert.equal(pizza.stats.total, 1);
    assert.deepEqual(pizza.benefitOptions, [{ id: "open", title: "Café Central" }, { id: "past", title: "Pizzería Vieja" }]);
    assert.equal(pizza.records[0].benefitSlug, "2-pizza");
  });

  await test("the CSV export keeps the list filters, escapes cells and defuses formulas", async () => {
    await db.insert(backend.coupons).values({ ...couponBase, id: "f1", code: "FORM01", benefitId: "open", benefitTitle: "Café Central", userName: '=HYPERLINK("x";"y")', status: "used", usedAt: "2026-10-03T13:05:00.000Z", createdAt: "2026-10-03T12:00:00.000Z" });
    const rows = await backend.getAdminCouponExport(event(), query("?estado=used"));
    assert.deepEqual(rows.map((row) => row.code), ["FORM01", "USED01"]);
    const csv = backend.adminCouponsCsv(rows);
    assert.ok(csv.startsWith("\uFEFFCódigo;Beneficio;Descuento;Socio;DNI;Estado;Generado;Canjeado\r\n"));
    assert.ok(csv.includes(`FORM01;Café Central;10%;"'=HYPERLINK(""x"";""y"")";30111222;Canjeado;03/10/2026, 09:00;03/10/2026, 10:05`), csv);
    await db.delete(backend.coupons).where(backend.eq(backend.coupons.id, "f1"));
  });

  for (const result of tests) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
    if (!result.ok) console.error(result.error.message);
  }
  const failures = tests.filter((result) => !result.ok);
  console.log(`${tests.length - failures.length}/${tests.length} checks passed; SQLite in memory; network forbidden.`);
  if (failures.length) process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  local.close();
  await rm(dirname(output), { recursive: true, force: true });
}
