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
  // Comprobar si la columna ya existe (idempotente)
  const info = await db.execute("PRAGMA table_info(custom_benefits)");
  const hasGaleria = info.rows.some((r) => r.name === "galeria");

  if (hasGaleria) {
    console.log("La columna 'galeria' ya existe. Nada que hacer.");
    return;
  }

  console.log("Agregando columna 'galeria' a custom_benefits...");
  await db.execute("ALTER TABLE custom_benefits ADD COLUMN galeria TEXT");
  console.log("✓ Columna 'galeria' agregada correctamente.");
}

run().catch((err) => {
  console.error("Error en la migración:", err);
  process.exit(1);
});
