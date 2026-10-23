import { component$, useComputed$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuMonitor, LuSmartphone } from "@qwikest/icons/lucide";
import { getSettings, saveSettings } from "~/server/chatbotDb";
import { putImage } from "~/server/media";
import { ActionFeedback } from "~/components/admin/action-feedback";
import { AdminPageHeader } from "~/components/admin/page-header";
import { POPUP_DEFAULTS, PopupModal } from "~/components/popup-modal/popup-modal";
import { POPUP_AUDIENCES, shouldShowPopup, type PopupAudience } from "~/utils/popup";
import { buenosAiresLocalToIso, formatDateTime, isoToBuenosAiresLocal } from "~/utils/club-content";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

interface PopupSchedule {
  popupActive: boolean;
  popupStartsAt: string | null;
  popupEndsAt: string | null;
  popupAudience: PopupAudience;
}

type PopupStatus = { key: "visible" | "scheduled" | "expired" | "off"; label: string; detail: string };

const audienceLabel = (audience: PopupAudience) =>
  (POPUP_AUDIENCES.find((option) => option.value === audience)?.label ?? POPUP_AUDIENCES[0].label).toLowerCase();

/** The same rule the home applies (shouldShowPopup), explained for the admin. */
function popupStatus(schedule: PopupSchedule, now = new Date()): PopupStatus {
  if (!schedule.popupActive) return { key: "off", label: "Desactivado", detail: "No se muestra en el inicio." };
  const ends = schedule.popupEndsAt ? ` hasta el ${formatDateTime(schedule.popupEndsAt)} hs` : "";
  if (shouldShowPopup(schedule, { loggedIn: true, now }) || shouldShowPopup(schedule, { loggedIn: false, now })) {
    return { key: "visible", label: "Visible ahora", detail: `Para ${audienceLabel(schedule.popupAudience)}${ends}.` };
  }
  const starts = schedule.popupStartsAt ? Date.parse(schedule.popupStartsAt) : NaN;
  if (!Number.isNaN(starts) && now.getTime() < starts) {
    return { key: "scheduled", label: "Programado", detail: `Se muestra desde el ${formatDateTime(schedule.popupStartsAt!)} hs${ends}.` };
  }
  return { key: "expired", label: "Vencido", detail: `Dejó de mostrarse el ${formatDateTime(schedule.popupEndsAt ?? "")} hs.` };
}

const STATUS_BADGE: Record<PopupStatus["key"], string> = {
  visible: "badge badge-accent",
  scheduled: "badge badge-dark",
  expired: "badge badge-muted",
  off: "badge badge-muted",
};

/** Internal paths ("/beneficios/") or full http(s) links; anything else would break the button. */
function isValidPopupLink(value: string): boolean {
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

// --- SECURITY & LOADERS ---

export const useSettingsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  const settings = await getSettings(event);
  return { ...settings, status: popupStatus(settings) };
});

// --- ACTIONS ---

const localDateTime = z
  .string()
  .optional()
  .refine((value) => !value || buenosAiresLocalToIso(value) !== null, "Ingresá fecha y hora.");

export const useUpdatePopupAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const uploadedImageUrl = (await putImage(requestEvent, "popup-promo", undefined, data.image)) ?? (data.popupImageUrl || null);

      const settings = await getSettings(requestEvent);
      await saveSettings(requestEvent, {
        ...settings,
        popupActive: data.popupActive === "on",
        popupTitle: data.popupTitle?.trim() || null,
        popupDescription: data.popupDescription?.trim() || null,
        popupButtonText: data.popupButtonText?.trim() || null,
        popupButtonLink: data.popupButtonLink?.trim() || null,
        popupImageUrl: uploadedImageUrl,
        popupStartsAt: data.popupStartsAt ? buenosAiresLocalToIso(data.popupStartsAt) : null,
        popupEndsAt: data.popupEndsAt ? buenosAiresLocalToIso(data.popupEndsAt) : null,
        popupAudience: data.popupAudience,
        updatedAt: new Date().toISOString(),
      });
      return { success: true };
    } catch (e: any) {
      console.error(e);
      return requestEvent.fail(500, { message: e.message || "Error al guardar." });
    }
  },
  zod$(
    z
      .object({
        popupActive: z.string().optional(),
        popupTitle: z.string().optional(),
        popupDescription: z.string().optional(),
        popupButtonText: z.string().optional(),
        popupButtonLink: z
          .string()
          .optional()
          .refine((value) => !value?.trim() || isValidPopupLink(value.trim()), "Usá una ruta del sitio que empiece con / (por ejemplo /beneficios/) o un link completo con https://"),
        popupImageUrl: z.string().optional(),
        popupStartsAt: localDateTime,
        popupEndsAt: localDateTime,
        popupAudience: z.enum(["all", "members", "guests"]).default("all"),
        image: z.any().optional(),
      })
      .refine(
        (data) => !data.popupStartsAt || !data.popupEndsAt || data.popupEndsAt > data.popupStartsAt,
        { message: "El fin tiene que ser posterior al inicio.", path: ["popupEndsAt"] },
      ),
  )
);

