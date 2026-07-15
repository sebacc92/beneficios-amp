/**
 * Enmascara un DNI dejando visibles solo los primeros 4 dígitos y agrupando
 * en formato argentino con puntos. Ej: "12345678" -> "12.34X.XXX".
 * Devuelve "—" si no hay dígitos.
 */
export function maskDni(dni: string | null | undefined): string {
  const digits = (dni || "").replace(/\D/g, "");
  if (!digits) return "—";
  const masked = digits
    .split("")
    .map((d, i) => (i < 4 ? d : "X"))
    .join("");
  // Agrupar de a 3 desde la derecha con puntos.
  return masked.replace(/\B(?=(.{3})+(?!.))/g, ".");
}
