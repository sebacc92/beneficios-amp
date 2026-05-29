import { component$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuImage } from "@qwikest/icons/lucide";
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

export const useUpdatePopupAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      let uploadedImageUrl = data.popupImageUrl || null;

      if (data.image && typeof data.image === "object" && (data.image as Blob).size > 0) {
        const file = data.image as File;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploadsDir = `${process.cwd()}/public/uploads`;
        const fsModule = await import("fs/promises");
        await fsModule.mkdir(uploadsDir, { recursive: true });

        const extension = file.name.split(".").pop() || "png";
        const fileName = `popup-promo-${Date.now()}.${extension}`;
        const filePath = `${uploadsDir}/${fileName}`;
        await fsModule.writeFile(filePath, buffer);

        uploadedImageUrl = `/uploads/${fileName}`;
      }

      const settings = await getSettings(requestEvent);
      const updatedSettings = {
        ...settings,
        popupActive: data.popupActive === "on",
        popupTitle: data.popupTitle || null,
        popupDescription: data.popupDescription || null,
        popupButtonText: data.popupButtonText || null,
        popupButtonLink: data.popupButtonLink || null,
        popupImageUrl: uploadedImageUrl,
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
    popupActive: z.string().optional(),
    popupTitle: z.string().optional(),
    popupDescription: z.string().optional(),
    popupButtonText: z.string().optional(),
    popupButtonLink: z.string().optional(),
    popupImageUrl: z.string().optional(),
    image: z.any().optional(),
  })
);

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
  const updatePopupAction = useUpdatePopupAction();
  const updateCampaignAction = useUpdateCampaignAction();

  const activeTab = useSignal<"popup" | "campaign">("popup");

  const s = settings.value;

  // Popup Signals
  const popupTitleSig = useSignal(s.popupTitle || "¡Gran Beneficio Especial!");
  const popupDescSig = useSignal(s.popupDescription || "Disfrutá de un descuento exclusivo en nuestra red médica adherida.");
  const popupButtonTextSig = useSignal(s.popupButtonText || "Ver Detalles");
  const popupButtonLinkSig = useSignal(s.popupButtonLink || "/");
  const popupImageUrlSig = useSignal(s.popupImageUrl || "");
  const popupActiveSig = useSignal(s.popupActive);

  // Campaign Signals
  const campaignActiveSig = useSignal(s.campaignActive);
  const campaignTitleSig = useSignal(s.campaignTitle || "Cafecitos & Desayunos");
  const campaignSubtitleSig = useSignal(s.campaignSubtitle || "Disfrutá del mejor aroma a café, desayunos premium y meriendas increíbles con tu credencial digital AMP+.");
  const campaignEmojiSig = useSignal(s.campaignEmoji || "☕");
  const campaignTagSig = useSignal(s.campaignTag || "SELECCIÓN GOURMET");
  const campaignQuerySig = useSignal(s.campaignQuery || "cafe,café,desayuno,factura,gastronomia,gastro");

  const previewUrl = useSignal<string | null>(null);

  const handleFileChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const file = element.files[0];
    previewUrl.value = URL.createObjectURL(file);
    popupImageUrlSig.value = "";
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
            Campañas & Popup Inicial
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Gestioná los espacios destacados temporales: el popup de ingreso y la sección temática interactiva de la página de inicio.
          </p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div class="flex border-b border-slate-200">
        <button
          onClick$={() => (activeTab.value = "popup")}
          class={[
            "px-6 py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer uppercase tracking-wider",
            activeTab.value === "popup"
              ? "border-brand-green text-brand-green"
              : "border-transparent text-slate-400 hover:text-slate-650",
          ]}
        >
          Popup de Bienvenida
        </button>
        <button
          onClick$={() => (activeTab.value = "campaign")}
          class={[
            "px-6 py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer uppercase tracking-wider",
            activeTab.value === "campaign"
              ? "border-brand-green text-brand-green"
              : "border-transparent text-slate-400 hover:text-slate-650",
          ]}
        >
          Campaña Destacada (Home)
        </button>
      </div>

      {activeTab.value === "popup" && updatePopupAction.value?.success && (
        <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm text-left">
          ✓ Configuración del Popup de Bienvenida guardada exitosamente.
        </div>
      )}

      {activeTab.value === "campaign" && updateCampaignAction.value?.success && (
        <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm text-left">
          ✓ Campaña especial guardada exitosamente. Se aplicará de forma inmediata en la home.
        </div>
      )}

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: EDITORS */}
        <div class="lg:col-span-7">
          {/* TAB 1: POPUP EDITOR */}
          {activeTab.value === "popup" && (
            <Form action={updatePopupAction} enctype="multipart/form-data" class="space-y-6">
              <input type="hidden" name="popupImageUrl" value={popupImageUrlSig.value} />

              <div class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl text-left font-sans">
                <div class="flex items-center justify-between border-b border-slate-100 bg-[#0a442a] px-8 py-5 text-white">
                  <div>
                    <h2 class="flex items-center gap-2 text-lg font-display font-extrabold text-brand-gold">
                      Modal de Anuncio de Bienvenida
                    </h2>
                    <p class="text-[10px] font-bold tracking-wider text-slate-200 uppercase mt-0.5">
                      Configurá el popup flotante para avisos o saludos de ingreso
                    </p>
                  </div>
                </div>

                <div class="p-8 space-y-6">
                  {/* Active Toggle */}
                  <div class="flex items-center justify-between border-b border-slate-100 pb-5">
                    <div class="space-y-0.5">
                      <span class="text-xs font-bold text-slate-800 uppercase tracking-wider block font-sans">Activar Popup</span>
                      <span class="text-[11px] text-slate-400 font-semibold font-sans">Si está marcado, se mostrará automáticamente en la página principal una vez por sesión.</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        name="popupActive"
                        checked={popupActiveSig.value}
                        onChange$={(ev, el) => {
                          popupActiveSig.value = el.checked;
                        }}
                        class="sr-only peer"
                      />
                      <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
                    </label>
                  </div>

                  {/* Title */}
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block font-sans">Título del Anuncio</label>
                    <input
                      type="text"
                      name="popupTitle"
                      value={popupTitleSig.value}
                      onInput$={(ev, el) => {
                        popupTitleSig.value = el.value;
                      }}
                      class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-bold font-sans"
                      placeholder="Ej: ¡Gran Beneficio Especial!"
                    />
                  </div>

                  {/* Description */}
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block font-sans">Descripción del Anuncio</label>
                    <textarea
                      name="popupDescription"
                      rows={4}
                      value={popupDescSig.value}
                      onInput$={(ev, el) => {
                        popupDescSig.value = el.value;
                      }}
                      class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-medium font-sans"
                      placeholder="Detalles sobre la promoción..."
                    />
                  </div>

                  {/* Image Upload */}
                  <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block font-sans">Imagen del Popup</label>
                    <div class="flex items-center gap-4 font-sans">
                      <div class="w-16 h-16 bg-slate-100 rounded-2xl border border-slate-250 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {previewUrl.value ? (
                          <img src={previewUrl.value} alt="Preview" class="w-full h-full object-cover" />
                        ) : popupImageUrlSig.value ? (
                          <img src={popupImageUrlSig.value} alt="Current" class="w-full h-full object-cover" />
                        ) : (
                          <LuImage class="w-7 h-7 text-slate-400" />
                        )}
                      </div>
                      <div class="flex gap-2">
                        <label class="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-extrabold rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm">
                          <LuImage class="w-4 h-4 text-brand-green" />
                          Subir Imagen
                          <input
                            id="image-file-input"
                            type="file"
                            name="image"
                            accept="image/*"
                            onChange$={handleFileChange}
                            class="hidden"
                          />
                        </label>
                        {(previewUrl.value || popupImageUrlSig.value) && (
                          <button
                            type="button"
                            onClick$={() => {
                              previewUrl.value = null;
                              popupImageUrlSig.value = "";
                              const fileInput = document.getElementById("image-file-input") as HTMLInputElement;
                              if (fileInput) fileInput.value = "";
                            }}
                            class="px-5 py-2.5 border border-red-200 hover:bg-red-50 text-red-650 text-xs font-extrabold rounded-2xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                          >
                            Eliminar Imagen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Button Details */}
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-1">
                      <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block font-sans">Texto del Botón</label>
                      <input
                        type="text"
                        name="popupButtonText"
                        value={popupButtonTextSig.value}
                        onInput$={(ev, el) => {
                          popupButtonTextSig.value = el.value;
                        }}
                        class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-bold font-sans"
                        placeholder="Ej: Ver Más"
                      />
                    </div>

                    <div class="space-y-1">
                      <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block font-sans">Enlace del Botón</label>
                      <input
                        type="text"
                        name="popupButtonLink"
                        value={popupButtonLinkSig.value}
                        onInput$={(ev, el) => {
                          popupButtonLinkSig.value = el.value;
                        }}
                        class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-sans"
                        placeholder="Ej: /beneficio/descuento-farmacia"
                      />
                    </div>
                  </div>
                </div>

                <div class="bg-slate-50 px-8 py-5 flex justify-end border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={updatePopupAction.isRunning}
                    class="py-3.5 px-7 rounded-2xl bg-brand-green hover:bg-[#083521] disabled:bg-slate-350 text-white text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg shadow-brand-green/10 transition-all duration-300 active:scale-95 cursor-pointer font-sans"
                  >
                    {updatePopupAction.isRunning ? "Guardando..." : "Guardar Popup"}
                  </button>
                </div>
              </div>
            </Form>
          )}

          {/* TAB 2: CAMPAIGN EDITOR */}
          {activeTab.value === "campaign" && (
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
          )}
        </div>

        {/* RIGHT COLUMN: PREVIEWS */}
        <div class="lg:col-span-5 space-y-6">
          {/* POPUP PREVIEW */}
          {activeTab.value === "popup" && (
            <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl text-left">
              <h3 class="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-1.5 font-sans">
                <span class="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse"></span>
                Vista Previa en Vivo (Escritorio / Móvil)
              </h3>

              {/* Visual Phone Frame Mockup Container */}
              <div class="relative bg-slate-900/5 rounded-[2.5rem] p-4 border border-slate-200/50 shadow-inner overflow-hidden max-w-sm mx-auto aspect-[9/16] flex items-center justify-center font-sans">
                {/* Status Indicator Badge */}
                <div class={`absolute top-6 left-6 z-20 px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase shadow-sm ${popupActiveSig.value ? 'bg-emerald-500 text-white border border-emerald-400' : 'bg-rose-500 text-white border border-rose-450'}`}>
                  {popupActiveSig.value ? 'ACTIVO' : 'DESACTIVADO'}
                </div>

                {/* Home Page Backdrop Simulation */}
                <div class="absolute inset-0 bg-[#072f1d] opacity-90 blur-[1px] select-none flex flex-col justify-between p-6">
                  <div class="w-full flex justify-between items-center opacity-40">
                    <div class="h-4 w-12 bg-white rounded-full"></div>
                    <div class="h-4 w-4 bg-white rounded-full"></div>
                  </div>
                  <div class="space-y-3 opacity-40">
                    <div class="h-2 w-3/4 bg-white rounded-full"></div>
                    <div class="h-2 w-full bg-white rounded-full"></div>
                    <div class="h-2 w-1/2 bg-white rounded-full"></div>
                  </div>
                </div>

                {/* Popup Modal Box Simulator */}
                <div class="relative z-10 w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90%] scale-95 origin-center">
                  {/* Close Button X (mockup only) */}
                  <div class="absolute top-3 right-3 z-30 bg-slate-950/60 hover:bg-slate-950/80 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] cursor-not-allowed">
                    ✕
                  </div>

                  {/* Modal Promo Image */}
                  <div class="relative w-full aspect-[16/10] bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {previewUrl.value ? (
                      <img src={previewUrl.value} alt="Preview" class="w-full h-full object-cover" />
                    ) : popupImageUrlSig.value ? (
                      <img src={popupImageUrlSig.value} alt="Popup Image" class="w-full h-full object-cover" />
                    ) : (
                      <div class="flex flex-col items-center justify-center text-slate-400 p-4">
                        <svg class="w-8 h-8 opacity-50 mb-1" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                        <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400">Sin Imagen</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div class="p-5 flex flex-col flex-1 overflow-y-auto space-y-3.5 text-left">
                    <h4 class="text-sm font-black text-brand-green-dark leading-tight line-clamp-2">
                      {popupTitleSig.value || "Sin Título"}
                    </h4>
                    <p class="text-[10px] font-semibold text-slate-550 leading-relaxed line-clamp-4">
                      {popupDescSig.value || "Sin Descripción"}
                    </p>

                    {/* Action Link Button */}
                    <div class="pt-1.5">
                      <button class="w-full py-2.5 rounded-xl bg-brand-gold text-white font-extrabold text-[10px] uppercase tracking-widest shadow-md shadow-brand-gold/15 cursor-not-allowed">
                        {popupButtonTextSig.value || "Ver Más"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CAMPAIGN PREVIEW */}
          {activeTab.value === "campaign" && (
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
          )}
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "AMP+ Portada & Campañas",
  meta: [
    {
      name: "description",
      content: "Administración de campañas destacadas y popups promocionales.",
    },
  ],
};
