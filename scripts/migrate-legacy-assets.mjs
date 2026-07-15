import { createClient } from "@libsql/client";
import { put } from "@vercel/blob";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";

dotenv.config({ path: ".env.local" });

const dbUrl = process.env.PRIVATE_TURSO_DATABASE_URL;
const dbAuthToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

if (!dbUrl) {
  console.error("PRIVATE_TURSO_DATABASE_URL no está definida.");
  process.exit(1);
}
if (!blobToken) {
  console.error("BLOB_READ_WRITE_TOKEN no está definida.");
  process.exit(1);
}

const db = createClient({ url: dbUrl, authToken: dbAuthToken });

const LEGACY_FILES_BASE = "https://beneficios.amepla.org.ar/files/";
const LEGACY_IMAGES_BASE = "https://beneficios.amepla.org.ar/images/slider/";

// Map to keep track of uploaded files to avoid double uploading
const uploadedMap = new Map();

async function downloadAndUpload(legacyUrl, filename) {
  if (uploadedMap.has(legacyUrl)) {
    return uploadedMap.get(legacyUrl);
  }

  const encodedUrl = encodeURI(legacyUrl);
  console.log(`Downloading: ${encodedUrl}`);
  
  try {
    const res = await fetch(encodedUrl);
    if (!res.ok) {
      console.warn(`⚠️ Failed to download ${encodedUrl} (Status: ${res.status})`);
      return null;
    }
    
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Clean filename for safety in Blob storage
    const cleanFilename = path.basename(filename).replace(/\s+/g, "_");
    
    console.log(`Uploading ${cleanFilename} to Vercel Blob...`);
    const blob = await put(cleanFilename, buffer, {
      access: "public",
      token: blobToken,
    });
    
    console.log(`✓ Uploaded: ${blob.url}`);
    uploadedMap.set(legacyUrl, blob.url);
    return blob.url;
  } catch (err) {
    console.error(`❌ Error migrating ${legacyUrl}:`, err.message);
    return null;
  }
}

async function migrateDbBenefits() {
  console.log("=== Migrating Database Custom Benefits ===");
  const result = await db.execute("SELECT id, titulo, imagen, imagen_mobile FROM custom_benefits");
  
  for (const row of result.rows) {
    const id = row.id;
    let updated = false;
    let newImagen = row.imagen;
    let newImagenMobile = row.imagen_mobile;
    
    // Check main image
    if (row.imagen && !row.imagen.startsWith("http") && !row.imagen.startsWith("/")) {
      const legacyUrl = `${LEGACY_FILES_BASE}${row.imagen}`;
      const blobUrl = await downloadAndUpload(legacyUrl, row.imagen);
      if (blobUrl) {
        newImagen = blobUrl;
        updated = true;
      }
    } else if (row.imagen && row.imagen.includes("beneficios.amepla.org.ar/files/")) {
      const blobUrl = await downloadAndUpload(row.imagen, path.basename(row.imagen));
      if (blobUrl) {
        newImagen = blobUrl;
        updated = true;
      }
    }
    
    // Check mobile image
    if (row.imagen_mobile && !row.imagen_mobile.startsWith("http") && !row.imagen_mobile.startsWith("/")) {
      const legacyUrl = `${LEGACY_FILES_BASE}${row.imagen_mobile}`;
      const blobUrl = await downloadAndUpload(legacyUrl, row.imagen_mobile);
      if (blobUrl) {
        newImagenMobile = blobUrl;
        updated = true;
      }
    } else if (row.imagen_mobile && row.imagen_mobile.includes("beneficios.amepla.org.ar/files/")) {
      const blobUrl = await downloadAndUpload(row.imagen_mobile, path.basename(row.imagen_mobile));
      if (blobUrl) {
        newImagenMobile = blobUrl;
        updated = true;
      }
    }
    
    if (updated) {
      console.log(`Updating DB benefit ID ${id}: imagen=${newImagen}, imagen_mobile=${newImagenMobile}`);
      await db.execute({
        sql: "UPDATE custom_benefits SET imagen = ?, imagen_mobile = ? WHERE id = ?",
        args: [newImagen, newImagenMobile, id]
      });
    }
  }
}

