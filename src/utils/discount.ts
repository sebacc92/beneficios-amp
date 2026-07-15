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
