import { component$, useSignal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { getSettings, saveSettings } from "~/server/chatbotDb";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

// --- SECURITY & LOADERS ---

export const useSettingsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  return await getSettings(event);
});

// --- ACTIONS ---

export const useUpdateCampaignAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const settings = await getSettings(requestEvent);
      const updatedSettings = {
        ...settings,
        campaignActive: data.campaignActive === "on",
        campaignTitle: data.campaignTitle || null,
        campaignSubtitle: data.campaignSubtitle || null,
        campaignEmoji: data.campaignEmoji || null,
        campaignTag: data.campaignTag || null,
        campaignQuery: data.campaignQuery || null,
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
    campaignActive: z.string().optional(),
    campaignTitle: z.string().optional(),
    campaignSubtitle: z.string().optional(),
    campaignEmoji: z.string().optional(),
    campaignTag: z.string().optional(),
    campaignQuery: z.string().optional(),
  })
);

export default component$(() => {
  const settings = useSettingsLoader();
  const updateCampaignAction = useUpdateCampaignAction();

  const s = settings.value;

  // Campaign Signals
  const campaignActiveSig = useSignal(s.campaignActive);
  const campaignTitleSig = useSignal(s.campaignTitle || "Cafecitos & Desayunos");
  const campaignSubtitleSig = useSignal(s.campaignSubtitle || "Disfrutá del mejor aroma a café, desayunos premium y meriendas increíbles con tu credencial digital AMP+.");
  const campaignEmojiSig = useSignal(s.campaignEmoji || "☕");
  const campaignTagSig = useSignal(s.campaignTag || "SELECCIÓN GOURMET");
  const campaignQuerySig = useSignal(s.campaignQuery || "cafe,café,desayuno,factura,gastronomia,gastro");

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      {/* Header */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              Administración / Portada & Promociones
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Campaña Destacada (Home)
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Gestioná la sección temática destacada interactiva que se visualiza en la página de inicio.
          </p>
        </div>
      </div>

      {updateCampaignAction.value?.success && (
        <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm text-left animate-fade-in">
          ✓ Campaña especial guardada exitosamente. Se aplicará de forma inmediata en la home.
        </div>
      )}

      <div class="grid grid-cols-1 grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: EDITOR */}
        <div class="col-span-12 lg:col-span-7">
          <Form action={updateCampaignAction} class="space-y-6">
            <div class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl text-left font-sans">
              <div class="flex items-center justify-between border-b border-slate-100 bg-[#0B1527] px-8 py-5 text-white">
                <div>
                  <h2 class="flex items-center gap-2 text-lg font-display font-extrabold text-brand-gold">
                    Campaña Temática Destacada
                  </h2>
                  <p class="text-[10px] font-bold tracking-wider text-slate-200 uppercase mt-0.5">
                    Sección editable de la home (Día del Padre, Fiestas, Cafecito, etc)
                  </p>
                </div>
              </div>

              <div class="p-8 space-y-6">
                {/* Campaign Active Toggle */}
                <div class="flex items-center justify-between border-b border-slate-100 pb-5">
                  <div class="space-y-0.5">
                    <span class="text-xs font-bold text-slate-800 uppercase tracking-wider block font-sans">Mostrar en el Inicio</span>
                    <span class="text-[11px] text-slate-400 font-semibold font-sans">Si se desmarca, esta sección temática temporal se ocultará de la página de inicio.</span>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="campaignActive"
                      checked={campaignActiveSig.value}
                      onChange$={(ev, el) => {
                        campaignActiveSig.value = el.checked;
                      }}
                      class="sr-only peer"
                    />
                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0B1527]"></div>
                  </label>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Tag / Badge */}
                  <div class="space-y-1 sm:col-span-2">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block font-sans">Etiqueta Superior (Tag)</label>
                    <input
                      type="text"
                      name="campaignTag"
                      value={campaignTagSig.value}
                      onInput$={(ev, el) => {
                        campaignTagSig.value = el.value;
                      }}
                      class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-[#0B1527] focus:bg-white focus:outline-none transition-all font-bold font-sans"
                      placeholder="Ej: DÍA DE LA MADRE, SELECCIÓN GOURMET..."
                    />
                  </div>

                  {/* Emoji */}
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block font-sans">Emoji de Campaña</label>
                    <input
                      type="text"
                      name="campaignEmoji"
                      value={campaignEmojiSig.value}
                      onInput$={(ev, el) => {
                        campaignEmojiSig.value = el.value;
                      }}
                      class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-[#0B1527] focus:bg-white focus:outline-none transition-all text-center font-bold font-sans text-lg"
                      placeholder="Ej: 🎁"
                    />
                  </div>
                </div>

                {/* Campaign Title */}
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block font-sans">Título Principal</label>
                  <input
                    type="text"
                    name="campaignTitle"
                    value={campaignTitleSig.value}
                    onInput$={(ev, el) => {
                      campaignTitleSig.value = el.value;
                    }}
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-[#0B1527] focus:bg-white focus:outline-none transition-all font-black font-sans"
                    placeholder="Ej: Especial Día de la Madre"
                  />
                </div>

                {/* Campaign Subtitle */}
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block font-sans">Copete o Subtítulo</label>
                  <textarea
                    name="campaignSubtitle"
                    rows={3}
                    value={campaignSubtitleSig.value}
                    onInput$={(ev, el) => {
                      campaignSubtitleSig.value = el.value;
                    }}
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-[#0B1527] focus:bg-white focus:outline-none transition-all font-medium font-sans"
                    placeholder="Contanos brevemente qué encontrarán en esta sección..."
                  />
                </div>

                {/* Campaign Keywords */}
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block font-sans flex justify-between">
                    <span>Palabras Clave de Búsqueda (Filtro Automático)</span>
                    <span class="text-[10px] text-slate-400 font-bold lowercase tracking-normal">Separadas por comas</span>
                  </label>
                  <input
                    type="text"
                    name="campaignQuery"
                    value={campaignQuerySig.value}
                    onInput$={(ev, el) => {
                      campaignQuerySig.value = el.value;
                    }}
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-[#0B1527] focus:bg-white focus:outline-none transition-all font-mono font-bold"
                    placeholder="Ej: cafe,factura,gastronomia (busca beneficios que contengan estos textos)"
                  />
                  <p class="text-[10px] text-slate-400 font-semibold mt-1">
                    💡 El sistema buscará de forma automatizada todos los beneficios que contengan estas palabras en su título, resumen, descripción o nombre de categoría y los mostrará en el inicio de manera dinámica.
                  </p>
                </div>
              </div>

              <div class="bg-slate-50 px-8 py-5 flex justify-end border-t border-slate-100">
                <button
                  type="submit"
                  disabled={updateCampaignAction.isRunning}
                  class="py-3.5 px-7 rounded-2xl bg-[#0B1527] hover:bg-[#020617] disabled:bg-slate-350 text-white text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg transition-all duration-300 active:scale-95 cursor-pointer font-sans"
                >
                  {updateCampaignAction.isRunning ? "Guardando..." : "Guardar Campaña"}
                </button>
              </div>
            </div>
          </Form>
        </div>

        {/* RIGHT COLUMN: PREVIEWS */}
        <div class="col-span-12 lg:col-span-5 space-y-6">
          <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl text-left">
            <h3 class="text-xs font-extrabold uppercase tracking-widest text-slate-450 mb-4 flex items-center gap-1.5 font-sans">
              <span class="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse"></span>
              Sección Temática en Home
            </h3>

            {/* Dynamic simulated card container */}
            <div class="w-full relative rounded-3xl bg-gradient-to-br from-[#0B1527] to-[#020617] border border-slate-800 p-6 md:p-8 overflow-hidden shadow-2xl font-sans text-left space-y-4">
              <div class="absolute -right-16 -top-16 w-32 h-32 bg-brand-gold/10 rounded-full blur-[40px] pointer-events-none" />
              <div class="absolute -left-16 -bottom-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-[40px] pointer-events-none" />

              {/* Tag pill */}
              <div class="inline-flex items-center space-x-1.5 relative z-10">
                <span class="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse"></span>
                <span class="text-[9px] font-extrabold tracking-widest text-brand-gold uppercase">
                  {campaignTagSig.value || "SELECCIÓN ESPECIAL"}
                </span>
              </div>

              {/* Title */}
              <h3 class="text-xl md:text-2xl font-display font-black text-white tracking-tight leading-none relative z-10">
                {campaignEmojiSig.value || "🎁"} {campaignTitleSig.value || "Especial de Temporada"}
              </h3>

              {/* Subtitle */}
              <p class="text-[11px] text-slate-400 font-medium leading-relaxed relative z-10 max-w-sm">
                {campaignSubtitleSig.value || "Disfrutá de beneficios exclusivos seleccionados especialmente para vos con tu credencial digital AMP+."}
              </p>

              {/* Button */}
              <div class="pt-2 relative z-10">
                <button class="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full bg-white/10 text-white text-[10px] font-extrabold uppercase tracking-widest cursor-not-allowed">
                  <span>Ver todos</span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* Mock grid to show structure */}
              <div class="border-t border-slate-800 pt-4 mt-2">
                <span class="text-[9px] text-slate-500 font-extrabold tracking-widest uppercase block mb-2.5">Beneficios Relacionados (Vista Previa)</span>
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-2.5 space-y-2 opacity-80">
                    <div class="h-14 rounded-xl bg-slate-950 flex items-center justify-center relative">
                      <span class="text-[8px] font-bold text-slate-600 uppercase">AMP+</span>
                      <div class="absolute bottom-1 right-1 bg-brand-gold text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-lg">15%</div>
                    </div>
                    <span class="text-[8px] font-bold text-[#0a442a] uppercase block">La Plata</span>
                    <span class="text-[10px] font-extrabold text-slate-300 line-clamp-1">Establecimiento A</span>
                  </div>

                  <div class="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-2.5 space-y-2 opacity-80">
                    <div class="h-14 rounded-xl bg-slate-950 flex items-center justify-center relative">
                      <span class="text-[8px] font-bold text-slate-600 uppercase">AMP+</span>
                      <div class="absolute bottom-1 right-1 bg-brand-gold text-slate-950 text-[8px] font-black px-1.5 py-0.5 rounded-lg">20%</div>
                    </div>
                    <span class="text-[8px] font-bold text-[#0a442a] uppercase block">Chubut</span>
                    <span class="text-[10px] font-extrabold text-slate-300 line-clamp-1">Establecimiento B</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Toggle Warning */}
            <div class="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-[11px] font-medium text-slate-500 leading-normal">
              {campaignActiveSig.value ? (
                <span class="text-emerald-700 font-bold">✓ Esta sección temática dinámica está actualmente visible en la home de los usuarios.</span>
              ) : (
                <span class="text-rose-700 font-bold">⚠️ Esta sección temática está deshabilitada y no se mostrará en la home.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "AMP+ Campaña Temática",
  meta: [
    {
      name: "description",
      content: "Administración de la campaña temática destacada de la página de inicio.",
    },
  ],
};
