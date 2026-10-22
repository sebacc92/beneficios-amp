import type { RequestEventBase } from "@builder.io/qwik-city";
import { and, eq, exists, sql } from "drizzle-orm";
import { getDB } from "~/db";
import { benefits, coupons } from "~/db/schema";
import { getSessionUser, type AuthenticatedUser } from "~/server/auth";
import { rateLimitByIp } from "~/server/rate-limit";
import { createQrDataUrl } from "~/server/qr";
import { expiredBenefitCondition } from "~/server/coupon-availability";

export class CouponGenerationError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function couponQrDataUrl(origin: string, code: string): Promise<string> {
  const url = new URL("/validar-cupon/", origin);
  url.searchParams.set("code", code);
  return createQrDataUrl(url.href);
}

export function isCouponBenefitAvailable(benefit: { validUntil: string | null } | null | undefined): boolean {
  if (!benefit || benefit.validUntil?.startsWith("draft")) return false;
  const validUntil = benefit.validUntil;
  const expiresAt = validUntil && /^\d{4}-\d{2}-\d{2}$/.test(validUntil)
    ? Date.parse(`${validUntil}T23:59:59-03:00`)
    : validUntil ? Date.parse(validUntil) : null;
  return expiresAt === null || !Number.isFinite(expiresAt) || expiresAt >= Date.now();
}

/** Resolve public slugs to the real DB primary key before writing the FK. */
export async function generateMemberCoupon(
  event: RequestEventBase,
  user: AuthenticatedUser,
  reference: { benefitId?: string; benefitSlug?: string },
) {
  const limit = rateLimitByIp(event, "coupon-generate", 20, 10 * 60 * 1000);
  if (!limit.allowed) {
    throw new CouponGenerationError(429, "Demasiadas solicitudes. Esperá un momento e intentá de nuevo.");
  }

  const db = getDB(event);
  const lookup = reference.benefitSlug
    ? eq(benefits.slug, reference.benefitSlug)
    : eq(benefits.id, reference.benefitId || "");
  const [benefit] = await db.select().from(benefits).where(lookup).limit(1);
  if (!benefit || !isCouponBenefitAvailable(benefit)) {
    throw new CouponGenerationError(404, "Este beneficio no está disponible para generar cupones.");
  }
  const premiumActive = user.role === "premium" && (!user.premiumExpiresAt || Date.parse(user.premiumExpiresAt) > Date.now());
  if (benefit.isPremiumOnly && user.role !== "admin" && !premiumActive) {
    throw new CouponGenerationError(403, "Este beneficio requiere Pase Premium vigente.");
  }

  const [existing] = await db.select().from(coupons).where(and(
    eq(coupons.userId, user.id),
    eq(coupons.benefitId, benefit.id),
    eq(coupons.status, "active"),
  )).limit(1);
  if (existing) {
    return { ...existing, qrDataUrl: await couponQrDataUrl(event.url.origin, existing.code), reused: true };
  }

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const code = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
    const [duplicate] = await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.code, code)).limit(1);
    if (duplicate) continue;

    const record = {
      id: crypto.randomUUID(),
      code,
      benefitId: benefit.id,
      benefitTitle: benefit.titulo,
      benefitResumen: benefit.resumen,
      userId: user.id,
      userName: user.name,
      numeroSocio: user.numeroSocio,
      status: "active" as const,
      createdAt: new Date().toISOString(),
      usedAt: null,
    };
    await db.insert(coupons).values(record);
    return { ...record, qrDataUrl: await couponQrDataUrl(event.url.origin, code), reused: false };
  }
  throw new CouponGenerationError(500, "No se pudo generar un código único. Intentá de nuevo.");
}

export interface ValidationResult {
  ok: boolean;
  message?: string;
  coupon?: {
    code: string;
    benefitTitle: string;
    userName: string;
    numeroSocio: string | null;
  };
}

/**
 * Who is allowed to burn a coupon: an authenticated admin, or a commerce holding
 * the shared validator PIN (COUPON_VALIDATOR_PIN).
 *
 * Redemption used to be completely open — any anonymous POST with a code could
 * mark it as used. If the PIN is not configured, validation is refused rather
 * than falling back to open access.
 */
function authorize(event: RequestEventBase, pin: string | undefined): ValidationResult | null {
  if (getSessionUser(event)?.role === "admin") return null;

  const expectedPin = (event.env.get("COUPON_VALIDATOR_PIN") ?? process.env.COUPON_VALIDATOR_PIN)?.trim();
  if (!expectedPin) {
    console.error("[Coupons] COUPON_VALIDATOR_PIN is not configured; refusing to validate.");
    return {
      ok: false,
      message: "La validación de cupones no está configurada. Contactá a la administración de la LPRC.",
    };
  }

  if (!pin || pin.trim() !== expectedPin) {
    return { ok: false, message: "PIN de comercio inválido." };
  }

  return null;
}

export interface ValidateCouponInput {
  code: string;
  numeroSocio: string;
  pin?: string;
}

export async function validateCoupon(
  event: RequestEventBase,
  input: ValidateCouponInput,
): Promise<ValidationResult> {
  const limit = rateLimitByIp(event, "coupon-validate", 30, 5 * 60 * 1000);
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Demasiados intentos. Esperá ${limit.retryAfter} segundo(s) e intentá de nuevo.`,
    };
  }

  const denied = authorize(event, input.pin);
  if (denied) return denied;

  const code = String(input.code ?? "").toUpperCase().trim();
  const numeroSocio = String(input.numeroSocio ?? "").trim();

  if (code.length < 4 || !numeroSocio) {
    return { ok: false, message: "Código y número de socio son requeridos." };
  }

  try {
    const db = getDB(event);

    // Single atomic statement: the WHERE clause carries the status check, so two
    // concurrent validations of the same coupon cannot both succeed (the previous
    // select-then-update left that race open).
    const redeemed = await db
      .update(coupons)
      .set({ status: "used", usedAt: new Date().toISOString() })
      .where(
        and(
          eq(coupons.code, code),
          eq(coupons.numeroSocio, numeroSocio),
          eq(coupons.status, "active"),
          exists(db.select({ value: sql`1` }).from(benefits).where(and(
            eq(benefits.id, coupons.benefitId),
            sql`coalesce(${expiredBenefitCondition()}, 0) = 0`,
          ))),
        ),
      )
      .returning({
        code: coupons.code,
        benefitTitle: coupons.benefitTitle,
        userName: coupons.userName,
        numeroSocio: coupons.numeroSocio,
      });

    const coupon = redeemed[0];
    if (!coupon) {
      return {
        ok: false,
        message: "Cupón inválido, vencido, ya utilizado, o el número de socio no coincide.",
      };
    }

    return { ok: true, coupon };
  } catch (err) {
    console.error("Validate coupon error:", err);
    return { ok: false, message: "Error del servidor. Intentá de nuevo." };
  }
}
