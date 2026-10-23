import type { RequestEventBase } from "@builder.io/qwik-city";
import { and, count, eq, exists, gte, sql } from "drizzle-orm";
import { getDB } from "~/db";
import { benefits, coupons } from "~/db/schema";
import { normalizedDniExpression } from "~/db/dni-expression.mjs";
import { getSessionUser, type AuthenticatedUser } from "~/server/auth";
import { rateLimitByIp } from "~/server/rate-limit";
import { createQrDataUrl } from "~/server/qr";
import { expiredBenefitCondition } from "~/server/coupon-availability";
import { normalizeDni } from "~/utils/dni";
import { parseValidUntil } from "~/utils/benefit-status";
import { normalizeCouponCode } from "~/utils/coupon-code";

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
  if (!benefit) return false;
  const { isDraft, validUntil } = parseValidUntil(benefit.validUntil);
  if (isDraft) return false;
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
    throw new CouponGenerationError(403, "Este beneficio es exclusivo para socios Gold con la membresía vigente.");
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

/** Why a coupon cannot be redeemed. Only told apart once the member's DNI matches. */
export type CouponRejection = "not_found" | "dni_mismatch" | "used" | "expired";

const REJECTION_MESSAGES: Record<CouponRejection, string> = {
  not_found: "No existe un cupón con ese código. Revisá que esté bien escrito.",
  dni_mismatch: "El DNI no coincide con el del socio que generó este cupón.",
  used: "Este cupón ya fue canjeado.",
  expired: "Este cupón está vencido o el beneficio ya no está vigente.",
};

export interface ValidatedCoupon {
  code: string;
  benefitTitle: string;
  benefitResumen: string;
  userName: string;
  numeroSocio: string | null;
  maskedDni: string;
}

export interface ValidationResult {
  ok: boolean;
  message?: string;
  reason?: CouponRejection;
  coupon?: ValidatedCoupon;
}

export { normalizeCouponCode };

/** "12345678" -> "**.***.678": enough for the cashier to compare with the member's DNI. */
export function maskDni(raw: string | null | undefined): string {
  const digits = normalizeDni(raw ?? "");
  if (!digits) return "";
  const masked = digits.slice(0, -3).replace(/./g, "*") + digits.slice(-3);
  const groups: string[] = [];
  for (let end = masked.length; end > 0; end -= 3) groups.unshift(masked.slice(Math.max(0, end - 3), end));
  return groups.join(".");
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

type ParsedInput = { ok: true; code: string; numeroSocio: string } | { ok: false; result: ValidationResult };

/** Shared gate for checking and redeeming: rate limit, merchant PIN and required fields. */
function parseValidationInput(event: RequestEventBase, input: ValidateCouponInput): ParsedInput {
  const limit = rateLimitByIp(event, "coupon-validate", 30, 5 * 60 * 1000);
  if (!limit.allowed) {
    return {
      ok: false,
      result: { ok: false, message: `Demasiados intentos. Esperá ${limit.retryAfter} segundo(s) e intentá de nuevo.` },
    };
  }

  const denied = authorize(event, input.pin);
  if (denied) return { ok: false, result: denied };

  const code = normalizeCouponCode(input.code);
  const numeroSocio = normalizeDni(String(input.numeroSocio ?? ""));
  if (code.length < 4 || !numeroSocio) {
    return { ok: false, result: { ok: false, message: "Código y DNI del socio son requeridos." } };
  }
  return { ok: true, code, numeroSocio };
}

/**
 * Looks a coupon up without changing it. The DNI is checked before anything else, so a
 * wrong DNI never reveals whether the coupon was already used or has expired.
 */
async function inspectCoupon(
  event: RequestEventBase,
  code: string,
  numeroSocio: string,
): Promise<{ reason: CouponRejection } | { coupon: ValidatedCoupon }> {
  const [row] = await getDB(event)
    .select({
      code: coupons.code,
      benefitTitle: coupons.benefitTitle,
      benefitResumen: coupons.benefitResumen,
      userName: coupons.userName,
      numeroSocio: coupons.numeroSocio,
      status: coupons.status,
      dniMatches: sql<number>`(${sql.raw(normalizedDniExpression)} = ${numeroSocio})`,
      expired: sql<number>`coalesce(${expiredBenefitCondition()}, 0)`,
    })
    .from(coupons)
    .leftJoin(benefits, eq(benefits.id, coupons.benefitId))
    .where(eq(coupons.code, code))
    .limit(1);

  if (!row) return { reason: "not_found" };
  if (!Number(row.dniMatches)) return { reason: "dni_mismatch" };
  if (row.status === "used") return { reason: "used" };
  if (row.status === "expired" || Number(row.expired)) return { reason: "expired" };
  return {
    coupon: {
      code: row.code,
      benefitTitle: row.benefitTitle,
      benefitResumen: row.benefitResumen,
      userName: row.userName,
      numeroSocio: row.numeroSocio,
      maskedDni: maskDni(row.numeroSocio),
    },
  };
}

const rejection = (reason: CouponRejection): ValidationResult => ({
  ok: false,
  reason,
  message: REJECTION_MESSAGES[reason],
});

/** Step 1 for merchants: shows what the coupon is worth without redeeming it. */
export async function checkCoupon(
  event: RequestEventBase,
  input: ValidateCouponInput,
): Promise<ValidationResult> {
  const parsed = parseValidationInput(event, input);
  if (!parsed.ok) return parsed.result;

  try {
    const found = await inspectCoupon(event, parsed.code, parsed.numeroSocio);
    return "reason" in found ? rejection(found.reason) : { ok: true, coupon: found.coupon };
  } catch (err) {
    console.error("Check coupon error:", err);
    return { ok: false, message: "Error del servidor. Intentá de nuevo." };
  }
}

export async function validateCoupon(
  event: RequestEventBase,
  input: ValidateCouponInput,
): Promise<ValidationResult> {
  const parsed = parseValidationInput(event, input);
  if (!parsed.ok) return parsed.result;
  const { code, numeroSocio } = parsed;

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
          eq(sql.raw(normalizedDniExpression), numeroSocio),
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
        benefitResumen: coupons.benefitResumen,
        userName: coupons.userName,
        numeroSocio: coupons.numeroSocio,
      });

    const coupon = redeemed[0];
    if (!coupon) {
      // Nothing changed; work out why so the cashier knows what to tell the member.
      const found = await inspectCoupon(event, code, numeroSocio);
      return rejection("reason" in found ? found.reason : "used");
    }

    return { ok: true, coupon: { ...coupon, maskedDni: maskDni(coupon.numeroSocio) } };
  } catch (err) {
    console.error("Validate coupon error:", err);
    return { ok: false, message: "Error del servidor. Intentá de nuevo." };
  }
}

