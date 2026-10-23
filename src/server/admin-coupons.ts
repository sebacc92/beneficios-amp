import type { RequestEventBase } from "@builder.io/qwik-city";
import { and, asc, count, desc, eq, gte, like, or, sql } from "drizzle-orm";
import { getDB } from "~/db";
import { benefits, coupons } from "~/db/schema";
import { expiredBenefitCondition } from "~/server/coupon-availability";

import { ADMIN_COUPONS_EXPORT_LIMIT, ADMIN_COUPONS_PAGE_SIZE, type AdminCouponQuery } from "~/utils/admin-coupons";

// Query parsing and constants live in ~/utils so the page component can use them
// without pulling this database module into the browser bundle.
export * from "~/utils/admin-coupons";

/** "Vencido" is computed from the benefit the same way the member history does, without rewriting records. */
const effectiveStatus = () =>
  sql<"active" | "used" | "expired">`case when ${coupons.status} = 'active' and ${expiredBenefitCondition()} then 'expired' else ${coupons.status} end`;

/** Period and benefit narrow the metrics too; status and search only narrow the list. */
function couponFilters(query: AdminCouponQuery, now: Date) {
  const since = query.period === "todo" ? null : new Date(now.getTime() - Number(query.period) * 86_400_000).toISOString();
  const scope = and(
    since ? gte(coupons.createdAt, since) : undefined,
    query.benefit ? eq(coupons.benefitId, query.benefit) : undefined,
  );
  const pattern = `%${query.search.toLowerCase().replace(/[%_]/g, "")}%`;
  const searchCondition = query.search
    ? or(
        like(sql`lower(${coupons.code})`, pattern),
        like(sql`lower(${coupons.benefitTitle})`, pattern),
        like(sql`lower(${coupons.userName})`, pattern),
        like(sql`lower(coalesce(${coupons.numeroSocio}, ''))`, pattern),
      )
    : undefined;
  const list = and(scope, query.status === "all" ? undefined : eq(effectiveStatus(), query.status), searchCondition);
  return { since, scope, list };
}

const recordColumns = () => ({
  id: coupons.id,
  code: coupons.code,
  benefitId: coupons.benefitId,
  benefitTitle: coupons.benefitTitle,
  benefitResumen: coupons.benefitResumen,
  benefitSlug: benefits.slug,
  userName: coupons.userName,
  numeroSocio: coupons.numeroSocio,
  status: effectiveStatus(),
  createdAt: coupons.createdAt,
  usedAt: coupons.usedAt,
});

/** One page of the admin coupon list plus metrics for the chosen period (and benefit). */
export async function getAdminCouponPage(event: RequestEventBase, query: AdminCouponQuery, now = new Date()) {
  const db = getDB(event);
  const { since, scope, list } = couponFilters(query, now);
  const status = effectiveStatus();

  const [grouped, [{ matching }], topBenefits, benefitOptions] = await Promise.all([
    db.select({ status, total: count() }).from(coupons)
      .leftJoin(benefits, eq(benefits.id, coupons.benefitId)).where(scope).groupBy(status),
    db.select({ matching: count() }).from(coupons)
      .leftJoin(benefits, eq(benefits.id, coupons.benefitId)).where(list),
    // Generated and redeemed are reported apart: a benefit can be asked for a lot and used little.
    db.select({
      benefitId: coupons.benefitId,
      title: sql<string>`max(${coupons.benefitTitle})`,
      slug: sql<string | null>`max(${benefits.slug})`,
      generated: count(),
      redeemed: sql<number>`coalesce(sum(case when ${coupons.status} = 'used' then 1 else 0 end), 0)`,
    }).from(coupons)
      .leftJoin(benefits, eq(benefits.id, coupons.benefitId))
      .where(since ? gte(coupons.createdAt, since) : undefined)
      .groupBy(coupons.benefitId).orderBy(desc(count()), asc(sql`max(${coupons.benefitTitle})`)).limit(5),
    db.select({ id: coupons.benefitId, title: sql<string>`max(${coupons.benefitTitle})` }).from(coupons)
      .groupBy(coupons.benefitId).orderBy(asc(sql`lower(max(${coupons.benefitTitle}))`)),
  ]);

  const counts = { active: 0, used: 0, expired: 0, all: 0 };
  for (const row of grouped) {
    if (row.status in counts) counts[row.status] += Number(row.total);
    counts.all += Number(row.total);
  }
  const pages = Math.max(1, Math.ceil(matching / ADMIN_COUPONS_PAGE_SIZE));
  const page = Math.min(query.page, pages);
  const records = await db.select(recordColumns()).from(coupons).leftJoin(benefits, eq(benefits.id, coupons.benefitId)).where(list)
    .orderBy(desc(coupons.createdAt), desc(coupons.id))
    .limit(ADMIN_COUPONS_PAGE_SIZE).offset((page - 1) * ADMIN_COUPONS_PAGE_SIZE);

  return {
    records,
    pageSize: ADMIN_COUPONS_PAGE_SIZE,
    total: matching,
    page,
    pages,
    benefitOptions,
    stats: {
      total: counts.all,
      redeemed: counts.used,
      active: counts.active,
      expired: counts.expired,
      rate: counts.all > 0 ? Math.round((counts.used / counts.all) * 100) : 0,
      topBenefits: topBenefits.map((row) => ({
        benefitId: row.benefitId,
        title: row.title,
        slug: row.slug,
        generated: Number(row.generated),
        redeemed: Number(row.redeemed),
      })),
    },
  };
}

/** Every coupon matching the list filters (no paging), newest first. */
export async function getAdminCouponExport(event: RequestEventBase, query: AdminCouponQuery, now = new Date()) {
  const { list } = couponFilters(query, now);
  return getDB(event).select(recordColumns()).from(coupons).leftJoin(benefits, eq(benefits.id, coupons.benefitId)).where(list)
    .orderBy(desc(coupons.createdAt), desc(coupons.id))
    .limit(ADMIN_COUPONS_EXPORT_LIMIT);
}

const STATUS_NAMES = { active: "Activo", used: "Canjeado", expired: "Vencido" } as const;

const csvDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
    : "";

function csvCell(value: string) {
  // A leading = + - @ would run as a formula in Excel or Sheets.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Semicolon-separated with a BOM: Excel set to Spanish (Argentina) opens it in columns and
 * with the accents right; Google Sheets detects it too.
 */
export function adminCouponsCsv(rows: Awaited<ReturnType<typeof getAdminCouponExport>>): string {
  const header = ["Código", "Beneficio", "Descuento", "Socio", "DNI", "Estado", "Generado", "Canjeado"];
  const lines = rows.map((row) =>
    [row.code, row.benefitTitle, row.benefitResumen, row.userName, row.numeroSocio ?? "", STATUS_NAMES[row.status] ?? row.status, csvDate(row.createdAt), csvDate(row.usedAt)]
      .map(csvCell)
      .join(";"),
  );
  return `﻿${[header.join(";"), ...lines].join("\r\n")}\r\n`;
}
