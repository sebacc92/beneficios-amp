import { sql } from "drizzle-orm";
import { benefits } from "~/db/schema";

/** Shared by the private history and the atomic redemption query. */
export function expiredBenefitCondition() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return sql`(${benefits.id} is null or ${benefits.validUntil} like 'draft%' or
    (length(${benefits.validUntil}) = 10 and ${benefits.validUntil} < ${today}) or
    (length(${benefits.validUntil}) > 10 and julianday(${benefits.validUntil}) < julianday('now')))`;
}
