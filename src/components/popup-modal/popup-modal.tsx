import { component$, useId, useSignal, useVisibleTask$, type PropFunction } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";

/** What the home shows when the admin leaves these popup fields empty. */
export const POPUP_DEFAULTS = { title: "Anuncio Importante", buttonText: "Más Información" };

/** localStorage key holding the version of the last popup the visitor closed. */
export const POPUP_STORAGE_KEY = "lprc-popup-cerrado";

interface PopupSettings {
  popupTitle?: string | null;
  popupDescription?: string | null;
  popupImageUrl?: string | null;
  popupButtonText?: string | null;
  popupButtonLink?: string | null;
}

/**
 * Changes only when the popup's own content changes, so saving unrelated settings
 * does not show a closed popup again, while a new campaign does.
 */
export function popupVersion(settings: PopupSettings): string {
  const content = [settings.popupTitle, settings.popupDescription, settings.popupImageUrl, settings.popupButtonText, settings.popupButtonLink]
    .map((value) => value ?? "")
    .join("\u0000");
  let hash = 5381;
  for (let index = 0; index < content.length; index++) hash = ((hash << 5) + hash + content.charCodeAt(index)) | 0;
  return (hash >>> 0).toString(36);
}

interface PopupModalProps {
  settings: PopupSettings;
  onClose$: PropFunction<() => void>;
}

export const PopupModal = component$<PopupModalProps>(({ settings, onClose$ }) => {
  const dialog = useSignal<HTMLDialogElement>();
  const titleId = useId();
  const location = useLocation();
  const link = settings.popupButtonLink || "";
  const isExternal = /^https?:\/\//i.test(link) && !link.startsWith(location.url.origin);

  // The component only mounts when the popup should show; open it as a real modal.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (!dialog.value?.open) dialog.value?.showModal();
  });

  const buttonClass = "inline-flex items-center justify-center w-full px-6 py-3.5 rounded-2xl bg-brand-navy hover:bg-brand-navy-dark text-white font-display font-black text-sm uppercase tracking-wider transition-all duration-300 shadow-md hover:shadow-lg active:scale-[0.98]";

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      class="m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-0 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-md"
      onClose$={onClose$}
      onClick$={(event, element) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (event.target === element) element.close();
      }}
    >
      <div class="relative flex flex-col">
        <button
          type="button"
          onClick$={() => dialog.value?.close()}
          class="absolute top-3 right-3 z-10 w-11 h-11 bg-white/85 hover:bg-white text-slate-700 rounded-full flex items-center justify-center shadow-md border border-slate-200/50 transition-all duration-200 active:scale-90 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Cerrar anuncio"
        >
          <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {settings.popupImageUrl && (
          <div class="relative h-52 sm:h-64 bg-slate-100 overflow-hidden">
            <img
              src={settings.popupImageUrl}
              alt=""
              class="w-full h-full object-cover"
              loading="eager"
              width={512}
              height={256}
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        )}

        <div class="p-6 sm:p-8 flex flex-col items-center text-center space-y-4">
          <h2 id={titleId} class="text-xl sm:text-2xl font-display font-black text-brand-navy-dark tracking-tight leading-tight">
            {settings.popupTitle || POPUP_DEFAULTS.title}
          </h2>
          {settings.popupDescription && (
            <p class="text-[13px] sm:text-[14.5px] text-slate-600 leading-relaxed font-medium max-h-40 overflow-y-auto pr-1">
              {settings.popupDescription}
            </p>
          )}
          {link && (
            <div class="w-full pt-2">
              {isExternal ? (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick$={() => dialog.value?.close()}
                  class={buttonClass}
                >
                  {settings.popupButtonText || POPUP_DEFAULTS.buttonText}
                  <span class="sr-only"> (abre en una pestaña nueva)</span>
                </a>
              ) : (
                <Link href={link} onClick$={() => dialog.value?.close()} class={buttonClass}>
                  {settings.popupButtonText || POPUP_DEFAULTS.buttonText}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
});
