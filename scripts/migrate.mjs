/**
 * One-off schema migration for Turso/libSQL.
 *
 * This replaces the ALTER TABLE statements that used to run inside getSettings()
 * on every single request. Run it once per environment before deploying:
 *
 *   pnpm migrate            # uses .env.local
 *
 * Every statement is idempotent: columns are added only when missing and tables
 * use CREATE TABLE IF NOT EXISTS, so re-running is safe.
 */
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const url = process.env.PRIVATE_TURSO_DATABASE_URL?.trim();
const authToken = process.env.PRIVATE_TURSO_AUTH_TOKEN?.trim();

if (!url) {
  console.error("✗ PRIVATE_TURSO_DATABASE_URL is missing (.env.local)");
  process.exit(1);
}

const db = createClient({ url, authToken });

/** Columns added after the original schema shipped, keyed by table. */
const ADDED_COLUMNS = {
  site_settings: [
    ["campaign_active", "INTEGER DEFAULT 1"],
    ["campaign_title", "TEXT DEFAULT 'Cafecitos & Desayunos'"],
    [
      "campaign_subtitle",
      "TEXT DEFAULT 'Disfrutá del mejor aroma a café, desayunos premium y meriendas increíbles con tu credencial digital LPRC.'",
    ],
    ["campaign_emoji", "TEXT DEFAULT '☕'"],
    ["campaign_tag", "TEXT DEFAULT 'SELECCIÓN GOURMET'"],
    [
      "campaign_query",
      "TEXT DEFAULT 'cafe,café,desayuno,factura,gastronomia,gastro'",
    ],
  ],
};

const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS sessions (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id),
     created_at TEXT NOT NULL,
     expires_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     endpoint TEXT NOT NULL UNIQUE,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id)`,
  `CREATE TABLE IF NOT EXISTS merchant_requests (
     id TEXT PRIMARY KEY,
     business_name TEXT NOT NULL,
     category TEXT NOT NULL,
     contact_name TEXT NOT NULL,
     email TEXT NOT NULL,
     phone TEXT NOT NULL,
     proposal TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending',
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS benefit_filter_options (
     id INTEGER PRIMARY KEY,
     type TEXT NOT NULL CHECK(type IN ('categorias', 'ubicaciones', 'ofertas')),
     descripcion TEXT NOT NULL,
     normalized_name TEXT NOT NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_benefit_filter_options_type_name
     ON benefit_filter_options(type, normalized_name)`,
  // Hot paths that were doing full scans.
  `CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code)`,
  `CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON coupons(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_coupons_user_status_date ON coupons(user_id, status, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_numero_socio ON users(numero_socio)`,
];

async function tableExists(name) {
  const res = await db.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [name],
  });
  return res.rows.length > 0;
}

async function existingColumns(table) {
  const res = await db.execute(`PRAGMA table_info(${table})`);
  return new Set(res.rows.map((row) => row.name));
}

async function main() {
  console.log(`→ Migrating ${url.replace(/\?.*$/, "")}`);

  for (const statement of CREATE_TABLES) {
    await db.execute(statement);
  }
  console.log(
    `✓ Tables and indexes ensured (${CREATE_TABLES.length} statements)`,
  );

  for (const [table, columns] of Object.entries(ADDED_COLUMNS)) {
    if (!(await tableExists(table))) {
      console.log(`• Skipping ${table}: table does not exist yet`);
      continue;
    }
    const present = await existingColumns(table);
    let added = 0;
    for (const [column, definition] of columns) {
      if (present.has(column)) continue;
      await db.execute(
        `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
      );
      added += 1;
      console.log(`  + ${table}.${column}`);
    }
    console.log(
      `✓ ${table}: ${added} column(s) added, ${columns.length - added} already present`,
    );
  }

  console.log("✓ Migration complete");
}

main()
  .catch((err) => {
    console.error("✗ Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(() => db.close());
