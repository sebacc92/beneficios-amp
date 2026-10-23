/** Administrative credential and deletion regressions. Shared SQLite memory; no network. */
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
const output = resolve(root, ".cache/test-admin-users/backend.mjs");
await mkdir(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/server/admin-users.ts'; export * from './src/db/schema.ts'; export { sha256Hex, verifyPassword } from './src/utils/crypto.ts';`,
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
const local = createClient({ url: "file::memory:?cache=shared" });
const db = drizzle(local, { schema: backend });
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("Network requests are forbidden in this test."); };
const event = (id, mustChangePassword = false, database = db) => ({
  sharedMap: new Map([
    ["__drizzle_db", database],
    ["user", { id, role: "admin", mustChangePassword }],
  ]),
});
const oldHash = await backend.sha256Hex("Temporary123");
const addAdmin = async (id, mustChangePassword = false) => {
  await db.insert(backend.users).values({
    id, name: id, email: `${id}@example.test`, role: "admin", passwordHash: oldHash,
    mustChangePassword, createdAt: "2026-10-01T00:00:00.000Z",
  });
  await db.insert(backend.sessions).values({ id: `session-${id}`, userId: id, createdAt: "2026-10-01T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z" });
};
let checked = 0;
const test = async (name, run) => {
  await run();
  checked++;
  console.log(`PASS ${name}`);
};

try {
  for (const table of [backend.users, backend.sessions, backend.pushSubscriptions]) {
    const { name, columns } = getTableConfig(table);
    const definitions = columns.map((column) =>
      `"${column.name}" ${column.getSQLType()}${column.primary ? " primary key" : ""}${column.notNull ? " not null" : ""}`,
    );
    if (name !== "users") definitions.push("foreign key (user_id) references users(id)");
    await local.execute(`create table "${name}" (${definitions.join(",")})`);
  }
  await local.execute("pragma foreign_keys=on");

  await test("normal administrators cannot use the temporary-password action", async () => {
    await addAdmin("normal");
    assert.deepEqual(await backend.changeTemporaryAdminPassword(event("normal"), "Replacement123"), { ok: false, reason: "not_temporary" });
    // A stale session flag is insufficient when the stored account is already permanent.
    assert.deepEqual(await backend.changeTemporaryAdminPassword(event("normal", true), "Replacement123"), { ok: false, reason: "not_temporary" });
    assert.equal((await local.execute("select password_hash from users where id = 'normal'")).rows[0].password_hash, oldHash);
    assert.equal((await local.execute("select id from sessions where user_id = 'normal'")).rows.length, 1);
  });

  await test("temporary credentials must change, and successful replacement revokes their sessions", async () => {
    await addAdmin("temporary", true);
    assert.deepEqual(await backend.changeTemporaryAdminPassword(event("temporary", true), "Temporary123"), { ok: false, reason: "same_password" });
    assert.deepEqual(await backend.changeTemporaryAdminPassword(event("temporary", true), "Replacement123"), { ok: true });
    const [row] = (await local.execute("select password_hash, must_change_password from users where id = 'temporary'")).rows;
    assert.equal(row.must_change_password, 0);
    assert.equal((await backend.verifyPassword("Replacement123", row.password_hash)).valid, true);
    assert.equal((await local.execute("select id from sessions where user_id = 'temporary'")).rows.length, 0);
  });

  await test("a flag or password changed after the read prevents a stale forced-password update", async () => {
    for (const [id, change] of [["stale-flag", "must_change_password = 0"], ["stale-hash", "password_hash = 'newer-reset-hash'"]]) {
      await addAdmin(id, true);
      let changed = false;
      const observedClient = new Proxy(local, {
        get(target, property) {
          if (property === "execute") return async (...args) => {
            const result = await target.execute(...args);
            const query = typeof args[0] === "string" ? args[0] : args[0].sql;
            if (!changed && /^select "password_hash"/i.test(query)) {
              changed = true;
              await target.execute({ sql: `update users set ${change} where id = ?`, args: [id] });
            }
            return result;
          };
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      const observedDb = drizzle(observedClient, { schema: backend });
      assert.deepEqual(await backend.changeTemporaryAdminPassword(event(id, true, observedDb), "Replacement123"), { ok: false, reason: "not_temporary" });
      assert.equal(changed, true);
      const [row] = (await local.execute({ sql: "select password_hash, must_change_password from users where id = ?", args: [id] })).rows;
      assert.equal(row.password_hash, id === "stale-hash" ? "newer-reset-hash" : oldHash);
      assert.equal(row.must_change_password, id === "stale-flag" ? 0 : 1);
      assert.equal((await local.execute({ sql: "select id from sessions where user_id = ?", args: [id] })).rows.length, 1);
    }
  });

  await test("two administrators deleting each other concurrently leave one active administrator", async () => {
    await local.execute("delete from sessions");
    await local.execute("delete from users");
    await addAdmin("admin-a");
    await addAdmin("admin-b");
    for (const id of ["admin-a", "admin-b"]) await db.insert(backend.pushSubscriptions).values({
      id: `push-${id}`, userId: id, endpoint: `https://example.test/${id}`, createdAt: "2026-10-01", updatedAt: "2026-10-01",
    });
    const other = createClient({ url: "file::memory:?cache=shared" });
    try {
      const otherDb = drizzle(other, { schema: backend });
      const results = await Promise.allSettled([
        backend.deleteAdministrator(event("admin-a"), "admin-b"),
        backend.deleteAdministrator(event("admin-b", false, otherDb), "admin-a"),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled" && result.value.ok).length, 1);
      const survivors = (await local.execute("select id from users where role = 'admin'")).rows;
      assert.equal(survivors.length, 1);
      const survivor = survivors[0].id;
      const removed = survivor === "admin-a" ? "admin-b" : "admin-a";
      assert.equal((await local.execute("select user_id from sessions")).rows[0].user_id, survivor);
      assert.equal((await local.execute("select user_id from push_subscriptions")).rows[0].user_id, survivor);
      // Retry with the removed actor's already-resolved request: it must not remove the survivor.
      assert.equal((await backend.deleteAdministrator(event(removed), survivor)).ok, false);
      assert.equal((await backend.deleteAdministrator(event(survivor), survivor)).ok, false);
      assert.equal((await local.execute("select id from users where role = 'admin'")).rows.length, 1);
    } finally {
      other.close();
    }
  });

  console.log(`${checked}/${checked} checks passed; shared SQLite in memory; network forbidden.`);
} finally {
  globalThis.fetch = originalFetch;
  local.close();
  await rm(dirname(output), { recursive: true, force: true });
}
