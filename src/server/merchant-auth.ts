import type { RequestEventBase, RequestEventCommon } from "@builder.io/qwik-city";
import { eq, sql } from "drizzle-orm";
import { getDB } from "~/db";
import { merchants } from "~/db/schema";

export const MERCHANT_COOKIE = "merchant_session";

export interface MerchantSession {
  id: string;
  benefitSlug: string;
  username: string;
}

/** Crea la tabla `merchants` en runtime (patrón de seeding del proyecto). */
export async function ensureMerchantsTable(db: any) {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      benefit_slug TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);
  // Si existe una versión previa de la tabla sin `benefit_slug` (feature aún sin
  // usar, por lo tanto sin datos reales), se recrea con el esquema correcto.
  try {
    await db.run(sql`SELECT benefit_slug FROM merchants LIMIT 1`);
  } catch {
    await db.run(sql`DROP TABLE IF EXISTS merchants`);
    await db.run(sql`
      CREATE TABLE merchants (
        id TEXT PRIMARY KEY,
        benefit_slug TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      )
    `);
  }
}

/** Resuelve el local logueado (atado a un beneficio) desde la cookie, o null. */
export async function getMerchant(
  event: RequestEventBase | RequestEventCommon
): Promise<MerchantSession | null> {
  const token = event.cookie.get(MERCHANT_COOKIE)?.value;
  if (!token) return null;
  try {
    const db = getDB(event);
    await ensureMerchantsTable(db);
    const [m] = await db.select().from(merchants).where(eq(merchants.id, token)).limit(1);
    if (!m || !m.isActive) return null;
    return { id: m.id, benefitSlug: m.benefitSlug, username: m.username };
  } catch (err) {
    console.error("[merchant-auth] Failed to resolve merchant session:", err);
    return null;
  }
}
