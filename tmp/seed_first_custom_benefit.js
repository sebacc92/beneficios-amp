import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function run() {
  try {
    console.log("Connecting to Turso database...");
    const nowStr = new Date().toISOString();

    console.log("\nInserting custom benefit: 'Opciones para todos'...");
    await client.execute({
      sql: `INSERT OR REPLACE INTO custom_benefits (
        id, titulo, resumen, descripcion, imagen, slug, is_featured, is_premium_only, category_id, location_id, offer_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "cb-1779979433206",
        "Opciones para todos",
        "Descuentos de lunes a viernes en gastronomía, salidas y relax",
        `<p>Disfrutá de una variada selección de beneficios y descuentos exclusivos diseñados para todos los médicos agremiados. Desde salidas gastronómicas hasta momentos de relax y recreación, tenemos opciones pensadas para cada día de la semana.</p>
         <p>Presentá tu credencial digital AMP+ y comenzá a disfrutar de tarifas especiales en los mejores comercios adheridos.</p>
         <p><b>DIRECCIÓN</b>: Calle 6 Nro. 1118 entre 55 y 56, La Plata.<br/><b>TELÉFONO</b>: +54 (221) 439-1300<br/><b>WHATSAPP</b>: 2214391300</p>`,
        "/uploads/slide-desk-1779979433206.webp",
        "opciones-para-todos",
        1, // isFeatured
        0, // isPremiumOnly
        18, // Category (Gastronomía / Cafecitos etc.)
        25, // Location (La Plata)
        8, // Offer (Promociones)
        nowStr
      ]
    });

    console.log("\nUpdating first slide button link to point to '/beneficio/opciones-para-todos'...");
    const upd = await client.execute({
      sql: "UPDATE hero_slides SET button_link = ? WHERE title = ? OR id = ?",
      args: ["/beneficio/opciones-para-todos", "Opciones para todos", "slide-1779979433205659"]
    });
    console.log(`Updated first slide: ${upd.rowsAffected} row(s)`);

    console.log("\nFirst custom benefit seeded and hero slide successfully updated!");
  } catch (error) {
    console.error("Failed to seed database:", error);
  } finally {
    client.close();
  }
}

run();
