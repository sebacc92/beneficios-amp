import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

async function run() {
  const result = await db.execute("SELECT id, titulo, descripcion, resumen FROM custom_benefits");
  
  console.log("Checking for '+' typos...");
  const plusWordRegex = /\b\w*\+\w*\b/g;
  
  for (const row of result.rows) {
    const desc = row.descripcion || "";
    const res = row.resumen || "";
    
    const descMatches = desc.match(plusWordRegex);
    const resMatches = res.match(plusWordRegex);
    
    if (descMatches || resMatches) {
      console.log(`Benefit ID: ${row.id} (${row.titulo})`);
      if (descMatches) console.log(`  Desc matches:`, descMatches);
      if (resMatches) console.log(`  Resumen matches:`, resMatches);
    }
  }
}

run().catch(console.error);
