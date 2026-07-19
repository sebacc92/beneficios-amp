/**
 * Vigencia de beneficios. Un beneficio "vence" cuando su `validUntil` (fecha
 * YYYY-MM-DD) es ANTERIOR al día de hoy en Argentina. El día de la fecha cargada
 * todavía es válido (vence al día siguiente). Sin fecha => nunca vence.
 *
 * La comparación es por fecha (no por hora) y en zona horaria de Argentina, así
 * no depende de la TZ del servidor ni requiere "desactivar" nada a mano.
 */
export function isExpired(validUntil?: string | null): boolean {
  if (!validUntil) return false;
  const until = validUntil.trim().slice(0, 10); // toma solo YYYY-MM-DD
  if (!until) return false;
  const todayArg = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }); // "YYYY-MM-DD"
  return todayArg > until;
}

/** Formatea la fecha de vencimiento en es-AR (dd/mm/aaaa), tolerante al formato. */
export function formatExpiryDate(validUntil?: string | null): string {
  if (!validUntil) return "";
  const v = validUntil.trim();
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("es-AR");
}
