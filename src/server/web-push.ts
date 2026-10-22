// VAPID authentication for an empty Web Push message (RFC 8292 / RFC 8030).
// The service worker supplies a generic message, so no member data leaves the app.
export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const allowed = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
    return url.protocol === "https:" && !url.username && !url.password && !url.hash &&
      (!url.port || url.port === "443") &&
      (allowed.includes(url.hostname) || url.hostname.endsWith(".notify.windows.com"));
  } catch {
    return false;
  }
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function createVapidAuthorization(
  endpoint: string,
  encodedPrivateKey: string,
  publicKey: string,
): Promise<string> {
  if (!validPushEndpoint(endpoint)) throw new Error("Invalid push endpoint");
  const privateJwk = JSON.parse(atob(encodedPrivateKey.replaceAll("-", "+").replaceAll("_", "/"))) as JsonWebKey;
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const encode = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));
  const content = `${encode({ typ: "JWT", alg: "ES256" })}.${encode({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: "https://beneficios.lprc.com.ar",
  })}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(content));
  return `vapid t=${content}.${base64Url(new Uint8Array(signature))}, k=${publicKey}`;
}
