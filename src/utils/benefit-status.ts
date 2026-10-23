/**
 * Benefits keep their draft flag inside `valid_until`: `draft|<fecha>` or plain `draft`.
 * Every read and write of that encoding goes through here so it cannot drift again.
 */
export function parseValidUntil(raw: string | null | undefined): { isDraft: boolean; validUntil: string | null } {
  if (raw === "draft") return { isDraft: true, validUntil: null };
  if (raw?.startsWith("draft|")) return { isDraft: true, validUntil: raw.slice("draft|".length) || null };
  return { isDraft: false, validUntil: raw || null };
}

export function isDraftBenefit(raw: string | null | undefined): boolean {
  return parseValidUntil(raw).isDraft;
}

export function encodeValidUntil(isActive: boolean, validUntil: string | null | undefined): string | null {
  const date = validUntil?.trim() || "";
  return isActive ? date || null : `draft|${date}`;
}