export async function getCouponCountsByBenefit(event: RequestEventBase): Promise<Record<string, number>> {
  const rows = await getDB(event)
    .select({ benefitId: coupons.benefitId, total: count() })
    .from(coupons)
    .groupBy(coupons.benefitId);
  return Object.fromEntries(rows.map((row) => [row.benefitId, row.total]));
}

/**
 * Coupons reference their benefit through a restrictive FK, so a benefit with issued
 * coupons can only be deleted together with them, and only once the admin agreed to it.
 * The confirmed count is checked under the write lock: newly issued coupons require
 * another confirmation, and none can be inserted between this check and deletion.
 */
export async function deleteBenefit(
  event: RequestEventBase,
  benefitId: string,
  options: { includeCoupons: boolean; expectedCouponCount: number },
) {
  const db = getDB(event);
  // The installed libSQL driver starts transaction() in "write" mode (BEGIN
  // IMMEDIATE), taking the write lock before the first SELECT on both HTTP and SQLite.
  return db.transaction(async (tx) => {
    const [benefit] = await tx.select({ id: benefits.id }).from(benefits)
      .where(eq(benefits.id, benefitId)).limit(1);
    if (!benefit) {
      return { ok: false as const, couponCount: 0, message: "El beneficio ya no existe." };
    }
    const [{ total: couponCount }] = await tx
      .select({ total: count() })
      .from(coupons)
      .where(eq(coupons.benefitId, benefitId));

    if ((couponCount > 0 && !options.includeCoupons) || couponCount !== options.expectedCouponCount) {
      return {
        ok: false as const,
        couponCount,
        message: `El beneficio tiene ${couponCount} ${couponCount === 1 ? "cupón emitido" : "cupones emitidos"}. Revisá la cantidad y confirmá nuevamente el borrado.`,
      };
    }

    const removedCoupons = await tx.delete(coupons)
      .where(eq(coupons.benefitId, benefitId)).returning({ id: coupons.id });
    await tx.delete(benefits).where(eq(benefits.id, benefitId));
    return { ok: true as const, deletedCoupons: removedCoupons.length };
  });
}

const ARGENTINA_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Coupons generated per Argentina calendar day (oldest first) and redemptions in the same
 * window. Argentina has no DST, so its midnight is always 03:00 UTC.
 */
export async function getCouponActivity(event: RequestEventBase, days = 30, now = new Date()) {
  const dayKeys = Array.from({ length: days }, (_, index) =>
    ARGENTINA_DAY.format(new Date(now.getTime() - (days - 1 - index) * 86_400_000)),
  );
  const since = `${dayKeys[0]}T03:00:00.000Z`;
  const argentinaDay = sql<string>`date(${coupons.createdAt}, '-3 hours')`;
  const db = getDB(event);
  const [generatedRows, usedRows] = await Promise.all([
    db
      .select({ day: argentinaDay, total: count() })
      .from(coupons)
      .where(gte(coupons.createdAt, since))
      .groupBy(argentinaDay),
    db.select({ total: count() }).from(coupons).where(gte(coupons.usedAt, since)),
  ]);
  const byDay = new Map(generatedRows.map((row) => [row.day, row.total]));
  const perDay = dayKeys.map((day) => ({ day, generated: byDay.get(day) ?? 0 }));
  return {
    days: perDay,
    generated: perDay.reduce((sum, row) => sum + row.generated, 0),
    used: usedRows[0]?.total ?? 0,
  };
}
