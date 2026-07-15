import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

async function run() {
  const result = await db.execute("SELECT id, titulo, imagen, imagen_mobile FROM custom_benefits");
  
  console.log("Searching custom_benefits for 'amepla.org'...");
  let found = 0;
  for (const row of result.rows) {
    const img = row.imagen || "";
    const imgMob = row.imagen_mobile || "";
    if (img.includes("amepla.org") || imgMob.includes("amepla.org")) {
      console.log(`Match in benefit ID ${row.id} (${row.titulo}):`);
      console.log(`  imagen: ${img}`);
      console.log(`  imagen_mobile: ${imgMob}`);
      found++;
    }
  }
  console.log(`Search complete. Found ${found} match(es).`);
}

run().catch(console.error);
