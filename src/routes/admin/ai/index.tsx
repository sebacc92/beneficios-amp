import { component$, useSignal, $, useComputed$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, Link, useLocation, type DocumentHead } from "@builder.io/qwik-city";
import { LuCheckCircle, LuExternalLink, LuImage, LuMessageCircle, LuRotateCcw, LuSend, LuTrash2 } from "@qwikest/icons/lucide";
import { getSessions, deleteSession, getSettings, saveSettings, firstUserMessage, referredToWhatsapp } from "~/server/chatbotDb";
import { putImage } from "~/server/media";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { ActionFeedback } from "~/components/admin/action-feedback";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { SectionHeading } from "~/components/section-heading/section-heading";
import { ChatMessageContent } from "~/components/chatbot/chat-message-content";
import { CLUB, WHATSAPP_MESSAGES, whatsappLink } from "~/utils/club";
import { formatDateTime } from "~/utils/club-content";

const TABS = [
  { key: "conversaciones", label: "Conversaciones" },
  { key: "personalidad", label: "Personalidad" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function isTabKey(value: string | null): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

/** WhatsApp wants only digits with the country code: 5492216796537, never "+54 (0221) 15...". */
function whatsappNumberError(raw: string): string | null {
  const digits = raw.replace(/[\s()+-]/g, "");
  if (!/^[1-9]\d{9,14}$/.test(digits)) {
    return "Escribí solo números, con el código de país y sin 0 ni 15. Ej.: 5492216796537.";
  }
  if (digits.startsWith("54") && !digits.startsWith("549")) {
    return "Para un celular de Argentina, después del 54 va un 9 (ej.: 549 221…).";
  }
  return null;
}

// --- SECURITY & LOADERS ---

export const useChatSessions = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/admin/login/");
  }
  const [sessions, settings] = await Promise.all([getSessions(event), getSettings(event)]);
  const numbers = [settings.whatsappNumber, CLUB.whatsappNumber];
  return sessions.map((s) => ({
    id: s.id,
    title: firstUserMessage(s.messages),
    createdAt: s.createdAt,
    lastActive: s.lastActive,
    reviewedAt: s.reviewedAt ?? null,
    messageCount: s.messages.length,
    whatsapp: referredToWhatsapp(s.messages, numbers),
  }));
});

export const useSettingsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/admin/login/");
  }
  return await getSettings(event);
});

// --- ACTIONS ---

export const useDeleteChatAction = routeAction$(async (data, requestEvent) => {
  const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

  const id = data.id as string;
  if (!id) return requestEvent.fail(400, { message: "ID no proporcionado." });

  try {
    const success = await deleteSession(requestEvent, id);
    if (!success) return requestEvent.fail(404, { message: "Sesión no encontrada." });
    return { success: true };
  } catch (err) {
    console.error(err);
    return requestEvent.fail(500, { message: "Error interno." });
  }
});

export const useUpdateAiSettingsAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    const whatsappNumber = (data.whatsappNumber || "").replace(/[\s()+-]/g, "") || CLUB.whatsappNumber;
    const numberError = whatsappNumberError(whatsappNumber);
    if (numberError) {
      return requestEvent.fail(400, { message: "Revisá el número de WhatsApp.", whatsappError: numberError });
    }

    try {
      let uploadedImageUrl = data.aiAvatarUrl || null;

      uploadedImageUrl = await putImage(requestEvent, "ai-avatar", undefined, data.image) ?? uploadedImageUrl;

      const settings = await getSettings(requestEvent);
      const updatedSettings = {
        ...settings,
        aiEnabled: data.aiEnabled === "on",
        aiTone: data.aiTone || "",
        aiInstructions: data.aiInstructions || "",
        aiKnowledge: data.aiKnowledge || "",
        aiInitialGreeting: data.aiInitialGreeting || "",
        aiCallToAction: data.aiCallToAction || "",
        whatsappNumber,
        aiAvatarUrl: uploadedImageUrl,
        updatedAt: new Date().toISOString(),
      };

      await saveSettings(requestEvent, updatedSettings);
      return { success: true };
    } catch (e: any) {
      console.error(e);
      return requestEvent.fail(500, { message: e.message || "Error al guardar." });
    }
  },
  zod$({
    aiEnabled: z.string().optional(),
    aiTone: z.string().optional(),
    aiInstructions: z.string().optional(),
    aiKnowledge: z.string().optional(),
    aiInitialGreeting: z.string().optional(),
    aiCallToAction: z.string().optional(),
    whatsappNumber: z.string().optional(),
    aiAvatarUrl: z.string().optional(),
    image: z.any().optional(),
  })
);

