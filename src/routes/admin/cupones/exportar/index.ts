import type { RequestHandler } from "@builder.io/qwik-city";
import { adminCouponsCsv, getAdminCouponExport, parseAdminCouponQuery } from "~/server/admin-coupons";
import { buenosAiresDay } from "~/utils/club-content";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

/** CSV of /admin/cupones with the same filters (period, benefit, status and search). */
export const onGet: RequestHandler = async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/admin/login/");
  }

  const rows = await getAdminCouponExport(event, parseAdminCouponQuery(event.url));
  event.headers.set("Content-Type", "text/csv; charset=utf-8");
  event.headers.set("Content-Disposition", `attachment; filename="cupones-lprc-${buenosAiresDay()}.csv"`);
  // Member names and DNIs: never keep a copy in a shared cache.
  event.headers.set("Cache-Control", "private, no-store");
  event.send(200, adminCouponsCsv(rows));
};
