import { component$, useSignal, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { LuMonitor, LuSmartphone } from "@qwikest/icons/lucide";

export const HERO_PREVIEW_MESSAGE = "lprc-hero-preview";
const PREVIEW_URL = "/admin/slides/vista-previa/";
const DESKTOP_WIDTH = 1440;
const MOBILE_WIDTH = 390;

export interface PreviewSlide {
  id?: string;
  imageUrl: string;
  imageMobile?: string | null;
  title: string;
  subtitle?: string | null;
  preTitle?: string | null;
  buttonText?: string | null;
  buttonLink?: string | null;
}

export type SlideBox = { width: number; height: number };

/** Size of the visible slide at each preview width, measured inside the frames. */
export interface SlideBoxes {
  desktop: SlideBox | null;
  mobile: SlideBox | null;
}

/** Measured on the home in October 2026; only used until the frames report real sizes. */
export const FALLBACK_BOXES: { desktop: SlideBox; mobile: SlideBox } = {
  desktop: { width: 840, height: 594 },
  mobile: { width: 390, height: 371 },
};

interface HeroPreviewFramesProps {
  slides: PreviewSlide[];
  /** Filled with the measured slide sizes, for crop guides elsewhere on the page. */
  boxes?: SlideBoxes;
}

/**
 * The real home cover (club block + carousel) framed at 1440 px and 390 px. The carousel's
 * breakpoints follow the viewport, so a narrow <div> could never show the phone layout.
 */
export const HeroPreviewFrames = component$<HeroPreviewFramesProps>((props) => {
  const desktopFrame = useSignal<HTMLIFrameElement>();
  const mobileFrame = useSignal<HTMLIFrameElement>();
  const desktopWrap = useSignal<HTMLDivElement>();
  const mobileWrap = useSignal<HTMLDivElement>();
  const view = useStore({ desktopScale: 0.5, mobileScale: 0.8, desktopHeight: 600, mobileHeight: 380, mobileTop: 0 });

  // eslint-disable-next-line qwik/no-use-visible-task -- talks to the preview frames, browser only
  useVisibleTask$(({ track }) => {
    const slides = track(() => props.slides);
    const message = { type: HERO_PREVIEW_MESSAGE, slides: JSON.parse(JSON.stringify(slides)) };
    for (const frame of [desktopFrame.value, mobileFrame.value]) frame?.contentWindow?.postMessage(message, window.location.origin);
  });

  // eslint-disable-next-line qwik/no-use-visible-task -- message channel and resize observer
  useVisibleTask$(({ cleanup }) => {
    const origin = window.location.origin;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || typeof event.data?.type !== "string") return;
      const which = event.source === desktopFrame.value?.contentWindow ? "desktop" : event.source === mobileFrame.value?.contentWindow ? "mobile" : null;
      if (!which) return;
      if (event.data.type === `${HERO_PREVIEW_MESSAGE}-ready`) {
        const message = { type: HERO_PREVIEW_MESSAGE, slides: JSON.parse(JSON.stringify(props.slides)) };
        (event.source as Window).postMessage(message, origin);
      } else if (event.data.type === `${HERO_PREVIEW_MESSAGE}-size`) {
        const { height, slide } = event.data as { height: number; slide: (SlideBox & { top: number }) | null };
        if (which === "desktop") {
          view.desktopHeight = height || view.desktopHeight;
        } else {
          // On phones the carousel sits under the club block: frame only the carousel.
          view.mobileTop = slide?.top ?? 0;
          view.mobileHeight = slide ? slide.height : height || view.mobileHeight;
        }
        if (props.boxes && slide) props.boxes[which] = { width: slide.width, height: slide.height };
      }
    };
    const resize = () => {
      if (desktopWrap.value) view.desktopScale = Math.min(1, desktopWrap.value.clientWidth / DESKTOP_WIDTH);
      if (mobileWrap.value) view.mobileScale = Math.min(1, mobileWrap.value.clientWidth / MOBILE_WIDTH);
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (desktopWrap.value) observer.observe(desktopWrap.value);
    if (mobileWrap.value) observer.observe(mobileWrap.value);
    window.addEventListener("message", onMessage);
    cleanup(() => {
      observer.disconnect();
      window.removeEventListener("message", onMessage);
    });
  });

  return (
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
      <figure class="min-w-0 space-y-2">
        <figcaption class="eyebrow flex items-center gap-1.5 text-[11px] text-slate-600">
          <LuMonitor class="h-4 w-4" /> Computadora · {DESKTOP_WIDTH} px
        </figcaption>
        <div
          ref={desktopWrap}
          class="w-full overflow-hidden border border-line bg-primary"
          style={{ height: `${Math.ceil(view.desktopHeight * view.desktopScale)}px` }}
        >
          <iframe
            ref={desktopFrame}
            src={PREVIEW_URL}
            title="Vista previa de la portada en una computadora"
            tabIndex={-1}
            loading="lazy"
            width={DESKTOP_WIDTH}
            height={view.desktopHeight}
            style={{ width: `${DESKTOP_WIDTH}px`, height: `${view.desktopHeight}px`, border: 0, transform: `scale(${view.desktopScale})`, transformOrigin: "0 0" }}
          />
        </div>
      </figure>
      <figure class="min-w-0 space-y-2">
        <figcaption class="eyebrow flex items-center gap-1.5 text-[11px] text-slate-600">
          <LuSmartphone class="h-4 w-4" /> Celular · {MOBILE_WIDTH} px
        </figcaption>
        <div
          ref={mobileWrap}
          class="w-full max-w-[390px] overflow-hidden border border-line bg-primary"
          style={{ height: `${Math.ceil(view.mobileHeight * view.mobileScale)}px` }}
        >
          <iframe
            ref={mobileFrame}
            src={PREVIEW_URL}
            title="Vista previa del carrusel en un celular"
            tabIndex={-1}
            loading="lazy"
            width={MOBILE_WIDTH}
            height={view.mobileTop + view.mobileHeight}
            style={{
              width: `${MOBILE_WIDTH}px`,
              height: `${view.mobileTop + view.mobileHeight}px`,
              border: 0,
              transform: `translateY(${-view.mobileTop * view.mobileScale}px) scale(${view.mobileScale})`,
              transformOrigin: "0 0",
            }}
          />
        </div>
      </figure>
    </div>
  );
});
