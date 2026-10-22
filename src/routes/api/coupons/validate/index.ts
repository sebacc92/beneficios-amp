import type { RequestHandler } from "@builder.io/qwik-city";
import { validateCoupon } from "~/server/coupons";

export const onPost: RequestHandler = async (event) => {
  const body = await event.request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    event.json(400, { ok: false, message: "Petición inválida." });
    return;
  }

  const { code, numeroSocio, pin } = body as {
    code?: string;
    numeroSocio?: string;
    pin?: string;
  };

  if (!code || !numeroSocio) {
    event.json(400, { ok: false, message: "Código y número de socio son requeridos." });
    return;
  }

  // Authorization, throttling and the atomic redemption all live in the shared
  // helper, so this endpoint and /validar-cupon cannot drift apart.
  // Business outcomes (invalid code, wrong PIN, throttled) come back as 200 with
  // ok:false, matching what the existing clients already expect.
  const result = await validateCoupon(event, { code, numeroSocio, pin });
  event.json(200, result);
};
