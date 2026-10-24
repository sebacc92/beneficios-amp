import type { RequestEventBase } from "@builder.io/qwik-city";
import type { benefits } from "~/db/schema";
import { getCustomBenefitRows, getCustomBenefits } from "~/server/cache";
import { getCouponCountsByBenefit } from "~/server/coupons";
import { isDraftBenefit } from "~/utils/benefit-status";
import { selectHomeBenefits } from "~/utils/home-benefits";

export type FeaturedPlacement = "home" | "overflow" | "draft" | "expired";
export type AdminBenefitRow = typeof benefits.$inferSelect & {
  couponCount: number;
  featuredPlacement: FeaturedPlacement | null;
};

/** Uses the same catalog and selection as the public home; both reads share request memoization. */
export async function loadAdminBenefits(event: RequestEventBase): Promise<{ rows: AdminBenefitRow[]; loadError: boolean }> {
  try {
    const [rows, couponCounts, catalog] = await Promise.all([
      getCustomBenefitRows(event),
      getCouponCountsByBenefit(event),
      getCustomBenefits(event),
    ]);
    // The public loader falls back to [] on failure. Do not mistake that for an empty selection.
    if (catalog.length !== rows.length) throw new Error("Could not load the public benefit catalog.");
    const homeSlugs = new Set(selectHomeBenefits(catalog).gold.map((benefit) => benefit.url));
    const publicBySlug = new Map(catalog.map((benefit) => [benefit.url, benefit]));
    return {
      loadError: false,
      rows: rows.map((row): AdminBenefitRow => ({
        ...row,
        couponCount: couponCounts[row.id] ?? 0,
        featuredPlacement: !row.isFeatured ? null
          : isDraftBenefit(row.validUntil) ? "draft"
          : publicBySlug.get(row.slug)?.isActive === false ? "expired"
          : homeSlugs.has(row.slug) ? "home"
          : "overflow",
      })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    };
  } catch (error) {
    console.error("Failed to load admin benefits:", error);
    return { rows: [], loadError: true };
  }
}