const inputClass = "field";

export default component$(() => {
  const settings = useSettingsLoader();
  const updatePopupAction = useUpdatePopupAction();

  const s = settings.value;

  // Empty fields stay empty: the placeholders and the preview show what the home uses instead.
  const popupTitleSig = useSignal(s.popupTitle || "");
  const popupDescSig = useSignal(s.popupDescription || "");
  const popupButtonTextSig = useSignal(s.popupButtonText || "");
  const popupButtonLinkSig = useSignal(s.popupButtonLink || "");
  const popupImageUrlSig = useSignal(s.popupImageUrl || "");
  const popupActiveSig = useSignal(s.popupActive);
  const startsSig = useSignal(s.popupStartsAt ? isoToBuenosAiresLocal(s.popupStartsAt) : "");
  const endsSig = useSignal(s.popupEndsAt ? isoToBuenosAiresLocal(s.popupEndsAt) : "");
  const audienceSig = useSignal<PopupAudience>(s.popupAudience);

  const previewUrl = useSignal<string | null>(null);

  const handleFileChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const file = element.files[0];
    previewUrl.value = URL.createObjectURL(file);
    popupImageUrlSig.value = "";
  });

  const draftStatus = useComputed$(() =>
    popupStatus({
      popupActive: popupActiveSig.value,
      popupStartsAt: buenosAiresLocalToIso(startsSig.value),
      popupEndsAt: buenosAiresLocalToIso(endsSig.value),
      popupAudience: audienceSig.value,
    }),
  );

  const previewSettings = {
    popupTitle: popupTitleSig.value,
    popupDescription: popupDescSig.value,
    popupImageUrl: previewUrl.value || popupImageUrlSig.value || null,
    popupButtonText: popupButtonTextSig.value,
    popupButtonLink: popupButtonLinkSig.value,
  };

  const linkValue = popupButtonLinkSig.value.trim();
  const linkInvalid = linkValue !== "" && !isValidPopupLink(linkValue);
  const fieldErrors = updatePopupAction.value?.failed ? updatePopupAction.value.fieldErrors : undefined;
  const status = s.status;

  return (
    <div class="w-full px-4 sm:px-10 py-8 sm:py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      <AdminPageHeader
        title="Popup del inicio"
        description="Un aviso que aparece sobre el inicio. Cada visitante lo ve hasta que lo cierra; vuelve a aparecer si cambiás el contenido."
      />
      <div class="flex flex-wrap items-center gap-3 border border-line bg-surface px-4 py-3 text-left" role="status">
        <span class="eyebrow text-slate-600">Ahora en el sitio</span>
        <span class={STATUS_BADGE[status.key]}>{status.label}</span>
        <span class="text-sm text-slate-700">{status.detail}</span>
      </div>

      {updatePopupAction.value && (
        <div class="text-left">
          <ActionFeedback value={updatePopupAction.value} success="Popup guardado." />
        </div>
      )}

      <div class="grid grid-cols-1 gap-8 items-start lg:grid-cols-12">
        <div class="min-w-0 lg:col-span-7">
          <Form action={updatePopupAction} enctype="multipart/form-data" class="card text-left">
            <input type="hidden" name="popupImageUrl" value={popupImageUrlSig.value} />

            <fieldset class="space-y-5 border-b border-line p-5 sm:p-8">
              <legend class="sr-only">Publicación</legend>
              <h2 class="heading-display text-xl text-primary">Cuándo y a quién</h2>

              <div class="flex items-start justify-between gap-4">
                <div class="space-y-1">
                  <label for="popup-active" class="field-label mb-0">Mostrar el popup</label>
                  <p id="popup-active-hint" class="text-sm text-slate-600">
                    Se muestra hasta que el visitante lo cierra; vuelve a aparecer si cambiás el contenido.
                  </p>
                </div>
                <input
                  id="popup-active"
                  type="checkbox"
                  role="switch"
                  name="popupActive"
                  checked={popupActiveSig.value}
                  aria-describedby="popup-active-hint"
                  onChange$={(ev, el) => {
                    popupActiveSig.value = el.checked;
                  }}
                  class="relative h-7 w-12 shrink-0 cursor-pointer appearance-none border border-slate-400 bg-surface-muted transition-colors before:absolute before:top-0.5 before:left-0.5 before:h-5 before:w-5 before:bg-slate-500 before:transition-transform before:content-[''] checked:border-primary checked:bg-primary checked:before:translate-x-5 checked:before:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label for="popup-starts" class="field-label">Desde (opcional)</label>
                  <input
                    id="popup-starts"
                    type="datetime-local"
                    name="popupStartsAt"
                    value={startsSig.value}
                    onInput$={(ev, el) => (startsSig.value = el.value)}
                    aria-invalid={!!fieldErrors?.popupStartsAt}
                    aria-describedby="popup-schedule-hint"
                    class={inputClass}
                  />
                  {fieldErrors?.popupStartsAt && <p role="alert" class="mt-1 text-xs text-red-700">{fieldErrors.popupStartsAt}</p>}
                </div>
                <div>
                  <label for="popup-ends" class="field-label">Hasta (opcional)</label>
                  <input
                    id="popup-ends"
                    type="datetime-local"
                    name="popupEndsAt"
                    value={endsSig.value}
                    min={startsSig.value || undefined}
                    onInput$={(ev, el) => (endsSig.value = el.value)}
                    aria-invalid={!!fieldErrors?.popupEndsAt}
                    aria-describedby={fieldErrors?.popupEndsAt ? "popup-ends-error" : "popup-schedule-hint"}
                    class={inputClass}
                  />
                  {fieldErrors?.popupEndsAt && <p id="popup-ends-error" role="alert" class="mt-1 text-xs text-red-700">{fieldErrors.popupEndsAt}</p>}
                </div>
                <p id="popup-schedule-hint" class="sm:col-span-2 -mt-2 text-xs text-slate-500">
                  Hora de La Plata. Sin “Desde” se muestra apenas lo guardás activo; sin “Hasta”, hasta que lo desactives.
                </p>
              </div>

              <div>
                <label for="popup-audience" class="field-label">Quiénes lo ven</label>
                <select
                  id="popup-audience"
                  name="popupAudience"
                  value={audienceSig.value}
                  onChange$={(ev, el) => (audienceSig.value = el.value as PopupAudience)}
                  class={`${inputClass} cursor-pointer`}
                >
                  {POPUP_AUDIENCES.map((option) => (
                    <option key={option.value} value={option.value} selected={audienceSig.value === option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <p class="flex flex-wrap items-center gap-2 text-sm text-slate-700" aria-live="polite">
                <span class="font-bold">Al guardar:</span>
                <span class={STATUS_BADGE[draftStatus.value.key]}>{draftStatus.value.label}</span>
                <span>{draftStatus.value.detail}</span>
              </p>
            </fieldset>

            <fieldset class="space-y-5 p-5 sm:p-8">
              <legend class="sr-only">Contenido</legend>
              <h2 class="heading-display text-xl text-primary">Contenido</h2>

              <div>
                <label for="popup-title" class="field-label">Título</label>
                <input
                  id="popup-title"
                  type="text"
                  name="popupTitle"
                  maxLength={80}
                  value={popupTitleSig.value}
                  onInput$={(ev, el) => {
                    popupTitleSig.value = el.value;
                  }}
                  class={inputClass}
                  placeholder={POPUP_DEFAULTS.title}
                />
              </div>

              <div>
                <label for="popup-description" class="field-label">Texto</label>
                <textarea
                  id="popup-description"
                  name="popupDescription"
                  rows={4}
                  value={popupDescSig.value}
                  onInput$={(ev, el) => {
                    popupDescSig.value = el.value;
                  }}
                  class={inputClass}
                  placeholder="Contá la novedad en dos o tres líneas."
                />
              </div>

              <div>
                <label for="popup-image" class="field-label">Imagen (opcional)</label>
                <input
                  id="popup-image"
                  type="file"
                  name="image"
                  accept="image/jpeg,image/png,image/webp"
                  aria-describedby="popup-image-hint"
                  onChange$={handleFileChange}
                  class="block w-full text-sm text-slate-600 file:mr-4 file:min-h-11 file:cursor-pointer file:border file:border-primary file:bg-surface file:px-4 file:py-2 file:text-sm file:font-bold file:text-primary hover:file:bg-surface-muted"
                />
                <p id="popup-image-hint" class="mt-1 text-xs text-slate-500">Foto horizontal, idealmente 1200×600 (2:1). Se recorta al centro.</p>
                {(previewUrl.value || popupImageUrlSig.value) && (
                  <button
                    type="button"
                    onClick$={() => {
                      previewUrl.value = null;
                      popupImageUrlSig.value = "";
                      const fileInput = document.getElementById("popup-image") as HTMLInputElement | null;
                      if (fileInput) fileInput.value = "";
                    }}
                    class="mt-2 inline-flex min-h-11 items-center border border-red-300 px-4 text-sm font-bold text-red-700 hover:bg-red-50 cursor-pointer"
                  >
                    Quitar imagen
                  </button>
                )}
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label for="popup-button-text" class="field-label">Texto del botón</label>
                  <input
                    id="popup-button-text"
                    type="text"
                    name="popupButtonText"
                    maxLength={40}
                    value={popupButtonTextSig.value}
                    onInput$={(ev, el) => {
                      popupButtonTextSig.value = el.value;
                    }}
                    class={inputClass}
                    placeholder={POPUP_DEFAULTS.buttonText}
                  />
                </div>

                <div>
                  <label for="popup-button-link" class="field-label">Link del botón</label>
                  <input
                    id="popup-button-link"
                    type="text"
                    inputMode="url"
                    name="popupButtonLink"
                    value={popupButtonLinkSig.value}
                    onInput$={(ev, el) => {
                      popupButtonLinkSig.value = el.value;
                    }}
                    aria-invalid={linkInvalid || !!fieldErrors?.popupButtonLink}
                    aria-describedby={linkInvalid || fieldErrors?.popupButtonLink ? "popup-link-error" : "popup-link-hint"}
                    class={inputClass}
                    placeholder="/beneficios/ o https://..."
                  />
                  {linkInvalid || fieldErrors?.popupButtonLink ? (
                    <p id="popup-link-error" role="alert" class="mt-1 text-xs text-red-700">
                      {fieldErrors?.popupButtonLink ?? "Usá una ruta del sitio que empiece con / o un link completo con https://"}
                    </p>
                  ) : (
                    <p id="popup-link-hint" class="mt-1 text-xs text-slate-500">Sin link, el popup no muestra botón.</p>
                  )}
                </div>
              </div>
            </fieldset>

            <div class="flex justify-end border-t border-line bg-surface-muted px-5 py-4 sm:px-8">
              <button type="submit" disabled={updatePopupAction.isRunning || linkInvalid} class="btn btn-primary">
                {updatePopupAction.isRunning ? "Guardando..." : "Guardar popup"}
              </button>
            </div>
          </Form>
        </div>

        <section aria-labelledby="popup-mobile-preview" class="min-w-0 lg:col-span-5 lg:sticky lg:top-24 space-y-3 text-left">
          <h2 id="popup-mobile-preview" class="flex items-center gap-2 heading-display text-lg text-primary">
            <LuSmartphone class="h-5 w-5" aria-hidden="true" />
            Vista previa en el celular
          </h2>
          <div class="mx-auto flex min-h-[640px] w-full max-w-[390px] items-center justify-center border-[6px] border-primary bg-brand-ink/80 p-4">
            <PopupModal preview settings={previewSettings} />
          </div>
          <p class="text-xs text-slate-500 text-center">Ancho de un teléfono de 390 px. El fondo oscuro es el inicio, atenuado.</p>
        </section>
      </div>

      <section aria-labelledby="popup-desktop-preview" class="hidden md:block space-y-3 text-left">
        <h2 id="popup-desktop-preview" class="flex items-center gap-2 heading-display text-lg text-primary">
          <LuMonitor class="h-5 w-5" aria-hidden="true" />
          Vista previa en la computadora
        </h2>
        <div class="flex min-h-[600px] w-full items-center justify-center border border-line bg-brand-ink/80 p-8">
          <PopupModal preview settings={previewSettings} />
        </div>
      </section>
    </div>
  );
});

export const head: DocumentHead = {
  title: "LPRC Popup Inicial",
  meta: [
    {
      name: "description",
      content: "Administración del popup promocional de bienvenida.",
    },
  ],
};
