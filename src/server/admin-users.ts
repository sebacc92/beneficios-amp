import type { RequestEventBase } from "@builder.io/qwik-city";
import { and, count, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { pushSubscriptions, sessions, users } from "~/db/schema";
import { getSessionUser } from "~/server/auth";
import { hashPassword, verifyPassword } from "~/utils/crypto";

/** Only the current temporary credential may be replaced through the forced-change form. */
export async function changeTemporaryAdminPassword(event: RequestEventBase, password: string) {
  const user = getSessionUser(event);
  const denied = { ok: false as const, reason: "not_temporary" as const };
  if (user?.role !== "admin" || !user.mustChangePassword) return denied;

  const db = getDB(event);
  const temporaryAdmin = and(eq(users.id, user.id), eq(users.role, "admin"), eq(users.mustChangePassword, true));
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(temporaryAdmin).limit(1);
  if (!row) return denied;
  if ((await verifyPassword(password, row.passwordHash)).valid) {
    return { ok: false as const, reason: "same_password" as const };
  }

  // Hash before taking the write lock; another request may change the credential
  // during that work, so the UPDATE also checks the exact state that was read.
  const passwordHash = await hashPassword(password);
  return db.transaction(async (tx) => {
    const updated = await tx.update(users)
      .set({ passwordHash, mustChangePassword: false })
      .where(and(temporaryAdmin, eq(users.passwordHash, row.passwordHash)))
      .returning({ id: users.id });
    if (!updated.length) return denied;
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    return { ok: true as const };
  });
}

/** The libSQL write transaction serializes concurrent removals of administrators. */
export async function deleteAdministrator(event: RequestEventBase, userId: string) {
  const actor = getSessionUser(event);
  const unauthorized = { ok: false as const, status: 403, message: "No autorizado." };
  if (actor?.role !== "admin") return unauthorized;
  if (actor.id === userId) return { ok: false as const, status: 400, message: "No podés darte de baja a vos mismo." };

  return getDB(event).transaction(async (tx) => {
    // The request may have started just before another administrator removed its actor.
    const [currentActor] = await tx.select({ id: users.id }).from(users)
      .where(and(eq(users.id, actor.id), eq(users.role, "admin"))).limit(1);
    if (!currentActor) return unauthorized;
    const [{ total }] = await tx.select({ total: count() }).from(users).where(eq(users.role, "admin"));
    if (total <= 1) return { ok: false as const, status: 400, message: "Tiene que quedar al menos un administrador." };

    const [target] = await tx.select({ name: users.name }).from(users)
      .where(and(eq(users.id, userId), eq(users.role, "admin"))).limit(1);
    if (!target) return { ok: false as const, status: 404, message: "No se encontró ese administrador." };
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
    return { ok: true as const, name: target.name };
  });
}
