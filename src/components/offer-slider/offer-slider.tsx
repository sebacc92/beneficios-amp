import { component$, $, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import type { Offer } from "~/server/cache";
import { discountValue, offerLabel } from "~/utils/home-benefits";

interface OfferSliderProps {
  ofertas: Offer[];
  activeOfferId?: number | null;
  sliderId?: string;
  /** Hide discounts without benefits (the active one always stays, so it can be removed). */
  filterEmpty?: boolean;
  title?: string;
  /** "blocks": yellow tiles that fill the row (home). "chips": compact quick filters (catalog). */
  variant?: "blocks" | "chips";
}

const arrowButton =
  "flex h-11 w-11 items-center justify-center border border-primary bg-surface text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-default disabled:opacity-35 disabled:hover:bg-surface disabled:hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const OfferSlider = component$<OfferSliderProps>(
  ({
    ofertas,
    activeOfferId = null,
    sliderId = "offer-scroll-container",
    filterEmpty = false,
    title = "Explorá por descuento",
    variant = "blocks",
  }) => {
    const location = useLocation();
    const showControls = useSignal(false);
    const canScrollLeft = useSignal(false);
    const canScrollRight = useSignal(false);

    const scrollBy = $((distance: number) => {
      document.getElementById(sliderId)?.scrollBy({
        left: distance,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    });

    const displayList = filterEmpty
      ? ofertas.filter((o) => (o.beneficios_count || 0) > 0 || o.id === activeOfferId)
      : ofertas;

    // Biggest discounts first; free activities count as the biggest of all.
    const value = (offer: Offer) => discountValue({ resumen: offer.descripcion, ofertas: [] });
    const sortedList = [...displayList].sort((a, b) => value(b) - value(a));

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track, cleanup }) => {
      track(() => sortedList.length);
      const container = document.getElementById(sliderId);
      const checkScroll = () => {
        if (!container) return;
        const maxScroll = container.scrollWidth - container.clientWidth;
        showControls.value = maxScroll > 1;
        canScrollLeft.value = container.scrollLeft > 1;
        canScrollRight.value = container.scrollLeft < maxScroll - 1;
      };
      const handle = setTimeout(checkScroll, 100);
      container?.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);
      cleanup(() => {
        clearTimeout(handle);
        container?.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      });
    });

    // From the home every discount opens the catalog; in the catalog a chip toggles its filter.
    const hrefFor = (id: number | null) => {
      if (location.url.pathname === "/") return id ? `/beneficios/?oferta=${id}` : "/beneficios/";
      const params = new URLSearchParams(location.url.search);
      if (id === null || id === activeOfferId) params.delete("oferta");
      else params.set("oferta", String(id));
      params.delete("page");
      const query = params.toString();
      return `/beneficios/${query ? `?${query}` : ""}`;
    };

    if (variant === "chips") {
      const chip = (selected: boolean) =>
        `inline-flex min-h-11 shrink-0 items-center gap-2 border px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          selected ? "border-primary bg-primary text-white" : "border-line bg-surface text-primary hover:border-primary"
        }`;
      return (
        <ul id={sliderId} aria-label={title} class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 md:flex-wrap md:overflow-visible">
          <li class="shrink-0">
            <Link href={hrefFor(null)} aria-current={activeOfferId ? undefined : "true"} class={chip(!activeOfferId)}>
              Todos
            </Link>
          </li>
          {sortedList.map((off) => {
            const isSelected = activeOfferId === off.id;
            const label = offerLabel(off.descripcion);
            return (
              <li key={off.id} class="shrink-0">
                <Link
                  href={hrefFor(off.id)}
                  aria-current={isSelected ? "true" : undefined}
                  aria-label={`${label}: ${off.beneficios_count || 0} beneficios${isSelected ? ". Quitar filtro" : ""}`}
                  class={chip(isSelected)}
                >
                  <span>{label}</span>
                  <span class={`text-xs ${isSelected ? "text-accent" : "text-slate-500"}`}>{off.beneficios_count || 0}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      );
    }

    return (
      <div class="w-full text-left">
        <div class="mb-3 flex min-h-11 items-center justify-between gap-3">
          <h3 class="eyebrow text-amber-900">{title}</h3>
          {showControls.value && (
            <div class="flex items-center gap-2 select-none">
              <button
                type="button"
                onClick$={() => scrollBy(-280)}
                disabled={!canScrollLeft.value}
                class={arrowButton}
                aria-label="Ver descuentos anteriores"
                aria-controls={sliderId}
              >
                <svg class="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="square" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick$={() => scrollBy(280)}
                disabled={!canScrollRight.value}
                class={arrowButton}
                aria-label="Ver más descuentos"
                aria-controls={sliderId}
              >
                <svg class="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="square" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <ul
          id={sliderId}
          class="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0 md:grid md:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] md:overflow-visible md:pb-0"
        >
          {sortedList.map((off) => {
            const isSelected = activeOfferId === off.id;
            const count = off.beneficios_count || 0;
            const label = offerLabel(off.descripcion);
            // "25% OFF" reads best as a big figure; anything else ("Socios free") as a title.
            const figure = /^(\d+%)\s*OFF$/i.exec(label);
            return (
              <li key={off.id} class="w-36 shrink-0 snap-start md:w-auto">
                <Link
                  href={hrefFor(off.id)}
                  aria-current={isSelected ? "true" : undefined}
                  aria-label={`${label}: ${count} ${count === 1 ? "beneficio" : "beneficios"}${isSelected ? ". Quitar filtro" : ""}`}
                  class={`flex h-full min-h-24 flex-col justify-between gap-3 p-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    isSelected ? "bg-primary text-accent" : "bg-accent text-primary hover:bg-accent-hover"
                  }`}
                >
                  {figure ? (
                    <span class="heading-display flex items-baseline gap-1.5">
                      <span class="text-3xl leading-none">{figure[1]}</span>
                      <span class="text-base">OFF</span>
                    </span>
                  ) : (
                    <span class="heading-display line-clamp-2 text-lg leading-tight">{label}</span>
                  )}
                  <span class={`text-xs font-semibold ${isSelected ? "text-white" : "text-primary"}`}>
                    {count} {count === 1 ? "beneficio" : "beneficios"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
);
