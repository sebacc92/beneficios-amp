/** Accept the usual printed DNI separators without accepting other characters. */
export function normalizeDni(value: string): string {
  return value.replace(/[.\s]/g, "");
}

export function isValidDni(value: string): boolean {
  return /^\d{5,9}$/.test(normalizeDni(value));
}
