/**
 * Migración: columnas del padrón de la AMP en la tabla `users`.
 *
 * Agrega dni / padron_id / origen / last_synced_at, copia el DNI que
 * históricamente se guardaba en `matricula` y crea el índice único de dni.
 *
 * Correr una sola vez (es idempotente) contra la base real:
 *   node scripts/migrate-padron.mjs
 */
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

const columns = ["dni TEXT", "padron_id INTEGER", "origen TEXT", "last_synced_at TEXT"];
for (const col of columns) {
  try {
    await db.execute(`ALTER TABLE users ADD COLUMN ${col}`);
    console.log("✓ columna agregada:", col.split(" ")[0]);
  } catch (e) {
    if (/duplicate column/i.test(e.message)) {
      console.log("• ya existía:", col.split(" ")[0]);
    } else {
      throw e;
    }
  }
}

// Backfill: si la matrícula es numérica y no está repetida, era el DNI.
const backfill = await db.execute(`
  UPDATE users SET dni = matricula
  WHERE dni IS NULL
    AND role != 'admin'
    AND matricula IS NOT NULL
    AND matricula NOT GLOB '*[^0-9]*'
    AND matricula IN (SELECT matricula FROM users GROUP BY matricula HAVING COUNT(*) = 1)
`);
console.log(`✓ backfill dni desde matricula: ${backfill.rowsAffected} fila(s)`);

await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_dni_unique ON users(dni)");
console.log("✓ índice único users_dni_unique");

const rows = await db.execute("SELECT id, name, matricula, dni, role FROM users");
console.table(rows.rows);
console.log("Migración completa.");
