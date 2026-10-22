import type { RequestEventBase } from "@builder.io/qwik-city";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { getDB } from "~/db";
import { benefits, coupons } from "~/db/schema";
import { expiredBenefitCondition } from "~/server/coupon-availability";

export async function getCouponHistory(event: RequestEventBase, userId: string) {
  const requested = event.url.searchParams.get("estado");
  const status = requested === "used" || requested === "expired" || requested === "all" ? requested : "active";
  const requestedPage = Number(event.url.searchParams.get("pagina"));
  const db = getDB(event);
  // Compute effective expiry without rewriting records or running a scheduled job.
  const effectiveStatus = sql<"active" | "used" | "expired">`case when ${coupons.status} = 'active' and ${expiredBenefitCondition()} then 'expired' else ${coupons.status} end`;
  const grouped = await db.select({ status: effectiveStatus, total: count() }).from(coupons)
    .leftJoin(benefits, eq(benefits.id, coupons.benefitId)).where(eq(coupons.userId, userId)).groupBy(effectiveStatus);
  const counts = { active: 0, used: 0, expired: 0, all: 0 };
  for (const row of grouped) { counts[row.status] = Number(row.total); counts.all += Number(row.total); }
  const total = counts[status];
  const pages = Math.max(1, Math.ceil(total / 12));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pages) : 1;
  const records = await db.select({
    id: coupons.id, code: coupons.code, benefitId: coupons.benefitId,
    benefitTitle: coupons.benefitTitle, benefitResumen: coupons.benefitResumen,
    status: effectiveStatus, createdAt: coupons.createdAt, usedAt: coupons.usedAt,
  }).from(coupons).leftJoin(benefits, eq(benefits.id, coupons.benefitId))
    .where(and(eq(coupons.userId, userId), status === "all" ? undefined : eq(effectiveStatus, status)))
    .orderBy(desc(coupons.createdAt), desc(coupons.id)).limit(12).offset((page - 1) * 12);
  return { records, counts, status, total, page, pages };
}
