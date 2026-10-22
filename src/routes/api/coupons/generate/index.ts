import type { RequestHandler } from "@builder.io/qwik-city";
import { getSessionUser } from "~/server/auth";
import { CouponGenerationError, generateMemberCoupon } from "~/server/coupons";

export const onPost: RequestHandler = async (event) => {
  const user = getSessionUser(event);
  if (!user) {
    event.json(401, {
      error: "No autenticado. Iniciá sesión para generar cupones.",
    });
    return;
  }

  let body: { benefitId?: unknown; benefitSlug?: unknown };
  try {
    body = await event.request.json();
  } catch {
    event.json(400, { error: "Solicitud inválida." });
    return;
  }
  if (
    !body ||
    (typeof body.benefitId !== "string" && typeof body.benefitSlug !== "string")
  ) {
    event.json(400, { error: "ID o dirección de beneficio requerido." });
    return;
  }

  try {
    const coupon = await generateMemberCoupon(event, user, {
      benefitId:
        typeof body.benefitId === "string" ? body.benefitId : undefined,
      benefitSlug:
        typeof body.benefitSlug === "string" ? body.benefitSlug : undefined,
    });
    event.json(200, {
      code: coupon.code,
      couponId: coupon.id,
      reused: coupon.reused,
    });
  } catch (error) {
    if (error instanceof CouponGenerationError) {
      event.json(error.status, { error: error.message });
      return;
    }
    console.error("Generate coupon error:", error);
    event.json(500, { error: "Error al generar el cupón. Intentá de nuevo." });
  }
};
