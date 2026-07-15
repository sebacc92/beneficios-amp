import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.PRIVATE_TURSO_DATABASE_URL;
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN;
const db = createClient({ url, authToken });

async function run() {
  const cb = await db.execute("SELECT id, titulo, pdf_url FROM custom_benefits");
  console.log("Checking custom_benefits for relative pdf_url...");
  for (const row of cb.rows) {
    const val = row.pdf_url;
    if (val && !val.startsWith("http") && !val.startsWith("/")) {
      console.log("Relative pdf_url:", row);
    } else if (val && val.includes("beneficios.amepla.org.ar")) {
      console.log("Legacy absolute pdf_url:", row);
    }
  }
}

run().catch(console.error);
