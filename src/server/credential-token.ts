/**
 * Token de credencial CIFRADO (AES-GCM) para el QR de verificación pública.
 *
 * El QR del carnet apunta a /verificar/<token>. El token va cifrado (no solo
 * firmado) con una clave derivada de AUTH_SECRET, de modo que:
 *   - Nadie puede forjarlo ni enumerar beneficiarios (no es adivinable).
 *   - El DNI / la matrícula NUNCA quedan legibles en la URL.
 *
 * Sólo se usa en handlers de servidor (routeLoader$, server$, endpoints).
 */

type EnvGetter = { get: (key: string) => string | undefined };

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface CredentialPayload {
  /** DNI (o identificador) que se revalida contra el padrón al escanear. */
  d: string;
  /** Matrícula provincial (puede no existir en el padrón). */
  m: string | null;
  /** Nombre, para mostrar si el padrón no responde. */
  n: string;
  /** Emitido (ms epoch). */
  iat: number;
}

function getAuthSecret(env: EnvGetter): string {
  const s = env.get("AUTH_SECRET");
  if (s && s.length >= 16) return s;
  if (import.meta.env.DEV) return "dev-only-insecure-secret-change-me-please";
  throw new Error(
    "AUTH_SECRET no está configurada (mínimo 16 caracteres). Definila en las variables de entorno."
  );
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromB64url(s: string): Uint8Array {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(env: EnvGetter): Promise<CryptoKey> {
  // Clave AES-256 derivada del secreto (SHA-256 → 32 bytes).
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(getAuthSecret(env)));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Cifra el payload y devuelve el token opaco (base64url) para la URL del QR. */
export async function makeCredentialToken(
  env: EnvGetter,
  payload: CredentialPayload
): Promise<string> {
  const key = await getKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(payload)))
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64urlFromBytes(out);
}

/** Descifra el token. Devuelve el payload o null si es inválido/manipulado. */
export async function readCredentialToken(
  env: EnvGetter,
  token: string
): Promise<CredentialPayload | null> {
  try {
    const raw = bytesFromB64url(token);
    if (raw.length < 13) return null; // iv(12) + al menos 1 byte
    const iv = raw.slice(0, 12);
    const ct = raw.slice(12);
    const key = await getKey(env);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    const parsed = JSON.parse(dec.decode(pt));
    if (parsed && typeof parsed.d === "string" && typeof parsed.n === "string") {
      return parsed as CredentialPayload;
    }
    return null;
  } catch {
    return null;
  }
}
