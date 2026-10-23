/** Query parameter that carries where to send the member after logging in. */
export const RETURN_PARAM = "volver";

/**
 * Accepts only same-site paths ("/perfil/cupon/1"), never "//otro.sitio" or
 * "/\otro.sitio", which browsers treat as another origin.
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/login")) return null;
  return value;
}

/** `/login/?volver=<path>` for a path the member was trying to open. */
export function loginUrl(returnTo?: string | null): string {
  const path = safeReturnPath(returnTo);
  return path ? `/login/?${RETURN_PARAM}=${encodeURIComponent(path)}` : "/login/";
}
