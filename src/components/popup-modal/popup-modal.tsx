import { component$, useId, useSignal, useVisibleTask$, type JSXOutput, type PropFunction } from "@builder.io/qwik";
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
  onClose$?: PropFunction<() => void>;
  /**
   * Admin preview: renders the same popup inline, without the modal <dialog>, and nothing
   * in it navigates. Sizes follow the popup's own width (container queries), so a narrow
   * preview frame shows the phone layout even on a desktop screen.
   */
  preview?: boolean;
}

const CloseIcon = () => (
  <svg class="w-5 h-5 stroke-current fill-none stroke-2" viewBox="0 0 24 24" aria-hidden="true">
    <path stroke-linecap="square" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const PopupModal = component$<PopupModalProps>(({ settings, onClose$, preview = false }) => {
  const dialog = useSignal<HTMLDialogElement>();
  const titleId = useId();
  const location = useLocation();
  const link = settings.popupButtonLink || "";
  const isExternal = /^https?:\/\//i.test(link) && !link.startsWith(location.url.origin);
  const buttonText = settings.popupButtonText || POPUP_DEFAULTS.buttonText;

  // The component only mounts when the popup should show; open it as a real modal.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (preview) return;
    if (!dialog.value?.open) dialog.value?.showModal();
  });

  const closeClass = "absolute top-0 right-0 z-10 flex h-11 w-11 items-center justify-center bg-primary text-white";

  const content: JSXOutput = (
    <div class="@container relative flex flex-col bg-surface text-left">
      {preview ? (
        <span class={closeClass} aria-hidden="true">
          <CloseIcon />
        </span>
      ) : (
        <button
          type="button"
          onClick$={() => dialog.value?.close()}
          class={`${closeClass} cursor-pointer transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent`}
          aria-label="Cerrar anuncio"
        >
          <CloseIcon />
        </button>
      )}

      {settings.popupImageUrl && (
        <div class="h-52 @sm:h-64 bg-surface-muted overflow-hidden">
          <img
            src={settings.popupImageUrl}
            alt=""
            class="w-full h-full object-cover"
            loading="eager"
            width={512}
            height={256}
          />
        </div>
      )}

      <div class="flex flex-col gap-4 p-6 @sm:p-8">
        <div class="space-y-3 pr-10">
          <h2 id={titleId} class="heading-display text-2xl @sm:text-3xl text-primary">
            {settings.popupTitle || POPUP_DEFAULTS.title}
          </h2>
          <span class="title-bar" aria-hidden="true" />
        </div>
        {settings.popupDescription && (
          <p class="text-sm @sm:text-base text-slate-700 leading-relaxed max-h-40 overflow-y-auto pr-1 whitespace-pre-line">
            {settings.popupDescription}
          </p>
        )}
        {link && (
          <div class="pt-2">
            {preview ? (
              <span class="btn btn-primary w-full">{buttonText}</span>
            ) : isExternal ? (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                onClick$={() => dialog.value?.close()}
                class="btn btn-primary w-full"
              >
                {buttonText}
                <span class="sr-only"> (abre en una pestaña nueva)</span>
              </a>
            ) : (
              <Link href={link} onClick$={() => dialog.value?.close()} class="btn btn-primary w-full">
                {buttonText}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (preview) {
    return (
      <div role="group" aria-labelledby={titleId} class="w-full max-w-lg overflow-hidden border border-line shadow-2xl">
        {content}
      </div>
    );
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      class="m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden border-0 bg-surface p-0 shadow-2xl backdrop:bg-brand-ink/70"
      onClose$={onClose$}
      onClick$={(event, element) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (event.target === element) element.close();
      }}
    >
      {content}
    </dialog>
  );
});
