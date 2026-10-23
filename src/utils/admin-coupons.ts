/** Shared by /admin/cupones (component and loader) and src/server/admin-coupons.ts. */
export const ADMIN_COUPONS_PAGE_SIZE = 25;
/** The CSV is meant for spreadsheets; past this the admin should narrow the period. */
export const ADMIN_COUPONS_EXPORT_LIMIT = 10_000;

export type AdminCouponStatus = "all" | "active" | "used" | "expired";
export type AdminCouponPeriod = "7" | "30" | "90" | "todo";

export const ADMIN_COUPON_PERIODS: { value: AdminCouponPeriod; label: string }[] = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "todo", label: "Todo" },
];

export function parseAdminCouponQuery(url: URL) {
  const requested = url.searchParams.get("estado");
  const status: AdminCouponStatus = requested === "active" || requested === "used" || requested === "expired" ? requested : "all";
  const search = (url.searchParams.get("buscar") ?? "").trim().slice(0, 80);
  const requestedPage = Number(url.searchParams.get("pagina"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const requestedPeriod = url.searchParams.get("periodo");
  const period: AdminCouponPeriod = requestedPeriod === "7" || requestedPeriod === "30" || requestedPeriod === "90" ? requestedPeriod : "todo";
  const benefit = (url.searchParams.get("beneficio") ?? "").trim().slice(0, 80);
  return { status, search, page, period, benefit };
}

export type AdminCouponQuery = ReturnType<typeof parseAdminCouponQuery>;
