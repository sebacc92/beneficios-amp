import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

async function run() {
  const cb = await db.execute("SELECT id, titulo, imagen, imagen_mobile FROM custom_benefits");
  
  console.log("Searching custom_benefits...");
  for (const row of cb.rows) {
    if (
      (row.titulo && row.titulo.toLowerCase().includes("notebook")) ||
      (row.imagen && row.imagen.toLowerCase().includes("notebook"))
    ) {
      console.log("Match in custom_benefits:", row);
    }
  }
}

run().catch(console.error);
