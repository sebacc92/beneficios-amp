import { component$, useComputed$, useSignal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuArrowDown, LuArrowUp, LuPlus, LuSearch, LuX } from "@qwikest/icons/lucide";
import { getSettings, saveSettings } from "~/server/chatbotDb";
import { getCustomBenefits, type Benefit } from "~/server/cache";
import { CAMPAIGN_DEFAULTS, CAMPAIGN_LIMIT, campaignTerms, matchesCampaign, selectHomeBenefits } from "~/utils/home-benefits";
import { ActionFeedback } from "~/components/admin/action-feedback";
import { AdminPageHeader } from "~/components/admin/page-header";
import { CampaignSpotlight } from "~/components/campaign-spotlight/campaign-spotlight";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

/** How many search results the picker lists before asking for a narrower search. */
const PICKER_LIMIT = 30;

function campaignStatus(active: boolean, count: number, manual: boolean) {
  if (!active) return { key: "off" as const, label: "Desactivada", detail: "No se muestra en el inicio." };
  if (count === 0) {
    return {
      key: "empty" as const,
      label: "Sin beneficios",
      detail: manual
        ? "No se muestra: ninguno de los beneficios elegidos sigue publicado."
        : "No se muestra porque ningún beneficio publicado coincide con las palabras clave.",
    };
  }
  return { key: "visible" as const, label: "Visible", detail: `Se muestra con ${count} beneficio${count === 1 ? "" : "s"}.` };
}

const STATUS_BADGE = { off: "badge badge-muted", empty: "badge badge-muted", visible: "badge badge-accent" };

function thumbUrl(imagen: string | null) {
  if (!imagen) return null;
  return imagen.startsWith("http") || imagen.startsWith("/") ? imagen : `https://beneficios.lprc.ar/files/${imagen}`;
}

// --- SECURITY & LOADERS ---

export const useSettingsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  const settings = await getSettings(event);
  const { cafecitos } = selectHomeBenefits(await getCustomBenefits(event), settings.campaignQuery, settings.campaignBenefitSlugs);
  return { ...settings, liveStatus: campaignStatus(settings.campaignActive, cafecitos.length, settings.campaignBenefitSlugs.length > 0) };
});

/**
 * Published benefits with just the fields selectHomeBenefits and CampaignSpotlight read,
 * in the catalog order the home gets, so the preview runs the same selection.
 */
export const useCampaignCandidatesLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  const benefits = await getCustomBenefits(event);
  return benefits
    .filter((benefit) => benefit.mostrar_app !== 0 && benefit.isActive !== false)
    .map((benefit) => ({
      id: benefit.id,
      url: benefit.url,
      titulo: benefit.titulo,
      resumen: benefit.resumen,
      descripcion: benefit.descripcion,
      imagen: benefit.imagen,
      created_at: benefit.created_at,
      mostrar_app: benefit.mostrar_app,
      isActive: benefit.isActive,
      isFeatured: benefit.isFeatured,
      latitud: null,
      longitud: null,
      categorias: benefit.categorias.map((category) => ({ id: category.id, descripcion: category.descripcion })),
      ubicacion: benefit.ubicacion.slice(0, 1).map((location) => ({ id: location.id, descripcion: location.descripcion })),
      ofertas: [],
    }) satisfies Benefit);
});

// --- ACTIONS ---

export const useUpdateCampaignAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    let slugs: string[] = [];
    try {
      const parsed = JSON.parse(data.campaignBenefitSlugs || "[]");
      if (Array.isArray(parsed)) slugs = [...new Set(parsed.filter((slug): slug is string => typeof slug === "string" && slug.length > 0))];
    } catch {
      return requestEvent.fail(400, { message: "No se pudo leer la selección de beneficios. Recargá la página." });
    }

    try {
      const settings = await getSettings(requestEvent);
      await saveSettings(requestEvent, {
        ...settings,
        campaignActive: data.campaignActive === "on",
        campaignTitle: data.campaignTitle?.trim() || null,
        campaignSubtitle: data.campaignSubtitle?.trim() || null,
        campaignEmoji: data.campaignEmoji?.trim() || null,
        campaignTag: data.campaignTag?.trim() || null,
        campaignQuery: data.campaignQuery?.trim() || null,
        campaignBenefitSlugs: slugs.slice(0, CAMPAIGN_LIMIT),
        updatedAt: new Date().toISOString(),
      });
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
    campaignEmoji: z.string().max(8, "Usá un solo emoji o dejalo vacío.").optional(),
    campaignTag: z.string().optional(),
    campaignQuery: z.string().optional(),
    campaignBenefitSlugs: z.string().optional(),
  })
);

