import { component$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, Link, type DocumentHead } from "@builder.io/qwik-city";
import { LuTrash2, LuImage } from "@qwikest/icons/lucide";
import { getSessions, deleteSession, getSettings, saveSettings } from "~/server/chatbotDb";
import { putImage } from "~/server/media";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { ActionFeedback } from "~/components/admin/action-feedback";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";

// --- SECURITY & LOADERS ---

export const useChatSessions = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  const sessions = await getSessions(event);
  return sessions.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    lastActive: s.lastActive,
    messageCount: s.messages.length,
  }));
});

export const useSettingsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
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
        whatsappNumber: data.whatsappNumber || "5492214895777",
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

export default component$(() => {
  const sessionsLoader = useChatSessions();
  const deleteAction = useDeleteChatAction();
  const settings = useSettingsLoader();
  const aiSettingsAction = useUpdateAiSettingsAction();

  const activeAiTab = useSignal<"audit" | "config">("audit");

  const isDeleteOpen = useSignal(false);
  const deleteTarget = useSignal<{ id: string; messageCount: number } | null>(null);
  const deleteError = useSignal("");

  const confirmDeleteChat$ = $(async () => {
    if (!deleteTarget.value) return;
    const { value } = await deleteAction.submit({ id: deleteTarget.value.id });
    if (value.failed) {
      deleteError.value = value.message || "No se pudo eliminar la conversación. Intentá de nuevo.";
      return;
    }
    isDeleteOpen.value = false;
  });

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // AI settings state
  const s = settings.value;
  const avatarUrl = useSignal(s.aiAvatarUrl || "");
  const previewUrl = useSignal<string | null>(null);

  const handleFileChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const file = element.files[0];
    previewUrl.value = URL.createObjectURL(file);
    avatarUrl.value = "";
  });

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      {/* SaaS Dashboard layout header */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-navy"></span>
            <span class="text-[11px] font-extrabold tracking-widest text-slate-500 uppercase">
              Administración / Inteligencia Artificial
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-navy-dark tracking-tight leading-none">
            Asistente Inteligente LPRC
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Gestioná el asistente virtual flotante, auditá sus chats o modificá sus reglas de conducta y conocimientos.
          </p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div class="flex border-b border-slate-200">
        <button
          onClick$={() => (activeAiTab.value = "audit")}
          class={[
            "px-6 py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer uppercase tracking-wider",
            activeAiTab.value === "audit"
              ? "border-brand-navy text-brand-navy"
              : "border-transparent text-slate-400 hover:text-slate-600",
          ]}
        >
          Auditoría de Chats
        </button>
        <button
          onClick$={() => (activeAiTab.value = "config")}
          class={[
            "px-6 py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer uppercase tracking-wider",
            activeAiTab.value === "config"
              ? "border-brand-navy text-brand-navy"
              : "border-transparent text-slate-400 hover:text-slate-600",
          ]}
        >
          Personalidad del Asistente
        </button>
      </div>

      <div class="mt-4">
        {/* --- AUDITORIA TAB --- */}
        {activeAiTab.value === "audit" && (
          <div class="space-y-6 animate-in fade-in duration-300 text-left">
            <div>
              <h3 class="text-lg font-bold text-slate-800">Historial de Conversaciones Auditadas</h3>
              <p class="text-xs text-slate-500">Revisá las consultas que los socios le hicieron al asistente.</p>
            </div>

            <ActionFeedback value={deleteAction.value} success="✓ Conversación eliminada." />

            {/* Sessions: stacked cards on phones, table from sm up */}
            <ul class="space-y-3 sm:hidden">
              {sessionsLoader.value.length === 0 && (
                <li class="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                  Aún no hay conversaciones registradas en la base de datos.
                </li>
              )}
              {sessionsLoader.value.map((session) => (
                <li key={session.id} class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                  <div class="space-y-1 text-xs text-slate-500">
                    <p class="font-mono font-bold text-brand-navy-dark truncate">{session.id}</p>
                    <p>Iniciada: {formatDateTime(session.createdAt)}</p>
                    <p>Última actividad: {formatDateTime(session.lastActive)}</p>
                    <p>{session.messageCount} {session.messageCount === 1 ? "mensaje" : "mensajes"}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <Link
                      href={`/admin/chats/${session.id}`}
                      class="px-3 py-2 bg-slate-100 hover:bg-brand-navy-dark hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-all"
                    >
                      Auditar
                    </Link>
                    <button
                      type="button"
                      onClick$={() => {
                        deleteTarget.value = { id: session.id, messageCount: session.messageCount };
                        deleteError.value = "";
                        isDeleteOpen.value = true;
                      }}
                      aria-label={`Eliminar conversación ${session.id}`}
                      class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                    >
                      <LuTrash2 class="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div class="hidden sm:block overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
              <table class="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr class="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    <th class="px-6 py-4">Sesión ID</th>
                    <th class="px-6 py-4">Iniciada</th>
                    <th class="px-6 py-4">Última Actividad</th>
                    <th class="px-6 py-4 text-center">Interacciones</th>
                    <th class="px-6 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 font-medium">
                  {sessionsLoader.value.length === 0 ? (
                    <tr>
                      <td colSpan={5} class="px-6 py-10 text-center text-slate-400">
                        Aún no hay conversaciones registradas en la base de datos.
                      </td>
                    </tr>
                  ) : (
                    sessionsLoader.value.map((session) => (
                      <tr key={session.id} class="hover:bg-slate-50 transition-colors">
                        <td class="px-6 py-4 font-mono text-xs text-brand-navy-dark font-bold truncate max-w-[120px]">
                          <Link href={`/admin/chats/${session.id}`} class="hover:underline">
                            {session.id}
                          </Link>
                        </td>
                        <td class="px-6 py-4 text-slate-500">{formatDateTime(session.createdAt)}</td>
                        <td class="px-6 py-4 text-slate-500">{formatDateTime(session.lastActive)}</td>
                        <td class="px-6 py-4 text-center">
                          <span class="inline-flex h-5 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100 px-2.5 text-[11px] font-bold text-emerald-800">
                            {session.messageCount}
                          </span>
                        </td>
                        <td class="px-6 py-4 text-center">
                          <div class="flex items-center justify-center space-x-2">
                            <Link
                              href={`/admin/chats/${session.id}`}
                              class="px-3 py-1.5 bg-slate-100 hover:bg-brand-navy-dark hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-all"
                            >
                              Auditar
                            </Link>
                            <button
                              type="button"
                              onClick$={() => {
                                deleteTarget.value = { id: session.id, messageCount: session.messageCount };
                                deleteError.value = "";
                                isDeleteOpen.value = true;
                              }}
                              aria-label={`Eliminar conversación ${session.id}`}
                              title="Eliminar conversación"
                              class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                            >
                              <LuTrash2 class="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- PERSONALIDAD TAB --- */}
        {activeAiTab.value === "config" && (
          <div class="space-y-6 animate-in fade-in duration-300 text-left">
            <ActionFeedback value={aiSettingsAction.value} success="✓ Configuración de personalidad de IA guardada." />

            <Form action={aiSettingsAction} enctype="multipart/form-data" class="space-y-8">
              <input type="hidden" name="aiAvatarUrl" value={avatarUrl.value} />

              <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div class="flex items-center justify-between border-b border-slate-100 bg-brand-navy px-8 py-5 text-white">
                  <div>
                    <h2 class="flex items-center gap-2 text-lg font-display font-extrabold text-brand-gold">
                      🤖 LPRC Asistente Virtual
                    </h2>
                    <p class="text-[11px] font-bold tracking-wider text-slate-200 uppercase mt-0.5">
                      Definición de personalidad, avatar y reglas de la IA.
                    </p>
                  </div>
                </div>

                <div class="p-8 space-y-6">
                  <div class="flex items-center justify-between border-b border-slate-100 pb-5">
                    <div class="space-y-0.5">
                      <span class="text-xs font-bold text-slate-800 uppercase tracking-wider block">Chatbot de IA Activo</span>
                      <span class="text-[11px] text-slate-400 font-semibold">Habilitá o deshabilitá el asistente virtual flotante.</span>
                    </div>
                    <input
                      type="checkbox"
                      name="aiEnabled"
                      checked={s.aiEnabled}
                      class="rounded border-slate-300 text-brand-navy focus:ring-brand-navy h-4 w-4 cursor-pointer"
                    />
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div class="space-y-1">
                      <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Avatar del Asistente</label>
                      <div class="flex items-center gap-4">
                        <div class="w-14 h-14 bg-slate-100 rounded-full border-2 border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {previewUrl.value ? (
                            <img src={previewUrl.value} alt="Preview" width={56} height={56} class="w-full h-full object-cover" />
                          ) : avatarUrl.value ? (
                            <img src={avatarUrl.value} alt="Avatar" width={56} height={56} class="w-full h-full object-cover" />
                          ) : (
                            <span class="text-2xl">🤖</span>
                          )}
                        </div>
                        <label class="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-extrabold rounded-full transition-all cursor-pointer flex items-center gap-1.5 shadow-sm">
                          <LuImage class="w-4 h-4" />
                          Subir Archivo
                          <input
                            type="file"
                            name="image"
                            accept="image/*"
                            onChange$={handleFileChange}
                            class="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    <div class="space-y-1">
                      <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Teléfono WhatsApp de Consulta</label>
                      <input
                        type="text"
                        name="whatsappNumber"
                        value={s.whatsappNumber || "5492214895777"}
                        class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tono del Asistente</label>
                    <input
                      type="text"
                      name="aiTone"
                      value={s.aiTone || ""}
                      class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
                    />
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Instrucciones Operativas</label>
                    <textarea
                      name="aiInstructions"
                      rows={4}
                      value={s.aiInstructions || ""}
                      class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
                    />
                  </div>

                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Base de Conocimientos</label>
                    <textarea
                      name="aiKnowledge"
                      rows={4}
                      value={s.aiKnowledge || ""}
                      class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
                    />
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div class="space-y-1">
                      <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Saludo Inicial</label>
                      <textarea
                        name="aiInitialGreeting"
                        rows={2}
                        value={s.aiInitialGreeting || ""}
                        class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
                      />
                    </div>

                    <div class="space-y-1">
                      <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Llamado a la Acción</label>
                      <textarea
                        name="aiCallToAction"
                        rows={2}
                        value={s.aiCallToAction || ""}
                        class="w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div class="bg-slate-50 px-8 py-5 flex justify-end border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={aiSettingsAction.isRunning}
                    class="py-3 px-6 rounded-2xl bg-brand-navy hover:bg-brand-navy-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
                  >
                    {aiSettingsAction.isRunning ? "Guardando..." : "💾 Guardar Ajustes"}
                  </button>
                </div>
              </div>
            </Form>
          </div>
        )}
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
          Se borrará la conversación {deleteTarget.value?.id} ({deleteTarget.value?.messageCount ?? 0}{" "}
          {deleteTarget.value?.messageCount === 1 ? "mensaje" : "mensajes"}) de la auditoría. No se puede deshacer.
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
