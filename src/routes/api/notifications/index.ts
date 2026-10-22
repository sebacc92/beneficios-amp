import type { RequestHandler } from "@builder.io/qwik-city";
import { and, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { pushSubscriptions } from "~/db/schema";
import { getSessionUser } from "~/server/auth";
import { rateLimit } from "~/server/rate-limit";
import { createVapidAuthorization, validPushEndpoint } from "~/server/web-push";

export const onGet: RequestHandler = (event) => {
  event.headers.set("Cache-Control", "private, no-store");
  if (!getSessionUser(event)) {
    event.json(401, {
      error: "Iniciá sesión para configurar las notificaciones.",
    });
    return;
  }
  const publicKey = event.env.get("PUBLIC_VAPID_KEY");
  event.json(200, {
    available: Boolean(publicKey && event.env.get("PRIVATE_VAPID_KEY")),
    publicKey: publicKey || null,
  });
};

async function boundedBody(request: Request): Promise<unknown> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 4096) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    chunks.push(part.value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

export const onPost: RequestHandler = async (event) => {
  event.headers.set("Cache-Control", "private, no-store");
  const user = getSessionUser(event);
  if (!user) {
    event.json(401, { error: "Tu sesión expiró. Volvé a ingresar." });
    return;
  }
  if (
    event.request.headers.get("Origin") !== event.url.origin ||
    !event.request.headers.get("Content-Type")?.startsWith("application/json")
  ) {
    event.json(403, { error: "Petición no permitida." });
    return;
  }
  const limit = rateLimit(`push-settings:${user.id}`, 40, 60 * 1000);
  if (!limit.allowed) {
    event.json(429, { error: "Esperá un momento antes de volver a intentar." });
    return;
  }
  let body: unknown;
  try {
    body = await boundedBody(event.request);
  } catch {
    event.json(400, { error: "Petición inválida." });
    return;
  }
  if (!body || typeof body !== "object") {
    event.json(400, { error: "Petición inválida." });
    return;
  }
  const { action, endpoint } = body as { action?: unknown; endpoint?: unknown };
  if (
    typeof action !== "string" ||
    !["status", "subscribe", "unsubscribe", "test"].includes(action) ||
    !validPushEndpoint(endpoint)
  ) {
    event.json(400, { error: "La suscripción del navegador no es válida." });
    return;
  }
  const db = getDB(event);
  const owned = and(
    eq(pushSubscriptions.userId, user.id),
    eq(pushSubscriptions.endpoint, endpoint),
  );
  try {
    if (action === "status") {
      const [row] = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(owned)
        .limit(1);
      event.json(200, { subscribed: Boolean(row) });
      return;
    }
    if (action === "unsubscribe") {
      await db.delete(pushSubscriptions).where(owned);
      event.json(200, { subscribed: false });
      return;
    }
    const privateKey = event.env.get("PRIVATE_VAPID_KEY");
    const publicKey = event.env.get("PUBLIC_VAPID_KEY");
    if (!privateKey || !publicKey) {
      event.json(503, {
        error: "Las notificaciones todavía no están disponibles.",
      });
      return;
    }
    if (action === "subscribe") {
      const now = new Date().toISOString();
      const saved = await db
        .insert(pushSubscriptions)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          endpoint,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: { updatedAt: now },
          setWhere: eq(pushSubscriptions.userId, user.id),
        })
        .returning({ id: pushSubscriptions.id });
      if (!saved.length) {
        event.json(409, {
          error:
            "Este navegador tiene avisos de otra cuenta. Desactivalos desde esa cuenta antes de activarlos aquí.",
        });
        return;
      }
      event.json(200, { subscribed: true });
      return;
    }
    const [subscription] = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(owned)
      .limit(1);
    if (!subscription) {
      event.json(404, {
        error: "Activá las notificaciones en este dispositivo primero.",
      });
      return;
    }
    const testLimit = rateLimit(`push-test:${user.id}`, 3, 60 * 60 * 1000);
    if (!testLimit.allowed) {
      event.json(429, {
        error: "Ya enviaste las pruebas disponibles. Probá de nuevo más tarde.",
      });
      return;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: await createVapidAuthorization(
          endpoint,
          privateKey,
          publicKey,
        ),
        TTL: "60",
        Urgency: "normal",
      },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 404 || response.status === 410) {
      await db.delete(pushSubscriptions).where(owned);
      event.json(410, {
        error:
          "Esta suscripción venció. Desactivá y volvé a activar las notificaciones.",
        expired: true,
      });
      return;
    }
    if (!response.ok) {
      event.json(502, {
        error: "No pudimos entregar la prueba. Intentá de nuevo más tarde.",
      });
      return;
    }
    event.json(200, { sent: true });
  } catch {
    event.json(500, {
      error: "No pudimos actualizar tus notificaciones. Intentá de nuevo.",
    });
  }
};
