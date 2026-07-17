import type { RequestHandler } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  matricula: string | null;
  dni: string | null;
  role: "admin" | "member";
  avatarUrl: string | null;
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
          dni: userRecord.dni,
          role: userRecord.role as any,
          avatarUrl: userRecord.avatarUrl,
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

  // Las rutas /admin se protegen con sesión firmada (HMAC) en el onRequest
  // de src/routes/admin/layout.tsx — acá no se inyecta ningún usuario.
  await event.next();
};