interface TestMessage {
  role: "user" | "assistant";
  content: string;
}

/** Talks to /api/chat with the form as it is now, so the admin can try changes before saving them. */
const TestChat = component$<{ form: { value: HTMLFormElement | undefined } }>(({ form }) => {
  const messages = useSignal<TestMessage[]>([]);
  const input = useSignal("");
  const loading = useSignal(false);
  const error = useSignal("");

  const send = $(async () => {
    const text = input.value.trim();
    if (!text || loading.value) return;
    const data = form.value ? new FormData(form.value) : new FormData();
    const field = (name: string) => String(data.get(name) ?? "");
    const history: TestMessage[] = [...messages.value, { role: "user", content: text }];
    messages.value = history;
    input.value = "";
    error.value = "";
    loading.value = true;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-8),
          preview: {
            aiTone: field("aiTone"),
            aiInstructions: field("aiInstructions"),
            aiKnowledge: field("aiKnowledge"),
            aiCallToAction: field("aiCallToAction"),
            whatsappNumber: field("whatsappNumber").replace(/[\s()+-]/g, ""),
          },
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { reply?: TestMessage; error?: string };
      if (response.ok && result.reply) {
        messages.value = [...history, { role: "assistant", content: result.reply.content }];
      } else {
        error.value = result.error || "El servidor no devolvió una respuesta.";
      }
    } catch {
      error.value = "No hubo conexión con el servidor. Revisá tu conexión e intentá de nuevo.";
    } finally {
      loading.value = false;
    }
  });

  return (
    <section aria-labelledby="test-chat-title" class="card flex flex-col xl:sticky xl:top-4">
      <div class="border-b-4 border-accent bg-primary px-5 py-4 text-white">
        <h2 id="test-chat-title" class="font-display text-lg font-semibold uppercase tracking-wide">Probar el asistente</h2>
        <p class="text-xs text-white/80">Usa lo que está escrito en el formulario, aunque no lo hayas guardado. Estas pruebas no quedan en Conversaciones.</p>
      </div>
      <div role="log" aria-live="polite" aria-label="Conversación de prueba" class="min-h-64 max-h-[28rem] flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {messages.value.length === 0 && !error.value && (
          <p class="text-sm text-slate-600">Escribí una pregunta como la haría un socio. Por ejemplo: “¿Qué descuentos hay en gimnasios?”.</p>
        )}
        {messages.value.map((message, index) => (
          <div key={index} class={["flex", message.role === "user" ? "justify-end" : "justify-start"]}>
            <div
              class={[
                "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed break-words",
                message.role === "user" ? "bg-primary text-white whitespace-pre-wrap" : "border border-slate-200 border-l-4 border-l-accent bg-white text-slate-800",
              ]}
            >
              {message.role === "user" ? message.content : <ChatMessageContent content={message.content} />}
            </div>
          </div>
        ))}
        {loading.value && <p class="text-sm text-slate-600">El asistente está escribiendo…</p>}
        {error.value && (
          <div role="alert" class="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p class="font-semibold">No se pudo probar el asistente.</p>
            <p>{error.value}</p>
          </div>
        )}
      </div>
      <form preventdefault:submit onSubmit$={send} class="flex gap-2 border-t border-slate-200 bg-white p-3">
        <label for="test-chat-input" class="sr-only">Pregunta de prueba</label>
        <input id="test-chat-input" type="text" bind:value={input} maxLength={1500} placeholder="Escribí una pregunta de prueba..." class="field min-w-0 flex-1 text-base sm:text-sm" />
        <button type="submit" disabled={!input.value.trim() || loading.value} class="btn btn-primary px-4" aria-label="Enviar pregunta de prueba">
          <LuSend class="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick$={() => {
            messages.value = [];
            error.value = "";
          }}
          disabled={loading.value || (messages.value.length === 0 && !error.value)}
          class="btn btn-outline px-4"
          aria-label="Reiniciar la prueba"
          title="Reiniciar la prueba"
        >
          <LuRotateCcw class="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
});

