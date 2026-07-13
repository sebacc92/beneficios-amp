import { component$, useSignal, $, useOnWindow } from "@builder.io/qwik";

export interface GalleryImage {
  id: string;
  imageUrl: string;
  title?: string | null;
}

interface GalleryProps {
  images: GalleryImage[];
}

export const Gallery = component$(({ images }: GalleryProps) => {
  const activeIndex = useSignal<number | null>(null);

  const close = $(() => {
    activeIndex.value = null;
  });

  const prev = $(() => {
    if (activeIndex.value === null) return;
    activeIndex.value = (activeIndex.value - 1 + images.length) % images.length;
  });

  const next = $(() => {
    if (activeIndex.value === null) return;
    activeIndex.value = (activeIndex.value + 1) % images.length;
  });

  useOnWindow(
    "keydown",
    $((event: Event) => {
      if (activeIndex.value === null) return;
      const key = (event as KeyboardEvent).key;
      if (key === "Escape") close();
      else if (key === "ArrowLeft") prev();
      else if (key === "ArrowRight") next();
    })
  );

  if (images.length === 0) return null;

  const active = activeIndex.value !== null ? images[activeIndex.value] : null;

  return (
    <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-10 print:hidden text-left animate-fade-in-up">
      <div class="border-b border-slate-200 pb-5 mb-8">
        <h2 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
          Galería de Fotos
        </h2>
        <p class="text-slate-500 text-sm mt-2 font-medium">Momentos y actividades de nuestra comunidad AMP+</p>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image, idx) => (
          <button
            key={image.id}
            type="button"
            onClick$={() => {
              activeIndex.value = idx;
            }}
            class="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm cursor-pointer"
          >
            <img
              src={image.imageUrl}
              alt={image.title || "Foto de galería"}
              class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              width={300}
              height={300}
              loading="lazy"
            />
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
          </button>
        ))}
      </div>

      {active && (
        <div
          class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick$={close}
        >
          <button
            type="button"
            onClick$={close}
            class="absolute top-4 right-4 sm:top-6 sm:right-6 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer z-10"
            title="Cerrar"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {images.length > 1 && (
            <button
              type="button"
              onClick$={(ev) => {
                ev.stopPropagation();
                prev();
              }}
              class="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer z-10"
              title="Anterior"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}

          <div
            class="max-w-4xl w-full flex flex-col items-center gap-4"
            onClick$={(ev) => ev.stopPropagation()}
          >
            <img
              src={active.imageUrl}
              alt={active.title || "Foto de galería"}
              class="max-h-[75vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl"
            />
            {active.title && (
              <p class="text-white text-sm sm:text-base font-semibold text-center px-4">{active.title}</p>
            )}
            <span class="text-slate-400 text-xs font-mono">
              {(activeIndex.value ?? 0) + 1} / {images.length}
            </span>
          </div>

          {images.length > 1 && (
            <button
              type="button"
              onClick$={(ev) => {
                ev.stopPropagation();
                next();
              }}
              class="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer z-10"
              title="Siguiente"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
        </div>
      )}
    </section>
  );
});
