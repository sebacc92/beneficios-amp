import { component$, type PropFunction } from "@builder.io/qwik";

interface PopupModalProps {
  settings: {
    popupTitle?: string | null;
    popupDescription?: string | null;
    popupImageUrl?: string | null;
    popupButtonText?: string | null;
    popupButtonLink?: string | null;
  };
  onClose$: PropFunction<() => void>;
}

export const PopupModal = component$<PopupModalProps>(({ settings, onClose$ }) => {
  return (
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        class="absolute inset-0 bg-slate-950/60 backdrop-blur-md animate-backdrop-in"
        onClick$={onClose$}
      />
      <div class="relative w-full max-w-lg bg-white rounded-[2rem] overflow-hidden shadow-2xl border border-slate-100 flex flex-col animate-scale-in">
        <button
          onClick$={onClose$}
          class="absolute top-4 right-4 z-10 w-9 h-9 bg-white/85 hover:bg-white text-slate-700 rounded-full flex items-center justify-center shadow-md border border-slate-200/50 transition-all duration-200 active:scale-90 cursor-pointer"
          aria-label="Cerrar"
        >
          <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {settings.popupImageUrl && (
          <div class="relative h-52 sm:h-64 bg-slate-100 overflow-hidden">
            <img
              src={settings.popupImageUrl}
              alt={settings.popupTitle || "Anuncio"}
              class="w-full h-full object-cover"
              loading="eager"
              width={512}
              height={256}
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        )}

        <div class="p-6 sm:p-8 flex flex-col items-center text-center space-y-4">
          <h3 class="text-xl sm:text-2xl font-display font-black text-brand-green-dark tracking-tight leading-tight">
            {settings.popupTitle || "Anuncio Importante"}
          </h3>
          {settings.popupDescription && (
            <p class="text-[13px] sm:text-[14.5px] text-slate-550 leading-relaxed font-medium max-h-40 overflow-y-auto pr-1">
              {settings.popupDescription}
            </p>
          )}
          {settings.popupButtonLink && (
            <div class="w-full pt-2">
              <a
                href={settings.popupButtonLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick$={onClose$}
                class="inline-flex items-center justify-center w-full px-6 py-3.5 rounded-2xl bg-brand-green hover:bg-brand-green-dark text-white font-display font-black text-sm uppercase tracking-wider transition-all duration-300 shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                {settings.popupButtonText || "Más Información"}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
