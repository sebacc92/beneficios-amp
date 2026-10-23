import { encodeValidUntil, parseValidUntil } from "~/utils/benefit-status";

/** Pure helpers for the benefits admin form; they run both in the browser and in actions. */

export const RESUMEN_MAX_LENGTH = 40;

/** "10 % Off " → "10% Off": one space between words and none before the percent sign. */
export function normalizeResumen(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s+%/g, "%").trim();
}

export function percentIn(value: string | null | undefined): number | null {
  const match = value?.match(/(\d+(?:[.,]\d+)?)\s*%/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

/** True only when both texts state a percentage and the numbers differ. */
export function resumenContradictsOffer(resumen: string, offer: string | null | undefined): boolean {
  const badge = percentIn(resumen);
  const selected = percentIn(offer);
  return badge !== null && selected !== null && badge !== selected;
}

export function normalizeTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['´`’‘]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findDuplicateTitle<T extends { id: string; titulo: string }>(
  rows: readonly T[],
  title: string,
  excludeId?: string,
): T | null {
  const wanted = normalizeTitle(title);
  if (!wanted) return null;
  return rows.find((row) => row.id !== excludeId && normalizeTitle(row.titulo) === wanted) ?? null;
}

// The place pin (!3d…!4d…) and explicit query parameters win over "@", which is only the map's center.
const MAPS_PATTERNS = [
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  /[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i,
  /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
];

/** Reads the coordinates out of a pasted Google Maps link, or plain "lat, lng" text. */
export function parseMapsLink(input: string): { latitud: string; longitud: string } | null {
  const text = input.trim();
  const plain = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  for (const match of [plain, ...MAPS_PATTERNS.map((pattern) => text.match(pattern))]) {
    if (!match) continue;
    const coordinates = parseCoordinateFields(match[1], match[2]);
    if (coordinates.ok && coordinates.latitud && coordinates.longitud) {
      return { latitud: coordinates.latitud, longitud: coordinates.longitud };
    }
  }
  return null;
}

type CoordinateResult =
  | { ok: true; latitud: string | null; longitud: string | null }
  | { ok: false; errors: { latitud?: string; longitud?: string } };

/** Both empty means "no location" (the benefit stays off the map); never invent a point. */
export function parseCoordinateFields(latitud?: string | null, longitud?: string | null): CoordinateResult {
  const lat = latitud?.trim().replace(",", ".") ?? "";
  const lng = longitud?.trim().replace(",", ".") ?? "";
  if (!lat && !lng) return { ok: true, latitud: null, longitud: null };

  const errors: { latitud?: string; longitud?: string } = {};
  const check = (value: string, limit: number, field: "latitud" | "longitud", label: string) => {
    if (!value) {
      errors[field] = "Completá latitud y longitud, o dejá las dos vacías.";
      return;
    }
    const number = Number(value);
    if (!/^-?\d+(\.\d+)?$/.test(value) || !Number.isFinite(number) || Math.abs(number) > limit) {
      errors[field] = `La ${label} debe ser un número entre -${limit} y ${limit}.`;
    }
  };
  check(lat, 90, "latitud", "latitud");
  check(lng, 180, "longitud", "longitud");
  if (errors.latitud || errors.longitud) return { ok: false, errors };
  return { ok: true, latitud: lat, longitud: lng };
}

export function hasCoordinates(row: { latitud: string | null; longitud: string | null }): boolean {
  const result = parseCoordinateFields(row.latitud, row.longitud);
  return result.ok && result.latitud !== null;
}

export interface BenefitFormInput {
  titulo: string;
  resumen: string;
  descripcion: string;
  isFeatured?: string;
  isPremiumOnly?: string;
  isActive?: string;
  categoryId: string;
  locationId: string;
  offerId: string;
  validUntil?: string;
  terms?: string;
  couponCode?: string;
}

/**
 * Columns the form owns. Anything absent here (media, coordinates, and coupon_code when the
 * form does not send it) is left untouched by an update, so a typo fix cannot erase other data.
 */
export function benefitValuesFromForm(input: BenefitFormInput) {
  return {
    titulo: input.titulo.trim(),
    resumen: normalizeResumen(input.resumen),
    descripcion: input.descripcion.trim(),
    isFeatured: input.isFeatured === "on",
    isPremiumOnly: input.isPremiumOnly === "on",
    categoryId: Number(input.categoryId),
    locationId: Number(input.locationId),
    offerId: Number(input.offerId),
    validUntil: encodeValidUntil(input.isActive === "on", input.validUntil),
    terms: input.terms?.trim() || null,
    // Only owned when the form sends the field; otherwise an update keeps the stored code.
    ...(input.couponCode === undefined ? {} : { couponCode: input.couponCode.trim().slice(0, 40) || null }),
  };
}

/** Flips the draft flag to the requested state and keeps the date. */
export function withPublishedState(raw: string | null | undefined, publish: boolean): string | null {
  return encodeValidUntil(publish, parseValidUntil(raw).validUntil);
}

/** "2026-12-31" → "31/12/2026" in Argentina; full ISO instants are converted to that zone. */
export function formatValidUntil(raw: string | null | undefined): string | null {
  const { validUntil } = parseValidUntil(raw);
  if (!validUntil) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(validUntil)
    ? new Date(`${validUntil}T12:00:00-03:00`)
    : new Date(validUntil);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const ARGENTINA_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day (YYYY-MM-DD) in Buenos Aires, the zone `valid_until` is written in. */
export function argentinaDay(date: Date = new Date()): string {
  return ARGENTINA_DAY.format(date);
}

/** How many days ahead counts as "vence pronto" in the admin list and dashboard. */
export const EXPIRING_SOON_DAYS = 14;

export type BenefitValidity = "vencido" | "vence-pronto" | "vigente" | "sin-vencimiento";

/**
 * Same rule as the coupon checks: a benefit is still valid on its last day and expires the
 * day after. `today` is an Argentine YYYY-MM-DD so callers can pin it in tests.
 */
export function benefitValidity(
  raw: string | null | undefined,
  today: string = argentinaDay(),
  soonDays: number = EXPIRING_SOON_DAYS,
): BenefitValidity {
  const { validUntil } = parseValidUntil(raw);
  if (!validUntil) return "sin-vencimiento";
  const day = /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : (() => {
    const date = new Date(validUntil);
    return Number.isNaN(date.getTime()) ? null : argentinaDay(date);
  })();
  if (!day) return "sin-vencimiento";
  if (day < today) return "vencido";
  const limit = argentinaDay(new Date(new Date(`${today}T12:00:00-03:00`).getTime() + soonDays * 86_400_000));
  return day <= limit ? "vence-pronto" : "vigente";
}

export const MERCHANT_FIELDS = ["address", "hours", "phone", "whatsapp", "instagram", "website"] as const;
export type MerchantField = (typeof MERCHANT_FIELDS)[number];
export type MerchantFieldsInput = Partial<Record<MerchantField, string | null>>;
type MerchantValues = Record<MerchantField, string | null>;

const MERCHANT_LIMITS: Record<MerchantField, number> = {
  address: 200,
  hours: 300,
  phone: 40,
  whatsapp: 40,
  instagram: 200,
  website: 300,
};

/** Phone numbers are kept as typed (only tidied up): the public page builds the links. */
function checkPhone(value: string, label: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!/^[\d\s()+\-.]+$/.test(value) || digits.length < 7 || digits.length > 15) {
    return `Revisá el ${label}: usá solo números, con código de área (ej: 221 456-7890).`;
  }
  return null;
}

/** "@lprc", "lprc" or any instagram.com link → canonical profile URL. */
export function normalizeInstagram(value: string): string | null {
  const text = value.trim();
  const fromUrl = text.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i);
  const handle = fromUrl?.[1] ?? text.match(/^@?([A-Za-z0-9._]{1,30})$/)?.[1];
  return handle ? `https://www.instagram.com/${handle}/` : null;
}

/** Adds https:// when missing and accepts only http(s) addresses with a real host name. */
export function normalizeWebsite(value: string): string | null {
  const text = value.trim();
  if (!text || /\s/.test(text)) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (!/^https?:$/.test(url.protocol) || !/^[^.]+\.[^.]{2,}/.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Why one merchant field cannot be saved, or null when it is fine (empty included). */
export function merchantFieldError(field: MerchantField, value: string | null | undefined): string | null {
  const raw = (value ?? "").replace(/[ \t]+/g, " ").trim();
  if (!raw) return null;
  if (raw.length > MERCHANT_LIMITS[field]) return `Usá hasta ${MERCHANT_LIMITS[field]} caracteres.`;
  if (field === "phone" || field === "whatsapp") return checkPhone(raw, field === "phone" ? "teléfono" : "WhatsApp");
  if (field === "instagram" && !normalizeInstagram(raw)) return "Ingresá el usuario (ej: @comercio) o el link del perfil.";
  if (field === "website" && !normalizeWebsite(raw)) return "Ingresá una dirección web válida (ej: comercio.com.ar).";
  return null;
}

/**
 * Structured merchant details from the form. Empty fields become null; links are tidied up
 * and the rest is checked loosely, so a valid way of writing a number is never rejected.
 */
export function parseMerchantFields(
  input: MerchantFieldsInput,
): { ok: true; values: MerchantValues } | { ok: false; errors: Partial<Record<MerchantField, string>> } {
  const values = {} as MerchantValues;
  const errors: Partial<Record<MerchantField, string>> = {};
  for (const field of MERCHANT_FIELDS) {
    const raw = (input[field] ?? "").replace(/[ \t]+/g, " ").trim();
    const error = merchantFieldError(field, raw);
    if (error) errors[field] = error;
    values[field] = !raw ? null : field === "instagram" ? normalizeInstagram(raw) : field === "website" ? normalizeWebsite(raw) : raw;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

/** Internal paths ("/beneficios/") or full http(s) links; protocol-relative "//" is refused. */
export function isValidSiteLink(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  if (text.startsWith("/")) return !text.startsWith("//") && !/\s/.test(text);
  try {
    const url = new URL(text);
    return /^https?:$/.test(url.protocol) && url.hostname.includes(".");
  } catch {
    return false;
  }
}
