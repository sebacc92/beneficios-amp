import { $, component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { LuBell, LuBellOff } from "@qwikest/icons/lucide";

interface PushReply {
  error?: string;
  available?: boolean;
  publicKey?: string;
  subscribed?: boolean;
  sent?: boolean;
  expired?: boolean;
}

function pushErrorMessage(error: unknown, fallback: string) {
  if (error instanceof DOMException) {
    return error.name === "NotAllowedError"
      ? "El navegador no pudo autorizar los avisos. Revisá los permisos del sitio y las notificaciones del sistema."
      : "No pudimos conectar con el servicio de notificaciones del navegador. Volvé a intentarlo.";
  }
  if (error instanceof TypeError)
    return "No pudimos conectar. Revisá tu conexión y volvé a intentarlo.";
  return error instanceof Error ? error.message : fallback;
}

async function settings(
  action?: string,
  endpoint?: string,
): Promise<PushReply> {
  const response = await fetch(
    "/api/notifications/",
    action
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, endpoint }),
        }
      : { cache: "no-store" },
  );
  const data = (await response.json()) as PushReply;
  if (!response.ok)
    throw new Error(data.error || "No pudimos conectar las notificaciones.");
  return data;
}

interface NotificationPanelProps {
  /** Anchor other pages link to (e.g. /sorteos sends members to "#avisos-del-club"). */
  id?: string;
  class?: string;
}

export default component$<NotificationPanelProps>(({ id, class: extraClass = "" }) => {
  const checking = useSignal(true);
  const busy = useSignal(false);
  const enabled = useSignal(false);
  const available = useSignal(false);
  const publicKey = useSignal("");
  const message = useSignal("");

  // Inspect existing permission only. The permission prompt belongs to the button.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ cleanup }) => {
    let active = true;
    cleanup(() => {
      active = false;
    });
    try {
      if (
        !window.isSecureContext ||
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        message.value =
          "Este navegador no admite notificaciones. En iPhone, agregá el portal a la pantalla de inicio y abrilo desde allí.";
        return;
      }
      const config = await settings();
      if (!active) return;
      publicKey.value = config.publicKey || "";
      available.value = Boolean(config.available);
      if (!config.available) {
        message.value = "Las notificaciones todavía no están disponibles.";
        return;
      }
      if (Notification.permission === "denied") {
        message.value =
          "El navegador bloqueó los avisos. Podés habilitarlos desde los permisos de este sitio.";
        available.value = false;
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription && Notification.permission === "granted") {
        const state = await settings("status", subscription.endpoint);
        if (active) enabled.value = Boolean(state.subscribed);
      }
    } catch (error) {
      if (active)
        message.value = pushErrorMessage(
          error,
          "No pudimos comprobar las notificaciones.",
        );
    } finally {
      if (active) checking.value = false;
    }
  });

  const toggle = $(async () => {
    if (busy.value || checking.value) return;
    busy.value = true;
    message.value = "";
    let newSubscription: PushSubscription | undefined;
    try {
      if (enabled.value) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await settings("unsubscribe", subscription.endpoint);
          await subscription.unsubscribe();
        }
        enabled.value = false;
        message.value = "Notificaciones desactivadas en este dispositivo.";
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        message.value =
          permission === "denied"
            ? "El navegador bloqueó los avisos. Revisá los permisos de este sitio para habilitarlos."
            : "No se concedió el permiso. Podés volver a intentarlo cuando quieras.";
        if (permission === "denied") available.value = false;
        return;
      }
      await navigator.serviceWorker.register("/notifications-sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const raw = atob(
          publicKey.value.replaceAll("-", "+").replaceAll("_", "/"),
        );
        const key = Uint8Array.from(raw, (character) =>
          character.charCodeAt(0),
        );
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        });
        newSubscription = subscription;
      }
      const state = await settings("subscribe", subscription.endpoint);
      if (!state.subscribed)
        throw new Error(
          "No pudimos guardar la suscripción. Volvé a intentarlo.",
        );
      enabled.value = true;
      message.value =
        "Notificaciones activadas en este dispositivo. Podés enviar una prueba para comprobarlas.";
    } catch (error) {
      if (newSubscription)
        await newSubscription.unsubscribe().catch(() => undefined);
      message.value = pushErrorMessage(
        error,
        "No pudimos actualizar las notificaciones.",
      );
    } finally {
      busy.value = false;
    }
  });

  const test = $(async () => {
    busy.value = true;
    message.value = "";
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        enabled.value = false;
        throw new Error(
          "Volvé a activar las notificaciones en este dispositivo.",
        );
      }
      const response = await fetch("/api/notifications/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          endpoint: subscription.endpoint,
        }),
      });
      const result = (await response.json()) as PushReply;
      if (result.expired) {
        await subscription.unsubscribe();
        enabled.value = false;
      }
      if (!response.ok || !result.sent)
        throw new Error(result.error || "No pudimos enviar la prueba.");
      message.value =
        "Prueba enviada al servicio del navegador. Si no la ves, revisá los avisos del sistema o el modo No molestar.";
    } catch (error) {
      message.value = pushErrorMessage(error, "No pudimos enviar la prueba.");
    } finally {
      busy.value = false;
    }
  });

  return (
    <section
      id={id}
      class={`card scroll-mt-52 border-t-4 border-t-accent p-5 sm:p-6 ${extraClass}`}
      aria-labelledby="notifications-title"
    >
      <div class="flex items-start gap-3">
        {enabled.value ? (
          <LuBell class="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <LuBellOff class="mt-1 h-6 w-6 shrink-0 text-slate-500" aria-hidden="true" />
        )}
        <div>
          <h2 id="notifications-title" class="heading-display text-xl text-primary">
            Avisos del club
          </h2>
          <p class="mt-2 text-sm leading-relaxed text-slate-600">
            Activalos para recibir en este dispositivo los avisos que envíe el club. El permiso
            se pide recién al activar.
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled.value}
        disabled={checking.value || busy.value || !available.value}
        onClick$={toggle}
        class={["btn mt-5 w-full", enabled.value ? "btn-outline" : "btn-dark"]}
      >
        {checking.value
          ? "Comprobando…"
          : busy.value
            ? "Procesando…"
            : enabled.value
              ? "Desactivar avisos"
              : "Activar avisos"}
      </button>
      {enabled.value && (
        <button
          type="button"
          disabled={busy.value}
          onClick$={test}
          class="mt-2 min-h-11 w-full text-sm font-bold text-primary underline underline-offset-4 disabled:opacity-50"
        >
          Enviar un aviso de prueba
        </button>
      )}
      <p
        role="status"
        aria-live="polite"
        class="mt-3 text-xs leading-relaxed text-slate-600"
      >
        {message.value ||
          (enabled.value
            ? "Activados en este dispositivo."
            : "Desactivados en este dispositivo.")}
      </p>
    </section>
  );
});
