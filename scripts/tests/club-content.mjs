/** Run with `node scripts/tests/club-content.mjs`. SQLite memory; no network. */
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
const output = resolve(root, ".cache/test-club-content/backend.mjs");
await mkdir(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/utils/club-content.ts'; export * from './src/utils/suggestions.ts'; export * from './src/server/club-content.ts'; export * from './src/db/schema.ts';`,
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
globalThis.fetch = async () => {
  throw new Error("Network requests are forbidden in this test.");
};
const event = () => ({ sharedMap: new Map([["__drizzle_db", db]]) });
const tests = [];
const test = async (name, run) => {
  try {
    await run();
    tests.push({ name, ok: true });
  } catch (error) {
    tests.push({ name, ok: false, error });
  }
};

try {
  for (const name of ["events", "raffles", "merchantRequests", "suggestions"]) {
    const { name: table, columns } = getTableConfig(backend[name]);
    const definitions = columns.map(
      (column) =>
        `"${column.name}" ${column.getSQLType()}${column.primary ? " primary key" : ""}${column.notNull ? " not null" : ""}${column.hasDefault && typeof column.default === "string" ? ` default '${column.default}'` : ""}`,
    );
    await local.execute(`create table "${table}" (${definitions.join(",")})`);
  }

  await test("Buenos Aires day boundaries decide raffles and events, not UTC", async () => {
    // 01:30 UTC on Oct 24 is still Oct 23, 22:30 in Buenos Aires.
    const lateNight = new Date("2026-10-24T01:30:00Z");
    assert.equal(backend.buenosAiresDay(lateNight), "2026-10-23");
    assert.equal(backend.isRaffleActive("2026-10-23", lateNight), true);
    assert.equal(backend.isRaffleActive("2026-10-22", lateNight), false);
    assert.equal(backend.isRaffleActive("2026-10-24", new Date("2026-10-24T03:00:00Z")), true);
    assert.equal(backend.isRaffleActive("2026-10-24", new Date("2026-10-25T02:59:00Z")), true);
    assert.equal(backend.isRaffleActive("2026-10-24", new Date("2026-10-25T03:00:00Z")), false);

    const { upcoming, past } = backend.splitEventsByDay(
      [
        { id: "next-week", date: "2026-10-30T18:00:00.000Z" },
        { id: "this-morning", date: "2026-10-23T12:00:00.000Z" },
        { id: "yesterday", date: "2026-10-22T23:00:00.000Z" },
        { id: "last-month", date: "2026-09-10T15:00:00.000Z" },
        { id: "broken", date: "not a date" },
      ],
      lateNight,
    );
    assert.deepEqual(upcoming.map((item) => item.id), ["this-morning", "next-week"]);
    assert.deepEqual(past.map((item) => item.id), ["yesterday", "last-month"]);
  });

  await test("datetime-local values round-trip as Buenos Aires time", async () => {
    assert.equal(backend.buenosAiresLocalToIso("2026-11-14T15:30"), "2026-11-14T18:30:00.000Z");
    assert.equal(backend.buenosAiresLocalToIso("2026-11-14T22:00"), "2026-11-15T01:00:00.000Z");
    assert.equal(backend.isoToBuenosAiresLocal("2026-11-15T01:00:00.000Z"), "2026-11-14T22:00");
    assert.equal(backend.isoToBuenosAiresLocal("2026-11-14T03:00:00.000Z"), "2026-11-14T00:00");
    for (const invalid of ["", "2026-11-14", "14/11/2026 15:30", "2026-13-40T99:99"])
      assert.equal(backend.buenosAiresLocalToIso(invalid), null);
    const parts = backend.formatEventParts("2026-11-15T01:00:00.000Z");
    assert.equal(parts.day, "14");
    assert.equal(parts.time, "22:00");
    assert.equal(backend.formatCalendarDay("2026-12-03"), "03/12/2026");
  });

  await test("raffles round-trip through the DB and split into current and past", async () => {
    const base = { description: "Premio para socios", prizeDetail: "Voucher", terms: "Bases del sorteo", winners: null, image: null };
    assert.equal(await backend.saveRaffle(event(), { ...base, title: "Invierno", drawDate: "2026-07-15" }), true);
    assert.equal(await backend.saveRaffle(event(), { ...base, title: "Aniversario", drawDate: "2026-12-03" }), true);
    const [winter] = (await backend.listRafflesForAdmin(event())).filter((row) => row.title === "Invierno");
    assert.ok(winter.id && winter.createdAt);
    assert.equal(await backend.saveRaffle(event(), { ...base, title: "Invierno", drawDate: "2026-07-15", winners: "Laura (Socio 3847)" }, winter.id), true);
    assert.equal(await backend.saveRaffle(event(), { ...base, title: "Fantasma", drawDate: "2026-07-15" }, "missing"), false);

    const board = await backend.getRaffleBoard(event(), new Date("2026-10-23T15:00:00Z"));
    assert.deepEqual(board.active.map((row) => row.title), ["Aniversario"]);
    assert.deepEqual(board.past.map((row) => row.title), ["Invierno"]);
    assert.equal(board.past[0].winners, "Laura (Socio 3847)");

    assert.equal(await backend.deleteRaffle(event(), winter.id), true);
    assert.equal(await backend.deleteRaffle(event(), winter.id), false);
    assert.equal((await backend.listRafflesForAdmin(event())).length, 1);
  });

  await test("events round-trip and keep Buenos Aires order in the agenda", async () => {
    const base = { description: "Actividad del club", location: "Sede Gonnet", image: null };
    await backend.saveClubEvent(event(), { ...base, title: "Clínica", date: "2026-10-30T12:00:00.000Z" });
    await backend.saveClubEvent(event(), { ...base, title: "Torneo", date: "2026-06-15T18:30:00.000Z" });
    const agenda = await backend.getAgenda(event(), new Date("2026-10-23T15:00:00Z"));
    assert.deepEqual(agenda.upcoming.map((row) => row.title), ["Clínica"]);
    assert.deepEqual(agenda.past.map((row) => row.title), ["Torneo"]);
    const torneo = agenda.past[0];
    assert.equal((await backend.getClubEvent(event(), torneo.id)).title, "Torneo");
    assert.equal(await backend.deleteClubEvent(event(), torneo.id), true);
  });

  await test("merchant request status updates validate the status and feed the pending count", async () => {
    for (const [id, status] of [["req-1", "pending"], ["req-2", "pending"], ["req-3", "contacted"]])
      await db.insert(backend.merchantRequests).values({
        id,
        businessName: `Comercio ${id}`,
        category: "Gastronomía",
        contactName: "Contacto",
        email: "comercio@example.com",
        phone: "0221 489-5777",
        proposal: "Descuento para socios",
        status,
        createdAt: `2026-10-2${id.at(-1)}T12:00:00.000Z`,
      });
    assert.equal(await backend.countPendingMerchantRequests(event()), 2);
    assert.equal(await backend.setMerchantRequestStatus(event(), "req-1", "contacted"), true);
    assert.equal(await backend.setMerchantRequestStatus(event(), "req-2", "approved"), false);
    assert.equal(await backend.setMerchantRequestStatus(event(), "missing", "discarded"), false);
    assert.equal(await backend.countPendingMerchantRequests(event()), 1);

    const contacted = await backend.getMerchantRequestInbox(event(), "contacted");
    assert.deepEqual(contacted.requests.map((row) => row.id), ["req-3", "req-1"]);
    assert.deepEqual(contacted.counts, { pending: 1, contacted: 2, discarded: 0, all: 3 });
    const all = await backend.getMerchantRequestInbox(event(), "all");
    assert.equal(all.requests.length, 3);
  });

  await test("suggestion form validation trims, requires a known motivo and limits lengths", async () => {
    const valid = backend.validateSuggestion({
      nombre: "  Socia Prueba ",
      email: "socia@example.com",
      telefono: "",
      tipo: "Problema Comercio",
      comercio: " Café Central ",
      mensaje: "No me aplicaron el descuento en caja.",
    });
    assert.deepEqual(valid.errors, {});
    assert.equal(valid.values.nombre, "Socia Prueba");
    assert.equal(valid.values.comercio, "Café Central");
    const invalid = backend.validateSuggestion({
      nombre: "A",
      email: "no-es-mail",
      telefono: "abc",
      tipo: "Inventado",
      mensaje: "corto",
    });
    assert.deepEqual(Object.keys(invalid.errors).sort(), ["email", "mensaje", "nombre", "telefono", "tipo"]);
    assert.equal(backend.isSuggestionType("Problema Comercio"), true);
    assert.equal(backend.isSuggestionType("Problema"), false);
  });

  await test("suggestions are saved, listed newest first and their status feeds the inbox badge", async () => {
    const base = { nombre: "Socia Prueba", email: "socia@example.com", telefono: "", tipo: "Problema Comercio", comercio: "", mensaje: "Mensaje de prueba largo" };
    await backend.saveSuggestion(event(), { ...base, comercio: "Café Central" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await backend.saveSuggestion(event(), { ...base, tipo: "Consulta General", telefono: "0221 489-5777" });

    const pending = await backend.getSuggestionInbox(event(), "pending");
    assert.equal(pending.suggestions.length, 2);
    assert.equal(pending.suggestions[0].tipo, "Consulta General", "newest first");
    assert.equal(pending.suggestions[0].telefono, "0221 489-5777");
    assert.equal(pending.suggestions[1].comercio, "Café Central");
    assert.equal(pending.suggestions[0].comercio, null, "empty optional fields are stored as null");
    assert.equal(await backend.countPendingSuggestions(event()), 2);

    const merchantsPending = await backend.countPendingMerchantRequests(event());
    assert.equal(await backend.countPendingInbox(event()), merchantsPending + 2);

    const id = pending.suggestions[1].id;
    assert.equal(await backend.setSuggestionStatus(event(), id, "reviewed"), true);
    assert.equal(await backend.setSuggestionStatus(event(), id, "contacted"), false, "merchant statuses do not apply");
    assert.equal(await backend.setSuggestionStatus(event(), "missing", "discarded"), false);
    const reviewed = await backend.getSuggestionInbox(event(), "reviewed");
    assert.deepEqual(reviewed.suggestions.map((row) => row.id), [id]);
    assert.deepEqual(reviewed.counts, { pending: 1, reviewed: 1, discarded: 0, all: 2 });
    assert.equal(await backend.countPendingInbox(event()), merchantsPending + 1);
  });

  for (const result of tests) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
    if (!result.ok) console.error(result.error.message);
  }
  const failures = tests.filter((result) => !result.ok);
  console.log(`${tests.length - failures.length}/${tests.length} checks passed; SQLite in memory; network forbidden.`);
  if (failures.length) process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  local.close();
  await rm(dirname(output), { recursive: true, force: true });
}
