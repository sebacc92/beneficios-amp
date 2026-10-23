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
