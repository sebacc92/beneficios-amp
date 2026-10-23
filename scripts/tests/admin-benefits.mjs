/** Run with `node scripts/tests/admin-benefits.mjs`. SQLite memory; no network. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const output = resolve(root, ".cache/test-admin-benefits/backend.mjs");
await mkdir(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/utils/benefit-admin.ts'; export * from './src/utils/benefit-status.ts'; export * from './src/db/schema.ts';`,
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
const tests = [];
const test = async (name, run) => {
  try {
    await run();
    tests.push({ name, ok: true });
  } catch (error) {
    tests.push({ name, ok: false, error });
  }
};
const form = {
  titulo: "  Tampico  ",
  resumen: " 10 %  Off ",
  descripcion: " Descuento en salón ",
  categoryId: "1",
  locationId: "2",
  offerId: "3",
};

try {
  await test("resumen is normalized and percentages are compared with the offer", async () => {
    assert.equal(backend.normalizeResumen(" 10 %  Off "), "10% Off");
    assert.equal(backend.normalizeResumen("  2x1 "), "2x1");
    assert.equal(backend.normalizeResumen("10%   de  descuento"), "10% de descuento");
    assert.equal(backend.percentIn("Hasta 12,5 % off"), 12.5);
    assert.equal(backend.percentIn("Socios Free"), null);
    assert.equal(backend.resumenContradictsOffer("10% Off", "15% Off"), true);
    assert.equal(backend.resumenContradictsOffer("10 % Off", "10% de descuento"), false);
    assert.equal(backend.resumenContradictsOffer("2x1", "10% Off"), false);
    assert.equal(backend.resumenContradictsOffer("20% Off", undefined), false);
  });

  await test("duplicate titles ignore case, accents, apostrophes and spacing", async () => {
    const rows = [
      { id: "a", titulo: "Flako´s" },
      { id: "b", titulo: "Café  Martínez" },
      { id: "c", titulo: "UDE" },
    ];
    assert.equal(backend.findDuplicateTitle(rows, "flako's")?.id, "a");
    assert.equal(backend.findDuplicateTitle(rows, "cafe martinez ")?.id, "b");
    assert.equal(backend.findDuplicateTitle(rows, " ude")?.id, "c");
    assert.equal(backend.findDuplicateTitle(rows, "UDE", "c"), null);
    assert.equal(backend.findDuplicateTitle(rows, "UDE (copia)"), null);
    assert.equal(backend.findDuplicateTitle(rows, "   "), null);
  });

  await test("Google Maps links and plain pairs fill coordinates; short links do not", async () => {
    assert.deepEqual(
      backend.parseMapsLink("https://www.google.com/maps/place/Tampico/@-34.9100,-57.9500,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-34.9214!4d-57.9544"),
      { latitud: "-34.9214", longitud: "-57.9544" },
    );
    assert.deepEqual(
      backend.parseMapsLink("https://www.google.com/maps/@-34.92,-57.95,15z"),
      { latitud: "-34.92", longitud: "-57.95" },
    );
    assert.deepEqual(
      backend.parseMapsLink("https://maps.google.com/?q=-34.9205,-57.9536"),
      { latitud: "-34.9205", longitud: "-57.9536" },
    );
    assert.deepEqual(
      backend.parseMapsLink("https://www.google.com/maps/search/?api=1&query=-34.9205%2C-57.9536"),
      { latitud: "-34.9205", longitud: "-57.9536" },
    );
    assert.deepEqual(backend.parseMapsLink(" -34.9205, -57.9536 "), { latitud: "-34.9205", longitud: "-57.9536" });
    assert.equal(backend.parseMapsLink("https://maps.app.goo.gl/AbCdEf123"), null);
    assert.equal(backend.parseMapsLink("https://www.google.com/maps/@123.4,456.7,15z"), null);
  });

  await test("coordinates are both empty or both valid; nothing is invented", async () => {
    assert.deepEqual(backend.parseCoordinateFields("", " "), { ok: true, latitud: null, longitud: null });
    assert.deepEqual(backend.parseCoordinateFields("-34,92", "-57.95"), { ok: true, latitud: "-34.92", longitud: "-57.95" });
    const missing = backend.parseCoordinateFields("-34.92", "");
    assert.equal(missing.ok, false);
    assert.ok(missing.errors.longitud);
    const invalid = backend.parseCoordinateFields("95", "abc");
    assert.equal(invalid.ok, false);
    assert.ok(invalid.errors.latitud && invalid.errors.longitud);
    assert.equal(backend.hasCoordinates({ latitud: null, longitud: null }), false);
    assert.equal(backend.hasCoordinates({ latitud: "-34.92", longitud: "-57.95" }), true);
  });

  await test("form values encode draft state, Gold, terms and coupon code, and never touch media", async () => {
    const draft = backend.benefitValuesFromForm({ ...form, validUntil: "2026-12-31", terms: "  Lunes a jueves ", isPremiumOnly: "on" });
    assert.equal(draft.titulo, "Tampico");
    assert.equal(draft.resumen, "10% Off");
    assert.equal(draft.validUntil, "draft|2026-12-31");
    assert.equal(draft.isPremiumOnly, true);
    assert.equal(draft.isFeatured, false);
    assert.equal(draft.terms, "Lunes a jueves");
    assert.equal(draft.categoryId, 1);
    for (const key of ["couponCode", "pdfUrl", "imagen", "imagenMobile", "latitud", "longitud"])
      assert.equal(key in draft, false, `${key} must stay out of the form values when the form does not send it`);
    assert.equal(backend.benefitValuesFromForm({ ...form, couponCode: "  LPRC15 " }).couponCode, "LPRC15");
    assert.equal(backend.benefitValuesFromForm({ ...form, couponCode: "  " }).couponCode, null, "an emptied field clears the code");
    const active = backend.benefitValuesFromForm({ ...form, isActive: "on", validUntil: "" });
    assert.equal(active.validUntil, null);
    assert.equal(active.terms, null);
    assert.equal(active.isPremiumOnly, false);
  });

  await test("publishing keeps the date and the visible date is Argentine", async () => {
    assert.equal(backend.withPublishedState("draft|2026-12-31", true), "2026-12-31");
    assert.equal(backend.withPublishedState("2026-12-31", false), "draft|2026-12-31");
    assert.equal(backend.withPublishedState("draft", true), null);
    assert.equal(backend.withPublishedState(null, false), "draft|");
    assert.equal(backend.formatValidUntil("2026-12-31"), "31/12/2026");
    assert.equal(backend.formatValidUntil("draft|2026-01-05"), "05/01/2026");
    assert.equal(backend.formatValidUntil("2026-03-01T01:30:00Z"), "28/02/2026");
    assert.equal(backend.formatValidUntil("draft"), null);
    assert.equal(backend.formatValidUntil(null), null);
  });

  await test("an edit saved with the form values preserves coupon_code and untouched media", async () => {
    const { columns } = getTableConfig(backend.benefits);
    const definitions = columns.map(
      (column) =>
        `"${column.name}" ${column.getSQLType()}${column.primary ? " primary key" : ""}${column.notNull ? " not null" : ""}`,
    );
    await local.execute(`create table "benefits" (${definitions.join(",")})`);
    await db.insert(backend.benefits).values({
      id: "edit-me",
      titulo: "Tampico",
      resumen: "10% Off",
      descripcion: "Antes",
      slug: "edit-me",
      categoryId: 1,
      locationId: 2,
      offerId: 3,
      couponCode: "PROMO-WEB",
      validUntil: "2026-12-31",
      terms: "Condición previa",
      isPremiumOnly: true,
      pdfUrl: "/media/menu.pdf",
      imagen: "/media/tampico.webp",
      latitud: "-34.92",
      longitud: "-57.95",
      createdAt: new Date().toISOString(),
    });
    const [existing] = await db.select().from(backend.benefits).where(eq(backend.benefits.id, "edit-me"));
    // Mirrors useEditBenefitAction: form values plus media/coordinates resolved by the action.
    await db
      .update(backend.benefits)
      .set({
        ...backend.benefitValuesFromForm({
          ...form,
          descripcion: "Después",
          isActive: "on",
          isPremiumOnly: "on",
          validUntil: "2026-12-31",
          terms: "Condición previa",
        }),
        imagen: existing.imagen,
        imagenMobile: existing.imagenMobile,
        pdfUrl: existing.pdfUrl,
        latitud: "-34.92",
        longitud: "-57.95",
      })
      .where(eq(backend.benefits.id, "edit-me"));
    const [saved] = await db.select().from(backend.benefits).where(eq(backend.benefits.id, "edit-me"));
    assert.equal(saved.descripcion, "Después");
    assert.equal(saved.couponCode, "PROMO-WEB");
    await db
      .update(backend.benefits)
      .set(backend.benefitValuesFromForm({ ...form, isActive: "on", couponCode: "LPRC15" }))
      .where(eq(backend.benefits.id, "edit-me"));
    const [withCode] = await db.select().from(backend.benefits).where(eq(backend.benefits.id, "edit-me"));
    assert.equal(withCode.couponCode, "LPRC15", "the form field now saves the code");
    assert.equal(withCode.pdfUrl, "/media/menu.pdf");
    assert.equal(saved.validUntil, "2026-12-31");
    assert.equal(saved.terms, "Condición previa");
    assert.equal(saved.isPremiumOnly, true);
    assert.equal(saved.pdfUrl, "/media/menu.pdf");
    assert.equal(saved.imagen, "/media/tampico.webp");
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
