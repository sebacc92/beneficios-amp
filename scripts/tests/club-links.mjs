/** Run with `node scripts/tests/club-links.mjs`. Pure functions only; no database or network. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const output = resolve(root, ".cache/test-club-links/backend.mjs");
await mkdir(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/utils/club.ts'; export * from './src/utils/popup.ts';`,
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

const tests = [];
const test = (name, run) => {
  try {
    run();
    tests.push({ name, ok: true });
  } catch (error) {
    tests.push({ name, ok: false, error });
  }
};

test("WhatsApp links use the club number and encode the prefilled text", () => {
  const href = backend.whatsappLink("Hola! Quiero ser socio & más");
  const url = new URL(href);
  assert.equal(url.origin + url.pathname, "https://api.whatsapp.com/send");
  assert.equal(url.searchParams.get("phone"), backend.CLUB.whatsappNumber);
  assert.equal(url.searchParams.get("text"), "Hola! Quiero ser socio & más");
  assert.equal(new URL(backend.whatsappLink()).searchParams.has("text"), false);
  assert.equal(new URL(backend.whatsappLink(undefined, "+54 9 221 555-0000")).searchParams.get("phone"), "5492215550000");
});

test("the DNI help message adds only the digits the member typed", () => {
  assert.match(backend.dniHelpMessage("30.123.456"), /Mi DNI es 30123456\.$/);
  assert.equal(backend.dniHelpMessage(""), backend.WHATSAPP_MESSAGES.dniNoFigura);
  assert.equal(backend.dniHelpMessage(null), backend.WHATSAPP_MESSAGES.dniNoFigura);
});

test("the popup respects the switch, its date window and its audience", () => {
  const now = new Date("2026-10-23T15:00:00.000Z");
  const show = (settings, loggedIn = false) => backend.shouldShowPopup({ popupActive: true, ...settings }, { loggedIn, now });
  assert.equal(backend.shouldShowPopup({ popupActive: false }, { loggedIn: true, now }), false);
  assert.equal(show({}), true);
  assert.equal(show({ popupStartsAt: "2026-10-24T03:00:00.000Z" }), false);
  assert.equal(show({ popupEndsAt: "2026-10-23T14:59:59.000Z" }), false);
  assert.equal(show({ popupStartsAt: "2026-10-23T00:00:00.000Z", popupEndsAt: "2026-10-30T00:00:00.000Z" }), true);
  assert.equal(show({ popupStartsAt: "no es fecha" }), true);
  assert.equal(show({ popupAudience: "members" }, false), false);
  assert.equal(show({ popupAudience: "members" }, true), true);
  assert.equal(show({ popupAudience: "guests" }, true), false);
  assert.equal(show({ popupAudience: "guests" }, false), true);
});

for (const result of tests) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
  if (!result.ok) console.error(result.error);
}
const failed = tests.filter((result) => !result.ok).length;
console.log(`${tests.length - failed}/${tests.length} checks passed; no database or network.`);
if (failed) process.exitCode = 1;
