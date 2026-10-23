import { component$, useSignal, $ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  Link,
  z,
  zod$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { LuArrowLeft, LuBookPlus, LuCheckCircle, LuChevronLeft, LuChevronRight, LuMessageCircle } from "@qwikest/icons/lucide";
import {
  appendToKnowledge,
  deleteSession,
  firstUserMessage,
  getSessionById,
  getSessionNeighbors,
  getSettings,
  referredToWhatsapp,
  setSessionReviewed,
} from "~/server/chatbotDb";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { ActionFeedback } from "~/components/admin/action-feedback";
import { SectionHeading } from "~/components/section-heading/section-heading";
import { ChatMessageContent } from "~/components/chatbot/chat-message-content";
import { CLUB } from "~/utils/club";
import { CLUB_TIME_ZONE, buenosAiresDay, formatDateTime } from "~/utils/club-content";

const MAX_KNOWLEDGE_ENTRY = 2000;

function requireAdmin(event: { sharedMap: Map<string, unknown> }) {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  return user?.role === "admin" ? user : null;
}

// Loader to fetch session details and complete chat logs
export const useSessionDetails = routeLoader$(async (event) => {
  if (!requireAdmin(event)) {
    throw event.redirect(302, "/admin/login/");
  }

  const session = await getSessionById(event, event.params.id);
  if (!session) {
    event.status(404);
    return null;
  }
  const [neighbors, settings] = await Promise.all([getSessionNeighbors(event, session.id), getSettings(event)]);
  return {
    ...session,
    reviewedAt: session.reviewedAt ?? null,
    title: firstUserMessage(session.messages),
    whatsapp: referredToWhatsapp(session.messages, [settings.whatsappNumber, CLUB.whatsappNumber]),
    neighbors,
  };
});

// Delete action for inside the details page
export const useDeleteSessionDetailsAction = routeAction$(async (data, requestEvent) => {
  if (!requireAdmin(requestEvent)) return requestEvent.fail(403, { message: "No autorizado." });

  const id = data.id as string;
  if (!id) return requestEvent.fail(400, { message: "ID no proporcionado." });

  try {
    const success = await deleteSession(requestEvent, id);
    if (!success) {
      return requestEvent.fail(404, { message: "Sesión no encontrada." });
    }
    return { success: true };
  } catch (err) {
    console.error("Error deleting session details:", err);
    return requestEvent.fail(500, { message: "Error interno al eliminar la sesión." });
  }
});

export const useReviewSessionAction = routeAction$(
  async (data, requestEvent) => {
    if (!requireAdmin(requestEvent)) return requestEvent.fail(403, { message: "No autorizado." });
    try {
      const reviewed = data.reviewed === "1";
      if (!(await setSessionReviewed(requestEvent, data.id, reviewed))) {
        return requestEvent.fail(404, { message: "La conversación ya no existe." });
      }
      return { success: true, message: reviewed ? "Conversación marcada como revisada." : "Se quitó la marca de revisada." };
    } catch (err) {
      console.error("Error marking session reviewed:", err);
      return requestEvent.fail(500, { message: "No se pudo actualizar la conversación. Intentá de nuevo." });
    }
  },
  zod$({ id: z.string(), reviewed: z.enum(["0", "1"]) }),
);

export const useCopyToKnowledgeAction = routeAction$(
  async (data, requestEvent) => {
    if (!requireAdmin(requestEvent)) return requestEvent.fail(403, { message: "No autorizado." });
    try {
      await appendToKnowledge(requestEvent, data.entry);
      return { success: true, messageId: data.messageId };
    } catch (err) {
      console.error("Error appending to the AI knowledge base:", err);
      return requestEvent.fail(500, { message: "No se pudo agregar a la base de conocimientos. Intentá de nuevo.", messageId: data.messageId });
    }
  },
  zod$({
    messageId: z.string(),
    entry: z.string().trim().min(10, "Escribí la pregunta y la respuesta que querés agregar.").max(MAX_KNOWLEDGE_ENTRY, `Hasta ${MAX_KNOWLEDGE_ENTRY} caracteres.`),
  }),
);

const dayFormatter = new Intl.DateTimeFormat("es-AR", { timeZone: CLUB_TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("es-AR", { timeZone: CLUB_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function formatDay(iso: string): string {
  const label = dayFormatter.format(new Date(iso));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** The entry a reply becomes in the knowledge base: the question it answered and the answer, editable before saving. */
function knowledgeEntry(question: string | undefined, answer: string): string {
  const oneLine = (text: string) => text.replace(/\s*\n+\s*/g, " ").trim();
  return question ? `- P: ${oneLine(question)}\n  R: ${oneLine(answer)}` : `- ${oneLine(answer)}`;
}

export default component$(() => {
  const sessionLoader = useSessionDetails();
  const deleteAction = useDeleteSessionDetailsAction();
  const reviewAction = useReviewSessionAction();
  const copyAction = useCopyToKnowledgeAction();
  const isDeleteOpen = useSignal(false);
  const deleteError = useSignal("");
  const copyingId = useSignal<string | null>(null);

  const confirmDelete$ = $(async () => {
    if (!sessionLoader.value) return;
    const { value } = await deleteAction.submit({ id: sessionLoader.value.id });
    if (value.failed) {
      deleteError.value = value.message || "No se pudo eliminar la conversación. Intentá de nuevo.";
      return;
    }
    isDeleteOpen.value = false;
  });

  const backLink = (
    <Link href="/admin/ai/?tab=conversaciones" class="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline">
      <LuArrowLeft class="h-4 w-4" aria-hidden="true" />
      Volver a Conversaciones
    </Link>
  );

  if (!sessionLoader.value) {
    return (
      <div class="w-full px-4 sm:px-10 py-8 sm:py-10 space-y-6 font-sans">
        <SectionHeading as="h1" eyebrow="Asistente IA" title="Conversación no encontrada" size="md">
          <p class="mt-3 text-sm text-slate-600">La conversación que buscás no existe o ya fue eliminada.</p>
        </SectionHeading>
        {backLink}
      </div>
    );
  }

  const s = sessionLoader.value;
  const { neighbors } = s;
  let lastDay = "";
  let lastQuestion: string | undefined;

  return (
    <div class="w-full px-4 sm:px-10 py-8 sm:py-10 space-y-6 pb-24 font-sans text-slate-800">
      <nav aria-label="Conversaciones" class="flex flex-wrap items-center justify-between gap-3">
        {backLink}
        {neighbors.total > 1 && neighbors.position > 0 && (
          <div class="flex items-center gap-2">
            {neighbors.newerId ? (
              <Link href={`/admin/chats/${neighbors.newerId}/`} class="btn btn-sm btn-outline" aria-label="Conversación anterior (más reciente)">
                <LuChevronLeft class="h-4 w-4" aria-hidden="true" />
                Anterior
              </Link>
            ) : (
              <span class="btn btn-sm btn-outline" aria-disabled="true">
                <LuChevronLeft class="h-4 w-4" aria-hidden="true" />
                Anterior
              </span>
            )}
            <span class="px-1 text-sm text-slate-600">{neighbors.position} de {neighbors.total}</span>
            {neighbors.olderId ? (
              <Link href={`/admin/chats/${neighbors.olderId}/`} class="btn btn-sm btn-outline" aria-label="Conversación siguiente (más antigua)">
                Siguiente
                <LuChevronRight class="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <span class="btn btn-sm btn-outline" aria-disabled="true">
                Siguiente
                <LuChevronRight class="h-4 w-4" aria-hidden="true" />
              </span>
            )}
          </div>
        )}
      </nav>

      <ConfirmDialog
        open={isDeleteOpen}
        title="Eliminar conversación"
        confirmLabel="Eliminar conversación"
        pending={deleteAction.isRunning}
        error={deleteError.value}
        onConfirm$={confirmDelete$}
      >
        <p>La conversación se borrará de la auditoría de forma permanente. No se puede deshacer.</p>
      </ConfirmDialog>

      {deleteAction.value?.success ? (
        <div role="status" class="card border-l-4 border-l-primary p-6 space-y-3">
          <h1 class="heading-display text-2xl text-primary">Conversación eliminada</h1>
          <p class="text-sm text-slate-600">Ya no aparece en la auditoría.</p>
          <div class="flex flex-wrap gap-3">
            <Link href="/admin/ai/?tab=conversaciones" class="btn btn-sm btn-dark">Volver a Conversaciones</Link>
            {neighbors.olderId && <Link href={`/admin/chats/${neighbors.olderId}/`} class="btn btn-sm btn-outline">Ver la siguiente</Link>}
          </div>
        </div>
      ) : (
        <>
          <SectionHeading as="h1" eyebrow="Asistente IA · Conversación" title={s.title ? "Consulta al asistente" : "Conversación sin preguntas"} size="md">
            {s.title && <p class="mt-4 max-w-3xl border-l-4 border-accent bg-white px-4 py-3 text-base font-semibold text-primary break-words">“{s.title}”</p>}
          </SectionHeading>

          <section aria-label="Datos de la conversación" class="card flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <dl class="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <div>
                <dt class="text-xs font-bold uppercase tracking-wide text-slate-600">Inicio</dt>
                <dd class="font-semibold text-slate-800">{formatDateTime(s.createdAt)} hs</dd>
              </div>
              <div>
                <dt class="text-xs font-bold uppercase tracking-wide text-slate-600">Último mensaje</dt>
                <dd class="font-semibold text-slate-800">{formatDateTime(s.lastActive)} hs</dd>
              </div>
              <div>
                <dt class="text-xs font-bold uppercase tracking-wide text-slate-600">Mensajes</dt>
                <dd class="font-semibold text-slate-800">{s.messages.length}</dd>
              </div>
              <div>
                <dt class="text-xs font-bold uppercase tracking-wide text-slate-600">Estado</dt>
                <dd class="flex flex-wrap gap-1.5 pt-0.5">
                  {s.reviewedAt ? (
                    <span class="badge bg-emerald-50 text-emerald-800" title={`Revisada el ${formatDateTime(s.reviewedAt)} hs`}>
                      <LuCheckCircle class="h-3.5 w-3.5" aria-hidden="true" />
                      Revisada
                    </span>
                  ) : (
                    <span class="badge badge-accent">Sin revisar</span>
                  )}
                  {s.whatsapp && (
                    <span class="badge badge-muted">
                      <LuMessageCircle class="h-3.5 w-3.5" aria-hidden="true" />
                      Derivó a WhatsApp
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            <div class="flex flex-wrap gap-2 lg:shrink-0">
              <Form action={reviewAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="reviewed" value={s.reviewedAt ? "0" : "1"} />
                <button type="submit" disabled={reviewAction.isRunning} class={["btn btn-sm", s.reviewedAt ? "btn-outline" : "btn-dark"]}>
                  {s.reviewedAt ? "Quitar marca de revisada" : "Marcar revisada"}
                </button>
              </Form>
              <button
                type="button"
                onClick$={() => {
                  deleteError.value = "";
                  isDeleteOpen.value = true;
                }}
                class="btn btn-sm border-red-700 bg-white text-red-700 hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          </section>

          <ActionFeedback value={reviewAction.value} success={reviewAction.value?.success ? reviewAction.value.message : undefined} />

          <section aria-label="Mensajes" class="card overflow-hidden">
            <div class="border-b-4 border-accent bg-primary px-5 py-3">
              <h2 class="font-display text-base font-semibold uppercase tracking-wide text-white">Mensajes</h2>
            </div>
            <ol class="space-y-4 bg-slate-50 p-4 sm:p-6">
              {s.messages.map((msg) => {
                const day = buenosAiresDay(msg.createdAt);
                const showDay = day !== lastDay;
                lastDay = day;
                const question = lastQuestion;
                if (msg.role === "user") lastQuestion = msg.content;
                const isUser = msg.role === "user";
                const copied = copyAction.value?.success && copyAction.value.messageId === msg.id;
                const copyFailed = copyAction.value?.failed && copyAction.formData?.get("messageId") === msg.id;
                return (
                  <li key={msg.id} class="space-y-4">
                    {showDay && (
                      <div class="flex items-center gap-3" role="separator" aria-label={formatDay(msg.createdAt)}>
                        <span class="h-px flex-1 bg-slate-300" aria-hidden="true" />
                        <span class="eyebrow text-slate-600" aria-hidden="true">{formatDay(msg.createdAt)}</span>
                        <span class="h-px flex-1 bg-slate-300" aria-hidden="true" />
                      </div>
                    )}
                    <div class={["flex max-w-[90%] flex-col gap-1 sm:max-w-[80%]", isUser ? "ml-auto items-end" : "mr-auto items-start"]}>
                      <p class="text-xs text-slate-600">
                        <span class="font-bold uppercase tracking-wide">{isUser ? "Usuario del portal" : "Asistente"}</span>
                        {" · "}
                        <time dateTime={msg.createdAt}>{timeFormatter.format(new Date(msg.createdAt))}</time>
                      </p>
                      <div
                        class={[
                          "px-4 py-3 text-sm leading-relaxed break-words",
                          isUser ? "bg-primary text-white whitespace-pre-wrap" : "border border-slate-200 border-l-4 border-l-accent bg-white text-slate-800",
                        ]}
                      >
                        {isUser ? msg.content : <ChatMessageContent content={msg.content} />}
                      </div>
                      {!isUser && copyingId.value !== msg.id && !copied && (
                        <button
                          type="button"
                          onClick$={() => (copyingId.value = msg.id)}
                          class="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-primary underline-offset-4 hover:underline cursor-pointer"
                        >
                          <LuBookPlus class="h-4 w-4" aria-hidden="true" />
                          Copiar a la base de conocimientos
                        </button>
                      )}
                      {copied && (
                        <p role="status" class="text-xs font-semibold text-emerald-800">
                          Se agregó a la base de conocimientos.{" "}
                          <Link href="/admin/ai/?tab=personalidad" class="text-primary underline underline-offset-2">Ver en Personalidad</Link>
                        </p>
                      )}
                      {!isUser && copyingId.value === msg.id && !copied && (
                        <Form
                          action={copyAction}
                          onSubmitCompleted$={() => {
                            if (copyAction.value?.success) copyingId.value = null;
                          }}
                          class="w-full space-y-2 border border-slate-300 bg-white p-3"
                        >
                          <input type="hidden" name="messageId" value={msg.id} />
                          <label for={`entry-${msg.id}`} class="field-label">Texto que se agrega a la base de conocimientos</label>
                          <textarea
                            id={`entry-${msg.id}`}
                            name="entry"
                            rows={4}
                            maxLength={MAX_KNOWLEDGE_ENTRY}
                            value={knowledgeEntry(question, msg.content)}
                            aria-describedby={`entry-help-${msg.id}`}
                            class="field text-base sm:text-sm"
                          />
                          <p id={`entry-help-${msg.id}`} class="text-xs text-slate-600">
                            Revisalo y corregilo antes de confirmar: el asistente lo va a usar tal cual en todas las respuestas.
                          </p>
                          {copyFailed && (
                            <p role="alert" class="text-xs font-semibold text-red-700">
                              {copyAction.value?.fieldErrors?.entry ?? copyAction.value?.message ?? "No se pudo agregar."}
                            </p>
                          )}
                          <div class="flex flex-wrap justify-end gap-2">
                            <button type="button" onClick$={() => (copyingId.value = null)} class="btn btn-sm btn-outline">Cancelar</button>
                            <button type="submit" disabled={copyAction.isRunning} class="btn btn-sm btn-dark">
                              {copyAction.isRunning ? "Agregando..." : "Agregar a la base"}
                            </button>
                          </div>
                        </Form>
                      )}
                    </div>
                  </li>
                );
              })}

              {s.messages.length === 0 && (
                <li class="py-10 text-center text-sm text-slate-600">
                  La conversación se abrió pero no tiene mensajes guardados.
                </li>
              )}
            </ol>
          </section>
        </>
      )}
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const data = resolveValue(useSessionDetails);
  const title = data?.title ? `“${data.title.slice(0, 50)}${data.title.length > 50 ? "…" : ""}”` : "Detalle de conversación";
  return {
    title: `${title} - Asistente IA - Admin LPRC`,
  };
};
