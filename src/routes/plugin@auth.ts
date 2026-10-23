import type { RequestHandler } from "@builder.io/qwik-city";
import { resolveSessionUser, type AuthenticatedUser } from "~/server/auth";
import { ADMIN_LOGIN_PATH, ADMIN_PASSWORD_CHANGE_PATH, adminPathWithReturn } from "~/utils/return-path";

export type { AuthenticatedUser };

/** The page the admin asked for, so login can send them back. Actions (POST) have nowhere useful to return. */
function requestedAdminPage(url: URL, method: string): string | null {
  if (method !== "GET") return null;
  const params = new URLSearchParams(url.search);
  params.delete("qaction");
  params.delete("qfunc");
  const query = params.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

export const onRequest: RequestHandler = async (event) => {
  try {
    const user = await resolveSessionUser(event);
    if (user) {
      // Expose user in sharedMap so all loaders and actions can access it
      event.sharedMap.set("user", user);
    }
  } catch (err) {
    console.error("[Auth Middleware] Failed to resolve session:", err);
  }

  const currentUser = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  const pathname = event.url.pathname;

  // Every /admin route requires a real admin session. The login page itself is the
  // only exception, otherwise there would be no way in.
  if (pathname.startsWith("/admin") && !pathname.startsWith(ADMIN_LOGIN_PATH)) {
    const requested = requestedAdminPage(event.url, event.method);
    if (!currentUser || currentUser.role !== "admin") {
      throw event.redirect(302, adminPathWithReturn(ADMIN_LOGIN_PATH, requested));
    }
    // A temporary password only opens the screen that replaces it.
    if (currentUser.mustChangePassword && !pathname.startsWith(ADMIN_PASSWORD_CHANGE_PATH)) {
      throw event.redirect(302, adminPathWithReturn(ADMIN_PASSWORD_CHANGE_PATH, requested));
    }
  }

  await event.next();
};
