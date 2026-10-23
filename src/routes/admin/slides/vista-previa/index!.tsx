import { component$, sync$, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { ClubHero } from "~/components/hero-slider/club-hero";
import type { HeroSlide } from "~/components/hero-slider/hero-slider";
import { HERO_PREVIEW_MESSAGE } from "~/components/admin/hero-preview";
import { getCustomBenefits, getFilters } from "~/server/cache";
import { isPublicBenefit, withLiveCounts } from "~/utils/home-benefits";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

/**
 * The real home cover, rendered alone so /admin/slides can frame it in <iframe>s at
 * phone and desktop widths: the carousel's breakpoints follow the viewport, so only a
 * frame of the right width shows what visitors get. Slides arrive by postMessage, which
 * also lets the editor preview images that are not uploaded yet (blob: URLs).
 */
export const usePreviewCounts = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") throw event.redirect(302, "/admin/login");
  try {
    const [items, savedFilters] = await Promise.all([getCustomBenefits(event), getFilters(event)]);
    const filters = withLiveCounts(savedFilters, items);
    return {
      benefitCount: items.filter(isPublicBenefit).length,
      categoryCount: filters.categorias.filter((category) => (category.beneficios_count || 0) > 0).length,
    };
  } catch (err) {
    console.error("Failed to count benefits for the slide preview:", err);
    return { benefitCount: 0, categoryCount: 0 };
  }
});

export default component$(() => {
  const counts = usePreviewCounts();
  const state = useStore<{ slides: HeroSlide[] }>({ slides: [] });

  // eslint-disable-next-line qwik/no-use-visible-task -- listens to the admin page that frames this one
  useVisibleTask$(({ cleanup }) => {
    const origin = window.location.origin;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.data?.type !== HERO_PREVIEW_MESSAGE) return;
      state.slides = event.data.slides as HeroSlide[];
    };
    const report = () => {
      const slide = document.querySelector("[aria-roledescription='diapositiva']:not([hidden])")?.getBoundingClientRect();
      window.parent.postMessage(
        {
          type: `${HERO_PREVIEW_MESSAGE}-size`,
          height: Math.ceil(document.querySelector("main")?.getBoundingClientRect().height ?? 0),
          slide: slide ? { width: Math.round(slide.width), height: Math.round(slide.height), top: Math.round(slide.top + window.scrollY) } : null,
        },
        origin,
      );
    };
    const observer = new ResizeObserver(report);
    observer.observe(document.body);
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: `${HERO_PREVIEW_MESSAGE}-ready` }, origin);
    cleanup(() => {
      observer.disconnect();
      window.removeEventListener("message", onMessage);
    });
  });

  return (
    // Links stay inert: a click inside the preview must not navigate the frame away.
    <main
      onClick$={sync$((event: MouseEvent) => {
        if ((event.target as Element).closest("a")) event.preventDefault();
      })}
    >
      {state.slides.length > 0 ? (
        <ClubHero key={state.slides.length} loggedIn={false} benefitCount={counts.value.benefitCount} categoryCount={counts.value.categoryCount} slides={state.slides} />
      ) : (
        <p class="bg-primary px-6 py-16 text-center text-sm text-slate-300">No hay slides visibles para mostrar.</p>
      )}
    </main>
  );
});

export const head: DocumentHead = {
  title: "Vista previa del carrusel",
  meta: [{ name: "robots", content: "noindex" }],
};
