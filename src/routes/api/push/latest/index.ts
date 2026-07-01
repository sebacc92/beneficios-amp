import type { RequestHandler } from "@builder.io/qwik-city";
import { getLatestPushMessage } from "~/server/webpush";

// El Service Worker llama a este endpoint al recibir un push (sin payload)
// para obtener el contenido de la notificación a mostrar.
export const onGet: RequestHandler = async (event) => {
  try {
    const msg = await getLatestPushMessage(event);
    event.headers.set("Cache-Control", "no-store");
    event.json(200, msg ? { title: msg.title, body: msg.body, url: msg.url } : {});
  } catch (err) {
    console.error("[api/push/latest] error:", err);
    event.json(200, {});
  }
};
