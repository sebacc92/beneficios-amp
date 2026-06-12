import type { RequestHandler } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { ensureMigrated } from "~/db/migrate";
import { users } from "~/db/schema";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  matricula: string | null;
  role: "admin" | "member";
  avatarUrl: string | null;
  createdAt: string;
}

export const onRequest: RequestHandler = async (event) => {
  // Run one-shot DB migrations exactly once per isolate.
  try {
    await ensureMigrated(event);
  } catch (err) {
    console.error("[Auth Middleware] Migrations failed:", err);
  }

  const sessionToken = event.cookie.get("session_token")?.value;

  if (sessionToken) {
    try {
      const db = getDB(event);
      const [userRecord] = await db
        .select()
        .from(users)
        .where(eq(users.id, sessionToken))
        .limit(1);

      if (userRecord) {
        const authenticatedUser: AuthenticatedUser = {
          id: userRecord.id,
          name: userRecord.name,
          email: userRecord.email,
          matricula: userRecord.matricula,
          role: userRecord.role,
          avatarUrl: userRecord.avatarUrl,
          createdAt: userRecord.createdAt,
        };
        event.sharedMap.set("user", authenticatedUser);
      } else {
        event.cookie.delete("session_token", { path: "/" });
      }
    } catch (err) {
      console.error("[Auth Middleware] Failed to resolve session:", err);
    }
  }

  // Gate the admin panel. `/admin/login` is the only admin route accessible
  // without an authenticated admin session — everything else requires one.
  const pathname = event.url.pathname;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const currentUser = event.sharedMap.get("user") as AuthenticatedUser | null;
    if (!currentUser || currentUser.role !== "admin") {
      throw event.redirect(302, "/admin/login");
    }
  }
};
