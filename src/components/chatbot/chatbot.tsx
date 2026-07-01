import {
  component$,
  useStore,
  $,
  useVisibleTask$,
  useSignal,
  useOnWindow,
} from "@builder.io/qwik";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export const Chatbot = component$(() => {
  const state = useStore({
    enabled: true,
    isOpen: false,
    isLoading: false,
    messages: [
      {
        role: "assistant",
        content:
          "¡Hola! Soy el asistente virtual de la Agremiación Médica Platense. ¿En qué te puedo ayudar hoy?",
      },
    ] as Message[],
    sessionId: "",
    avatarUrl: "" as string | null,
    whatsappNumber: "542214391300",
  });

  const inputValue = useSignal("");
  const messagesContainerRef = useSignal<HTMLDivElement>();
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

  // Fetch settings from server on mount
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    try {
      const res = await fetch("/api/chat");
      if (res.ok) {
        const data = await res.json();
        state.enabled = data.aiEnabled;
        state.avatarUrl = data.aiAvatarUrl;
        state.whatsappNumber = data.whatsappNumber;
        if (data.aiInitialGreeting) {
          state.messages = [
            { role: "assistant", content: data.aiInitialGreeting }
          ];
        }
      }
    } catch (err) {
      console.error("Error fetching chatbot settings:", err);
    }
  });

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
  });

  // Scroll to bottom when messages update
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => state.messages.length);
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop =
        messagesContainerRef.value.scrollHeight;
    }
  });

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

      const data = await response.json();

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

  const bottomPos = hasScrolled.value ? "bottom-24 sm:bottom-28" : "bottom-6 sm:bottom-8";

  return (
    <>
      {!state.isOpen && (
        <span
          class={[
            "pointer-events-none fixed right-6 z-40 h-14 w-14 sm:h-16 sm:w-16 animate-ping rounded-full bg-brand-gold opacity-50 transition-all duration-300",
            bottomPos,
          ]}
        ></span>
      )}
      <button
        onClick$={() => (state.isOpen = !state.isOpen)}
        class={[
          "fixed right-6 z-50 flex cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 shadow-2xl shadow-slate-900/40 transition-all duration-300 hover:scale-105 active:scale-95 h-14 w-14 sm:h-16 sm:w-16",
          bottomPos,
          state.isOpen
            ? "border-slate-700 bg-slate-900 text-white p-3"
            : "border-brand-gold bg-brand-green text-white p-3.5",
        ]}
        aria-label="Abrir asistente virtual"
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
            class="h-6 w-6 text-brand-gold"
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
            class="h-8 w-8 sm:h-10 sm:w-10 text-brand-gold"
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
          class={[
            "animate-in slide-in-from-bottom-5 fade-in fixed right-4 z-[100] flex h-[34rem] max-h-[85vh] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-brand-gold/25 bg-white shadow-2xl text-slate-800 duration-300 sm:right-6 sm:w-96",
            hasScrolled.value ? "bottom-44 sm:bottom-48" : "bottom-24 sm:bottom-28",
          ]}
        >
          {/* Header */}
          <div class="flex items-center justify-between bg-brand-green-dark border-b border-brand-gold/20 p-4 text-white">
            <div class="flex items-center gap-3">
              <div class="relative">
                <div class="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-brand-gold p-1 overflow-hidden">
                  <img
                    src={state.avatarUrl || "/logo-beneficios_amp2.webp"}
                    alt="Asistente AMP"
                    class="h-full w-full object-contain"
                    width={38}
                    height={38}
                  />
                </div>
                <div class="absolute right-0 bottom-0 h-3 w-3 animate-pulse rounded-full border-2 border-brand-green-dark bg-emerald-400"></div>
              </div>
              <div>
                <h3 class="text-sm font-display font-extrabold tracking-wide text-brand-gold-light uppercase">
                  Asistente AMP+
                </h3>
                <p class="text-[9px] font-bold tracking-widest text-slate-300 uppercase">
                  En línea
                </p>
              </div>
            </div>
            <button
              onClick$={() => (state.isOpen = false)}
              class="text-slate-300 transition-colors hover:text-brand-gold cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.5"
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
            class="flex flex-1 flex-col space-y-4 overflow-y-auto bg-slate-50 p-4 scrollbar-thin"
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
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm font-medium whitespace-pre-wrap break-words",
                    msg.role === "user"
                      ? "rounded-br-none bg-brand-green text-white"
                      : "rounded-bl-none border border-slate-200 bg-white text-slate-800",
                  ]}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {state.isLoading && (
              <div class="flex justify-start">
                <div class="flex items-center gap-1.5 rounded-2xl rounded-bl-none border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400 shadow-sm">
                  <div class="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-gold"></div>
                  <div class="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-gold [animation-delay:-0.15s]"></div>
                  <div class="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-gold [animation-delay:-0.3s]"></div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div class="border-t border-slate-100 bg-white p-4">
            <form
              preventdefault:submit
              onSubmit$={sendMessage}
              class="flex gap-2"
            >
              <input
                type="text"
                bind:value={inputValue}
                placeholder="Escribe tu consulta..."
                class="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-brand-gold focus:outline-none"
                disabled={state.isLoading}
              />
              <button
                type="submit"
                disabled={!inputValue.value.trim() || state.isLoading}
                class="flex items-center justify-center rounded-xl bg-brand-green p-2.5 text-white transition-all active:scale-95 disabled:bg-slate-100 disabled:text-slate-300 disabled:opacity-50 cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  class="h-5 w-5 text-brand-gold"
                >
                  <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
});