export default component$(() => {
  const location = useLocation();
  const sessionsLoader = useChatSessions();
  const deleteAction = useDeleteChatAction();
  const settings = useSettingsLoader();
  const aiSettingsAction = useUpdateAiSettingsAction();

  const requestedTab = location.url.searchParams.get("tab");
  const activeTab = useSignal<TabKey>(isTabKey(requestedTab) ? requestedTab : "conversaciones");
  const formRef = useSignal<HTMLFormElement>();

  const isDeleteOpen = useSignal(false);
  const deleteTarget = useSignal<{ id: string; title: string; messageCount: number } | null>(null);
  const deleteError = useSignal("");

  const selectTab = $((key: TabKey, focus = false) => {
    activeTab.value = key;
    // The tab lives in the URL so a reload or a shared link opens the same view.
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(window.history.state, "", url);
    if (focus) document.getElementById(`ai-tab-${key}`)?.focus();
  });

  const confirmDeleteChat$ = $(async () => {
    if (!deleteTarget.value) return;
    const { value } = await deleteAction.submit({ id: deleteTarget.value.id });
    if (value.failed) {
      deleteError.value = value.message || "No se pudo eliminar la conversación. Intentá de nuevo.";
      return;
    }
    isDeleteOpen.value = false;
  });

  // AI settings state
  const s = settings.value;
  const avatarUrl = useSignal(s.aiAvatarUrl || "");
  const previewUrl = useSignal<string | null>(null);
  const whatsappNumber = useSignal(s.whatsappNumber || CLUB.whatsappNumber);
  const whatsappDigits = useComputed$(() => whatsappNumber.value.replace(/[\s()+-]/g, ""));
  const whatsappClientError = useComputed$(() => whatsappNumberError(whatsappDigits.value));

  const handleFileChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const file = element.files[0];
    previewUrl.value = URL.createObjectURL(file);
    avatarUrl.value = "";
  });

  const sessions = sessionsLoader.value;
  const pendingReview = sessions.filter((session) => !session.reviewedAt).length;
  const referred = sessions.filter((session) => session.whatsapp).length;
  const saveFailure = aiSettingsAction.value?.failed ? (aiSettingsAction.value as { message?: string; whatsappError?: string }) : undefined;
  const whatsappError = saveFailure?.whatsappError ?? (whatsappDigits.value ? whatsappClientError.value : null);

  const fieldHelp = "mt-1.5 text-xs text-slate-600";

  return (
    <div class="w-full px-4 sm:px-10 py-8 sm:py-10 space-y-6 pb-24 font-sans text-slate-800 flex flex-col flex-1">
      <SectionHeading as="h1" eyebrow="Administración" title="Asistente IA" size="md">
        <p class="mt-3 max-w-2xl text-sm text-slate-600">
          Revisá qué le preguntan al asistente del portal y ajustá cómo responde. Podés probar los cambios antes de guardarlos.
        </p>
      </SectionHeading>

      <div
        role="tablist"
        aria-label="Secciones del asistente"
        class="flex gap-x-1 overflow-x-auto border-b border-slate-200 sm:gap-x-2"
        onKeyDown$={(event) => {
          const index = TABS.findIndex((tab) => tab.key === activeTab.value);
          const next =
            event.key === "ArrowRight" ? (index + 1) % TABS.length
            : event.key === "ArrowLeft" ? (index - 1 + TABS.length) % TABS.length
            : event.key === "Home" ? 0
            : event.key === "End" ? TABS.length - 1
            : -1;
          if (next >= 0) selectTab(TABS[next].key, true);
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            id={`ai-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={activeTab.value === tab.key}
            aria-controls={`ai-panel-${tab.key}`}
            tabIndex={activeTab.value === tab.key ? 0 : -1}
            onClick$={() => selectTab(tab.key)}
            class={[
              "-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-4 px-2 sm:px-4 text-xs sm:text-sm font-bold uppercase tracking-wide transition-colors cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary",
              activeTab.value === tab.key ? "border-accent text-primary" : "border-transparent text-slate-600 hover:text-primary",
            ]}
          >
            {tab.label}
            {tab.key === "conversaciones" && pendingReview > 0 && (
              <span class="badge badge-dark">{pendingReview}<span class="sr-only"> sin revisar</span></span>
            )}
          </button>
        ))}
      </div>

      {/* --- CONVERSACIONES --- */}
      <div id="ai-panel-conversaciones" role="tabpanel" aria-labelledby="ai-tab-conversaciones" hidden={activeTab.value !== "conversaciones"} class="space-y-5">
        <p class="text-sm text-slate-600">
          {sessions.length === 0
            ? "Todavía nadie usó el asistente."
            : `${sessions.length} ${sessions.length === 1 ? "conversación" : "conversaciones"} · ${pendingReview} sin revisar · ${referred} ${referred === 1 ? "derivó" : "derivaron"} a WhatsApp. Las más recientes, arriba.`}
        </p>

        <ActionFeedback value={deleteAction.value} success="Conversación eliminada." />

        {sessions.length === 0 ? (
          <div class="card border-dashed p-10 text-center text-sm text-slate-600">
            Cuando alguien le escriba al asistente desde el portal, la conversación aparece acá.
          </div>
        ) : (
          <ul class="card divide-y divide-slate-200">
            {sessions.map((session) => (
              <li key={session.id} class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div class="min-w-0 space-y-1.5">
                  <Link href={`/admin/chats/${session.id}/`} class="block font-semibold text-primary underline-offset-4 hover:underline">
                    <span class="line-clamp-2 break-words">{session.title ? `“${session.title}”` : "Conversación sin preguntas"}</span>
                  </Link>
                  <p class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
                    <time dateTime={session.lastActive}>{formatDateTime(session.lastActive)} hs</time>
                    <span>{session.messageCount} {session.messageCount === 1 ? "mensaje" : "mensajes"}</span>
                    {session.whatsapp && (
                      <span class="badge badge-muted">
                        <LuMessageCircle class="h-3.5 w-3.5" aria-hidden="true" />
                        Derivó a WhatsApp
                      </span>
                    )}
                    {session.reviewedAt ? (
                      <span class="badge bg-emerald-50 text-emerald-800">
                        <LuCheckCircle class="h-3.5 w-3.5" aria-hidden="true" />
                        Revisada
                      </span>
                    ) : (
                      <span class="badge badge-accent">Sin revisar</span>
                    )}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <Link href={`/admin/chats/${session.id}/`} class="btn btn-sm btn-outline">
                    Ver conversación
                  </Link>
                  <button
                    type="button"
                    onClick$={() => {
                      deleteTarget.value = { id: session.id, title: session.title ?? "", messageCount: session.messageCount };
                      deleteError.value = "";
                      isDeleteOpen.value = true;
                    }}
                    aria-label={`Eliminar la conversación ${session.title ? `“${session.title.slice(0, 60)}”` : session.id}`}
                    title="Eliminar conversación"
                    class="flex h-11 w-11 items-center justify-center text-red-700 hover:bg-red-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-red-700"
                  >
                    <LuTrash2 class="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --- PERSONALIDAD --- */}
      <div id="ai-panel-personalidad" role="tabpanel" aria-labelledby="ai-tab-personalidad" hidden={activeTab.value !== "personalidad"} class="space-y-5">
        <ActionFeedback value={aiSettingsAction.value} success="Ajustes del asistente guardados." />

        <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <Form ref={formRef} action={aiSettingsAction} enctype="multipart/form-data" class="card divide-y divide-slate-200">
            <input type="hidden" name="aiAvatarUrl" value={avatarUrl.value} />

            <div class="flex items-center justify-between gap-4 p-5 sm:p-6">
              <div>
                <label for="ai-enabled" class="block text-sm font-bold uppercase tracking-wide text-primary">Asistente activo</label>
                <p id="ai-enabled-help" class={fieldHelp}>Si lo apagás, el botón del asistente deja de aparecer en el portal. Igual podés probarlo desde acá.</p>
              </div>
              <label class="relative inline-flex shrink-0 cursor-pointer items-center">
                <input
                  id="ai-enabled"
                  type="checkbox"
                  role="switch"
                  name="aiEnabled"
                  checked={s.aiEnabled}
                  aria-describedby="ai-enabled-help"
                  class="sr-only peer"
                />
                <span aria-hidden="true" class="w-11 h-6 bg-slate-300 rounded-full peer peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></span>
              </label>
            </div>

            <div class="grid gap-6 p-5 sm:p-6 md:grid-cols-2">
              <div>
                <span id="ai-avatar-label" class="field-label">Imagen del asistente</span>
                <div class="flex items-center gap-4">
                  <div class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-primary">
                    <img
                      src={previewUrl.value || avatarUrl.value || "/lprc.avif"}
                      alt={previewUrl.value || avatarUrl.value ? "Imagen actual del asistente" : "Escudo del club (imagen por defecto)"}
                      width={56}
                      height={56}
                      class="h-full w-full object-contain"
                    />
                  </div>
                  <label for="ai-avatar" class="btn btn-sm btn-outline whitespace-nowrap">
                    <LuImage class="h-4 w-4" aria-hidden="true" />
                    Subir imagen
                  </label>
                  <input id="ai-avatar" type="file" name="image" accept="image/*" aria-labelledby="ai-avatar-label" onChange$={handleFileChange} class="sr-only" />
                </div>
                <p class={fieldHelp}>Si no subís una, se usa el escudo del club.</p>
              </div>

              <div>
                <label for="ai-whatsapp" class="field-label">WhatsApp de consulta</label>
                <input
                  id="ai-whatsapp"
                  type="text"
                  name="whatsappNumber"
                  inputMode="numeric"
                  autoComplete="off"
                  bind:value={whatsappNumber}
                  placeholder={CLUB.whatsappNumber}
                  aria-invalid={whatsappError ? "true" : undefined}
                  aria-describedby={whatsappError ? "ai-whatsapp-help ai-whatsapp-error" : "ai-whatsapp-help"}
                  class="field text-base sm:text-sm"
                />
                <p id="ai-whatsapp-help" class={fieldHelp}>
                  El asistente lo ofrece cuando no puede resolver una consulta. Solo números, con código de país. El del club es <span class="whitespace-nowrap">{CLUB.whatsappDisplay}</span>.
                </p>
                {whatsappError && <p id="ai-whatsapp-error" class="mt-1.5 text-xs font-semibold text-red-700">{whatsappError}</p>}
                <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {!whatsappError && whatsappDigits.value && (
                    <a
                      href={whatsappLink(WHATSAPP_MESSAGES.consulta, whatsappDigits.value)}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline decoration-accent decoration-2 underline-offset-4"
                    >
                      <LuExternalLink class="h-4 w-4" aria-hidden="true" />
                      Probar el link de WhatsApp<span class="sr-only"> (se abre en otra pestaña)</span>
                    </a>
                  )}
                  {whatsappDigits.value !== CLUB.whatsappNumber && (
                    <button type="button" onClick$={() => (whatsappNumber.value = CLUB.whatsappNumber)} class="min-h-11 text-sm font-semibold text-primary underline underline-offset-4 cursor-pointer">
                      Usar el del club
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div class="space-y-6 p-5 sm:p-6">
              <div>
                <label for="ai-tone" class="field-label">Tono</label>
                <input
                  id="ai-tone"
                  type="text"
                  name="aiTone"
                  value={s.aiTone || ""}
                  placeholder="Ej.: Cercano y claro, con voseo, como alguien del club."
                  aria-describedby="ai-tone-help"
                  class="field text-base sm:text-sm"
                />
                <p id="ai-tone-help" class={fieldHelp}>Cómo habla: una frase corta alcanza.</p>
              </div>

              <div>
                <label for="ai-instructions" class="field-label">Instrucciones</label>
                <textarea
                  id="ai-instructions"
                  name="aiInstructions"
                  rows={5}
                  value={s.aiInstructions || ""}
                  placeholder={"1. Respondé corto y en español rioplatense.\n2. Si no sabés algo, no lo inventes: ofrecé el WhatsApp del club."}
                  aria-describedby="ai-instructions-help"
                  class="field text-base sm:text-sm"
                />
                <p id="ai-instructions-help" class={fieldHelp}>Reglas que siempre tiene que seguir. Una por línea, numeradas si querés.</p>
              </div>

              <div>
                <label for="ai-knowledge" class="field-label">Base de conocimientos</label>
                <textarea
                  id="ai-knowledge"
                  name="aiKnowledge"
                  rows={8}
                  value={s.aiKnowledge || ""}
                  placeholder={"- Cómo se usa un beneficio: ...\n- Horarios de la secretaría: ...\n- P: ¿Puedo usar el cupón dos veces? R: ..."}
                  aria-describedby="ai-knowledge-help"
                  class="field text-base sm:text-sm"
                />
                <p id="ai-knowledge-help" class={fieldHelp}>
                  Datos del club y respuestas que tiene que saber. El catálogo de beneficios ya lo recibe solo. Desde una conversación podés copiar una respuesta acá con “Copiar a la base de conocimientos”.
                </p>
              </div>

              <div class="grid gap-6 md:grid-cols-2">
                <div>
                  <label for="ai-greeting" class="field-label">Saludo inicial</label>
                  <textarea
                    id="ai-greeting"
                    name="aiInitialGreeting"
                    rows={3}
                    value={s.aiInitialGreeting || ""}
                    placeholder="¡Hola! Soy el asistente del Club de Beneficios de La Plata Rugby Club. ¿En qué te ayudo?"
                    aria-describedby="ai-greeting-help"
                    class="field text-base sm:text-sm"
                  />
                  <p id="ai-greeting-help" class={fieldHelp}>Lo primero que ve la persona al abrir el chat.</p>
                </div>

                <div>
                  <label for="ai-cta" class="field-label">Cierre con WhatsApp</label>
                  <textarea
                    id="ai-cta"
                    name="aiCallToAction"
                    rows={3}
                    value={s.aiCallToAction || ""}
                    placeholder="Si necesitás algo más, escribinos al WhatsApp del club:"
                    aria-describedby="ai-cta-help"
                    class="field text-base sm:text-sm"
                  />
                  <p id="ai-cta-help" class={fieldHelp}>Frase que usa para derivar a WhatsApp; el número se agrega al final.</p>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-end gap-3 bg-slate-50 p-5 sm:px-6">
              {saveFailure?.message && <p role="alert" class="text-sm font-semibold text-red-700">{saveFailure.message}</p>}
              <button type="submit" disabled={aiSettingsAction.isRunning} class="btn btn-primary">
                {aiSettingsAction.isRunning ? "Guardando..." : "Guardar ajustes"}
              </button>
            </div>
          </Form>

          <TestChat form={formRef} />
        </div>
      </div>

      <ConfirmDialog
        open={isDeleteOpen}
        title="Eliminar conversación"
        confirmLabel="Eliminar conversación"
        pending={deleteAction.isRunning}
        error={deleteError.value}
        onConfirm$={confirmDeleteChat$}
      >
        <p>
          Se borrará {deleteTarget.value?.title ? `la conversación “${deleteTarget.value.title.slice(0, 80)}”` : "esta conversación"} (
          {deleteTarget.value?.messageCount ?? 0} {deleteTarget.value?.messageCount === 1 ? "mensaje" : "mensajes"}). No se puede deshacer.
        </p>
      </ConfirmDialog>
    </div>
  );
});

export const head: DocumentHead = {
  title: "LPRC Club - Asistente IA",
  meta: [
    {
      name: "description",
      content: "Configuración de la personalidad del chatbot de inteligencia artificial y auditoría de chats.",
    },
  ],
};
