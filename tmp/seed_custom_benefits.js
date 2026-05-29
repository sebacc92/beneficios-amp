import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;

if (!url) {
  console.error("Error: PRIVATE_TURSO_DATABASE_URL is not defined in .env.local");
  process.exit(1);
}

const client = createClient({ url, authToken });

async function run() {
  try {
    console.log("Connecting to Turso database...");

    // 1. Fetch active slides to inspect current state
    const slidesRes = await client.execute("SELECT id, title, button_link FROM hero_slides");
    console.log("Current hero slides in DB:");
    console.log(slidesRes.rows);

    // 2. Insert new benefits into custom_benefits
    const nowStr = new Date().toISOString();

    console.log("\nInserting custom benefit: 'Experiencias Exclusivas para Agremiados'...");
    await client.execute({
      sql: `INSERT OR REPLACE INTO custom_benefits (
        id, titulo, resumen, descripcion, imagen, slug, is_featured, is_premium_only, category_id, location_id, offer_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "cb-1779980461157",
        "Experiencias Exclusivas para Agremiados",
        "Más de 20 opciones con tarifas especiales",
        `<p>Disfrutá de más de 20 opciones exclusivas para todos los médicos agremiados en La Plata y City Bell. Presentando tu credencial digital AMP+, accedé a beneficios únicos en paseos, salidas, actividades recreativas y propuestas culturales diseñadas para vos y tu familia.</p>
         <p><b>DIRECCIÓN</b>: Calle 6 Nro. 1118 entre 55 y 56, La Plata.<br/><b>TELÉFONO</b>: +54 (221) 439-1300<br/><b>WHATSAPP</b>: 2214391300</p>`,
        "/uploads/slide-desk-1779980461157.webp",
        "experiencias-exclusivas-para-agremiados",
        1, // isFeatured
        0, // isPremiumOnly
        16, // Category (Eventos)
        25, // Location (La Plata)
        8, // Offer (Promociones)
        nowStr
      ]
    });

    console.log("Inserting custom benefit: 'Descuentos Exclusivos en la Costa Atlántica'...");
    await client.execute({
      sql: `INSERT OR REPLACE INTO custom_benefits (
        id, titulo, resumen, descripcion, imagen, slug, is_featured, is_premium_only, category_id, location_id, offer_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "cb-1779980592129",
        "Descuentos Exclusivos en la Costa Atlántica",
        "Tarifas especiales todo el año",
        `<p>Aprovechá del turismo en la Costa Atlántica todo el año con paradores, balnearios, hoteles y restaurantes adheridos. Obtené tarifas especiales y descuentos exclusivos en Pinamar, Cariló y Valeria del Mar presentando tu credencial digital de la Agremiación Médica Platense.</p>
         <p><b>DIRECCIÓN</b>: Costa Atlántica, Buenos Aires.<br/><b>TELÉFONO</b>: +54 (221) 439-1300<br/><b>WHATSAPP</b>: 2214391300</p>`,
        "/uploads/slide-desk-1779980592129.webp",
        "descuentos-exclusivos-costa-atlantica",
        1, // isFeatured
        0, // isPremiumOnly
        22, // Category (Hoteles)
        26, // Location (Costa Atlántica)
        8, // Offer (Promociones)
        nowStr
      ]
    });

    // 3. Update the three hero slides' links
    console.log("\nUpdating slide button links in hero_slides...");

    // First slide: Opciones para todos
    const upd1 = await client.execute({
      sql: "UPDATE hero_slides SET button_link = ? WHERE title = ? OR id = ?",
      args: ["/", "Opciones para todos", "slide-1779979433205659"]
    });
    console.log(`Updated first slide: ${upd1.rowsAffected} row(s)`);

    // Second slide: Experiencias exclusivas
    const upd2 = await client.execute({
      sql: "UPDATE hero_slides SET button_link = ? WHERE title = ? OR id = ?",
      args: ["/beneficio/experiencias-exclusivas-para-agremiados", "Experiencias exclusivas para todos los agremiados", "slide-1779980461155989"]
    });
    console.log(`Updated second slide: ${upd2.rowsAffected} row(s)`);

    // Third slide: Descuentos exclusivos
    const upd3 = await client.execute({
      sql: "UPDATE hero_slides SET button_link = ? WHERE title = ? OR id = ?",
      args: ["/beneficio/descuentos-exclusivos-costa-atlantica", "Descuentos exclusivos en Pinamar, Cariló y Valeria del Mar", "slide-1779980592128838"]
    });
    console.log(`Updated third slide: ${upd3.rowsAffected} row(s)`);

    console.log("\nSeeding and slide updates completed successfully!");
  } catch (error) {
    console.error("Failed to seed database:", error);
  } finally {
    client.close();
  }
}

run();
