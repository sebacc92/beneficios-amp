/**
 * Edge-compatible password hashing using PBKDF2 with the Web Crypto API.
 *
 * Stored format: `pbkdf2$<iterations>$<saltHex>$<hashHex>`
 *
 * The legacy format (a bare hex SHA-256 digest) is still accepted by
 * `verifyPassword` so existing admin accounts keep working until they reset
 * their password.
 */

const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;

async function getSubtle(): Promise<SubtleCrypto> {
  if (typeof crypto !== "undefined" && crypto.subtle) return crypto.subtle;
  const nodeCrypto = await import("crypto").catch(() => null);
  if (nodeCrypto?.webcrypto?.subtle) return nodeCrypto.webcrypto.subtle as SubtleCrypto;
  throw new Error("Web Crypto API is not available in this environment");
}

function getRandomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const subtle = await getSubtle();
  const key = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    KEY_LENGTH_BITS
  );
  return bytesToHex(new Uint8Array(bits));
}

async function sha256Hex(input: string): Promise<string> {
  const subtle = await getSubtle();
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(digest));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = getRandomBytes(SALT_BYTES);
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${bytesToHex(salt)}$${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;

  if (stored.startsWith("pbkdf2$")) {
    const [, iterStr, saltHex, hashHex] = stored.split("$");
    const iterations = Number(iterStr);
    if (!iterations || !saltHex || !hashHex) return false;
    const candidate = await pbkdf2(password, hexToBytes(saltHex), iterations);
    return timingSafeEqual(candidate, hashHex);
  }

  // Legacy format: bare hex SHA-256 digest (no salt).
  const candidate = await sha256Hex(password);
  return timingSafeEqual(candidate, stored);
}
