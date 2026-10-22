import type { RequestHandler } from "@builder.io/qwik-city";
import { resolveSessionUser, type AuthenticatedUser } from "~/server/auth";

export type { AuthenticatedUser };

const ADMIN_LOGIN_PATH = "/admin/login";

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
    if (!currentUser || currentUser.role !== "admin") {
      throw event.redirect(302, ADMIN_LOGIN_PATH);
    }
  }

  await event.next();
};
