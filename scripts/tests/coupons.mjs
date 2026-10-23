/** Run with `node scripts/tests/coupons.mjs`. All database work uses SQLite memory. */
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
const output = resolve(root, ".cache/test-coupons/backend.mjs");
await mkdir(dirname(output), { recursive: true });
await build({
  stdin: {
    contents: `export * from './src/server/coupons.ts'; export * from './src/server/coupon-history.ts'; export * from './src/server/member-dni.ts'; export * from './src/utils/dni.ts'; export * from './src/db/schema.ts';`,
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
// Transactions use separate connections, so share the same in-memory database.
const local = createClient({ url: "file::memory:?cache=shared" });
const queries = [];
const db = drizzle(local, {
  schema: backend,
  logger: {
    logQuery(query) {
      queries.push(query);
    },
  },
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("Network requests are forbidden in this test.");
};
const originalDate = globalThis.Date;
const tests = [];
const test = async (name, run) => {
  try {
    await run();
    tests.push({ name, ok: true });
  } catch (error) {
    tests.push({ name, ok: false, error });
  }
};
let requestId = 0;
const event = (query = "") => ({
  sharedMap: new Map([["__drizzle_db", db]]),
  url: new URL(`https://beneficios.example/perfil/${query}`),
  env: { get: () => undefined },
  request: new Request("https://beneficios.example/", {
    headers: { "x-real-ip": `fixture-${++requestId}` },
  }),
});
const member = {
  id: "generation-owner",
  name: "Fixture member",
  role: "member",
  numeroSocio: "12345678",
  premiumExpiresAt: null,
};
const benefitBase = {
  titulo: "Fixture comercio",
  resumen: "20%",
  descripcion: "Beneficio",
  isFeatured: false,
  isPremiumOnly: false,
  categoryId: 1,
  locationId: 1,
  offerId: 1,
  createdAt: new Date().toISOString(),
};
const couponBase = {
  benefitTitle: "Fixture comercio",
  benefitResumen: "20%",
  userName: "Fixture member",
  numeroSocio: "12345678",
  status: "active",
  createdAt: new Date().toISOString(),
};

try {
  for (const name of ["users", "benefits", "coupons"]) {
    const { columns } = getTableConfig(backend[name]);
    const definitions = columns.map(
      (column) =>
        `"${column.name}" ${column.getSQLType()}${column.primary ? " primary key" : ""}${column.notNull ? " not null" : ""}`,
    );
    if (name === "coupons")
      definitions.push(
        "foreign key (benefit_id) references benefits(id)",
        "unique(code)",
      );
    await local.execute(`create table "${name}" (${definitions.join(",")})`);
  }
  await local.execute("pragma foreign_keys=on");
  for (const [id, slug, validUntil, isPremiumOnly] of [
    ["benefit-uuid", "123-comercio-prueba", null, false],
    ["draft-uuid", "456-borrador", "draft|", false],
    ["expired-uuid", "789-vencido", "2020-01-01", false],
    ["premium-uuid", "321-premium", null, true],
  ])
    await db
      .insert(backend.benefits)
      .values({ ...benefitBase, id, slug, validUntil, isPremiumOnly });

  await test("DNI accepts printed separators and rejects letters, hyphens and invalid lengths", async () => {
    assert.equal(backend.normalizeDni(" 12.345 678 "), "12345678");
    for (const value of ["12.345.678", " 12 345 678 ", "12345", "123456789"])
      assert.equal(backend.isValidDni(value), true);
    for (const value of ["12A345678", "12-345-678", "123", "1234567890", ""])
      assert.equal(backend.isValidDni(value), false);
  });

  await test("generation writes the real UUID FK, creates a local SVG QR and reuses an active coupon", async () => {
    const first = await backend.generateMemberCoupon(event(), member, {
      benefitSlug: "123-comercio-prueba",
    });
    assert.equal(first.benefitId, "benefit-uuid");
    assert.match(first.code, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.match(first.qrDataUrl, /^data:image\/svg\+xml/);
    assert.match(decodeURIComponent(first.qrDataUrl), /<svg/);
    const reused = await backend.generateMemberCoupon(event(), member, {
      benefitSlug: "123-comercio-prueba",
    });
    assert.equal(reused.id, first.id);
    assert.equal(reused.reused, true);
    const other = await backend.generateMemberCoupon(
      event(),
      { ...member, id: "generation-other" },
      { benefitSlug: "123-comercio-prueba" },
    );
    assert.notEqual(other.id, first.id);
  });

  await test("generation rejects public numeric IDs, draft/expired benefits and invalid premium access", async () => {
    for (const [reference, status] of [
      [{ benefitId: "123" }, 404],
      [{ benefitSlug: "456-borrador" }, 404],
      [{ benefitSlug: "789-vencido" }, 404],
      [{ benefitSlug: "321-premium" }, 403],
    ])
      await assert.rejects(
        backend.generateMemberCoupon(event(), member, reference),
        (error) =>
          error instanceof backend.CouponGenerationError &&
          error.status === status,
      );
    await assert.rejects(
      backend.generateMemberCoupon(
        event(),
        { ...member, role: "premium", premiumExpiresAt: "2020-01-01" },
        { benefitSlug: "321-premium" },
      ),
      (error) => error.status === 403,
    );
    const premium = await backend.generateMemberCoupon(
      event(),
      { ...member, role: "premium", premiumExpiresAt: "2099-01-01" },
      { benefitSlug: "321-premium" },
    );
    assert.equal(premium.benefitId, "premium-uuid");
  });

  await test("legacy DNI lookup, coupon generation and redemption accept equivalent printed formats", async () => {
    await db.insert(backend.users).values({
      ...member,
      id: "legacy-member",
      email: "legacy@example.test",
      passwordHash: "fixture",
      numeroSocio: " 23.456 789 ",
      createdAt: new Date().toISOString(),
    });
    const adminEvent = () => {
      const value = event();
      value.sharedMap.set("user", { ...member, role: "admin" });
      return value;
    };
    for (const numeroSocio of ["23456789", "23.456.789", " 23 456 789 "]) {
      const matches = await backend.findUsersByDni(event(), numeroSocio);
      assert.equal(matches.length, 1);
      const coupon = await backend.generateMemberCoupon(event(), matches[0], {
        benefitSlug: "123-comercio-prueba",
      });
      assert.equal(coupon.numeroSocio, " 23.456 789 ");
      for (const invalid of ["", "   ", "23A456789", "23-456-789", "23456780"]) {
        const rejected = await backend.validateCoupon(adminEvent(), {
          code: coupon.code,
          numeroSocio: invalid,
        });
        assert.equal(rejected.ok, false);
        assert.equal(rejected.reason, invalid.trim() ? "dni_mismatch" : undefined);
        assert.equal(rejected.message, invalid.trim()
          ? "El DNI no coincide con el del socio que generó este cupón."
          : "Código y DNI del socio son requeridos.");
      }
      const input = { code: coupon.code, numeroSocio };
      assert.equal((await backend.validateCoupon(adminEvent(), input)).ok, true);
      assert.equal((await backend.validateCoupon(adminEvent(), input)).ok, false);
    }
  });

  for (let i = 0; i < 13; i++)
    await db
      .insert(backend.coupons)
      .values({
        ...couponBase,
        id: `history-active-${String(i).padStart(2, "0")}`,
        code: `HA${String(i).padStart(4, "0")}`,
        benefitId: "benefit-uuid",
        userId: "history-owner",
        createdAt: "2026-10-01T12:00:00.000Z",
      });
  for (const [id, status, benefitId] of [
    ["used", "used", "benefit-uuid"],
    ["expired", "expired", "benefit-uuid"],
    ["draft", "active", "draft-uuid"],
    ["past-benefit", "active", "expired-uuid"],
  ])
    await db
      .insert(backend.coupons)
      .values({
        ...couponBase,
        id: `history-${id}`,
        code: `H-${id}`,
        benefitId,
        userId: "history-owner",
        status,
      });
  await db
    .insert(backend.coupons)
    .values({
      ...couponBase,
      id: "private-other-coupon",
      code: "OTHER1",
      benefitId: "benefit-uuid",
      userId: "history-other",
    });
  await local.execute("pragma foreign_keys=off");
  await db
    .insert(backend.coupons)
    .values({
      ...couponBase,
      id: "orphan",
      code: "ORPHAN",
      benefitId: "missing-benefit",
      userId: "history-owner",
    });
  await local.execute("pragma foreign_keys=on");

  await test("history computes status/counts and includes only its owner", async () => {
    const before = queries.length;
    const active = await backend.getCouponHistory(event(), "history-owner");
    assert.equal(
      queries.length - before,
      2,
      "history must use two queries regardless of page size",
    );
    assert.deepEqual(active.counts, {
      active: 13,
      used: 1,
      expired: 4,
      all: 18,
    });
    assert.equal(active.records.length, 12);
    assert.equal(active.total, 13);
    assert.equal(active.pages, 2);
    assert.equal(active.page, 1);
    assert.ok(active.records.every((row) => row.status === "active"));
    assert.equal(
      active.records.some((row) => row.id === "private-other-coupon"),
      false,
    );
    const other = await backend.getCouponHistory(
      event("?estado=all"),
      "history-other",
    );
    assert.equal(other.records.length, 1);
    assert.equal(other.records[0].id, "private-other-coupon");
    const empty = await backend.getCouponHistory(event(), "nobody");
    assert.equal(empty.total, 0);
    assert.equal(empty.pages, 1);
    assert.equal(empty.page, 1);
    assert.deepEqual(empty.records, []);
  });

  await test("history pages are stable, bounded to twelve and clamp invalid/out-of-range pages", async () => {
    const first = await backend.getCouponHistory(
      event("?pagina=1"),
      "history-owner",
    );
    const second = await backend.getCouponHistory(
      event("?pagina=2"),
      "history-owner",
    );
    assert.equal(second.records.length, 1);
    assert.equal(second.records[0].id, "history-active-00");
    assert.equal(
      new Set([...first.records, ...second.records].map((row) => row.id)).size,
      13,
    );
    assert.deepEqual(
      first.records.map((row) => row.id),
      [...first.records.map((row) => row.id)].sort().reverse(),
    );
    assert.equal(
      (await backend.getCouponHistory(event("?pagina=999"), "history-owner"))
        .page,
      2,
    );
    for (const value of [
      "0",
      "-1",
      "1.5",
      "NaN",
      "Infinity",
      "9007199254740992",
      "",
    ])
      assert.equal(
        (
          await backend.getCouponHistory(
            event(`?pagina=${value}`),
            "history-owner",
          )
        ).page,
        1,
      );
    assert.equal(
      (
        await backend.getCouponHistory(
          event("?estado=invalid"),
          "history-owner",
        )
      ).status,
      "active",
    );
  });

  await test("history tabs filter used/expired/all and retain used coupons when their benefit expires", async () => {
    for (const status of ["used", "expired", "all"]) {
      const history = await backend.getCouponHistory(
        event(`?estado=${status}`),
        "history-owner",
      );
      assert.equal(history.status, status);
      assert.equal(history.total, history.counts[status]);
      if (status !== "all")
        assert.ok(history.records.every((row) => row.status === status));
    }
    await db
      .insert(backend.coupons)
      .values({
        ...couponBase,
        id: "used-expired-benefit",
        code: "USEDPAST",
        benefitId: "expired-uuid",
        userId: "used-owner",
        status: "used",
        usedAt: new Date().toISOString(),
      });
    const history = await backend.getCouponHistory(
      event("?estado=used"),
      "used-owner",
    );
    assert.equal(history.records[0].status, "used");
    assert.equal(history.counts.expired, 0);
  });

  await test("history timestamp expiry handles ISO instants without changing saved state", async () => {
    const now = originalDate.now();
    for (const [id, delta] of [
      ["past", -60_000],
      ["future", 60_000],
    ]) {
      await db
        .insert(backend.benefits)
        .values({
          ...benefitBase,
          id: `timestamp-${id}`,
          slug: `timestamp-${id}`,
          validUntil: new originalDate(now + delta).toISOString(),
        });
      await db
        .insert(backend.coupons)
        .values({
          ...couponBase,
          id: `timestamp-${id}`,
          code: `T-${id}`,
          benefitId: `timestamp-${id}`,
          userId: "timestamp-owner",
        });
    }
    const history = await backend.getCouponHistory(
      event("?estado=all"),
      "timestamp-owner",
    );
    assert.deepEqual(history.counts, {
      active: 1,
      used: 0,
      expired: 1,
      all: 2,
    });
    const byId = new Map(history.records.map((row) => [row.id, row.status]));
    assert.equal(byId.get("timestamp-past"), "expired");
    assert.equal(byId.get("timestamp-future"), "active");
    const saved = await local.execute(
      "select status from coupons where user_id = 'timestamp-owner'",
    );
    assert.ok(saved.rows.every((row) => row.status === "active"));
  });

  await test("history date-only expiry uses Argentina day, including hours before UTC 03:00", async () => {
    const fixed = originalDate.parse("2030-01-02T01:00:00Z"); // Still Jan 1 in Argentina.
    globalThis.Date = class extends originalDate {
      constructor(...args) {
        super(...(args.length ? args : [fixed]));
      }
      static now() {
        return fixed;
      }
    };
    try {
      for (const [id, validUntil] of [
        ["yesterday", "2029-12-31"],
        ["today", "2030-01-01"],
        ["tomorrow", "2030-01-02"],
      ]) {
        await db
          .insert(backend.benefits)
          .values({
            ...benefitBase,
            id: `boundary-${id}`,
            slug: `boundary-${id}`,
            validUntil,
          });
        await db
          .insert(backend.coupons)
          .values({
            ...couponBase,
            id: `boundary-${id}`,
            code: `B-${id}`,
            benefitId: `boundary-${id}`,
            userId: "boundary-owner",
          });
      }
      const history = await backend.getCouponHistory(
        event("?estado=all"),
        "boundary-owner",
      );
      assert.deepEqual(history.counts, {
        active: 2,
        used: 0,
        expired: 1,
        all: 3,
      });
      const byId = new Map(history.records.map((row) => [row.id, row.status]));
      assert.equal(byId.get("boundary-yesterday"), "expired");
      assert.equal(byId.get("boundary-today"), "active");
      assert.equal(byId.get("boundary-tomorrow"), "active");
    } finally {
      globalThis.Date = originalDate;
    }
  });

  await test("redemption atomically rejects expired, draft and missing benefits, and accepts a valid coupon once", async () => {
    const adminEvent = () => {
      const value = event();
      value.sharedMap.set("user", { ...member, role: "admin" });
      return value;
    };
    for (const [id, benefitId] of [
      ["valid", "benefit-uuid"],
      ["draft", "draft-uuid"],
      ["past", "expired-uuid"],
    ]) {
      await db
        .insert(backend.coupons)
        .values({
          ...couponBase,
          id: `redeem-${id}`,
          code: `R${id.toUpperCase()}`,
          benefitId,
          userId: "redeem-owner",
        });
    }
    for (const code of ["RDRAFT", "RPAST", "ORPHAN"]) {
      const result = await backend.validateCoupon(adminEvent(), {
        code,
        numeroSocio: "12345678",
      });
      assert.equal(result.ok, false);
      assert.equal(result.reason, "expired");
    }
    // Printed codes may carry spaces or hyphens; only the characters count.
    const valid = { code: " r-val id ", numeroSocio: "12345678" };
    assert.equal(
      (
        await backend.validateCoupon(adminEvent(), {
          ...valid,
          numeroSocio: "99999999",
        })
      ).ok,
      false,
    );
    const redeemed = await backend.validateCoupon(adminEvent(), valid);
    assert.equal(redeemed.ok, true);
    assert.equal(redeemed.coupon.code, "RVALID");
    assert.equal(redeemed.coupon.benefitResumen, couponBase.benefitResumen);
    assert.equal(redeemed.coupon.maskedDni, "**.***.678");
    const again = await backend.validateCoupon(adminEvent(), valid);
    assert.equal(again.ok, false);
    assert.equal(again.reason, "used");
    const rejected = await local.execute(
      "select status from coupons where id in ('redeem-draft', 'redeem-past', 'orphan')",
    );
    assert.ok(rejected.rows.every((row) => row.status === "active"));
  });

  await test("checking a coupon shows its discount without redeeming and explains every rejection", async () => {
    const adminEvent = () => {
      const value = event();
      value.sharedMap.set("user", { ...member, role: "admin" });
      return value;
    };
    await db.insert(backend.coupons).values({
      ...couponBase,
      id: "check-coupon",
      code: "CHK7X4",
      benefitId: "benefit-uuid",
      userId: "check-owner",
    });
    const status = async () =>
      (await local.execute("select status from coupons where id = 'check-coupon'")).rows[0].status;

    const checked = await backend.checkCoupon(adminEvent(), { code: "chk 7x4", numeroSocio: "12.345.678" });
    assert.equal(checked.ok, true);
    assert.equal(checked.coupon.benefitResumen, "20%");
    assert.equal(checked.coupon.userName, "Fixture member");
    assert.equal(checked.coupon.maskedDni, "**.***.678");
    assert.equal(await status(), "active", "checking must not redeem");

    const reasons = async (code, numeroSocio) =>
      (await backend.checkCoupon(adminEvent(), { code, numeroSocio })).reason;
    assert.equal(await reasons("NOPE99", "12345678"), "not_found");
    assert.equal(await reasons("CHK-7X4", "87654321"), "dni_mismatch");
    assert.equal(await reasons("RDRAFT", "12345678"), "expired");
    assert.equal(await reasons("RVALID", "12345678"), "used");
    // A wrong DNI never reveals that the coupon was already used.
    assert.equal(await reasons("RVALID", "87654321"), "dni_mismatch");

    const anonymous = await backend.checkCoupon(event(), { code: "CHK7X4", numeroSocio: "12345678" });
    assert.equal(anonymous.ok, false);
    assert.equal(await status(), "active");
    assert.equal(backend.normalizeCouponCode(" ab-c d "), "ABCD");
    assert.equal(backend.maskDni("1.234.567"), "*.***.567");
  });

  await test("deleting a benefit with coupons requires confirmation and removes only its coupons", async () => {
    for (const [id, slug] of [
      ["delete-with-coupons", "900-con-cupones"],
      ["delete-without-coupons", "901-sin-cupones"],
    ])
      await db
        .insert(backend.benefits)
        .values({ ...benefitBase, id, slug, validUntil: "draft|" });
    for (const [id, code] of [
      ["delete-coupon-1", "DEL001"],
      ["delete-coupon-2", "DEL002"],
    ])
      await db.insert(backend.coupons).values({
        ...couponBase,
        id,
        code,
        benefitId: "delete-with-coupons",
        userId: "delete-owner",
      });
    const remaining = async (sql) =>
      Number((await local.execute(sql)).rows[0].total);
    const otherCoupons = await remaining(
      "select count(*) as total from coupons where benefit_id <> 'delete-with-coupons'",
    );

    const counts = await backend.getCouponCountsByBenefit(event());
    assert.equal(counts["delete-with-coupons"], 2);
    assert.equal(counts["delete-without-coupons"], undefined);

    const refused = await backend.deleteBenefit(event(), "delete-with-coupons", {
      includeCoupons: false,
      expectedCouponCount: 2,
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.couponCount, 2);
    assert.equal(
      await remaining("select count(*) as total from benefits where id = 'delete-with-coupons'"),
      1,
    );

    const stale = await backend.deleteBenefit(event(), "delete-with-coupons", {
      includeCoupons: true,
      expectedCouponCount: 1,
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.couponCount, 2);
    assert.equal(await remaining("select count(*) as total from coupons where benefit_id = 'delete-with-coupons'"), 2);

    const confirmed = await backend.deleteBenefit(event(), "delete-with-coupons", {
      includeCoupons: true,
      expectedCouponCount: 2,
    });
    assert.deepEqual(confirmed, { ok: true, deletedCoupons: 2 });
    assert.equal(
      await remaining("select count(*) as total from benefits where id = 'delete-with-coupons'"),
      0,
    );
    assert.equal(
      await remaining("select count(*) as total from coupons where benefit_id = 'delete-with-coupons'"),
      0,
    );
    assert.equal(
      await remaining("select count(*) as total from coupons where benefit_id <> 'delete-with-coupons'"),
      otherCoupons,
    );

    const plain = await backend.deleteBenefit(event(), "delete-without-coupons", {
      includeCoupons: false,
      expectedCouponCount: 0,
    });
    assert.deepEqual(plain, { ok: true, deletedCoupons: 0 });
    const missing = await backend.deleteBenefit(event(), "delete-without-coupons", {
      includeCoupons: false,
      expectedCouponCount: 0,
    });
    assert.equal(missing.ok, false);
  });

  await test("a concurrent coupon cannot be inserted between the confirmed count and deletion", async () => {
    await db.insert(backend.benefits).values({ ...benefitBase, id: "delete-race", slug: "902-race" });
    const concurrentClient = createClient({ url: "file::memory:?cache=shared" });
    const concurrentDb = drizzle(concurrentClient, { schema: backend });
    let attempted = false;
    let insertionError;
    const attemptConcurrentInsert = async (statement) => {
      const query = typeof statement === "string" ? statement : statement.sql;
      if (attempted || !/^select count\(\*\).*from "coupons"/i.test(query)) return;
      attempted = true;
      try {
        await concurrentDb.insert(backend.coupons).values({
          ...couponBase, id: "concurrent-coupon", code: "RACE01", benefitId: "delete-race", userId: "race-owner",
        });
      } catch (error) {
        insertionError = error.cause?.code ?? error.code;
      }
    };
    // Intercept the real client's completed count query, with and without a
    // transaction, so the old count-then-batch implementation reproduces the race.
    const observeCount = (client) => new Proxy(client, {
      get(target, property) {
        if (property === "transaction") return async (...args) => observeCount(await target.transaction(...args));
        if (property === "execute") return async (...args) => {
          const result = await target.execute(...args);
          await attemptConcurrentInsert(args[0]);
          return result;
        };
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    try {
      const deletionEvent = event();
      deletionEvent.sharedMap.set("__drizzle_db", drizzle(observeCount(local), { schema: backend }));
      const result = await backend.deleteBenefit(deletionEvent, "delete-race", {
        includeCoupons: false,
        expectedCouponCount: 0,
      });
      assert.equal(attempted, true, "must attempt a separate write after the count and before deletion");
      assert.match(insertionError ?? "", /^SQLITE_(LOCKED|BUSY)/, "the transaction must hold the write lock");
      assert.deepEqual(result, { ok: true, deletedCoupons: 0 });
      assert.equal((await local.execute("select id from coupons where id = 'concurrent-coupon'")).rows.length, 0);
      await assert.rejects(
        backend.generateMemberCoupon(event(), member, { benefitSlug: "902-race" }),
        (error) => error instanceof backend.CouponGenerationError && error.status === 404,
      );
    } finally {
      concurrentClient.close();
    }
  });

  await test("a failed benefit deletion rolls back the coupon deletion", async () => {
    await db.insert(backend.benefits).values({ ...benefitBase, id: "delete-rollback", slug: "903-rollback" });
    await db.insert(backend.coupons).values({
      ...couponBase, id: "rollback-coupon", code: "ROLL01", benefitId: "delete-rollback", userId: "rollback-owner",
    });
    await local.execute(`create trigger prevent_fixture_delete before delete on benefits
      when OLD.id = 'delete-rollback' begin select raise(abort, 'fixture deletion blocked'); end`);
    await assert.rejects(backend.deleteBenefit(event(), "delete-rollback", {
      includeCoupons: true,
      expectedCouponCount: 1,
    }));
    assert.equal((await local.execute("select id from benefits where id = 'delete-rollback'")).rows.length, 1);
    assert.equal((await local.execute("select id from coupons where id = 'rollback-coupon'")).rows.length, 1);
  });

  await test("coupon activity groups by Argentina day and ignores coupons outside the window", async () => {
    for (const [id, createdAt, usedAt] of [
      ["activity-late-night", "2030-01-10T02:30:00.000Z", null],
      ["activity-morning", "2030-01-10T03:30:00.000Z", "2030-01-10T04:00:00.000Z"],
      ["activity-old", "2029-12-11T12:00:00.000Z", "2029-12-11T13:00:00.000Z"],
    ])
      await db.insert(backend.coupons).values({
        ...couponBase,
        id,
        code: id.toUpperCase(),
        benefitId: "benefit-uuid",
        userId: "activity-owner",
        createdAt,
        usedAt,
      });
    const activity = await backend.getCouponActivity(
      event(),
      30,
      new originalDate("2030-01-10T12:00:00.000Z"),
    );
    assert.equal(activity.days.length, 30);
    assert.equal(activity.days[0].day, "2029-12-12");
    assert.deepEqual(activity.days.at(-1), { day: "2030-01-10", generated: 1 });
    assert.deepEqual(activity.days.at(-2), { day: "2030-01-09", generated: 1 });
    assert.equal(activity.generated, 2);
    assert.equal(activity.used, 1);
  });

  for (const result of tests) {
    console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}`);
    if (!result.ok) console.error(result.error.message);
  }
  const failures = tests.filter((result) => !result.ok);
  console.log(
    `${tests.length - failures.length}/${tests.length} checks passed; SQLite in memory; network forbidden.`,
  );
  if (failures.length) process.exitCode = 1;
} finally {
  globalThis.Date = originalDate;
  globalThis.fetch = originalFetch;
  local.close();
  await rm(dirname(output), { recursive: true, force: true });
}
