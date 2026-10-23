import type { RequestEventBase } from "@builder.io/qwik-city";
import { and, eq, gt } from "drizzle-orm";
import { getDB } from "~/db";
import { sessions, users } from "~/db/schema";
import { randomToken, sha256Hex } from "~/utils/crypto";

export const SESSION_COOKIE = "session_token";
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * SESSION_TTL_DAYS;

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  numeroSocio: string | null;
  role: "admin" | "member" | "premium";
  avatarUrl: string | null;
  premiumExpiresAt: string | null;
  createdAt: string;
  /** Admin accounts created or reset with a temporary password must replace it first. */
  mustChangePassword: boolean;
}

function isSecureRequest(event: RequestEventBase): boolean {
  // Behind Vercel's proxy the origin protocol arrives in x-forwarded-proto.
  const forwardedProto = event.request.headers.get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto.split(",")[0].trim() === "https";
  return event.url.protocol === "https:";
}

/**
 * Issues a fresh session: a random 256-bit token goes to the cookie, only its
 * SHA-256 is persisted. Returns the raw token (callers rarely need it).
 */
export async function createSession(event: RequestEventBase, userId: string): Promise<string> {
  const db = getDB(event);
  const token = await randomToken(32);
  const now = new Date();

  await db.insert(sessions).values({
    id: await sha256Hex(token),
    userId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString(),
  });
  // "Último acceso" in the admin lists; a failure here must not block the login.
  await db.update(users).set({ lastLoginAt: now.toISOString() }).where(eq(users.id, userId)).catch((err) => {
    console.error("Failed to record last login:", err);
  });

  event.cookie.set(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(event),
    maxAge: SESSION_TTL_SECONDS,
  });

  return token;
}

/** Resolves the cookie token to a user, or null when absent/expired/unknown. */
export async function resolveSessionUser(event: RequestEventBase): Promise<AuthenticatedUser | null> {
  const token = event.cookie.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDB(event);
  const [row] = await db
    .select({ user: users, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, await sha256Hex(token)), gt(sessions.expiresAt, new Date().toISOString())))
    .limit(1);

  if (!row) {
    event.cookie.delete(SESSION_COOKIE, { path: "/" });
    return null;
  }

  const { user } = row;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    numeroSocio: user.numeroSocio,
    role: user.role,
    avatarUrl: user.avatarUrl,
    premiumExpiresAt: user.premiumExpiresAt,
    createdAt: user.createdAt,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

/** Deletes the session row and clears the cookie. */
export async function destroySession(event: RequestEventBase): Promise<void> {
  const token = event.cookie.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await getDB(event).delete(sessions).where(eq(sessions.id, await sha256Hex(token)));
    } catch (err) {
      console.error("[Auth] Failed to delete session row:", err);
    }
  }
  event.cookie.delete(SESSION_COOKIE, { path: "/" });
}

/** Invalidates every session of a user (e.g. after a password change). */
export async function destroyAllSessionsForUser(event: RequestEventBase, userId: string): Promise<void> {
  try {
    await getDB(event).delete(sessions).where(eq(sessions.userId, userId));
  } catch (err) {
    console.error("[Auth] Failed to delete user sessions:", err);
  }
}

/** The authenticated user resolved by the auth middleware, if any. */
export function getSessionUser(event: RequestEventBase): AuthenticatedUser | null {
  return (event.sharedMap.get("user") as AuthenticatedUser | undefined) ?? null;
}

export function isAdmin(event: RequestEventBase): boolean {
  return getSessionUser(event)?.role === "admin";
}
