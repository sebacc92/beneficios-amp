import type { RequestEventBase } from "@builder.io/qwik-city";
import { and, count, desc, eq, like, or, sql } from "drizzle-orm";
import { getDB } from "~/db";
import { benefits, coupons } from "~/db/schema";
import { expiredBenefitCondition } from "~/server/coupon-availability";

export const ADMIN_COUPONS_PAGE_SIZE = 25;

export type AdminCouponStatus = "all" | "active" | "used" | "expired";

export function parseAdminCouponQuery(url: URL) {
  const requested = url.searchParams.get("estado");
  const status: AdminCouponStatus = requested === "active" || requested === "used" || requested === "expired" ? requested : "all";
  const search = (url.searchParams.get("buscar") ?? "").trim().slice(0, 80);
  const requestedPage = Number(url.searchParams.get("pagina"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  return { status, search, page };
}

/**
 * One page of the admin coupon list plus metrics over every coupon. "Vencido" is computed
 * from the benefit the same way the member history does, without rewriting records.
 */
export async function getAdminCouponPage(event: RequestEventBase, query: ReturnType<typeof parseAdminCouponQuery>) {
  const db = getDB(event);
  const effectiveStatus = sql<"active" | "used" | "expired">`case when ${coupons.status} = 'active' and ${expiredBenefitCondition()} then 'expired' else ${coupons.status} end`;
  const pattern = `%${query.search.toLowerCase().replace(/[%_]/g, "")}%`;
  const searchCondition = query.search
    ? or(
        like(sql`lower(${coupons.code})`, pattern),
        like(sql`lower(${coupons.benefitTitle})`, pattern),
        like(sql`lower(${coupons.userName})`, pattern),
        like(sql`lower(coalesce(${coupons.numeroSocio}, ''))`, pattern),
      )
    : undefined;
  const filter = and(query.status === "all" ? undefined : eq(effectiveStatus, query.status), searchCondition);

  const [grouped, [{ matching }], topBenefits] = await Promise.all([
    db.select({ status: effectiveStatus, total: count() }).from(coupons)
      .leftJoin(benefits, eq(benefits.id, coupons.benefitId)).groupBy(effectiveStatus),
    db.select({ matching: count() }).from(coupons)
      .leftJoin(benefits, eq(benefits.id, coupons.benefitId)).where(filter),
    db.select({ title: coupons.benefitTitle, count: count() }).from(coupons)
      .groupBy(coupons.benefitId, coupons.benefitTitle).orderBy(desc(count())).limit(3),
  ]);

  const counts = { active: 0, used: 0, expired: 0, all: 0 };
  for (const row of grouped) {
    if (row.status in counts) counts[row.status] += Number(row.total);
    counts.all += Number(row.total);
  }
  const pages = Math.max(1, Math.ceil(matching / ADMIN_COUPONS_PAGE_SIZE));
  const page = Math.min(query.page, pages);
  const records = await db.select({
    id: coupons.id, code: coupons.code, benefitTitle: coupons.benefitTitle, benefitResumen: coupons.benefitResumen,
    userName: coupons.userName, numeroSocio: coupons.numeroSocio, status: effectiveStatus,
    createdAt: coupons.createdAt, usedAt: coupons.usedAt,
  }).from(coupons).leftJoin(benefits, eq(benefits.id, coupons.benefitId)).where(filter)
    .orderBy(desc(coupons.createdAt), desc(coupons.id))
    .limit(ADMIN_COUPONS_PAGE_SIZE).offset((page - 1) * ADMIN_COUPONS_PAGE_SIZE);

  return {
    records,
    pageSize: ADMIN_COUPONS_PAGE_SIZE,
    total: matching,
    page,
    pages,
    stats: {
      total: counts.all,
      redeemed: counts.used,
      active: counts.active,
      rate: counts.all > 0 ? Math.round((counts.used / counts.all) * 100) : 0,
      topBenefits: topBenefits.map((row) => ({ title: row.title, count: Number(row.count) })),
    },
  };
}
