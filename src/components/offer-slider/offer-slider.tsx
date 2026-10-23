import { component$, $, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import type { Offer } from "~/server/cache";

interface OfferSliderProps {
  ofertas: Offer[];
  activeOfferId?: number | null;
  sliderId?: string;
  filterEmpty?: boolean;
  title?: string;
}

export const OfferSlider = component$<OfferSliderProps>(
  ({
    ofertas,
    activeOfferId = null,
    sliderId = "offer-scroll-container",
    filterEmpty = false,
    title = "Explorá por Descuento",
  }) => {
    const location = useLocation();
    const showControls = useSignal(false);
    const canScrollLeft = useSignal(false);
    const canScrollRight = useSignal(false);

    const scrollLeft = $(() => {
      const container = document.getElementById(sliderId);
      if (container) {
        container.scrollBy({
          left: -280,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      }
    });

    const scrollRight = $(() => {
      const container = document.getElementById(sliderId);
      if (container) {
        container.scrollBy({
          left: 280,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      }
    });

    const displayList = filterEmpty
      ? ofertas.filter((o) => (o.beneficios_count || 0) > 0)
      : ofertas;

    // Sort offers so higher percentages/promos appear first
    const sortedList = [...displayList].sort((a, b) => {
      // Keep Promociones at the end or sorting numeric first
      const getVal = (desc: string) => {
        const num = parseInt(desc);
        return isNaN(num) ? -1 : num;
      };
      return getVal(b.descripcion) - getVal(a.descripcion);
    });

    useVisibleTask$(({ track, cleanup }) => {
      track(() => sortedList.length);

      const checkScroll = () => {
        const container = document.getElementById(sliderId);
        if (container) {
          const maxScroll = container.scrollWidth - container.clientWidth;
          showControls.value = maxScroll > 1;
          canScrollLeft.value = container.scrollLeft > 1;
          canScrollRight.value = container.scrollLeft < maxScroll - 1;
        }
      };

      // Check after DOM layout calculation
      const container = document.getElementById(sliderId);
      const handle = setTimeout(checkScroll, 100);
      container?.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);

      cleanup(() => {
        clearTimeout(handle);
        container?.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      });
    });

    return (
      <div class="w-full text-left">
        <div class="flex min-h-12 items-center justify-between gap-3 mb-2 border-b border-line pb-1">
          <h3 class="text-[12px] font-black tracking-widest text-slate-600 uppercase pl-1 m-0">
            {title}
          </h3>
          {/* Scroll controllers */}
          {showControls.value && (
            <div class="flex items-center space-x-1.5 select-none">
              <button
                type="button"
                onClick$={scrollLeft}
                disabled={!canScrollLeft.value}
                class="w-11 h-11 rounded-full border border-line bg-surface hover:bg-surface-muted text-primary flex items-center justify-center shadow-sm transition-all active:scale-90 cursor-pointer disabled:opacity-35 disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                aria-label="Ver descuentos anteriores"
                aria-controls={sliderId}
              >
                <svg
                  class="w-3.5 h-3.5 stroke-current fill-none stroke-2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick$={scrollRight}
                disabled={!canScrollRight.value}
                class="w-11 h-11 rounded-full border border-line bg-surface hover:bg-surface-muted text-primary flex items-center justify-center shadow-sm transition-all active:scale-90 cursor-pointer disabled:opacity-35 disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                aria-label="Ver más descuentos"
                aria-controls={sliderId}
              >
                <svg
                  class="w-3.5 h-3.5 stroke-current fill-none stroke-2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div
          id={sliderId}
          class="flex items-center space-x-3 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory"
        >
          {sortedList.map((off) => {
            const isSelected = activeOfferId === off.id;

            // Build target URL
            const isHome = location.url.pathname === "/";
            let href = "";
            if (isHome) {
              href = `/beneficios?oferta=${off.id}`;
            } else {
              const searchParams = new URLSearchParams(location.url.search);
              if (isSelected) {
                searchParams.delete("oferta");
              } else {
                searchParams.set("oferta", String(off.id));
              }
              searchParams.set("page", "1");
              href = `/beneficios?${searchParams.toString()}`;
            }

            return (
              <Link
                key={off.id}
                href={href}
                aria-current={isSelected ? "true" : undefined}
                aria-label={`${off.descripcion}: ${off.beneficios_count || 0} beneficios${isSelected ? ". Quitar filtro" : ""}`}
                class={[
                  "flex min-h-11 items-center justify-between space-x-2 px-3.5 py-1.5 rounded-full border transition-all duration-300 flex-shrink-0 select-none cursor-pointer group snap-start shadow-sm text-[11px] font-black uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  isSelected
                    ? "bg-accent border-accent text-primary shadow-md shadow-accent/15 scale-105"
                    : "bg-surface border-line hover:border-accent text-primary hover:bg-amber-50 hover:shadow-sm hover:scale-105",
                ]}
              >
                <span>
                  {off.descripcion.toLowerCase().includes("promoci")
                    ? "Promociones"
                    : `${off.descripcion} OFF`}
                </span>
                <span
                  class={[
                    "flex items-center justify-center text-[11px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] h-4.5 leading-none transition-all duration-300",
                    isSelected
                      ? "bg-primary text-white font-black shadow-sm"
                      : "bg-surface-muted text-slate-600 group-hover:bg-accent group-hover:text-primary",
                  ]}
                >
                  {off.beneficios_count || 0}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  },
);
