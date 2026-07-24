import { component$, useSignal, $, useVisibleTask$ } from "@builder.io/qwik";

interface Slide {
  id?: string;
  imageUrl: string;
  imageMobile?: string;
  imageSrcset?: string | null;
  imageMobileSrcset?: string | null;
  title: string;
  subtitle?: string;
  preTitle?: string;
  buttonText?: string;
  buttonLink?: string;
}

interface HeroSliderProps {
  slides: Slide[];
}

export const HeroSlider = component$<HeroSliderProps>(({ slides }) => {
  const currentSlide = useSignal(0);
  const isPaused = useSignal(false);

  const handlePrevSlide = $(() => {
    currentSlide.value = (currentSlide.value - 1 + slides.length) % slides.length;
  });

  const handleNextSlide = $(() => {
    currentSlide.value = (currentSlide.value + 1) % slides.length;
  });

  // Auto-play with 6s interval, pauses on hover
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    if (slides.length <= 1) return;

    const interval = setInterval(() => {
      if (!isPaused.value) {
        currentSlide.value = (currentSlide.value + 1) % slides.length;
      }
    }, 6000);

    cleanup(() => clearInterval(interval));
  });

  if (!slides || slides.length === 0) return null;

  return (
    <section
      class="relative w-full aspect-[4/5] md:aspect-auto md:h-[380px] lg:h-auto lg:aspect-[1600/520] bg-[#020617] overflow-hidden print:hidden group"
      onMouseEnter$={() => (isPaused.value = true)}
      onMouseLeave$={() => (isPaused.value = false)}
    >
      {/* Slides */}
      <div class="relative w-full h-full flex items-center">
        {slides.map((slide, idx) => (
          <div
            key={slide.id || idx}
            class={`absolute inset-0 w-full h-full transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) ${idx === currentSlide.value ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0 pointer-events-none"
              }`}
          >
            <div class="absolute inset-0 bg-gradient-to-t from-[#020617]/95 via-[#020617]/40 to-transparent z-10" />
            {/* Una sola imagen responsive con <picture>: el navegador baja SOLO
                la variante del viewport. Antes había dos <img> (desktop
                `hidden md:block` + mobile `block md:hidden`); el <img> oculto
                con display:none IGUAL se descarga, así que en mobile la variante
                desktop (más pesada) competía por el ancho de banda con el LCP y
                lo retrasaba (~2s de "load delay"). */}
            <picture class="block w-full h-full">
              {/* El hero es full-width (sizes=100vw). Con srcset por ancho el
                  navegador baja la variante justa: mobile 480/768, desktop
                  1280/1920. Si un slide no tiene srcset (URL externa/seed), cae
                  a la URL única. */}
              <source
                media="(min-width: 768px)"
                srcset={slide.imageSrcset || slide.imageUrl}
                sizes="100vw"
              />
              <img
                src={slide.imageMobile || slide.imageUrl}
                srcset={slide.imageMobileSrcset || undefined}
                sizes={slide.imageMobileSrcset ? "100vw" : undefined}
                alt={slide.title}
                fetchPriority={idx === 0 ? "high" : "low"}
                loading={idx === 0 ? "eager" : "lazy"}
                class="w-full h-full object-cover select-none group-hover:scale-105 transition-transform duration-1000"
                width={480}
                height={600}
              />
            </picture>
            <div class="absolute bottom-12 left-6 md:left-14 lg:left-20 z-20 max-w-2xl text-white text-left animate-fade-in-up">
              <span class="inline-flex items-center px-5 py-2 rounded-full text-[12px] font-black bg-brand-gold text-brand-green-dark mb-4 shadow-lg tracking-widest uppercase border border-white/10">
                {slide.preTitle || "Exclusivo AMP+"}
              </span>
              <h2 class="text-5xl md:text-6xl font-display font-black tracking-tight drop-shadow-md text-white mb-3 leading-none">
                {slide.title}
              </h2>
              <p class="text-slate-100 text-base md:text-lg drop-shadow font-medium max-w-xl leading-relaxed">
                {slide.subtitle || "Presentá tu credencial digital y disfrutá de los mejores descuentos."}
              </p>
              {slide.buttonText && (
                <a
                  href={slide.buttonLink || "/"}
                  class="inline-flex items-center justify-center mt-5 px-8 py-3.5 rounded-full bg-brand-gold hover:bg-brand-gold-light text-brand-green-dark text-sm font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {slide.buttonText}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Carousel Prev/Next Buttons */}
      {slides.length > 1 && (
        <>
          <button
            onClick$={handlePrevSlide}
            class="absolute left-6 top-1/2 -translate-y-1/2 z-20 w-14 h-14 flex items-center justify-center rounded-full bg-black/35 hover:bg-brand-gold/90 text-white hover:text-brand-green-dark border border-white/20 hover:border-transparent transition-all duration-300 backdrop-blur-sm cursor-pointer shadow-md"
            aria-label="Slide anterior"
          >
            <svg class="w-7 h-7 stroke-current" fill="none" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick$={handleNextSlide}
            class="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-14 h-14 flex items-center justify-center rounded-full bg-black/35 hover:bg-brand-gold/90 text-white hover:text-brand-green-dark border border-white/20 hover:border-transparent transition-all duration-300 backdrop-blur-sm cursor-pointer shadow-md"
            aria-label="Próximo slide"
          >
            <svg class="w-7 h-7 stroke-current" fill="none" viewBox="0 0 24 24" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Slide Indicators with progress bar */}
      {slides.length > 1 && (
        <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex space-x-2.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick$={() => (currentSlide.value = idx)}
              class={`relative h-2.5 rounded-full transition-all duration-300 overflow-hidden ${idx === currentSlide.value ? "bg-brand-gold/40 w-10" : "bg-white/55 hover:bg-white/80 w-2.5"
                }`}
              aria-label={`Ir al slide ${idx + 1}`}
            >
              {idx === currentSlide.value && !isPaused.value && (
                <span class="absolute inset-0 bg-brand-gold rounded-full animate-hero-progress" />
              )}
              {idx === currentSlide.value && isPaused.value && (
                <span class="absolute inset-0 bg-brand-gold rounded-full w-full" />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
});
