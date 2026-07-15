import { createClient } from "@libsql/client";
import { put } from "@vercel/blob";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: ".env.local" });

const dbUrl = process.env.PRIVATE_TURSO_DATABASE_URL;
const dbAuthToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

const db = createClient({ url: dbUrl, authToken: dbAuthToken });
const LEGACY_FILES_BASE = "https://beneficios.amepla.org.ar/files/";

async function run() {
  const result = await db.execute("SELECT id, titulo, imagen, imagen_mobile FROM custom_benefits");
  
  console.log("Checking DB custom_benefits for remaining relative paths...");
  let count = 0;
  for (const row of result.rows) {
    let updated = false;
    let newImagen = row.imagen;
    let newImagenMobile = row.imagen_mobile;
    
    if (row.imagen && !row.imagen.startsWith("http") && !row.imagen.startsWith("/")) {
      const legacyUrl = `${LEGACY_FILES_BASE}${row.imagen}`;
      console.log(`Resolving missing imagen for ID ${row.id}: ${legacyUrl}`);
      try {
        const res = await fetch(encodeURI(legacyUrl));
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const cleanFilename = path.basename(row.imagen).replace(/\s+/g, "_");
          const blob = await put(cleanFilename, buffer, { access: "public", token: blobToken, addRandomSuffix: true });
          newImagen = blob.url;
          updated = true;
          console.log(`✓ Uploaded main image: ${blob.url}`);
        } else {
          console.warn(`Failed to fetch legacy: ${res.status}`);
        }
      } catch (err) {
        console.error(`Error resolving main image:`, err.message);
      }
    }
    
    if (row.imagen_mobile && !row.imagen_mobile.startsWith("http") && !row.imagen_mobile.startsWith("/")) {
      const legacyUrl = `${LEGACY_FILES_BASE}${row.imagen_mobile}`;
      console.log(`Resolving missing imagen_mobile for ID ${row.id}: ${legacyUrl}`);
      try {
        const res = await fetch(encodeURI(legacyUrl));
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const cleanFilename = path.basename(row.imagen_mobile).replace(/\s+/g, "_");
          const blob = await put(cleanFilename, buffer, { access: "public", token: blobToken, addRandomSuffix: true });
          newImagenMobile = blob.url;
          updated = true;
          console.log(`✓ Uploaded mobile image: ${blob.url}`);
        } else {
          console.warn(`Failed to fetch legacy: ${res.status}`);
        }
      } catch (err) {
        console.error(`Error resolving mobile image:`, err.message);
      }
    }
    
    if (updated) {
      await db.execute({
        sql: "UPDATE custom_benefits SET imagen = ?, imagen_mobile = ? WHERE id = ?",
        args: [newImagen, newImagenMobile, row.id]
      });
      count++;
      console.log(`Updated DB ID ${row.id} successfully.`);
    }
  }
  console.log(`Double check complete. Updated ${count} remaining benefit(s).`);
}

run().catch(console.error);
