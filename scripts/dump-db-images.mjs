import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;
if (!url) {
  console.error("PRIVATE_TURSO_DATABASE_URL no está definida.");
  process.exit(1);
}

const db = createClient({ url, authToken });

async function run() {
  console.log("Checking custom_benefits table...");
  const cb = await db.execute("SELECT id, titulo, imagen, imagen_mobile, pdf_url FROM custom_benefits");
  console.log(`Total custom benefits: ${cb.rows.length}`);
  
  const benefitsWithUrls = cb.rows.filter(row => 
    (row.imagen && row.imagen.includes("http")) || 
    (row.imagen_mobile && row.imagen_mobile.includes("http")) ||
    (row.pdf_url && row.pdf_url.includes("http"))
  );
  console.log(`Custom benefits with absolute URLs in DB: ${benefitsWithUrls.length}`);
  if (benefitsWithUrls.length > 0) {
    console.log("Sample custom benefits with URLs:", benefitsWithUrls.slice(0, 5));
  }

  const legacyFilenames = cb.rows.filter(row => 
    row.imagen && !row.imagen.includes("http") && !row.imagen.includes("/")
  );
  console.log(`Custom benefits with legacy filenames (relative): ${legacyFilenames.length}`);
  if (legacyFilenames.length > 0) {
    console.log("Sample legacy relative filenames:", legacyFilenames.slice(0, 5));
  }

  console.log("\nChecking news table...");
  const news = await db.execute("SELECT id, title, image FROM news");
  console.log("News:", news.rows);

  console.log("\nChecking events table...");
  const events = await db.execute("SELECT id, title, image FROM events");
  console.log("Events:", events.rows);

  console.log("\nChecking banners table...");
  const banners = await db.execute("SELECT id, image_url FROM banners");
  console.log("Banners:", banners.rows);

  console.log("\nChecking sponsors table...");
  const sponsors = await db.execute("SELECT id, name, image_url FROM sponsors");
  console.log("Sponsors:", sponsors.rows);

  console.log("\nChecking hero_slides table...");
  const heroSlides = await db.execute("SELECT id, title, image_url, image_mobile FROM hero_slides");
  console.log("Hero slides:", heroSlides.rows);

  console.log("\nChecking gallery_images table...");
  try {
    const gallery = await db.execute("SELECT id, image_url, title FROM gallery_images");
    console.log("Gallery images:", gallery.rows);
  } catch (e) {
    console.log("Gallery images table error or doesn't exist:", e.message);
  }
}

run().catch(console.error);
