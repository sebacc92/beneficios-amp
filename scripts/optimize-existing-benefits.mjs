/**
 * ONE-SHOT: optimiza las imágenes de BENEFICIOS que siguen en JPG/PNG en Blob.
 *
 * Los beneficios nuevos ya suben como WebP liviano (alta client-side), pero el
 * seed histórico dejó muchas imágenes en JPG/PNG pesadas (ej. 2298-...jpg 104
 * KiB). Este script las pasa a WebP con resize a máx 800w (las tarjetas se ven a
 * ~400px; 800 cubre @2x) en las columnas imagen, imagen_mobile y en el array
 * `galeria` (JSON).
 *
 * SEGURIDAD:
 *   - Por defecto DRY-RUN: descarga, mide y reporta antes/después. No sube ni
 *     toca la base.
 *   - Con `--apply` re-sube a Blob y actualiza custom_benefits, con backup JSON.
 *
 * REQUISITOS: npm i -D sharp · .env.local con PRIVATE_TURSO_* y BLOB_READ_WRITE_TOKEN.
 * USO:
 *   node scripts/optimize-existing-benefits.mjs          # dry-run
 *   node scripts/optimize-existing-benefits.mjs --apply   # aplica
 */
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import { writeFileSync } from "node:fs";

dotenv.config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const MAX_WIDTH = 800;
const WEBP_QUALITY = 80;

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
const isRaster = (u) => /\.(jpe?g|png)(\?|$)/i.test(u);

async function download(u) {
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
async function toWebp(buffer) {
  return await sharp(buffer).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toBuffer();
}

async function run() {
  console.log(`\n=== Beneficios JPG/PNG → WebP (${APPLY ? "APPLY" : "DRY-RUN"}) ===`);
  console.log(`resize máx ${MAX_WIDTH}w · WebP q${WEBP_QUALITY}\n`);

  const { rows } = await db.execute("SELECT id, titulo, imagen, imagen_mobile, galeria FROM custom_benefits");
  console.log(`Beneficios en DB: ${rows.length}`);

  // Aplanar a una lista de "targets": campo simple (imagen/imagen_mobile) o
  // entrada de galeria (index dentro del JSON array).
  const targets = [];
  for (const r of rows) {
    for (const field of ["imagen", "imagen_mobile"]) {
      const v = r[field];
      if (isHttp(v) && isRaster(v)) targets.push({ id: r.id, titulo: r.titulo, kind: "col", field, oldUrl: v });
    }
    if (r.galeria) {
      let arr;
      try { arr = JSON.parse(r.galeria); } catch { arr = null; }
      if (Array.isArray(arr)) {
        arr.forEach((g, i) => {
          if (isHttp(g) && isRaster(g)) targets.push({ id: r.id, titulo: r.titulo, kind: "galeria", index: i, oldUrl: g });
        });
      }
    }
  }
  console.log(`Imágenes JPG/PNG a optimizar: ${targets.length}\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  const backup = [];
  // Para apply, acumulamos nuevos valores por (id): columnas y galeria.
  const newColByRow = new Map(); // id -> { imagen?, imagen_mobile? }
  const galeriaByRow = new Map(); // id -> array (copia mutable)

  for (const r of rows) {
    if (r.galeria) {
      try { galeriaByRow.set(r.id, JSON.parse(r.galeria)); } catch { /* noop */ }
    }
  }

  let done = 0;
  for (const t of targets) {
    try {
      const original = await download(t.oldUrl);
      const webp = await toWebp(original);
      totalBefore += original.length;
      totalAfter += webp.length;
      done++;
      const pct = ((1 - webp.length / original.length) * 100).toFixed(0);
      if (done <= 15 || done % 20 === 0) {
        console.log(`[${String(done).padStart(3)}/${targets.length}] ${t.kind === "galeria" ? "galería" : t.field.padEnd(13)} ${String(t.titulo).slice(0, 22).padEnd(22)} ${kb(original.length).padStart(10)} → ${kb(webp.length).padStart(10)} (-${pct}%)`);
      }

      if (APPLY) {
        const fileName = `benefit-opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`;
        const blob = await put(fileName, webp, { access: "public", token: blobToken });
        backup.push({ id: t.id, kind: t.kind, field: t.field, index: t.index, oldUrl: t.oldUrl });
        if (t.kind === "col") {
          const cur = newColByRow.get(t.id) || {};
          cur[t.field] = blob.url;
          newColByRow.set(t.id, cur);
        } else {
          const arr = galeriaByRow.get(t.id);
          if (arr) arr[t.index] = blob.url;
        }
      }
    } catch (err) {
      console.error(`  ✗ ${t.oldUrl}: ${err.message}`);
    }
  }

  console.log(`\n--- Totales: ${kb(totalBefore)} → ${kb(totalAfter)} (-${((1 - totalAfter / totalBefore) * 100).toFixed(0)}%) sobre ${targets.length} imágenes ---`);

  if (!APPLY) {
    console.log("\nDRY-RUN: no se subió nada ni se tocó la base.");
    console.log("Para aplicar:  node scripts/optimize-existing-benefits.mjs --apply\n");
    return;
  }

  const backupPath = `scripts/benefits-backup-${Date.now()}.json`;
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`\nBackup de URLs viejas: ${backupPath}`);

  // Escribir columnas simples.
  for (const [id, cols] of newColByRow) {
    const sets = Object.keys(cols).map((c) => `${c} = ?`).join(", ");
    await db.execute({ sql: `UPDATE custom_benefits SET ${sets} WHERE id = ?`, args: [...Object.values(cols), id] });
  }
  // Escribir galerías modificadas (solo las que tenían raster).
  const touchedGaleria = new Set(targets.filter((t) => t.kind === "galeria").map((t) => t.id));
  for (const id of touchedGaleria) {
    const arr = galeriaByRow.get(id);
    if (arr) await db.execute({ sql: `UPDATE custom_benefits SET galeria = ? WHERE id = ?`, args: [JSON.stringify(arr), id] });
  }
  console.log(`\n✓ Aplicado. ${newColByRow.size} filas (columnas) + ${touchedGaleria.size} galerías actualizadas.\n`);
}

run().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
