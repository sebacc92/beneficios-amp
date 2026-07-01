import type { RequestEventBase, RequestEventCommon } from "@builder.io/qwik-city";
import { eq, sql, desc } from "drizzle-orm";
import { getDB } from "~/db";
import { pushSubscriptions, pushMessages } from "~/db/schema";

type Ev = RequestEventBase | RequestEventCommon;

// ── Helpers base64url ──
function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlFromString(s: string): string {
  return b64urlFromBytes(new TextEncoder().encode(s));
}

// ── Creación de tablas en runtime (patrón del proyecto) ──
export async function ensurePushTables(db: any) {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS push_messages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

export function getVapidPublicKey(event: Ev): string {
  return event.env.get("VAPID_PUBLIC_KEY")?.trim() || "";
}

// ── Guardar / borrar suscripción ──
export async function savePushSubscription(event: Ev, subscriptionJson: string, userId: string | null) {
  const db = getDB(event);
  await ensurePushTables(db);
  const sub = JSON.parse(subscriptionJson);
  const endpoint = sub.endpoint as string;
  const p256dh = sub.keys?.p256dh as string;
  const auth = sub.keys?.auth as string;
  if (!endpoint || !p256dh || !auth) throw new Error("Suscripción inválida");

  // Upsert por endpoint.
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  await db.insert(pushSubscriptions).values({
    id: crypto.randomUUID(),
    userId,
    endpoint,
    p256dh,
    auth,
    createdAt: new Date().toISOString(),
  });
}

export async function removePushSubscription(event: Ev, endpoint: string) {
  const db = getDB(event);
  await ensurePushTables(db);
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function getLatestPushMessage(event: Ev) {
  const db = getDB(event);
  await ensurePushTables(db);
  const [m] = await db.select().from(pushMessages).orderBy(desc(pushMessages.createdAt)).limit(1);
  return m || null;
}

// ── Firma VAPID (JWT ES256 con Web Crypto) ──
async function importVapidKey(event: Ev): Promise<CryptoKey> {
  const jwkRaw = event.env.get("PRIVATE_VAPID_JWK");
  if (!jwkRaw) throw new Error("PRIVATE_VAPID_JWK no está configurada");
  const jwk = JSON.parse(jwkRaw);
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function createVapidJWT(audience: string, subject: string, key: CryptoKey): Promise<string> {
  const header = b64urlFromString(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = b64urlFromString(
    JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })
  );
  const signingInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${b64urlFromBytes(new Uint8Array(sig))}`;
}

/**
 * Envía una notificación (sin payload) a TODAS las suscripciones.
 * El Service Worker, al recibir el push, busca el contenido en /api/push/latest.
 */
export async function sendPushToAll(
  event: Ev,
  msg: { title: string; body: string; url: string }
): Promise<{ total: number; sent: number; removed: number }> {
  const db = getDB(event);
  await ensurePushTables(db);

  const publicKey = getVapidPublicKey(event);
  const subject = event.env.get("VAPID_SUBJECT")?.trim() || "mailto:beneficios@amepla.org.ar";
  const privateKey = await importVapidKey(event);

  // Guardar el contenido para que lo lea el SW.
  await db.insert(pushMessages).values({
    id: crypto.randomUUID(),
    title: msg.title,
    body: msg.body,
    url: msg.url,
    createdAt: new Date().toISOString(),
  });

  const subs = await db.select().from(pushSubscriptions);
  let sent = 0;
  let removed = 0;

  for (const s of subs) {
    try {
      const u = new URL(s.endpoint);
      const audience = `${u.protocol}//${u.host}`;
      const jwt = await createVapidJWT(audience, subject, privateKey);
      const res = await fetch(s.endpoint, {
        method: "POST",
        headers: {
          TTL: "86400",
          Authorization: `vapid t=${jwt}, k=${publicKey}`,
          "Content-Length": "0",
        },
      });
      if (res.status === 404 || res.status === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
        removed++;
      } else if (res.ok || res.status === 201) {
        sent++;
      }
    } catch (err) {
      console.error("[webpush] Error enviando a", s.endpoint, err);
    }
  }

  return { total: subs.length, sent, removed };
}
