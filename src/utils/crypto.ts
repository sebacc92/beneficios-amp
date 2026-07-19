/**
 * Hash de contraseña con Web Crypto (SHA-256). Compatible con Edge y navegador.
 * Evita dependencias binarias (bcrypt nativo) y NO usa el módulo `crypto` de Node
 * de forma estática: el `import("crypto")` de fallback lleva `@vite-ignore` para
 * que el bundler NO lo empaquete en el cliente (arrastraba un polyfill enorme de
 * crypto-browserify que rompía otros chunks con "u.promisify is not a function").
 */
export async function hashPassword(password: string): Promise<string> {
  // Web Crypto global: disponible en navegador, Vercel Edge y Node 18+.
  const webcrypto: SubtleCrypto | undefined =
    typeof crypto !== "undefined" && crypto.subtle ? crypto.subtle : undefined;

  if (webcrypto) {
    return digestHex(webcrypto, password);
  }

  // Fallback SOLO para runtimes Node donde Web Crypto está anidado. El
  // `@vite-ignore` evita que Vite lo resuelva/empaquete para el navegador
  // (en el navegador esta rama nunca se alcanza porque crypto.subtle existe).
  const nodeCrypto = await import(/* @vite-ignore */ "node:crypto").catch(() => null as any);
  if (nodeCrypto && nodeCrypto.webcrypto) {
    return digestHex(nodeCrypto.webcrypto.subtle, password);
  }

  throw new Error("Web Crypto API is not supported in this environment");
}

async function digestHex(subtle: SubtleCrypto, password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
