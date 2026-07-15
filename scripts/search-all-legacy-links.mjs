import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

async function run() {
  const tables = ["custom_benefits", "sponsors", "hero_slides", "gallery_images", "merchant_requests"];
  
  for (const table of tables) {
    try {
      console.log(`Checking table: ${table}`);
      const result = await db.execute(`SELECT * FROM ${table} LIMIT 1`);
      if (result.rows.length === 0) continue;
      const columns = Object.keys(result.rows[0]);
      
      const allRows = await db.execute(`SELECT * FROM ${table}`);
      for (const row of allRows.rows) {
        for (const col of columns) {
          const val = row[col];
          if (typeof val === "string") {
            if (val.includes("beneficios.amepla.org.ar") || (col.toLowerCase().includes("imagen") && val && !val.startsWith("http") && !val.startsWith("/"))) {
              console.log(`Match in table ${table}, ID ${row.id || row.slug || "unknown"}, col ${col}: ${val}`);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Could not check table ${table}:`, err.message);
    }
  }
}

run().catch(console.error);
