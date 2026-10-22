/** Run with `node scripts/tests/notifications.mjs`. Uses SQLite memory + mocked fetch only. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getTableConfig } from "drizzle-orm/sqlite-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const output = resolve(root, ".cache/test-notifications/backend.mjs");
await mkdir(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/server/web-push.ts'; export {onGet,onPost} from './src/routes/api/notifications/index.ts'; export * from './src/db/schema.ts';`,
    resolveDir: root,
    loader: "ts",
  },
  tsconfig: resolve(root, "tsconfig.json"),
  bundle: true,
  packages: "external",
  platform: "node",
  format: "esm",
  outfile: output,
  logLevel: "silent",
});
const backend = await import(pathToFileURL(output).href);
const local = createClient({ url: "file::memory:" });
const db = drizzle(local, { schema: backend });
const originalFetch = globalThis.fetch;
let remoteStatus = 201;
const sent = [];
globalThis.fetch = async (input, init) => {
  assert.equal(typeof input, "string");
  assert.equal(backend.validPushEndpoint(input), true);
  sent.push({ input, init });
  return new Response("", { status: remoteStatus });
};

const tests = [];
const test = async (name, run) => {
  try { await run(); tests.push({ name, ok: true }); }
  catch (error) { tests.push({ name, ok: false, error }); }
};
const publicKeys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const privateJwk = await crypto.subtle.exportKey("jwk", publicKeys.privateKey);
const privateKey = Buffer.from(JSON.stringify(privateJwk)).toString("base64url");
const publicKey = Buffer.from(await crypto.subtle.exportKey("raw", publicKeys.publicKey)).toString("base64url");
const credentials = { PRIVATE_VAPID_KEY: privateKey, PUBLIC_VAPID_KEY: publicKey };
const endpoint = "https://fcm.googleapis.com/fcm/send/local-fixture";
let nextUser = 0;
const user = () => ({ id: `member-${++nextUser}`, name: "Fixture member", role: "member", numeroSocio: "12345678" });

async function request(method, account, body, options = {}) {
  const headers = new Headers({ Origin: "https://beneficios.lprc.com.ar", "Content-Type": "application/json", ...options.headers });
  let response;
  const event = {
    request: new Request("https://beneficios.lprc.com.ar/api/notifications/", { method, headers, ...(method === "POST" ? { body: options.raw ?? JSON.stringify(body) } : {}) }),
    url: new URL("https://beneficios.lprc.com.ar/api/notifications/"),
    sharedMap: new Map([["__drizzle_db", db], ...(account ? [["user", account]] : [])]),
    env: { get: key => (options.credentials ?? credentials)[key] },
    headers: new Headers(),
    json: (status, data) => { response = { status, data }; },
  };
  await (method === "GET" ? backend.onGet : backend.onPost)(event);
  assert.equal(event.headers.get("Cache-Control"), "private, no-store");
  return response;
}
const post = (account, action, target = endpoint, options) => request("POST", account, { action, endpoint: target }, options);

try {
  const { columns } = getTableConfig(backend.pushSubscriptions);
  await local.execute(`create table push_subscriptions (${columns.map(column => `"${column.name}" ${column.getSQLType()}${column.primary ? " primary key" : ""}${column.notNull ? " not null" : ""}`).join(",")}, unique(endpoint))`);

  await test("VAPID ES256 signature, raw public key, audience, subject and one-hour expiry", async () => {
    for (const target of [endpoint, "https://updates.push.services.mozilla.com/wpush/v2/fixture", "https://web.push.apple.com/Qfixture", "https://wns2-test.notify.windows.com/w/?token=fixture"]) {
      const authorization = await backend.createVapidAuthorization(target, privateKey, publicKey);
      const match = authorization.match(/^vapid t=([A-Za-z0-9_.-]+), k=([A-Za-z0-9_-]+)$/);
      assert.ok(match);
      assert.equal(match[2], publicKey);
      assert.equal(Buffer.from(match[2], "base64url").byteLength, 65);
      const [header, payload, signature] = match[1].split(".");
      assert.deepEqual(JSON.parse(Buffer.from(header, "base64url")), { typ: "JWT", alg: "ES256" });
      const claims = JSON.parse(Buffer.from(payload, "base64url"));
      assert.equal(claims.aud, new URL(target).origin);
      assert.equal(claims.sub, "https://beneficios.lprc.com.ar");
      const remaining = claims.exp - Math.floor(Date.now() / 1000);
      assert.ok(remaining >= 3598 && remaining <= 3600);
      const sigBytes = Buffer.from(signature, "base64url");
      assert.equal(sigBytes.byteLength, 64);
      assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKeys.publicKey, sigBytes, new TextEncoder().encode(`${header}.${payload}`)), true);
      assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKeys.publicKey, sigBytes, new TextEncoder().encode(`${header}.${payload}x`)), false);
    }
  });

  await test("SSRF rejects private IPs, credentials, ports, lookalike domains and non-HTTPS", async () => {
    for (const target of [undefined, null, 123, {}, "https://localhost/push", "https://127.0.0.1/push", "https://2130706433/push", "https://[::1]/push", "https://169.254.169.254/latest/meta-data", "https://10.0.0.1/push", "http://fcm.googleapis.com/push", "file:///etc/passwd", "https://fcm.googleapis.com.evil.example/push", "https://evilnotify.windows.com/push", "https://notify.windows.com.evil.example/push", "https://u:p@fcm.googleapis.com/push", "https://fcm.googleapis.com:8443/push", "https://fcm.googleapis.com/push#fragment", `https://fcm.googleapis.com/${"a".repeat(2048)}`]) {
      assert.equal(backend.validPushEndpoint(target), false, String(target));
    }
    await assert.rejects(backend.createVapidAuthorization("https://127.0.0.1/", privateKey, publicKey));
    for (const target of [endpoint, "https://updates.push.services.mozilla.com/push", "https://web.push.apple.com/push", "https://wns2-test.notify.windows.com/push"]) assert.equal(backend.validPushEndpoint(target), true);
  });

  await test("settings require authentication and expose only public configuration", async () => {
    assert.equal((await request("GET", null)).status, 401);
    assert.equal((await post(null, "subscribe")).status, 401);
    const account = user();
    assert.deepEqual((await request("GET", account, null, { credentials: {} })).data, { available: false, publicKey: null });
    const result = await request("GET", account);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { available: true, publicKey });
    assert.equal(JSON.stringify(result.data).includes(privateKey), false);
  });

  await test("POST rejects cross-origin, wrong types, malformed and oversized JSON", async () => {
    const account = user();
    assert.equal((await post(account, "status", endpoint, { headers: { Origin: "https://evil.example" } })).status, 403);
    assert.equal((await post(account, "status", endpoint, { headers: { "Content-Type": "text/plain" } })).status, 403);
    assert.equal((await post(account, "status", endpoint, { raw: "{" })).status, 400);
    assert.equal((await post(account, "status", endpoint, { raw: JSON.stringify({ pad: "a".repeat(4097) }) })).status, 400);
    assert.equal((await request("POST", account, null)).status, 400);
    assert.equal((await post(account, "unknown")).status, 400);
    assert.equal((await post(account, "subscribe", "https://127.0.0.1/fixture")).status, 400);
  });

  await test("status, unsubscribe and test preserve account ownership", async () => {
    const owner = user(), other = user();
    const target = `${endpoint}-ownership`;
    assert.deepEqual((await post(owner, "status", target)).data, { subscribed: false });
    assert.equal((await post(owner, "subscribe", target)).status, 200);
    assert.equal((await post(owner, "subscribe", target)).status, 200);
    assert.deepEqual((await post(owner, "status", target)).data, { subscribed: true });
    assert.deepEqual((await post(other, "status", target)).data, { subscribed: false });
    assert.equal((await post(other, "unsubscribe", target)).status, 200);
    assert.deepEqual((await post(owner, "status", target)).data, { subscribed: true });
    const previous = sent.length;
    assert.equal((await post(other, "test", target)).status, 404);
    assert.equal(sent.length, previous);
  });

  await test("subscribe cannot transfer an existing endpoint to another account", async () => {
    const owner = user(), other = user();
    const target = `${endpoint}-no-takeover`;
    assert.equal((await post(owner, "subscribe", target)).status, 200);
    const result = await post(other, "subscribe", target);
    assert.equal(result.status, 409);
    assert.deepEqual((await post(owner, "status", target)).data, { subscribed: true });
    assert.deepEqual((await post(other, "status", target)).data, { subscribed: false });
  });

  await test("non-string action is rejected without throwing", async () => {
    assert.equal((await post(user(), { toString: 1 })).status, 400);
  });

  await test("test uses authenticated push with no member payload and rejects redirects", async () => {
    const account = user(), target = `${endpoint}-send`;
    await post(account, "subscribe", target);
    const start = sent.length;
    assert.deepEqual((await post(account, "test", target)).data, { sent: true });
    assert.equal(sent.length, start + 1);
    const delivery = sent.at(-1);
    assert.equal(delivery.input, target);
    assert.equal(delivery.init.method, "POST");
    assert.equal(delivery.init.body, undefined);
    assert.equal(delivery.init.redirect, "error");
    assert.ok(delivery.init.signal instanceof AbortSignal);
    assert.equal(delivery.init.headers.TTL, "60");
    assert.equal(delivery.init.headers.Urgency, "normal");
    assert.match(delivery.init.headers.Authorization, /^vapid t=/);
    remoteStatus = 302;
    assert.equal((await post(account, "test", target)).status, 502);
    remoteStatus = 201;
  });

  await test("404 and 410 expired subscriptions are removed only for their owner", async () => {
    for (const status of [404, 410]) {
      const account = user(), target = `${endpoint}-expire-${status}`;
      await post(account, "subscribe", target);
      remoteStatus = status;
      const result = await post(account, "test", target);
      assert.equal(result.status, 410);
      assert.equal(result.data.expired, true);
      assert.deepEqual((await post(account, "status", target)).data, { subscribed: false });
    }
    remoteStatus = 201;
  });

  await test("per-account test limit allows three sends and rejects the fourth", async () => {
    const account = user(), target = `${endpoint}-rate-test`;
    await post(account, "subscribe", target);
    const start = sent.length;
    for (let i = 0; i < 3; i++) assert.equal((await post(account, "test", target)).status, 200);
    assert.equal((await post(account, "test", target)).status, 429);
    assert.equal(sent.length, start + 3);
  });

  await test("per-account settings limit allows forty calls and rejects the forty-first", async () => {
    const account = user();
    for (let i = 0; i < 40; i++) assert.equal((await post(account, "status")).status, 200);
    assert.equal((await post(account, "status")).status, 429);
  });

  for (const result of tests) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
    if (!result.ok) console.error(result.error.message);
  }
  const failures = tests.filter(result => !result.ok);
  console.log(`${tests.length - failures.length}/${tests.length} checks passed; SQLite in memory; all outbound fetches mocked.`);
  if (failures.length) process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  local.close();
  await rm(dirname(output), { recursive: true, force: true });
}