const sectionTitle = "heading-display text-xl text-primary";

export default component$(() => {
  const settings = useSettingsLoader();
  const candidates = useCampaignCandidatesLoader();
  const updateCampaignAction = useUpdateCampaignAction();

  const s = settings.value;

  // Empty fields stay empty: the placeholders show the text the home uses instead.
  const campaignActiveSig = useSignal(s.campaignActive);
  const campaignTitleSig = useSignal(s.campaignTitle || "");
  const campaignSubtitleSig = useSignal(s.campaignSubtitle || "");
  const campaignEmojiSig = useSignal(s.campaignEmoji || "");
  const campaignTagSig = useSignal(s.campaignTag || "");
  const campaignQuerySig = useSignal(s.campaignQuery || "");
  const selectedSlugs = useSignal<string[]>(s.campaignBenefitSlugs);
  const searchSig = useSignal("");

  // Exactly what the home will render with the values in the form.
  const shown = useComputed$(() => selectHomeBenefits(candidates.value, campaignQuerySig.value, selectedSlugs.value).cafecitos);

  const keywordMatches = useComputed$(() => {
    const terms = campaignTerms(campaignQuerySig.value);
    return candidates.value.filter((benefit) => matchesCampaign(benefit, terms)).length;
  });

  const searchResults = useComputed$(() => {
    const term = searchSig.value.trim().toLowerCase();
    return candidates.value
      .filter((benefit) =>
        !term ||
        [benefit.titulo, benefit.resumen, benefit.ubicacion[0]?.descripcion ?? "", ...benefit.categorias.map((category) => category.descripcion)]
          .some((value) => value.toLowerCase().includes(term)),
      )
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
  });

  const manual = selectedSlugs.value.length > 0;
  const draftStatus = campaignStatus(campaignActiveSig.value, shown.value.length, manual);
  const isDirty =
    campaignActiveSig.value !== s.campaignActive ||
    campaignTitleSig.value !== (s.campaignTitle || "") ||
    campaignSubtitleSig.value !== (s.campaignSubtitle || "") ||
    campaignEmojiSig.value !== (s.campaignEmoji || "") ||
    campaignTagSig.value !== (s.campaignTag || "") ||
    campaignQuerySig.value !== (s.campaignQuery || "") ||
    JSON.stringify(selectedSlugs.value) !== JSON.stringify(s.campaignBenefitSlugs);
  const selectedBenefits = selectedSlugs.value.map((slug) => ({ slug, benefit: candidates.value.find((item) => item.url === slug) }));
  const fieldErrors = updateCampaignAction.value?.failed ? updateCampaignAction.value.fieldErrors : undefined;

  return (
    <div class="w-full px-4 sm:px-10 py-8 sm:py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      <AdminPageHeader
        title="Campaña del inicio"
        description="Un bloque temático del inicio (Día del Padre, Fiestas, vuelta a clases…) con hasta 4 beneficios elegidos por vos o por palabras clave."
      />

      <div class="flex flex-wrap items-center gap-3 border border-line bg-surface px-4 py-3 text-left" role="status">
        <span class="eyebrow text-slate-600">Ahora en el inicio</span>
        <span class={STATUS_BADGE[s.liveStatus.key]}>{s.liveStatus.label}</span>
        <span class="text-sm text-slate-700">{s.liveStatus.detail}</span>
      </div>

      {updateCampaignAction.value && (
        <div class="text-left">
          <ActionFeedback value={updateCampaignAction.value} success="Campaña guardada. Ya se ve así en el inicio." />
        </div>
      )}

      <Form action={updateCampaignAction} class="card text-left">
        <input type="hidden" name="campaignBenefitSlugs" value={JSON.stringify(selectedSlugs.value)} />

        <div class="grid grid-cols-1 xl:grid-cols-2 [&>*]:min-w-0">
          <div class="space-y-6 border-b border-line p-5 sm:p-8 xl:border-r xl:border-b-0">
            <div class="flex items-start justify-between gap-4 border-b border-line pb-5">
              <div class="space-y-1">
                <label for="campaign-active" class="field-label mb-0">Mostrar en el inicio</label>
                <p id="campaign-active-hint" class="text-sm text-slate-600">Apagala cuando termine la fecha; los textos y la selección quedan guardados.</p>
              </div>
              <input
                id="campaign-active"
                type="checkbox"
                role="switch"
                name="campaignActive"
                checked={campaignActiveSig.value}
                aria-describedby="campaign-active-hint"
                onChange$={(ev, el) => {
                  campaignActiveSig.value = el.checked;
                }}
                class="relative h-7 w-12 shrink-0 cursor-pointer appearance-none border border-slate-400 bg-surface-muted transition-colors before:absolute before:top-0.5 before:left-0.5 before:h-5 before:w-5 before:bg-slate-500 before:transition-transform before:content-[''] checked:border-primary checked:bg-primary checked:before:translate-x-5 checked:before:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            </div>

            <h2 class={sectionTitle}>Textos</h2>

            <div class="grid grid-cols-1 sm:grid-cols-[1fr_7rem] gap-5">
              <div>
                <label for="campaign-tag" class="field-label">Etiqueta</label>
                <input
                  id="campaign-tag"
                  type="text"
                  name="campaignTag"
                  maxLength={40}
                  value={campaignTagSig.value}
                  onInput$={(ev, el) => {
                    campaignTagSig.value = el.value;
                  }}
                  class="field"
                  placeholder={CAMPAIGN_DEFAULTS.tag}
                />
              </div>

              <div>
                <label for="campaign-emoji" class="field-label">Emoji</label>
                <input
                  id="campaign-emoji"
                  type="text"
                  name="campaignEmoji"
                  maxLength={8}
                  value={campaignEmojiSig.value}
                  onInput$={(ev, el) => {
                    campaignEmojiSig.value = el.value;
                  }}
                  aria-describedby="campaign-emoji-hint"
                  aria-invalid={!!fieldErrors?.campaignEmoji}
                  class="field text-center"
                />
              </div>
              <p id="campaign-emoji-hint" class="sm:col-span-2 -mt-3 text-xs text-slate-500">
                Emoji opcional. El sitio del club no usa emojis en los títulos: dejalo vacío salvo que la campaña lo pida.
                {fieldErrors?.campaignEmoji && <span role="alert" class="block text-red-700">{fieldErrors.campaignEmoji}</span>}
              </p>
            </div>

            <div>
              <label for="campaign-title-input" class="field-label">Título</label>
              <input
                id="campaign-title-input"
                type="text"
                name="campaignTitle"
                maxLength={60}
                value={campaignTitleSig.value}
                onInput$={(ev, el) => {
                  campaignTitleSig.value = el.value;
                }}
                class="field"
                placeholder={CAMPAIGN_DEFAULTS.title}
              />
            </div>

            <div>
              <label for="campaign-subtitle" class="field-label">Bajada</label>
              <textarea
                id="campaign-subtitle"
                name="campaignSubtitle"
                rows={3}
                maxLength={220}
                value={campaignSubtitleSig.value}
                onInput$={(ev, el) => {
                  campaignSubtitleSig.value = el.value;
                }}
                class="field"
                placeholder={CAMPAIGN_DEFAULTS.subtitle}
              />
            </div>
          </div>

          <div class="space-y-6 p-5 sm:p-8">
            <div class="space-y-1">
              <h2 class={sectionTitle}>Beneficios</h2>
              <p class="text-sm text-slate-600">Elegí hasta {CAMPAIGN_LIMIT} y ordenalos. Si no elegís ninguno, se usan las palabras clave.</p>
            </div>

            <section aria-labelledby="campaign-selected-title" class="space-y-2">
              <h3 id="campaign-selected-title" class="field-label">Elegidos ({selectedSlugs.value.length} de {CAMPAIGN_LIMIT})</h3>
              {selectedBenefits.length === 0 ? (
                <p class="border border-dashed border-slate-300 bg-surface-muted p-4 text-sm text-slate-600">
                  Ninguno elegido a mano: la campaña muestra los que coinciden con las palabras clave.
                </p>
              ) : (
                <ol class="space-y-2">
                  {selectedBenefits.map(({ slug, benefit }, index) => (
                    <li key={slug} class="flex items-center gap-3 border border-line bg-surface p-2">
                      <span class="w-5 shrink-0 text-center font-display text-lg font-bold text-slate-400" aria-hidden="true">{index + 1}</span>
                      {thumbUrl(benefit?.imagen ?? null) ? (
                        <img src={thumbUrl(benefit?.imagen ?? null)!} alt="" width={48} height={48} loading="lazy" class="h-12 w-12 shrink-0 object-cover" />
                      ) : (
                        <span class="h-12 w-12 shrink-0 bg-surface-muted" aria-hidden="true" />
                      )}
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-bold text-primary">{benefit?.titulo ?? slug}</p>
                        <p class="truncate text-xs text-slate-500">
                          {benefit ? `${benefit.ubicacion[0]?.descripcion ?? "La Plata"} · ${benefit.resumen}` : "Ya no está publicado: no se muestra."}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick$={() => {
                          const items = [...selectedSlugs.value];
                          [items[index - 1], items[index]] = [items[index], items[index - 1]];
                          selectedSlugs.value = items;
                        }}
                        class="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-line text-slate-600 hover:border-primary hover:text-primary disabled:opacity-30 cursor-pointer"
                        aria-label={`Subir ${benefit?.titulo ?? slug}`}
                      >
                        <LuArrowUp class="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={index === selectedBenefits.length - 1}
                        onClick$={() => {
                          const items = [...selectedSlugs.value];
                          [items[index + 1], items[index]] = [items[index], items[index + 1]];
                          selectedSlugs.value = items;
                        }}
                        class="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-line text-slate-600 hover:border-primary hover:text-primary disabled:opacity-30 cursor-pointer"
                        aria-label={`Bajar ${benefit?.titulo ?? slug}`}
                      >
                        <LuArrowDown class="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick$={() => (selectedSlugs.value = selectedSlugs.value.filter((item) => item !== slug))}
                        class="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-line text-red-700 hover:border-red-600 hover:bg-red-50 cursor-pointer"
                        aria-label={`Quitar ${benefit?.titulo ?? slug}`}
                      >
                        <LuX class="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-labelledby="campaign-search-label" class="space-y-2">
              <label id="campaign-search-label" for="campaign-search" class="field-label">Buscar beneficios publicados</label>
              <div class="relative">
                <LuSearch class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="campaign-search"
                  type="search"
                  value={searchSig.value}
                  onInput$={(ev, el) => (searchSig.value = el.value)}
                  placeholder="Nombre, rubro o zona"
                  aria-controls="campaign-results"
                  class="field pl-9"
                />
              </div>
              <p class="text-xs text-slate-500" aria-live="polite">
                {searchResults.value.length === 0
                  ? "Ningún beneficio publicado coincide con la búsqueda."
                  : searchResults.value.length > PICKER_LIMIT
                    ? `${searchResults.value.length} beneficios; se listan los primeros ${PICKER_LIMIT}. Escribí para acotar.`
                    : `${searchResults.value.length} beneficio${searchResults.value.length === 1 ? "" : "s"}.`}
              </p>
              <ul id="campaign-results" class="max-h-80 divide-y divide-line overflow-y-auto border border-line">
                {searchResults.value.slice(0, PICKER_LIMIT).map((benefit) => {
                  const isSelected = selectedSlugs.value.includes(benefit.url);
                  const full = selectedSlugs.value.length >= CAMPAIGN_LIMIT;
                  return (
                    <li key={benefit.url} class="flex items-center gap-3 bg-surface p-2">
                      {thumbUrl(benefit.imagen) ? (
                        <img src={thumbUrl(benefit.imagen)!} alt="" width={40} height={40} loading="lazy" class="h-10 w-10 shrink-0 object-cover" />
                      ) : (
                        <span class="h-10 w-10 shrink-0 bg-surface-muted" aria-hidden="true" />
                      )}
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-bold text-primary">{benefit.titulo}</p>
                        <p class="truncate text-xs text-slate-500">{benefit.ubicacion[0]?.descripcion ?? "La Plata"} · {benefit.resumen}</p>
                      </div>
                      <button
                        type="button"
                        disabled={isSelected || full}
                        onClick$={() => (selectedSlugs.value = [...selectedSlugs.value, benefit.url])}
                        class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 border border-primary px-3 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-white disabled:border-line disabled:text-slate-400 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                        aria-label={isSelected ? `${benefit.titulo} ya está elegido` : `Agregar ${benefit.titulo}`}
                      >
                        {isSelected ? "Elegido" : (
                          <>
                            <LuPlus class="h-4 w-4" aria-hidden="true" />
                            <span class="hidden sm:inline">Agregar</span>
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <div class={manual ? "opacity-70" : ""}>
              <label for="campaign-query" class="field-label">Palabras clave (respaldo)</label>
              <input
                id="campaign-query"
                type="text"
                name="campaignQuery"
                value={campaignQuerySig.value}
                onInput$={(ev, el) => {
                  campaignQuerySig.value = el.value;
                }}
                aria-describedby="campaign-query-hint"
                class="field font-mono"
                placeholder={CAMPAIGN_DEFAULTS.query}
              />
              <p id="campaign-query-hint" class="mt-1 text-xs text-slate-500">
                Separadas por comas. Se buscan en el título, el resumen, la descripción y el rubro; vacías, se usan las del ejemplo.{" "}
                {manual
                  ? "Ahora no se usan porque elegiste beneficios a mano."
                  : `Coinciden ${keywordMatches.value} beneficio${keywordMatches.value === 1 ? "" : "s"}; se muestran hasta ${CAMPAIGN_LIMIT}, priorizando los que no figuran en Destacados ni en Nuevos.`}
              </p>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-4 border-t border-line bg-surface-muted px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p class="flex flex-wrap items-center gap-2 text-sm text-slate-700" aria-live="polite">
            <span class="font-bold">{isDirty ? "Al guardar:" : "Sin cambios:"}</span>
            <span class={STATUS_BADGE[draftStatus.key]}>{draftStatus.label}</span>
            <span>{draftStatus.detail}</span>
          </p>
          <button type="submit" disabled={updateCampaignAction.isRunning} class="btn btn-primary shrink-0">
            {updateCampaignAction.isRunning ? "Guardando..." : "Guardar campaña"}
          </button>
        </div>
      </Form>

      <section aria-labelledby="campaign-preview-title" class="space-y-3 text-left">
        <h2 id="campaign-preview-title" class={sectionTitle}>Vista previa en el inicio</h2>
        {draftStatus.key === "visible" ? (
          <div class="border border-line bg-background">
            <CampaignSpotlight
              preview
              tag={campaignTagSig.value || CAMPAIGN_DEFAULTS.tag}
              title={campaignTitleSig.value || CAMPAIGN_DEFAULTS.title}
              subtitle={campaignSubtitleSig.value || CAMPAIGN_DEFAULTS.subtitle}
              emoji={campaignEmojiSig.value || null}
              benefits={shown.value}
            />
          </div>
        ) : (
          <p class="border border-dashed border-slate-300 bg-surface-muted p-6 text-sm text-slate-600">
            Con estos datos la campaña no aparece en el inicio. {draftStatus.detail}
          </p>
        )}
      </section>
    </div>
  );
});

export const head: DocumentHead = {
  title: "LPRC Campaña Temática",
  meta: [
    {
      name: "description",
      content: "Administración de la campaña temática destacada de la página de inicio.",
    },
  ],
};
