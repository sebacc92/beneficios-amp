/** Codes are printed and read aloud with spaces or hyphens; only the characters count. */
export function normalizeCouponCode(raw: unknown): string {
  return String(raw ?? "").replace(/[\s-]/g, "").toUpperCase();
}
