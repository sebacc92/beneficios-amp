import { component$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  Link,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { getSessionById, deleteSession } from "~/server/chatbotDb";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

// Loader to fetch session details and complete chat logs
export const useSessionDetails = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }

  const session = await getSessionById(event, event.params.id);
  if (!session) {
    event.status(404);
    return null;
  }
  return session;
});

// Delete action for inside the details page
export const useDeleteSessionDetailsAction = routeAction$(async (data, requestEvent) => {
  const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

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

export default component$(() => {
  const sessionLoader = useSessionDetails();
  const deleteAction = useDeleteSessionDetailsAction();

  if (!sessionLoader.value) {
    return (
      <div class="mx-auto max-w-4xl px-4 py-20 text-center font-sans">
        <div class="text-5xl mb-4">⚠️</div>
        <h1 class="text-2xl font-display font-extrabold text-slate-800">Sesión de Chat No Encontrada</h1>
        <p class="text-slate-500 mt-2 text-sm">La conversación que estás buscando no existe o ya fue eliminada del registro.</p>
        <Link
          href="/admin"
          class="inline-flex items-center justify-center px-6 py-3 rounded-full bg-brand-green text-white text-xs font-bold uppercase tracking-wider mt-6 hover:bg-brand-green-light transition-all shadow-md active:scale-95"
        >
          Volver a la Lista
        </Link>
      </div>
    );
  }

  const s = sessionLoader.value;

  return (
    <div class="mx-auto max-w-4xl space-y-6 px-4 py-12 pb-24 font-sans">

      {/* Navigation and Actions Row */}
      <div class="flex items-center justify-between border-b border-slate-200 pb-4">
        <Link
          href="/admin"
          class="inline-flex items-center space-x-1.5 text-xs font-bold text-brand-green hover:text-brand-green-light uppercase tracking-wider transition-colors"
        >
          <span>&larr;</span>
          <span>Volver a la Auditoría</span>
        </Link>

        {/* Delete directly from details */}
        <Form action={deleteAction}>
          <input type="hidden" name="id" value={s.id} />
          <button
            type="submit"
            preventdefault:click
            onClick$={async (e, el) => {
              if (
                confirm(
                  `¿Eliminar la conversación del ${new Date(s.createdAt).toLocaleDateString("es-AR")}? Esta acción no se puede deshacer.`
                )
              ) {
                (el.closest("form") as HTMLFormElement).requestSubmit();
              }
            }}
            class="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm cursor-pointer"
          >
            Eliminar Conversación
          </button>
        </Form>
      </div>

      {deleteAction.value?.success ? (
        <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-8 text-center text-emerald-800 shadow-sm animate-fade-in space-y-4">
          <div class="text-4xl">✅</div>
          <h2 class="text-lg font-bold">Conversación eliminada exitosamente</h2>
          <p class="text-xs text-slate-500 max-w-md mx-auto">La sesión fue dada de baja de los registros locales. Puedes volver a la auditoría general.</p>
          <Link
            href="/admin"
            class="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
          >
            Volver a la Lista
          </Link>
        </div>
      ) : (
        <div class="space-y-6">

          {/* Metadata Info Panel */}
          <div class="glass-card border border-slate-200 rounded-2xl p-6 bg-white shadow-sm space-y-4">
            <h2 class="text-xs font-extrabold tracking-widest text-brand-gold uppercase">Detalles del Registro</h2>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium text-slate-500">
              <div>
                <span class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">ID Sesión (Local)</span>
                <span class="font-mono font-bold text-slate-800">{s.id}</span>
              </div>
              <div>
                <span class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Iniciado el</span>
                <span class="font-semibold text-slate-800">
                  {s.createdAt ? new Date(s.createdAt).toLocaleString("es-AR") : "—"}
                </span>
              </div>
              <div>
                <span class="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Último Mensaje el</span>
                <span class="font-semibold text-slate-800">
                  {s.lastActive ? new Date(s.lastActive).toLocaleString("es-AR") : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Conversation Mockup Screen */}
          <div class="rounded-2xl border border-slate-200 bg-slate-100/50 shadow-sm flex flex-col overflow-hidden">
            {/* Header Mockup */}
            <div class="bg-brand-green-dark border-b border-brand-gold/15 p-4 flex items-center space-x-3.5 text-white">
              <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center p-1 border border-brand-gold">
                <img
                  src="/logo-beneficios_amp2.webp"
                  alt="AMP Logo"
                  width={34}
                  height={34}
                  class="object-contain"
                />
              </div>
              <div>
                <h3 class="text-xs font-display font-extrabold uppercase tracking-wide text-brand-gold">
                  Auditoría Chatbot AMP+
                </h3>
                <p class="text-[9px] text-slate-300 font-bold uppercase tracking-wider">Historial de Conversación</p>
              </div>
            </div>

            {/* Message History Grid Bubble Container */}
            <div class="p-6 space-y-5 flex-1 min-h-[300px]">
              {s.messages.map((msg) => (
                <div
                  key={msg.id}
                  class={[
                    "flex flex-col max-w-[85%] space-y-1.5 animate-fade-in",
                    msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start",
                  ]}
                >
                  {/* Role Label */}
                  <span class="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">
                    {msg.role === "user" ? "Médico Agremiado (Usuario)" : "Asistente Virtual (IA)"}
                  </span>

                  {/* Bubble content */}
                  <div
                    class={[
                      "rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-sm font-medium whitespace-pre-wrap break-words",
                      msg.role === "user"
                        ? "rounded-br-none bg-brand-green text-white"
                        : "rounded-bl-none border border-slate-200 bg-white text-slate-800",
                    ]}
                  >
                    {msg.content}
                  </div>

                  {/* Time */}
                  <span class="text-[8px] text-slate-400 font-semibold">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleString("es-AR") : ""}
                  </span>
                </div>
              ))}

              {s.messages.length === 0 && (
                <div class="text-center py-12 text-slate-400 text-xs uppercase tracking-wider font-extrabold">
                  Esta sesión se inició pero no cuenta con mensajes registrados.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const data = resolveValue(useSessionDetails);
  return {
    title: data
      ? `Detalle Conversación ${data.id} - Auditoría AMP`
      : "Detalle de Conversación - Admin AMP",
  };
};
