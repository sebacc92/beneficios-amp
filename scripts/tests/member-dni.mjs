/** Run with `node scripts/tests/member-dni.mjs`. SQLite in memory; no network. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { normalizedDniIndexSql } from "../../src/db/dni-expression.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const output = resolve(root, ".cache/test-member-dni/backend.mjs");
await mkdir(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/server/member-dni.ts'; export * from './src/utils/dni.ts'; export * from './src/db/schema.ts';`,
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
const queries = [];
const db = drizzle(local, {
  schema: backend,
  logger: { logQuery: (sql, args) => queries.push({ sql, args }) },
});
const event = { sharedMap: new Map([["__drizzle_db", db]]) };
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("Network requests are forbidden in this test.");
};
let checked = 0;
const test = async (name, run) => {
  await run();
  checked++;
  console.log(`PASS ${name}`);
};
const addMember = async (id, dni) => db.insert(backend.users).values({
  id,
  name: "Fixture member",
  email: `${id}@example.test`,
  passwordHash: "fixture",
  numeroSocio: dni,
  role: "member",
  createdAt: "2026-10-01T00:00:00.000Z",
});

try {
  const { columns, indexes } = getTableConfig(backend.users);
  await local.execute(`create table users (${columns.map((column) =>
    `"${column.name}" ${column.getSQLType()}${column.primary ? " primary key" : ""}${column.notNull ? " not null" : ""}${column.isUnique ? " unique" : ""}`,
  ).join(",")})`);
  await test("lookup works before migration and the index can be applied repeatedly", async () => {
    await addMember("legacy", "12.345.678");
    assert.equal((await backend.findUsersByDni(event, "12345678")).length, 1);
    await local.execute(normalizedDniIndexSql);
    await local.execute(normalizedDniIndexSql);
  });
  await local.execute(normalizedDniIndexSql);
  assert.ok(indexes.some((item) => item.config.name === "idx_users_dni_normalized"));

  await test("formatted DNI and historical identifiers resolve to the same account", async () => {
    for (const input of ["12345678", "12.345.678", " 12 345 678 "]) {
      const matches = await backend.findUsersByDni(event, input);
      assert.deepEqual(matches.map((user) => user.id), ["legacy"]);
    }
    assert.equal(backend.normalizeDni(" 12.345 678 "), "12345678");
  });

  await test("SQL and input normalization agree for every accepted whitespace character", async () => {
    const whitespace = Array.from({ length: 65536 }, (_, code) => String.fromCharCode(code))
      .filter((value) => /\s/.test(value));
    for (const separator of whitespace) {
      await local.execute({
        sql: "update users set numero_socio = ? where id = 'legacy'",
        args: [`12${separator}345.678`],
      });
      assert.equal(backend.normalizeDni(`12${separator}345.678`), "12345678");
      assert.deepEqual((await backend.findUsersByDni(event, "12345678")).map((user) => user.id), ["legacy"]);
    }
  });

  await test("invalid DNI never queries the database and an unknown DNI has no match", async () => {
    const before = queries.length;
    for (const input of ["", "1234", "1234567890", "12A345678", "12-345-678"]) {
      assert.equal(backend.isValidDni(input), false);
      assert.deepEqual(await backend.findUsersByDni(event, input), []);
    }
    assert.equal(queries.length, before);
    assert.deepEqual(await backend.findUsersByDni(event, "99999999"), []);
  });

  await test("canonical plus historical duplicates are ambiguous, even with an exact canonical match", async () => {
    await addMember("canonical", "12345678");
    const matches = await backend.findUsersByDni(event, "12345678");
    assert.equal(matches.length, 2);
    assert.deepEqual(new Set(matches.map((user) => user.id)), new Set(["legacy", "canonical"]));
  });

  await test("multiple historical variants remain detectable and results are bounded", async () => {
    for (const [id, dni] of [["legacy-a", "23.456.789"], ["legacy-b", "23 456 789"], ["legacy-c", "23.456 789"]])
      await addMember(id, dni);
    assert.equal((await backend.findUsersByDni(event, "23456789")).length, 2);
  });

  await test("the actual lookup uses the normalized expression index in one query", async () => {
    const before = queries.length;
    await backend.findUsersByDni(event, "12345678");
    assert.equal(queries.length - before, 1);
    const lookup = queries.at(-1);
    const plan = await local.execute({ sql: `explain query plan ${lookup.sql}`, args: lookup.args });
    assert.ok(plan.rows.some((row) => String(row.detail).includes("idx_users_dni_normalized")));
    assert.ok(plan.rows.every((row) => !String(row.detail).includes("SCAN users")));
  });

  console.log(`${checked}/${checked} checks passed; SQLite in memory; network forbidden.`);
} finally {
  globalThis.fetch = originalFetch;
  local.close();
  await rm(dirname(output), { recursive: true, force: true });
}
