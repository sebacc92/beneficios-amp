/**
 * ONE-SHOT: optimiza los slides del hero que YA están en Vercel Blob.
 *
 * Los slides subidos antes de la tarea T1a se guardaron como JPG/PNG crudos
 * (800–1080 KiB), causa #1 del LCP alto en la home. Este script los descarga,
 * los re-comprime a WebP con resize (desktop máx 1920px, mobile máx 1080px de
 * ancho) y —en modo --apply— los re-sube a Blob y actualiza las URLs en la DB.
 *
 * SEGURIDAD:
 *   - Por defecto corre en DRY-RUN: descarga, mide y reporta antes/después.
 *     NO sube nada ni toca la base. Revisá la tabla antes de aplicar.
 *   - Con `--apply` re-sube a Blob y actualiza hero_slides (image_url /
 *     image_mobile). Guarda un backup JSON de las URLs viejas en scripts/.
 *
 * REQUISITOS:
 *   - npm i -D sharp
 *   - .env.local con PRIVATE_TURSO_DATABASE_URL, PRIVATE_TURSO_AUTH_TOKEN y
 *     BLOB_READ_WRITE_TOKEN (usar credenciales de PRODUCCIÓN con cuidado).
 *
 * USO:
 *   node scripts/optimize-existing-slides.mjs          # dry-run (reporte)
 *   node scripts/optimize-existing-slides.mjs --apply  # aplica de verdad
 */
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import { writeFileSync } from "node:fs";

dotenv.config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");

const MAX = {
  desktop: 1920, // image_url  -> variante horizontal del hero
  mobile: 1080, //  image_mobile -> variante vertical del hero
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

// Imports que pueden faltar hasta que se instalen: se cargan dinámicamente.
let sharp, put;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("✗ Falta 'sharp'. Instalá con:  npm i -D sharp");
  process.exit(1);
}
if (APPLY) {
  ({ put } = await import("@vercel/blob"));
}

const db = createClient({ url, authToken });

const kb = (n) => `${(n / 1024).toFixed(1)} KiB`;
const isHttp = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

async function download(u) {
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HTTP ${res.status} al bajar ${u}`);
  return Buffer.from(await res.arrayBuffer());
}

async function optimize(buffer, maxWidth) {
  return await sharp(buffer)
    .rotate() // respeta orientación EXIF
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

async function run() {
  console.log(`\n=== Optimización de slides existentes (${APPLY ? "APPLY" : "DRY-RUN"}) ===`);
  console.log(`Máximos: desktop ${MAX.desktop}px · mobile ${MAX.mobile}px · WebP q${WEBP_QUALITY}\n`);

  const { rows } = await db.execute("SELECT id, title, image_url, image_mobile FROM hero_slides ORDER BY order_index ASC");
  console.log(`Slides en DB: ${rows.length}\n`);

  const targets = [];
  for (const row of rows) {
    if (isHttp(row.image_url)) targets.push({ id: row.id, title: row.title, field: "image_url", variant: "desktop", oldUrl: row.image_url });
    if (isHttp(row.image_mobile)) targets.push({ id: row.id, title: row.title, field: "image_mobile", variant: "mobile", oldUrl: row.image_mobile });
  }

  let totalBefore = 0;
  let totalAfter = 0;
  const updates = []; // { id, field, oldUrl, newUrl }
  const backup = [];

  for (const t of targets) {
    try {
      const original = await download(t.oldUrl);
      const optimized = await optimize(original, MAX[t.variant]);
      totalBefore += original.length;
      totalAfter += optimized.length;

      const pct = ((1 - optimized.length / original.length) * 100).toFixed(0);
      const already = optimized.length >= original.length;
      console.log(
        `[${t.variant.padEnd(7)}] ${String(t.title).slice(0, 28).padEnd(28)} ${kb(original.length).padStart(11)} → ${kb(optimized.length).padStart(11)}  (-${pct}%)${already ? "  (ya óptima, se omite)" : ""}`
      );

      if (APPLY && !already) {
        const fileName = `slide-${t.variant}-opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`;
        const blob = await put(fileName, optimized, { access: "public", token: blobToken });
        updates.push({ id: t.id, field: t.field, newUrl: blob.url });
        backup.push({ id: t.id, field: t.field, oldUrl: t.oldUrl });
      }
    } catch (err) {
      console.error(`  ✗ ${t.variant} de "${t.title}" (${t.oldUrl}): ${err.message}`);
    }
  }

  console.log(`\n--- Totales: ${kb(totalBefore)} → ${kb(totalAfter)}  (-${((1 - totalAfter / totalBefore) * 100).toFixed(0)}%) sobre ${targets.length} imágenes ---`);

  if (!APPLY) {
    console.log("\nDRY-RUN: no se subió nada ni se tocó la base.");
    console.log("Para aplicar de verdad:  node scripts/optimize-existing-slides.mjs --apply\n");
    return;
  }

  // Backup de URLs viejas antes de pisar la base.
  const backupPath = `scripts/slides-backup-${Date.now()}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nBackup de URLs viejas: ${backupPath}`);

  for (const u of updates) {
    await db.execute({
      sql: `UPDATE hero_slides SET ${u.field} = ? WHERE id = ?`,
      args: [u.newUrl, u.id],
    });
    console.log(`  ✓ ${u.id} · ${u.field} → ${u.newUrl}`);
  }
  console.log(`\n✓ Aplicado. ${updates.length} URLs actualizadas.\n`);
}

run().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
