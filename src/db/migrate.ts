import type { RequestEventBase } from "@builder.io/qwik-city";
import { eq, sql } from "drizzle-orm";
import { getDB } from "./index";
import { users } from "./schema";
import { hashPassword } from "~/utils/crypto";

/**
 * One-shot, idempotent migrations. Runs once per server isolate.
 *
 * SQLite/Turso doesn't support transactional ALTER reliably across runs, so we
 * issue each statement guarded by try/catch and rely on `IF NOT EXISTS` where
 * supported. Each guard is cheap precisely because we only do this ONCE.
 */
const globalState = globalThis as unknown as { __ampMigrationPromise?: Promise<void> };

async function runMigrations(requestEvent: RequestEventBase): Promise<void> {
  const db = getDB(requestEvent);

  const statements: string[] = [
    // siteSettings: campaign columns (added later in development)
    `ALTER TABLE site_settings ADD COLUMN campaign_active INTEGER DEFAULT 1`,
    `ALTER TABLE site_settings ADD COLUMN campaign_title TEXT`,
    `ALTER TABLE site_settings ADD COLUMN campaign_subtitle TEXT`,
    `ALTER TABLE site_settings ADD COLUMN campaign_emoji TEXT`,
    `ALTER TABLE site_settings ADD COLUMN campaign_tag TEXT`,
    `ALTER TABLE site_settings ADD COLUMN campaign_query TEXT`,

    // merchant_requests: previously created via inline SQL in the home route
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
  ];

  for (const stmt of statements) {
    try {
      await db.run(sql.raw(stmt));
    } catch {
      // Idempotent: column/table already exists.
    }
  }

  // Migrate any legacy `premium` role to `member`. The premium concept was
  // dropped; the column is kept but values are normalized.
  try {
    await db.run(sql`UPDATE users SET role = 'member' WHERE role = 'premium'`);
  } catch (err) {
    console.error("[Migrate] Failed to normalize legacy premium role:", err);
  }

  await bootstrapAdmin(requestEvent);
}

/**
 * Creates the first admin account from env vars if no admin exists yet.
 * Required env vars:
 *   PRIVATE_BOOTSTRAP_ADMIN_EMAIL
 *   PRIVATE_BOOTSTRAP_ADMIN_PASSWORD
 * Optional:
 *   PRIVATE_BOOTSTRAP_ADMIN_NAME (defaults to "Administrador")
 */
async function bootstrapAdmin(requestEvent: RequestEventBase): Promise<void> {
  const db = getDB(requestEvent);

  let existingAdmin;
  try {
    [existingAdmin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);
  } catch (err) {
    console.error("[Bootstrap] Could not query admins:", err);
    return;
  }

  if (existingAdmin) return;

  const email = (requestEvent.env.get("PRIVATE_BOOTSTRAP_ADMIN_EMAIL") || "").trim().toLowerCase();
  const password = requestEvent.env.get("PRIVATE_BOOTSTRAP_ADMIN_PASSWORD") || "";
  const name = (requestEvent.env.get("PRIVATE_BOOTSTRAP_ADMIN_NAME") || "Administrador").trim();

  if (!email || !password) {
    console.warn(
      "[Bootstrap] No admin exists. Set PRIVATE_BOOTSTRAP_ADMIN_EMAIL and PRIVATE_BOOTSTRAP_ADMIN_PASSWORD to seed the first admin account."
    );
    return;
  }

  try {
    const passwordHash = await hashPassword(password);
    await db.insert(users).values({
      id: "usr-bootstrap-" + Date.now().toString(),
      email,
      passwordHash,
      name,
      role: "admin",
      createdAt: new Date().toISOString(),
    });
    console.log(`[Bootstrap] Created initial admin account for ${email}.`);
  } catch (err) {
    console.error("[Bootstrap] Failed to create initial admin:", err);
  }
}

/**
 * Ensures migrations have run on this isolate. Safe to call from every
 * request — the underlying promise is cached so the work only happens once.
 */
export function ensureMigrated(requestEvent: RequestEventBase): Promise<void> {
  if (!globalState.__ampMigrationPromise) {
    globalState.__ampMigrationPromise = runMigrations(requestEvent).catch((err) => {
      console.error("[Migrate] Migration runner failed:", err);
      // Clear so the next request can retry rather than caching a failed state.
      globalState.__ampMigrationPromise = undefined;
      throw err;
    });
  }
  return globalState.__ampMigrationPromise;
}
