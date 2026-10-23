import {
  component$,
  useSignal,
  $,
  useVisibleTask$,
  sync$,
} from "@builder.io/qwik";

/** Database rows from hero_slides fit as they are (empty columns come as null). */
export interface HeroSlide {
  id?: string;
  imageUrl: string;
  imageMobile?: string | null;
  title: string;
  subtitle?: string | null;
  preTitle?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
}

interface HeroSliderProps {
  slides: HeroSlide[];
  /**
   * Fills its parent instead of setting its own height, with smaller type: the home
   * puts it beside the club's own hero, which owns the page title and main buttons.
   */
  compact?: boolean;
}

const controlButton =
  "flex h-11 w-11 shrink-0 items-center justify-center border border-white/80 bg-brand-ink/45 text-white transition-colors hover:border-accent hover:bg-accent hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export const HeroSlider = component$<HeroSliderProps>(({ slides, compact = false }) => {
  const currentSlide = useSignal(0);
  const isPaused = useSignal(false);
  const isHovered = useSignal(false);
  const hasFocus = useSignal(false);
  const reducedMotion = useSignal(false);
  const touchStart = useSignal<{ x: number; y: number }>();

  const handlePrevSlide = $(() => {
    if (slides.length > 1)
      currentSlide.value =
        (currentSlide.value - 1 + slides.length) % slides.length;
  });
  const handleNextSlide = $(() => {
    if (slides.length > 1)
      currentSlide.value = (currentSlide.value + 1) % slides.length;
  });

  // Respect the system preference and pause while the user reads or uses controls.
  // Browser-only media preference and timer share this component lifecycle.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => (reducedMotion.value = preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    const interval =
      slides.length > 1
        ? setInterval(() => {
            if (
              !isPaused.value &&
              !isHovered.value &&
              !hasFocus.value &&
              !reducedMotion.value &&
              document.visibilityState === "visible"
            ) {
              currentSlide.value = (currentSlide.value + 1) % slides.length;
            }
          }, 6000)
        : undefined;
    cleanup(() => {
      if (interval) clearInterval(interval);
      preference.removeEventListener("change", updatePreference);
    });
  });

  // Hidden slides are display:none, so their lazy images only start loading once shown and
  // the slide flashes empty. Warm both neighbours of the visible slide instead.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const current = track(() => currentSlide.value);
    if (slides.length < 2) return;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    for (const offset of [1, -1]) {
      const slide = slides[(current + offset + slides.length) % slides.length];
      new Image().src = (mobile && slide.imageMobile) || slide.imageUrl;
    }
  });

  if (!slides?.length) return null;

  return (
    <section
      aria-label="Comercios destacados"
      aria-roledescription="carrusel"
      class={`relative w-full overflow-hidden bg-primary print:hidden ${compact ? "h-full min-h-[24rem] sm:min-h-[26rem]" : ""}`}
      onMouseEnter$={() => (isHovered.value = true)}
      onMouseLeave$={() => (isHovered.value = false)}
      onFocusIn$={() => (hasFocus.value = true)}
      onFocusOut$={(event, element) => {
        if (!element.contains(event.relatedTarget as Node | null))
          hasFocus.value = false;
      }}
      onTouchStart$={(event) => {
        const touch = event.changedTouches[0];
        touchStart.value = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd$={(event) => {
        const start = touchStart.value;
        touchStart.value = undefined;
        if (!start || slides.length < 2) return;
        const touch = event.changedTouches[0];
        const distanceX = touch.clientX - start.x;
        const distanceY = touch.clientY - start.y;
        if (
          Math.abs(distanceX) < 50 ||
          Math.abs(distanceX) < Math.abs(distanceY) * 1.5
        )
          return;
        isPaused.value = true;
        currentSlide.value =
          (currentSlide.value + (distanceX < 0 ? 1 : -1) + slides.length) %
          slides.length;
      }}
      onKeyDown$={[
        sync$((event: KeyboardEvent) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight")
            event.preventDefault();
        }),
        $((event: KeyboardEvent) => {
          if (event.key === "ArrowLeft") {
            handlePrevSlide();
          } else if (event.key === "ArrowRight") {
            handleNextSlide();
          }
        }),
      ]}
    >
      <div
        aria-live={isPaused.value || reducedMotion.value ? "polite" : "off"}
        aria-atomic="true"
        class={compact ? "absolute inset-0" : undefined}
      >
        {slides.map((slide, idx) => (
          <div
            key={slide.id || idx}
            role="group"
            aria-roledescription="diapositiva"
            aria-label={`${idx + 1} de ${slides.length}`}
            hidden={idx !== currentSlide.value}
            class={
              idx !== currentSlide.value
                ? "hidden"
                : compact
                  ? "absolute inset-0 flex items-end"
                  : "relative flex min-h-[420px] w-full items-end sm:min-h-[440px] md:min-h-[480px] lg:min-h-[520px] lg:aspect-[1600/646]"
            }
          >
            <picture class="absolute inset-0 h-full w-full">
              {slide.imageMobile && (
                <source media="(max-width: 767px)" srcset={slide.imageMobile} />
              )}
              <img
                src={slide.imageUrl}
                alt=""
                fetchPriority={idx === 0 ? "high" : "low"}
                loading={idx === 0 ? "eager" : "lazy"}
                class="h-full w-full object-cover select-none"
                width={1600}
                height={646}
              />
            </picture>
            <div class="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/45 to-transparent" />
            <div
              class={`relative z-10 w-full pt-16 ${compact ? "px-5 sm:px-8 lg:px-10" : "px-5 sm:px-8 md:px-20 lg:px-24"} ${slides.length > 1 ? "pb-24" : "pb-10"}`}
            >
              <div class="max-w-2xl text-left text-white">
                <span class="badge badge-accent max-w-full whitespace-normal">
                  {slide.preTitle || "Exclusivo LPRC"}
                </span>
                <h2
                  class={`heading-display mt-4 mb-3 break-words text-white drop-shadow-md ${compact ? "text-3xl sm:text-4xl xl:text-5xl" : "text-4xl sm:text-5xl md:text-6xl"}`}
                >
                  {slide.title}
                </h2>
                <p class={`max-w-xl text-sm font-medium leading-relaxed text-slate-100 drop-shadow sm:text-base ${compact ? "" : "md:text-lg"}`}>
                  {slide.subtitle ||
                    "Presentá tu credencial digital y disfrutá de los mejores descuentos."}
                </p>
                {slide.buttonText && (
                  <a
                    href={slide.buttonLink || "/"}
                    class={`btn mt-5 max-w-full ${compact ? "btn-outline-light" : "btn-primary"}`}
                  >
                    {slide.buttonText}
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div
          class={`absolute inset-x-0 bottom-3 z-20 mx-auto flex max-w-[90rem] items-center gap-1 md:bottom-5 ${compact ? "px-5 sm:px-8 lg:px-10" : "px-4 md:px-12"}`}
        >
          <button
            type="button"
            onClick$={handlePrevSlide}
            class={controlButton}
            aria-label="Diapositiva anterior"
          >
            <svg
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
              aria-hidden="true"
            >
              <path
                stroke-linecap="square"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick$={handleNextSlide}
            class={controlButton}
            aria-label="Diapositiva siguiente"
          >
            <svg
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
              aria-hidden="true"
            >
              <path
                stroke-linecap="square"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
          <div
            class="flex min-w-0 flex-1 justify-center overflow-x-auto"
            aria-label="Elegir diapositiva"
          >
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick$={() => {
                  currentSlide.value = idx;
                  isPaused.value = true;
                }}
                class="flex h-11 w-9 shrink-0 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                aria-label={`Ver diapositiva ${idx + 1}`}
                aria-current={idx === currentSlide.value ? "true" : undefined}
              >
                {/* Yellow bar for the current slide, as on lprc.com.ar. */}
                <span
                  class={`h-1 transition-all motion-reduce:transition-none ${idx === currentSlide.value ? "w-7 bg-accent" : "w-3 bg-white/70"}`}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={reducedMotion.value}
            onClick$={() => (isPaused.value = !isPaused.value)}
            aria-label={
              reducedMotion.value
                ? "Reproducción automática desactivada por movimiento reducido"
                : isPaused.value
                  ? "Reanudar presentación automática"
                  : "Pausar presentación automática"
            }
            aria-pressed={isPaused.value || reducedMotion.value}
            class={`${controlButton} disabled:opacity-60`}
          >
            {isPaused.value || reducedMotion.value ? (
              <svg
                class="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m8 5 11 7-11 7V5Z" />
              </svg>
            ) : (
              <svg
                class="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
              </svg>
            )}
          </button>
        </div>
      )}
    </section>
  );
});
