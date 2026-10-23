/** Run with `node scripts/tests/club-agenda.mjs`. Pure functions only; no database or network. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const output = resolve(root, ".cache/test-club-agenda/backend.mjs");
await mkdir(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/utils/club-content.ts'; export * from './src/utils/suggestions.ts';`,
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

const clinic = {
  id: "e-1",
  title: "Clínica infantil; rugby, diversión",
  description: "Traé botines\ny agua",
  // 19:30 in Buenos Aires on Nov 1st.
  date: "2026-11-01T22:30:00.000Z",
  location: "Cancha 1 — Sede Gonnet",
};

test("draw countdown counts Buenos Aires days, not UTC ones", () => {
  // 01:30 UTC on Oct 24 is still Oct 23 in Buenos Aires.
  const lateNight = new Date("2026-10-24T01:30:00Z");
  assert.equal(backend.daysUntilCalendarDay("2026-10-23", lateNight), 0);
  assert.equal(backend.daysUntilCalendarDay("2026-10-24", lateNight), 1);
  assert.equal(backend.daysUntilCalendarDay("2026-11-04", lateNight), 12);
  assert.equal(backend.drawCountdownLabel(0), "Se sortea hoy");
  assert.equal(backend.drawCountdownLabel(1), "Se sortea mañana");
  assert.equal(backend.drawCountdownLabel(12), "Se sortea en 12 días");
});

test("event dates print as DD/MM/YYYY in Buenos Aires", () => {
  assert.equal(backend.formatEventDate("2026-11-02T01:00:00.000Z"), "01/11/2026");
  assert.equal(backend.formatEventDate(clinic.date), "01/11/2026");
});

test("Google Calendar link carries a two-hour UTC slot and the event text", () => {
  const url = new URL(backend.googleCalendarUrl(clinic));
  assert.equal(url.origin + url.pathname, "https://calendar.google.com/calendar/render");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("dates"), "20261101T223000Z/20261102T003000Z");
  assert.equal(url.searchParams.get("text"), clinic.title);
  assert.equal(url.searchParams.get("location"), clinic.location);
  assert.equal(backend.googleCalendarUrl({ ...clinic, date: "no es fecha" }), null);
});

test("the .ics escapes text, uses CRLF and folds long lines", () => {
  const ics = backend.eventIcs({ ...clinic, description: `${"Muy larga ".repeat(20)}\nfin ${"ñandú áéíóú ".repeat(12)}` }, new Date("2026-10-23T12:00:00Z"));
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.match(ics, /\r\nDTSTART:20261101T223000Z\r\n/);
  assert.match(ics, /\r\nDTEND:20261102T003000Z\r\n/);
  assert.match(ics, /\r\nDTSTAMP:20261023T120000Z\r\n/);
  assert.match(ics, /SUMMARY:Clínica infantil\\; rugby\\, diversión/);
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, `line too long: ${line}`);
  const unfolded = ics.replace(/\r\n /g, "");
  assert.match(unfolded, /DESCRIPTION:(Muy larga ){20}\\nfin (ñandú áéíóú ){12}\r\n/);
  assert.ok(backend.eventIcsDataUri(clinic).startsWith("data:text/calendar;charset=utf-8,BEGIN%3AVCALENDAR"));
  assert.equal(backend.eventIcs({ ...clinic, date: "" }), null);
});

test("club venues use the club pin; other places become a Maps search", () => {
  const club = "https://www.google.com/maps/search/?api=1&query=La+Plata+Rugby+Club+Gonnet";
  assert.equal(backend.eventMapsUrl("Cancha 1 — Sede Gonnet", club), club);
  assert.equal(backend.eventMapsUrl("Quincho del club", club), club);
  assert.equal(backend.eventMapsUrl("", club), club);
  const away = new URL(backend.eventMapsUrl("Estadio Único", club));
  assert.equal(away.searchParams.get("query"), "Estadio Único, La Plata");
});

test("event kinds have labels; unknown kinds show none", () => {
  assert.equal(backend.eventKindLabel("clinica"), "Clínica");
  assert.equal(backend.eventKindLabel("torneo"), "Torneo");
  assert.equal(backend.eventKindLabel(null), null);
  assert.equal(backend.eventKindLabel("fiesta"), null);
});

test("suggestion reasons keep their stored values and say which ask for a shop", () => {
  assert.deepEqual(
    backend.SUGGESTION_TYPES.map((type) => type.value),
    ["Sugerir Comercio", "Problema Comercio", "Consulta General", "Otro"],
  );
  for (const type of backend.SUGGESTION_TYPES) assert.ok(type.title && type.hint && type.label);
  assert.deepEqual([...backend.SUGGESTION_TYPES_WITH_COMMERCE], ["Sugerir Comercio", "Problema Comercio"]);
  assert.ok(backend.SUGGESTION_TYPES_WITH_COMMERCE.every((value) => backend.isSuggestionType(value)));
});

for (const result of tests) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
  if (!result.ok) console.error(result.error);
}
const failed = tests.filter((result) => !result.ok).length;
console.log(`${tests.length - failed}/${tests.length} checks passed; no database or network.`);
if (failed) process.exitCode = 1;
