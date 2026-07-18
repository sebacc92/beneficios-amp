/**
 * Deriva el texto del badge ("Resumen") a partir de la oferta seleccionada.
 * Ej: "20%" -> "20% de descuento"; "2x1" -> "2x1"; "Promociones" -> "Promociones".
 */
export function deriveDiscountBadge(offerDesc: string): string {
  const s = (offerDesc || "").trim();
  const m = s.match(/(\d+)\s*%/) || s.match(/^(\d+)$/);
  if (m) return `${m[1]}% de descuento`;
  return s;
}

/** Extrae el porcentaje numérico de un texto libre, o null si no hay. */
export function pctFromText(text: string): string | null {
  const m = (text || "").match(/(\d+)\s*%/);
  return m ? m[1] : null;
}

// ── Múltiples descuentos por beneficio ─────────────────────────────────────
// Cada descuento es un porcentaje (o texto libre) + una etiqueta de condición
// corta (ej. "lunes a jueves", "en efectivo", "en mano de obra"). Se guardan
// como JSON en la columna `discounts` (SQL crudo, fuera del schema de Drizzle).

export interface Discount {
  pct: string; // "20", "2x1", "Promociones"…
  label: string; // condición: "lunes a jueves", "en efectivo"… (puede ir vacía)
}

/** Parsea la lista de descuentos desde el JSON guardado. Tolerante a basura. */
export function parseDiscounts(raw: string | null | undefined): Discount[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((d: any) => ({ pct: String(d?.pct ?? "").trim(), label: String(d?.label ?? "").trim() }))
      .filter((d) => d.pct || d.label);
  } catch {
    return [];
  }
}

function isNumericPct(pct: string): boolean {
  return /^\d+$/.test(pct.trim());
}

/** Muestra un porcentaje: "20" -> "20%"; texto libre ("2x1") se deja igual. */
export function pctDisplay(pct: string): string {
  const p = (pct || "").trim();
  if (!p) return "";
  return isNumericPct(p) ? `${p}%` : p;
}

/**
 * Lista de descuentos efectiva de un beneficio: usa `discounts` si existe; si no
 * (beneficios previos con un solo descuento), la deriva del resumen/oferta para
 * que TODO siga funcionando sin migración manual.
 */
export function benefitDiscounts(b: {
  discounts?: Discount[] | null;
  resumen?: string;
  ofertas?: { descripcion: string }[];
}): Discount[] {
  if (b.discounts && b.discounts.length) return b.discounts;
  const src = b.ofertas?.[0]?.descripcion || b.resumen || "";
  const pct = pctFromText(src);
  const val = pct || src.trim();
  return val ? [{ pct: val, label: "" }] : [];
}

/**
 * Texto compacto para el "redondelito"/badge circular. 1 descuento -> "20%";
 * 2 numéricos -> "20/25%"; más de 2 o muy largo -> "Hasta 25%".
 */
export function formatDiscountBadge(discounts: Discount[]): string {
  const pcts = discounts.map((d) => d.pct).filter(Boolean);
  if (pcts.length === 0) return "";
  if (pcts.length === 1) return pctDisplay(pcts[0]);
  const nums = discounts.map((d) => parseInt(d.pct, 10)).filter((n) => !isNaN(n));
  const allNumeric = nums.length === discounts.length && nums.length > 0;
  if (allNumeric) {
    if (discounts.length === 2) return `${nums[0]}/${nums[1]}%`;
    return `Hasta ${Math.max(...nums)}%`;
  }
  if (nums.length) return `Hasta ${Math.max(...nums)}%`;
  return pctDisplay(pcts[0]);
}

/** Texto con TODOS los porcentajes, para el chip/cuerpo: "5% / 20%". */
export function formatDiscountChip(discounts: Discount[]): string {
  return discounts
    .map((d) => pctDisplay(d.pct))
    .filter(Boolean)
    .join(" / ");
}

/**
 * Dada una lista de descuentos y el catálogo de ofertas (facets de filtro),
 * devuelve el offerId del descuento principal (el primero), para mantener el
 * filtro por descuento de /beneficios funcionando.
 */
export function offerIdForDiscounts(
  discounts: Discount[],
  ofertas: { id: number; descripcion: string }[]
): number | null {
  const first = discounts[0];
  if (!first) return null;
  const n = parseInt(first.pct, 10);
  if (!isNaN(n)) {
    const exact = ofertas.find((o) => parseInt(o.descripcion, 10) === n);
    if (exact) return exact.id;
  }
  const promo = ofertas.find((o) => /promoci/i.test(o.descripcion));
  return promo?.id ?? ofertas[0]?.id ?? null;
}
