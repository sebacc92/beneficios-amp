/**
 * ONE-SHOT: regenera los slides del hero como VARIANTES RESPONSIVE (srcset).
 *
 * Primera pasada (iteración anterior): pasó los JPG crudos a un único WebP.
 * Esta versión genera varias variantes por ancho para servir con srcset/sizes:
 *   - desktop (image_url):    1280w y 1920w  -> columna image_srcset
 *   - mobile  (image_mobile):  480w y  768w  -> columna image_mobile_srcset
 * y deja image_url / image_mobile apuntando a la variante MÁS GRANDE (fallback).
 * No hace upscaling: si la fuente es más chica que un ancho, usa la fuente y
 * deduplica.
 *
 * SEGURIDAD:
 *   - Por defecto DRY-RUN: descarga, mide y reporta pesos por variante. No sube
 *     nada ni toca la base.
 *   - Con `--apply` re-sube a Blob, arma el srcset y actualiza hero_slides
 *     (image_url, image_mobile, image_srcset, image_mobile_srcset). Guarda un
 *     backup JSON de los valores viejos.
 *
 * REQUISITOS: npm i -D sharp · .env.local con PRIVATE_TURSO_* y BLOB_READ_WRITE_TOKEN.
 * USO:
 *   node scripts/optimize-existing-slides.mjs          # dry-run
 *   node scripts/optimize-existing-slides.mjs --apply   # aplica
 */
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import { writeFileSync } from "node:fs";

dotenv.config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");

const WIDTHS = {
  desktop: [1280, 1920], // image_url
  mobile: [480, 768], //    image_mobile
};
const WEBP_QUALITY = 82;

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

if (!url) {
  console.error("✗ Falta PRIVATE_TURSO_DATABASE_URL en .env.local");
  process.exit(1);
}
if (APPLY && !blobToken) {
  console.error("✗ --apply requiere BLOB_READ_WRITE_TOKEN en .env.local");
  process.exit(1);
}

let sharp, put;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("✗ Falta 'sharp'. Instalá con:  npm i -D sharp");
  process.exit(1);
}
if (APPLY) ({ put } = await import("@vercel/blob"));

const db = createClient({ url, authToken });
const kb = (n) => `${(n / 1024).toFixed(1)} KiB`;
const isHttp = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

async function download(u) {
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HTTP ${res.status} al bajar ${u}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Genera las variantes WebP por ancho (sin upscaling, deduplicadas). */
async function makeVariants(buffer, widths) {
  const meta = await sharp(buffer).metadata();
  const srcW = meta.width || Math.max(...widths);
  const seen = new Set();
  const out = [];
  for (const target of [...widths].sort((a, b) => a - b)) {
    const w = Math.min(target, srcW);
    if (seen.has(w)) continue;
    seen.add(w);
    const buf = await sharp(buffer).rotate().resize({ width: w }).webp({ quality: WEBP_QUALITY }).toBuffer();
    out.push({ width: w, buf });
  }
  return out;
}

async function run() {
  console.log(`\n=== Slides responsive (${APPLY ? "APPLY" : "DRY-RUN"}) ===`);
  console.log(`desktop ${WIDTHS.desktop.join("/")}w · mobile ${WIDTHS.mobile.join("/")}w · WebP q${WEBP_QUALITY}\n`);

  const { rows } = await db.execute(
    "SELECT id, title, image_url, image_mobile FROM hero_slides ORDER BY order_index ASC"
  );
  console.log(`Slides en DB: ${rows.length}\n`);

  const jobs = [];
  for (const row of rows) {
    if (isHttp(row.image_url)) jobs.push({ id: row.id, title: row.title, variant: "desktop", field: "image_url", srcsetField: "image_srcset", oldUrl: row.image_url });
    if (isHttp(row.image_mobile)) jobs.push({ id: row.id, title: row.title, variant: "mobile", field: "image_mobile", srcsetField: "image_mobile_srcset", oldUrl: row.image_mobile });
  }

  let totalBefore = 0;
  let totalAfter = 0;
  const updates = []; // { id, field, srcsetField, url, srcset }
  const backup = [];

  for (const j of jobs) {
    try {
      const original = await download(j.oldUrl);
      const variants = await makeVariants(original, WIDTHS[j.variant]);
      totalBefore += original.length;
      const after = variants.reduce((s, v) => s + v.buf.length, 0);
      totalAfter += after;

      const detail = variants.map((v) => `${v.width}w ${kb(v.buf.length)}`).join(" · ");
      console.log(`[${j.variant.padEnd(7)}] ${String(j.title).slice(0, 24).padEnd(24)} orig ${kb(original.length).padStart(11)} → ${detail}`);

      if (APPLY) {
        const uploaded = [];
        for (const v of variants) {
          const fileName = `slide-${j.variant}-${v.width}w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`;
          const blob = await put(fileName, v.buf, { access: "public", token: blobToken });
          uploaded.push({ url: blob.url, width: v.width });
        }
        const srcset = uploaded.map((u) => `${u.url} ${u.width}w`).join(", ");
        const largest = uploaded[uploaded.length - 1].url;
        updates.push({ id: j.id, field: j.field, srcsetField: j.srcsetField, url: largest, srcset });
        backup.push({ id: j.id, field: j.field, oldUrl: j.oldUrl });
      }
    } catch (err) {
      console.error(`  ✗ ${j.variant} de "${j.title}" (${j.oldUrl}): ${err.message}`);
    }
  }

  console.log(`\n--- Totales: ${kb(totalBefore)} → ${kb(totalAfter)} (suma de variantes) sobre ${jobs.length} imágenes ---`);

  if (!APPLY) {
    console.log("\nDRY-RUN: no se subió nada ni se tocó la base.");
    console.log("Para aplicar:  node scripts/optimize-existing-slides.mjs --apply\n");
    return;
  }

  // Asegurar columnas (idempotente) por si la app aún no corrió la migración.
  for (const ddl of [
    "ALTER TABLE hero_slides ADD COLUMN image_srcset TEXT",
    "ALTER TABLE hero_slides ADD COLUMN image_mobile_srcset TEXT",
  ]) {
    try { await db.execute(ddl); } catch { /* ya existe */ }
  }

  const backupPath = `scripts/slides-backup-${Date.now()}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nBackup de URLs viejas: ${backupPath}`);

  for (const u of updates) {
    await db.execute({
      sql: `UPDATE hero_slides SET ${u.field} = ?, ${u.srcsetField} = ? WHERE id = ?`,
      args: [u.url, u.srcset, u.id],
    });
    console.log(`  ✓ ${u.id} · ${u.field} + ${u.srcsetField}`);
  }
  console.log(`\n✓ Aplicado. ${updates.length} imágenes con variantes responsive.\n`);
}

run().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
