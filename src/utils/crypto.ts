/**
 * Password hashing using PBKDF2-HMAC-SHA256, with a portable fallback for
 * Workers runtimes that cap native PBKDF2 iteration counts.
 *
 * Stored format: `pbkdf2$<iterations>$<saltBase64>$<hashBase64>`
 *
 * Hashes created before this module existed were plain unsalted SHA-256 (64 hex
 * chars). `verifyPassword` still accepts those so nobody gets locked out, but it
 * reports `needsRehash` so the caller can upgrade the stored hash on next login.
 */

// Preserve the existing work factor and stored hashes when switching runtimes.
const PBKDF2_ITERATIONS = 150_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

async function getSubtle(): Promise<SubtleCrypto> {
  if (typeof crypto !== "undefined" && crypto.subtle) return crypto.subtle;
  const nodeCrypto = await import("crypto").catch(() => null);
  if (nodeCrypto?.webcrypto?.subtle)
    return nodeCrypto.webcrypto.subtle as SubtleCrypto;
  throw new Error("Web Crypto API is not supported in this environment");
}

async function getRandomBytes(length: number): Promise<Uint8Array> {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return bytes;
  }
  const nodeCrypto = await import("crypto").catch(() => null);
  if (nodeCrypto?.webcrypto?.getRandomValues) {
    nodeCrypto.webcrypto.getRandomValues(bytes);
    return bytes;
  }
  throw new Error("No secure random source available in this environment");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-independent comparison that does not short-circuit on the first difference. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const subtle = await getSubtle();
  const passwordBytes = new TextEncoder().encode(password);
  const keyMaterial = await subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  try {
    const bits = await subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: new Uint8Array(salt),
        iterations,
        hash: "SHA-256",
      },
      keyMaterial,
      KEY_BITS,
    );
    return toBase64(new Uint8Array(bits));
  } catch (error) {
    // Cloudflare's native PBKDF2 (including node:crypto) caps iterations at 100k.
    // Use the same algorithm and work factor only for this explicit runtime limit.
    if (
      iterations <= 100_000 ||
      !(error instanceof DOMException) ||
      error.name !== "NotSupportedError" ||
      !/^Pbkdf2 failed: iteration counts above \d+ are not supported \(requested \d+\)\.$/.test(
        error.message,
      )
    ) {
      throw error;
    }
    const [{ pbkdf2Async }, { sha256 }] = await Promise.all([
      import("@noble/hashes/pbkdf2.js"),
      import("@noble/hashes/sha2.js"),
    ]);
    return toBase64(
      await pbkdf2Async(sha256, passwordBytes, salt, {
        c: iterations,
        dkLen: KEY_BITS / 8,
      }),
    );
  }
}

/** Legacy scheme: unsalted SHA-256 hex. Only used to verify pre-existing hashes. */
async function legacySha256(password: string): Promise<string> {
  const subtle = await getSubtle();
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password),
  );
  return toHex(new Uint8Array(digest));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await getRandomBytes(SALT_BYTES);
  const hash = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${hash}`;
}

export interface VerifyResult {
  valid: boolean;
  /** True when the stored hash uses an outdated scheme and should be replaced. */
  needsRehash: boolean;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<VerifyResult> {
  if (!stored) return { valid: false, needsRehash: false };

  if (stored.startsWith("pbkdf2$")) {
    const [, iterationsRaw, saltRaw, hashRaw] = stored.split("$");
    const iterations = Number(iterationsRaw);
    if (!iterations || !saltRaw || !hashRaw)
      return { valid: false, needsRehash: false };
    const computed = await deriveKey(password, fromBase64(saltRaw), iterations);
    return {
      valid: timingSafeEqual(computed, hashRaw),
      needsRehash: iterations < PBKDF2_ITERATIONS,
    };
  }

  // Legacy unsalted SHA-256 hex digest.
  if (/^[0-9a-f]{64}$/i.test(stored)) {
    const computed = await legacySha256(password);
    return {
      valid: timingSafeEqual(computed, stored.toLowerCase()),
      needsRehash: true,
    };
  }

  return { valid: false, needsRehash: false };
}

/** Random URL-safe token, used for session identifiers. */
export async function randomToken(bytes = 32): Promise<string> {
  return toHex(await getRandomBytes(bytes));
}

/** SHA-256 of an opaque token, so the database never stores usable session tokens. */
export async function sha256Hex(value: string): Promise<string> {
  const subtle = await getSubtle();
  const digest = await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return toHex(new Uint8Array(digest));
}
