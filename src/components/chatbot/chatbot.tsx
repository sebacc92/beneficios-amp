import {
  component$,
  useStore,
  $,
  useVisibleTask$,
  useSignal,
  useOnWindow,
} from "@builder.io/qwik";
import { LuMessageCircle } from "@qwikest/icons/lucide";
import { CLUB, WHATSAPP_MESSAGES, whatsappLink } from "~/utils/club";
import { ChatMessageContent } from "./chat-message-content";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatbotSettingsResponse {
  aiEnabled: boolean;
  aiAvatarUrl: string | null;
  aiInitialGreeting: string;
  whatsappNumber: string;
}

export const Chatbot = component$(() => {
  const state = useStore({
    enabled: true,
    // Stays invisible until /api/chat answers, so a disabled assistant never flashes in.
    ready: false,
    isOpen: false,
    isLoading: false,
    messages: [
      {
        role: "assistant",
        content:
          "¡Hola! Soy el asistente virtual de La Plata Rugby Club. ¿En qué te puedo ayudar hoy?",
      },
    ] as Message[],
    sessionId: "",
    avatarUrl: "" as string | null,
    whatsappNumber: CLUB.whatsappNumber as string,
  });

  const inputValue = useSignal("");
  const messagesContainerRef = useSignal<HTMLDivElement>();
  const launcherRef = useSignal<HTMLButtonElement>();
  const hasScrolled = useSignal(false);

  // Monitor scroll height to slide chatbot launcher and window up/down
  useOnWindow(
    "scroll",
    $(() => {
      requestAnimationFrame(() => {
        hasScrolled.value = window.scrollY > 300;
      });
    }),
  );

  // The root wrapper has no size of its own (everything inside is `fixed`), so the
  // default "visible" strategy never fires: these tasks run once the page is idle.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      const res = await fetch("/api/chat");
      if (res.ok) {
        const data = (await res.json()) as ChatbotSettingsResponse;
        state.enabled = data.aiEnabled;
        state.avatarUrl = data.aiAvatarUrl;
        if (data.whatsappNumber) state.whatsappNumber = data.whatsappNumber;
        if (data.aiInitialGreeting) {
          state.messages = [
            { role: "assistant", content: data.aiInitialGreeting },
          ];
        }
      }
    } catch (err) {
      console.error("Error fetching chatbot settings:", err);
    } finally {
      state.ready = true;
    }
  }, { strategy: "document-idle" });

  // Session ID initialization
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    let sId = sessionStorage.getItem("chatbot_session_id");
    if (!sId) {
      sId =
        "sess-" +
        Date.now().toString() +
        Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem("chatbot_session_id", sId);
    }
    state.sessionId = sId;
  }, { strategy: "document-idle" });

  // Scroll to bottom when messages update
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => state.messages.length);
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop =
        messagesContainerRef.value.scrollHeight;
    }
  }, { strategy: "document-idle" });

  const sendMessage = $(async () => {
    if (!inputValue.value.trim() || state.isLoading) return;

    const userMsg = inputValue.value.trim();
    inputValue.value = "";

    state.messages.push({ role: "user", content: userMsg });
    state.isLoading = true;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: state.messages.slice(-8), // Keep a longer context
          sessionId: state.sessionId,
        }),
      });

      if (!response.ok) throw new Error("Error en la conexión");

      const data = (await response.json()) as { reply?: Message };

      if (data.reply) {
        state.messages.push(data.reply);
      } else {
        state.messages.push({
          role: "assistant",
          content:
            "Ocurrió un error al procesar tu solicitud, por favor intenta nuevamente.",
        });
      }
    } catch (error) {
      console.error("Error de red en chat:", error);
      state.messages.push({
        role: "assistant",
        content:
          "Lo lamento, no pude contactar al servidor de inteligencia artificial. Revisa tu conexión o intenta más tarde.",
      });
    } finally {
      state.isLoading = false;
    }
  });

  if (!state.enabled) return null;

  const bottomPos = hasScrolled.value
    ? "bottom-24 sm:bottom-28"
    : "bottom-6 sm:bottom-8";

  return (
    <div class={["floating-action print:hidden", !state.ready && "invisible"]} aria-hidden={!state.ready}>
      <button
        ref={launcherRef}
        onClick$={() => (state.isOpen = !state.isOpen)}
        class={[
          "fixed right-6 z-45 flex h-14 w-14 cursor-pointer items-center justify-center border-2 shadow-xl shadow-slate-900/30 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-16 sm:w-16",
          bottomPos,
          state.isOpen
            ? "border-primary bg-white text-primary hover:bg-slate-100"
            : "border-accent bg-primary text-accent hover:bg-secondary",
        ]}
        aria-label={state.isOpen ? "Cerrar asistente virtual" : "Abrir asistente virtual"}
        aria-expanded={state.isOpen}
        aria-controls="chatbot-window"
      >
        {state.isOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2.5"
            stroke="currentColor"
            aria-hidden="true"
            class="h-6 w-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            aria-hidden="true"
            class="h-8 w-8 sm:h-9 sm:w-9"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M2.25 12.76c0-4.43 3.65-8.08 8.08-8.08h3.33c4.43 0 8.08 3.65 8.08 8.08s-3.65 8.08-8.08 8.08H7.5A5.25 5.25 0 012.25 15.6zm10.74-2.5h.01M9.75 10.25h.01M14.25 10.25h.01"
            />
          </svg>
        )}
      </button>

      {state.isOpen && (
        <div
          id="chatbot-window"
          role="dialog"
          aria-labelledby="chatbot-title"
          onKeyDown$={(event) => {
            if (event.key !== "Escape") return;
            state.isOpen = false;
            launcherRef.value?.focus();
          }}
          class={[
            "animate-fade-in-up fixed right-4 z-50 flex h-[34rem] w-[calc(100vw-2rem)] flex-col overflow-hidden border border-slate-300 bg-white text-slate-800 shadow-2xl shadow-slate-900/30 duration-300 sm:right-6 sm:w-96 [@media(max-height:600px)]:bottom-4 [@media(max-height:600px)]:max-h-[calc(100dvh-2rem)]",
            hasScrolled.value
              ? "bottom-44 max-h-[calc(100dvh-12rem)] sm:bottom-48 sm:max-h-[calc(100dvh-13rem)]"
              : "bottom-24 max-h-[calc(100dvh-7rem)] sm:bottom-28 sm:max-h-[calc(100dvh-8rem)]",
          ]}
        >
          {/* Header: club navy with the yellow rule lprc.com.ar uses */}
          <div class="flex shrink-0 items-center justify-between gap-3 border-b-4 border-accent bg-primary px-4 py-3 text-white">
            <div class="flex min-w-0 items-center gap-3">
              <img
                src={state.avatarUrl || "/lprc.avif"}
                alt=""
                class={["h-11 w-11 shrink-0 object-contain", state.avatarUrl && "bg-white p-0.5"]}
                width={44}
                height={44}
              />
              <div class="min-w-0">
                <h3 id="chatbot-title" class="font-display text-base font-semibold uppercase leading-tight tracking-wide text-white">
                  Asistente LPRC
                </h3>
                <p class="text-xs font-semibold text-accent">
                  Club de Beneficios
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick$={() => (state.isOpen = false)}
              aria-label="Cerrar asistente virtual"
              class="flex h-11 w-11 shrink-0 items-center justify-center text-white/80 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.5"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            role="log"
            aria-live="polite"
            aria-label="Conversación con el asistente"
            class="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto bg-slate-50 p-4 scrollbar-thin"
          >
            {state.messages.map((msg, i) => (
              <div
                key={i}
                class={[
                  "flex w-full animate-fade-in",
                  msg.role === "user" ? "justify-end" : "justify-start",
                ]}
              >
                <div
                  class={[
                    "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed break-words",
                    msg.role === "user"
                      ? "bg-primary text-white whitespace-pre-wrap"
                      : "border border-slate-200 border-l-4 border-l-accent bg-white text-slate-800",
                  ]}
                >
                  {msg.role === "user" ? msg.content : <ChatMessageContent content={msg.content} />}
                </div>
              </div>
            ))}

            {state.isLoading && (
              <div class="flex justify-start">
                <div class="flex items-center gap-1.5 border border-slate-200 border-l-4 border-l-accent bg-white px-4 py-3 text-sm text-slate-500">
                  <span class="sr-only">El asistente está escribiendo…</span>
                  <div class="h-1.5 w-1.5 animate-bounce bg-primary"></div>
                  <div class="h-1.5 w-1.5 animate-bounce bg-primary [animation-delay:-0.15s]"></div>
                  <div class="h-1.5 w-1.5 animate-bounce bg-primary [animation-delay:-0.3s]"></div>
                </div>
              </div>
            )}
          </div>

          {/* A person on WhatsApp, for whatever the assistant cannot solve */}
          <a
            href={whatsappLink(WHATSAPP_MESSAGES.consulta, state.whatsappNumber)}
            target="_blank"
            rel="noopener noreferrer"
            class="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-primary hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          >
            <LuMessageCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>¿Preferís hablar con una persona? <span class="underline decoration-accent decoration-2 underline-offset-2">Escribinos por WhatsApp</span></span>
            <span class="sr-only"> (se abre en otra pestaña)</span>
          </a>

          {/* Input Area */}
          <div class="shrink-0 border-t border-slate-200 bg-white p-3">
            <form
              preventdefault:submit
              onSubmit$={sendMessage}
              class="flex gap-2"
            >
              <label for="chatbot-input" class="sr-only">Tu consulta</label>
              {/* readOnly instead of disabled: disabling the focused input closes the phone keyboard after every message. */}
              <input
                id="chatbot-input"
                type="text"
                bind:value={inputValue}
                placeholder="Escribí tu consulta..."
                class="field min-w-0 flex-1 py-2.5 text-base sm:text-sm"
                readOnly={state.isLoading}
                aria-busy={state.isLoading}
              />
              <button
                type="submit"
                aria-label="Enviar consulta"
                disabled={!inputValue.value.trim() || state.isLoading}
                class="flex h-11 w-11 shrink-0 items-center justify-center bg-accent text-primary transition-colors hover:bg-accent-hover disabled:bg-slate-200 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer disabled:cursor-not-allowed"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  class="h-5 w-5"
                >
                  <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
