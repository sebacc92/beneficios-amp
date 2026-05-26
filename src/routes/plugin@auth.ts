import type { RequestHandler } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  matricula: string | null;
  role: "admin" | "member" | "premium";
  avatarUrl: string | null;
  premiumExpiresAt: string | null;
  createdAt: string;
}

export const onRequest: RequestHandler = async (event) => {
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
          role: userRecord.role as any,
          avatarUrl: userRecord.avatarUrl,
          premiumExpiresAt: userRecord.premiumExpiresAt,
          createdAt: userRecord.createdAt,
        };
        // Expose user in sharedMap so all loaders and actions can access it
        event.sharedMap.set("user", authenticatedUser);
      } else {
        // Clear invalid cookie
        event.cookie.delete("session_token", { path: "/" });
      }
    } catch (err) {
      console.error("[Auth Middleware] Failed to resolve session:", err);
    }
  }

  // TEMPORAL: Bypassing auth checks for easy testing ONLY for admin routes.
  if (!event.sharedMap.get("user") && event.url.pathname.startsWith("/admin")) {
    const mockAdmin: AuthenticatedUser = {
      id: "mock-admin-id",
      name: "Administrador",
      email: "admin@amepla.org.ar",
      matricula: "12345",
      role: "admin",
      avatarUrl: null,
      premiumExpiresAt: null,
      createdAt: new Date().toISOString(),
    };
    event.sharedMap.set("user", mockAdmin);
  }

  await event.next();
};