async function migrateSeedJson() {
  console.log("\n=== Migrating seed.json ===");
  const seedPath = path.join(process.cwd(), "src/server/data/seed.json");
  
  let seedData;
  try {
    const rawData = await fs.readFile(seedPath, "utf-8");
    seedData = JSON.parse(rawData);
  } catch (err) {
    console.error(`Failed to read/parse seed.json at ${seedPath}:`, err.message);
    return;
  }
  
  if (!seedData || !seedData.benefits) {
    console.warn("seed.json does not contain benefits array.");
    return;
  }
  
  let mutatedCount = 0;
  for (const b of seedData.benefits) {
    let updated = false;
    
    // imagen
    if (b.imagen && !b.imagen.startsWith("http") && !b.imagen.startsWith("/")) {
      const legacyUrl = `${LEGACY_FILES_BASE}${b.imagen}`;
      const blobUrl = await downloadAndUpload(legacyUrl, b.imagen);
      if (blobUrl) {
        b.imagen = blobUrl;
        updated = true;
      }
    } else if (b.imagen && b.imagen.includes("beneficios.amepla.org.ar/files/")) {
      const blobUrl = await downloadAndUpload(b.imagen, path.basename(b.imagen));
      if (blobUrl) {
        b.imagen = blobUrl;
        updated = true;
      }
    }
    
    // imagenMobile
    if (b.imagenMobile && !b.imagenMobile.startsWith("http") && !b.imagenMobile.startsWith("/")) {
      const legacyUrl = `${LEGACY_FILES_BASE}${b.imagenMobile}`;
      const blobUrl = await downloadAndUpload(legacyUrl, b.imagenMobile);
      if (blobUrl) {
        b.imagenMobile = blobUrl;
        updated = true;
      }
    } else if (b.imagenMobile && b.imagenMobile.includes("beneficios.amepla.org.ar/files/")) {
      const blobUrl = await downloadAndUpload(b.imagenMobile, path.basename(b.imagenMobile));
      if (blobUrl) {
        b.imagenMobile = blobUrl;
        updated = true;
      }
    }
    
    if (updated) {
      mutatedCount++;
    }
  }
  
  if (mutatedCount > 0) {
    console.log(`Saving updated seed.json back to disk (${mutatedCount} benefits updated)...`);
    await fs.writeFile(seedPath, JSON.stringify(seedData, null, 2), "utf-8");
    console.log("✓ seed.json updated successfully.");
  } else {
    console.log("No benefits in seed.json required updating.");
  }
}

async function migrateSlidersAndRaffles() {
  console.log("\n=== Migrating Sliders and Raffles Images ===");
  const sliderImages = [
    "23-PHOTO-2026-05-05-16-00-15.jpg",
    "24-23-930289de-f986-4060-b33c-2858b5b7ddef.jpg",
    "-DAZZLER SLIDE.jpg",
    "26-0e3e1eaa-1394-4eed-a06e-da739f49e404.jpg",
    "27-PHOTO-2025-11-03-12-09-52.jpg",
    "-Tred Slide.jpg"
  ];
  
  const mapResults = {};
  for (const imgName of sliderImages) {
    const legacyUrl = `${LEGACY_IMAGES_BASE}${imgName}`;
    const blobUrl = await downloadAndUpload(legacyUrl, imgName);
    if (blobUrl) {
      mapResults[imgName] = blobUrl;
    }
  }
  
  console.log("\n--- Slider Images Mapping Results ---");
  console.log(JSON.stringify(mapResults, null, 2));
}

async function run() {
  await migrateDbBenefits();
  await migrateSeedJson();
  await migrateSlidersAndRaffles();
  console.log("\n🎉 Migration completed!");
}

run().catch(console.error);
