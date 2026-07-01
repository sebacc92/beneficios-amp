import { component$, useSignal, useComputed$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { getSettings, saveSettings } from "~/server/chatbotDb";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { getCustomBenefits, type Benefit } from "~/server/cache";

// --- SECURITY & LOADERS ---

export const useSettingsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  return await getSettings(event);
});

export const useAllBenefitsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  return await getCustomBenefits(event);
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
        campaignBenefitIds: data.campaignBenefitIds || null,
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
    campaignBenefitIds: z.string().optional(),
  })
);

export default component$(() => {
  const settings = useSettingsLoader();
  const updateCampaignAction = useUpdateCampaignAction();
  const allBenefitsLoader = useAllBenefitsLoader();

  const s = settings.value;
  const allBenefits = allBenefitsLoader.value;

  // Campaign Signals
  const campaignActiveSig = useSignal(s.campaignActive);
  const campaignTitleSig = useSignal(s.campaignTitle || "Cafecitos & Desayunos");
  const campaignSubtitleSig = useSignal(s.campaignSubtitle || "Disfrutá del mejor aroma a café, desayunos premium y meriendas increíbles con tu credencial digital AMP+.");
  const campaignEmojiSig = useSignal(s.campaignEmoji || "☕");
  const campaignTagSig = useSignal(s.campaignTag || "SELECCIÓN GOURMET");
  const campaignQuerySig = useSignal(s.campaignQuery || "cafe,café,desayuno,factura,gastronomia,gastro");
  const campaignBenefitIdsSig = useSignal(s.campaignBenefitIds || "");
  const searchQuerySig = useSignal("");

  const selectedIdsList = useComputed$(() => {
    return campaignBenefitIdsSig.value
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);
  });

  const selectedBenefits = useComputed$(() => {
    const selected = selectedIdsList.value;
    const matched: Benefit[] = [];
    for (const idOrUrl of selected) {
      const b = allBenefits.find(x => String(x.id) === idOrUrl || x.url === idOrUrl);
      if (b) matched.push(b);
    }
    return matched;
  });

  const filteredSearchBenefits = useComputed$(() => {
    const q = searchQuerySig.value.trim().toLowerCase();
    const selected = selectedIdsList.value;
    
    return allBenefits.filter((b) => {
      if (b.mostrar_app === 0) return false;
      const isSelected = selected.includes(String(b.id)) || selected.includes(b.url);
      if (isSelected) return false;
      
      if (!q) {
        return b.isFeatured;
      }
      
      const titleMatch = b.titulo.toLowerCase().includes(q);
      const catMatch = b.categorias.some(c => c.descripcion.toLowerCase().includes(q));
      const locMatch = b.ubicacion.some(l => l.descripcion.toLowerCase().includes(q));
      return titleMatch || catMatch || locMatch;
    }).slice(0, 5);
  });

  const previewBenefits = useComputed$(() => {
    if (selectedBenefits.value.length > 0) {
      return selectedBenefits.value.slice(0, 4);
    }
    const queryTerms = campaignQuerySig.value.split(",").map(term => term.trim().toLowerCase()).filter(Boolean);
    if (queryTerms.length === 0) return [];
    
    return allBenefits.filter(b => {
      const tl = b.titulo.toLowerCase(); const dl = b.descripcion.toLowerCase(); const rl = b.resumen.toLowerCase();
      return queryTerms.some(term => tl.includes(term) || dl.includes(term) || rl.includes(term) || b.categorias.some(c => c.descripcion.toLowerCase().includes(term)));
    }).slice(0, 4);
  });

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

                {/* Hidden input to preserve campaignQuery */}
                <input type="hidden" name="campaignQuery" value={campaignQuerySig.value} />

                {/* Manual Benefit Selection */}
                <div class="border-t border-slate-100 pt-6 space-y-4 px-8 pb-8 bg-slate-50/50">
                  <div>
                    <label class="text-xs font-black text-[#0B1527] uppercase tracking-wider block font-sans">
                      Selección Manual de Beneficios
                    </label>
                    <span class="text-[11px] text-slate-400 font-semibold font-sans block mt-1">
                      Buscá y seleccioná beneficios específicos para mostrarlos destacados en la home.
                    </span>
                  </div>

                  {/* Hidden Input to send selection to the action */}
                  <input type="hidden" name="campaignBenefitIds" value={campaignBenefitIdsSig.value} />

                  {/* Search Input */}
                  <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={searchQuerySig.value}
                      onInput$={(ev, el) => {
                        searchQuerySig.value = el.value;
                      }}
                      class="w-full bg-white text-slate-800 text-sm pl-11 pr-4 py-3 rounded-2xl border border-slate-200 focus:border-[#0B1527] focus:outline-none transition-all font-bold font-sans shadow-sm"
                      placeholder="Escribí para buscar beneficios (ej: Starbucks, Sushi...)"
                    />
                  </div>

                  {/* Search Results Suggestion Box */}
                  {filteredSearchBenefits.value.length > 0 && (
                    <div class="border border-slate-200 rounded-2xl bg-white shadow-xl overflow-hidden divide-y divide-slate-100 z-20 relative animate-fade-in">
                      <div class="bg-slate-50/80 px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {searchQuerySig.value.trim() ? "Resultados de búsqueda" : "Beneficios Destacados Sugeridos"}
                      </div>
                      {filteredSearchBenefits.value.map((benefit) => (
                        <button
                          key={benefit.id}
                          type="button"
                          onClick$={() => {
                            const currentList = selectedIdsList.value;
                            const identifier = benefit.url; // Slug is stable
                            if (!currentList.includes(identifier)) {
                              campaignBenefitIdsSig.value = [...currentList, identifier].join(",");
                            }
                            searchQuerySig.value = ""; // clear search
                          }}
                          class="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between transition-colors group cursor-pointer"
                        >
                          <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200 flex-shrink-0">
                              {benefit.imagen ? (
                                <img
                                  src={benefit.imagen.startsWith('http') || benefit.imagen.startsWith('/') ? benefit.imagen : `https://beneficios.amepla.org.ar/files/${benefit.imagen}`}
                                  alt={benefit.titulo}
                                  class="w-full h-full object-cover"
                                  width={36}
                                  height={36}
                                />
                              ) : (
                                <span class="text-[10px] font-black text-slate-400">AMP+</span>
                              )}
                            </div>
                            <div class="truncate">
                              <span class="text-xs font-bold text-slate-800 block leading-tight truncate">{benefit.titulo}</span>
                              <span class="text-[9px] font-semibold text-slate-400 block mt-0.5 truncate">
                                {benefit.categorias[0]?.descripcion || "General"} • {benefit.ubicacion[0]?.descripcion || "La Plata"}
                              </span>
                            </div>
                          </div>
                          <span class="text-xs font-black text-emerald-600 group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-2">
                            + Agregar
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected Benefits List */}
                  <div class="space-y-2 mt-4">
                    <span class="text-[10px] font-bold text-slate-450 uppercase tracking-widest block font-sans">
                      Beneficios Seleccionados ({selectedBenefits.value.length})
                    </span>

                    {selectedBenefits.value.length > 0 ? (
                      <div class="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white shadow-sm">
                        {selectedBenefits.value.map((benefit, index) => (
                          <div key={benefit.id} class="px-4 py-3 flex items-center justify-between hover:bg-slate-50/30 transition-all">
                            <div class="flex items-center gap-3 min-w-0">
                              <span class="text-xs font-bold text-slate-300 w-4 text-center flex-shrink-0">
                                {index + 1}
                              </span>
                              <div class="w-9 h-9 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200 flex-shrink-0">
                                {benefit.imagen ? (
                                  <img
                                    src={benefit.imagen.startsWith('http') || benefit.imagen.startsWith('/') ? benefit.imagen : `https://beneficios.amepla.org.ar/files/${benefit.imagen}`}
                                    alt={benefit.titulo}
                                    class="w-full h-full object-cover"
                                    width={36}
                                    height={36}
                                  />
                                ) : (
                                  <span class="text-[10px] font-black text-slate-400">AMP+</span>
                                )}
                              </div>
                              <div class="truncate">
                                <span class="text-xs font-bold text-slate-800 block leading-tight truncate">{benefit.titulo}</span>
                                <span class="text-[9px] font-semibold text-slate-450 block mt-0.5 truncate">
                                  {benefit.categorias[0]?.descripcion || "General"} • <span class="text-emerald-700 font-bold">{benefit.resumen}</span>
                                </span>
                              </div>
                            </div>

                            <div class="flex items-center gap-1.5 flex-shrink-0 ml-4">
                              {/* Reorder Buttons */}
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick$={() => {
                                  const currentList = [...selectedIdsList.value];
                                  if (index > 0) {
                                    const temp = currentList[index];
                                    currentList[index] = currentList[index - 1];
                                    currentList[index - 1] = temp;
                                    campaignBenefitIdsSig.value = currentList.join(",");
                                  }
                                }}
                                class="p-1 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                title="Subir orden"
                              >
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                disabled={index === selectedBenefits.value.length - 1}
                                onClick$={() => {
                                  const currentList = [...selectedIdsList.value];
                                  if (index < currentList.length - 1) {
                                    const temp = currentList[index];
                                    currentList[index] = currentList[index + 1];
                                    currentList[index + 1] = temp;
                                    campaignBenefitIdsSig.value = currentList.join(",");
                                  }
                                }}
                                class="p-1 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                                title="Bajar orden"
                              >
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>

                              {/* Remove Button */}
                              <button
                                type="button"
                                onClick$={() => {
                                  const currentList = selectedIdsList.value;
                                  campaignBenefitIdsSig.value = currentList.filter(id => id !== benefit.url).join(",");
                                }}
                                class="p-1 rounded-lg border border-rose-100 text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-all ml-1 cursor-pointer"
                                title="Quitar"
                              >
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div class="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs font-semibold text-slate-450 bg-slate-50/50">
                        Ningún beneficio seleccionado manualmente. Se aplicarán palabras clave de forma automática.
                      </div>
                    )}
                  </div>
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
            <div class="w-full relative rounded-3xl bg-gradient-to-br from-[#0B1527] to-[#020617] border border-slate-800/80 p-6 md:p-8 overflow-hidden shadow-2xl font-sans text-left space-y-5">
              <div class="absolute -right-16 -top-16 w-32 h-32 bg-brand-gold/10 rounded-full blur-[40px] pointer-events-none" />
              <div class="absolute -left-16 -bottom-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-[40px] pointer-events-none" />

              {/* Tag pill */}
              <div class="inline-flex items-center space-x-2 bg-brand-gold/10 border border-brand-gold/25 rounded-full px-3 py-1 w-fit">
                <span class="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse"></span>
                <span class="text-[9px] font-extrabold tracking-widest text-brand-gold uppercase">
                  {campaignTagSig.value || "SELECCIÓN ESPECIAL"}
                </span>
              </div>

              {/* Floating Emoji card + Title */}
              <div class="space-y-3">
                <div class="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center text-xl shadow-lg shadow-black/25">
                  <span>{campaignEmojiSig.value || "🎁"}</span>
                </div>
                <h3 class="text-xl font-display font-black text-white tracking-tight leading-tight">
                  {campaignTitleSig.value || "Especial de Temporada"}
                </h3>
              </div>

              {/* Subtitle */}
              <p class="text-[11px] text-slate-400 font-medium leading-relaxed max-w-sm">
                {campaignSubtitleSig.value || "Disfrutá de beneficios exclusivos seleccionados especialmente para vos con tu credencial digital AMP+."}
              </p>

              {/* Button */}
              <div class="pt-1">
                <button class="inline-flex items-center space-x-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-light text-slate-950 text-[10px] font-extrabold uppercase tracking-wider cursor-not-allowed">
                  <span>Ver todos</span>
                  <span>&rarr;</span>
                </button>
              </div>

              {/* Mock grid to show structure */}
              <div class="border-t border-slate-800/80 pt-4 mt-3">
                <span class="text-[9px] text-slate-500 font-extrabold tracking-widest uppercase block mb-3">Beneficios Relacionados (Vista Previa)</span>
                
                {previewBenefits.value.length > 0 ? (
                  <div class="grid grid-cols-2 gap-3">
                    {previewBenefits.value.map((benefit) => {
                      const discountText = benefit.resumen.replace("Descuento del", "").trim();
                      const isLongDiscount = discountText.length > 12;

                      return (
                        <div key={benefit.id} class="group flex flex-col justify-between bg-slate-950/40 border border-white/5 rounded-2xl p-3 space-y-2.5 relative">
                          <div class="space-y-2">
                            {/* Image Container */}
                            <div class="relative h-16 rounded-xl bg-slate-950/80 border border-white/5 flex items-center justify-center p-1.5">
                              {benefit.imagen ? (
                                <img
                                  src={benefit.imagen.startsWith('http') || benefit.imagen.startsWith('/') ? benefit.imagen : `https://beneficios.amepla.org.ar/files/${benefit.imagen}`}
                                  alt={benefit.titulo}
                                  class="w-full h-full object-contain"
                                  width={100}
                                  height={56}
                                  loading="lazy"
                                />
                              ) : (
                                <span class="text-[8px] font-bold text-slate-650 uppercase">AMP+</span>
                              )}
                              
                              {/* Overlay discount tag */}
                              <div class="absolute bottom-1 right-1">
                                <span class="inline-flex items-center px-1.5 py-0.5 rounded-lg text-[8px] font-black bg-brand-gold text-slate-950 border border-white/10">
                                  {isLongDiscount ? "Promo" : discountText}
                                </span>
                              </div>
                            </div>

                            {/* Long discount tag rendered below image */}
                            {isLongDiscount && (
                              <div class="flex items-center space-x-1 bg-brand-gold/10 border border-brand-gold/20 rounded-lg px-1.5 py-0.5 w-fit">
                                <span class="text-brand-gold text-[8px] font-black uppercase tracking-wider line-clamp-1 leading-none">
                                  {discountText}
                                </span>
                              </div>
                            )}

                            <div class="text-left">
                              <span class="text-[8px] font-extrabold text-brand-gold uppercase tracking-wider block truncate">
                                {benefit.ubicacion[0]?.descripcion || "La Plata"}
                              </span>
                              <span class="text-[10px] font-bold text-slate-200 line-clamp-1 block truncate mt-0.5">
                                {benefit.titulo}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p class="text-[10px] text-slate-500 font-semibold italic text-center py-4">
                    Sin beneficios asignados. Escribí palabras clave o seleccioná beneficios específicos para mostrarlos.
                  </p>
                )}
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
