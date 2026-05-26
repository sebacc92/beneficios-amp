/**
 * Edge-compatible password hashing helper utilizing the standard Web Crypto API.
 * Eliminates binary dependencies like native bcrypt, ensuring 100% compatibility in Edge environments.
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    // Fallback for environments where Web Crypto is nested
    const nodeCrypto = await import("crypto").catch(() => null);
    if (nodeCrypto && nodeCrypto.webcrypto) {
      const msgBuffer = new TextEncoder().encode(password);
      const hashBuffer = await nodeCrypto.webcrypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    throw new Error("Web Crypto API is not supported in this environment");
  }

  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
