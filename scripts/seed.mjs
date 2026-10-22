/**
 * Explicit, insert-only seeding for a fresh database.
 *
 *   pnpm seed          # inserts missing rows only
 *   pnpm seed --force  # also overwrites rows that already exist
 *
 * This replaces the old ensureDbSeeded()/ensureHeroSlidesSeeded() helpers, which
 * ran on every request and DELETED the whole table whenever the row count did not
 * match the seed file. Nothing here ever deletes.
 */
import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const force = process.argv.includes("--force");
const url = process.env.PRIVATE_TURSO_DATABASE_URL?.trim();
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN?.trim();

if (!url) {
  console.error("✗ PRIVATE_TURSO_DATABASE_URL is missing (.env.local)");
  process.exit(1);
}

const db = createClient({ url, authToken });

const DEFAULT_SLIDES = [
  {
    id: "slide-1",
    image_url:
      "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=1200&auto=format&fit=crop&q=80",
    title: "Temporada 2026 LPRC",
    subtitle: "Presentá tu credencial digital y disfrutá de los mejores beneficios en el club.",
    button_text: "Ver Beneficios",
    button_link: "/",
    order_index: 1,
    pre_title: "Exclusivo Socios",
    image_mobile:
      "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&auto=format&fit=crop&q=80",
    is_active: 1,
  },
  {
    id: "slide-2",
    image_url:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=80",
    title: "Tercer Tiempo en M55",
    subtitle: "Ahorrá un 15% en consumaciones en la sede de Gonnet de lunes a domingo.",
    button_text: "Explorar Restaurante",
    button_link: "/beneficio/2340-m55-resto-bar-sede-lprc",
    order_index: 2,
    pre_title: "Gastronomía LPRC",
    image_mobile:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80",
    is_active: 1,
  },
  {
    id: "slide-3",
    image_url:
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&auto=format&fit=crop&q=80",
    title: "Entrená al Máximo",
    subtitle: "Hasta 25% de descuento en gimnasios adheridos presentando tu credencial digital.",
    button_text: "Ver Gimnasios",
    button_link: "/beneficio/2328-tred-gimnasio-gonnet",
    order_index: 3,
    pre_title: "Deportes & Salud",
    image_mobile:
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80",
    is_active: 1,
  },
];

function benefitRowFromSeed(b) {
  return {
    id: String(b.id),
    titulo: b.titulo,
    resumen: b.resumen || "Descuento especial",
    descripcion: b.descripcion || "",
    imagen: b.imagen || null,
    imagen_mobile: null,
    slug: b.url,
    is_featured: b.orden_app != null && b.orden_app > 0 ? 1 : 0,
    is_premium_only: 0,
    category_id: b.categorias?.[0]?.id || 109,
    location_id: b.ubicacion?.[0]?.id || 25,
    offer_id: b.ofertas?.[0]?.id || 1,
    coupon_code: "LPRC" + b.id,
    valid_until: "2026-12-31",
    terms: "Válido presentando credencial digital.",
    pdf_url: null,
    latitud: b.latitud || null,
    longitud: b.longitud || null,
    created_at: b.created_at || new Date().toISOString(),
  };
}

async function existingIds(table) {
  const res = await db.execute(`SELECT id FROM ${table}`);
  return new Set(res.rows.map((row) => row.id));
}

async function upsertRows(table, rows) {
  const present = await existingIds(table);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map(() => "?").join(", ");
    const values = columns.map((c) => row[c]);

    if (!present.has(row.id)) {
      await db.execute({
        sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
        args: values,
      });
      inserted += 1;
    } else if (force) {
      const assignments = columns.filter((c) => c !== "id").map((c) => `${c} = ?`);
      await db.execute({
        sql: `UPDATE ${table} SET ${assignments.join(", ")} WHERE id = ?`,
        args: [...columns.filter((c) => c !== "id").map((c) => row[c]), row.id],
      });
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(
    `✓ ${table}: ${inserted} inserted, ${updated} updated, ${skipped} left untouched` +
      (skipped && !force ? " (use --force to overwrite)" : ""),
  );
}

async function main() {
  console.log(`→ Seeding ${url.replace(/\?.*$/, "")}${force ? " (force)" : ""}`);

  const seed = JSON.parse(await readFile(new URL("../src/server/data/seed.json", import.meta.url), "utf8"));
  await upsertRows("benefits", seed.benefits.map(benefitRowFromSeed));

  const now = new Date().toISOString();
  await upsertRows(
    "hero_slides",
    DEFAULT_SLIDES.map((slide) => ({ ...slide, created_at: now })),
  );

  console.log("✓ Seed complete");
}

main()
  .catch((err) => {
    console.error("✗ Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
