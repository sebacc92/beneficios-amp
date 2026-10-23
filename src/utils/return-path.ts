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

export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_PASSWORD_CHANGE_PATH = "/admin/cambiar-password";
export const ADMIN_HOME_PATH = "/admin/stats/";

/** Same checks for the admin panel: only pages inside /admin, never its login or forced password change. */
export function safeAdminReturnPath(raw: string | null | undefined): string | null {
  const path = safeReturnPath(raw);
  if (!path || !/^\/admin(?:[/?#]|$)/.test(path)) return null;
  if (path.startsWith(ADMIN_LOGIN_PATH) || path.startsWith(ADMIN_PASSWORD_CHANGE_PATH)) return null;
  return path;
}

/** `/admin/login/?volver=<path>` (or the forced password change) for an admin page. */
export function adminPathWithReturn(base: string, returnTo?: string | null): string {
  const path = safeAdminReturnPath(returnTo);
  return path ? `${base}/?${RETURN_PARAM}=${encodeURIComponent(path)}` : `${base}/`;
}
