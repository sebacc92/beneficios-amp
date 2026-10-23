import { component$, $, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import type { Category } from "~/server/cache";
import {
  LuUtensils,
  LuShirt,
  LuHeartPulse,
  LuDumbbell,
  LuFilm,
  LuHome,
  LuCar,
  LuTags,
  LuHotel,
  LuShoppingBag,
  LuSparkles,
  LuCalendar,
  LuCamera,
  LuGraduationCap,
  LuCreditCard,
  LuPlane,
} from "@qwikest/icons/lucide";

// central category icon selector
export const getCategoryIcon = (
  desc: string,
  className = "w-12 h-12 text-current stroke-[1.5]",
) => {
  const d = desc.toLowerCase();
  if (
    d.includes("gastro") ||
    d.includes("restaurante") ||
    d.includes("comida") ||
    d.includes("café")
  )
    return <LuUtensils class={className} />;
  if (d.includes("turismo") || d.includes("viaje"))
    return <LuPlane class={className} />;
  if (d.includes("hotel") || d.includes("alojamiento"))
    return <LuHotel class={className} />;
  if (
    d.includes("moda") ||
    d.includes("ropa") ||
    d.includes("indumentaria") ||
    d.includes("calzado")
  )
    return <LuShirt class={className} />;
  if (
    d.includes("estética") ||
    d.includes("belleza") ||
    d.includes("peluquería") ||
    d.includes("spa")
  )
    return <LuSparkles class={className} />;
  if (
    d.includes("salud") ||
    d.includes("cuidado") ||
    d.includes("farmacia") ||
    d.includes("ortopedia") ||
    d.includes("médic")
  )
    return <LuHeartPulse class={className} />;
  if (
    d.includes("deporte") ||
    d.includes("gimnasio") ||
    d.includes("club") ||
    d.includes("fitness")
  )
    return <LuDumbbell class={className} />;
  if (
    d.includes("entretenimiento") ||
    d.includes("cine") ||
    d.includes("teatro") ||
    d.includes("espectáculo")
  )
    return <LuFilm class={className} />;
  if (d.includes("evento") || d.includes("fiesta") || d.includes("reunión"))
    return <LuCalendar class={className} />;
  if (d.includes("fotografía") || d.includes("foto"))
    return <LuCamera class={className} />;
  if (
    d.includes("educación") ||
    d.includes("curso") ||
    d.includes("colegio") ||
    d.includes("universidad") ||
    d.includes("librería")
  )
    return <LuGraduationCap class={className} />;
  if (
    d.includes("banco") ||
    d.includes("financiero") ||
    d.includes("seguro") ||
    d.includes("crédito")
  )
    return <LuCreditCard class={className} />;
  if (
    d.includes("compras") ||
    d.includes("supermercado") ||
    d.includes("regalo") ||
    d.includes("mayorista")
  )
    return <LuShoppingBag class={className} />;
  if (
    d.includes("hogar") ||
    d.includes("deco") ||
    d.includes("mueble") ||
    d.includes("inmobiliari") ||
    d.includes("construc")
  )
    return <LuHome class={className} />;
  if (
    d.includes("servicio") ||
    d.includes("auto") ||
    d.includes("taller") ||
    d.includes("mecánica")
  )
    return <LuCar class={className} />;
  return <LuTags class={className} />;
};

interface CategorySliderProps {
  categorias: Category[];
  activeCategoryId?: number | null;
  sliderId?: string;
  filterEmpty?: boolean;
  title?: string;
}

export const CategorySlider = component$<CategorySliderProps>(
  ({
    categorias,
    activeCategoryId = null,
    sliderId = "category-scroll-container",
    filterEmpty = false,
    title = "Explorá por Categoría",
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
      ? categorias.filter((c) => (c.beneficios_count || 0) > 0)
      : categorias;

    useVisibleTask$(({ track, cleanup }) => {
      track(() => displayList.length);

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
          {/* Category scroll controllers */}
          {showControls.value && (
            <div class="flex items-center space-x-1.5 select-none">
              <button
                type="button"
                onClick$={scrollLeft}
                disabled={!canScrollLeft.value}
                class="w-11 h-11 rounded-full border border-line bg-surface hover:bg-surface-muted text-primary flex items-center justify-center shadow-sm transition-all active:scale-90 cursor-pointer disabled:opacity-35 disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                aria-label="Ver categorías anteriores"
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
                aria-label="Ver más categorías"
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
          {displayList.map((cat) => {
            const isSelected = activeCategoryId === cat.id;

            // Build target URL synchronously and safely
            const isHome = location.url.pathname === "/";
            let href = "";
            if (isHome) {
              href = `/beneficios?categoria=${cat.id}`;
            } else {
              const searchParams = new URLSearchParams(location.url.search);
              if (isSelected) {
                searchParams.delete("categoria");
              } else {
                searchParams.set("categoria", String(cat.id));
              }
              searchParams.set("page", "1");
              href = `/beneficios?${searchParams.toString()}`;
            }

            return (
              <Link
                key={cat.id}
                href={href}
                aria-current={isSelected ? "true" : undefined}
                aria-label={`${cat.descripcion}: ${cat.beneficios_count || 0} beneficios${isSelected ? ". Quitar filtro" : ""}`}
                title={cat.descripcion}
                class={[
                  "relative flex flex-col items-center justify-center text-center p-3 rounded-2xl border transition-all duration-300 w-28 h-28 flex-shrink-0 select-none cursor-pointer group snap-start shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  isSelected
                    ? "bg-accent border-accent text-primary shadow-md shadow-accent/15 scale-105"
                    : "bg-surface border-line hover:border-accent text-primary hover:bg-amber-50 hover:shadow-md hover:scale-105",
                ]}
              >
                {/* Floating Benefit Count Badge */}
                <span
                  class={[
                    "absolute top-2 right-2 text-[11px] font-black px-1.5 py-0.5 rounded-full shadow-sm transition-all duration-300 flex items-center justify-center min-w-[18px] h-4.5",
                    isSelected
                      ? "bg-primary text-white"
                      : "bg-surface-muted text-slate-600 group-hover:bg-accent group-hover:text-primary",
                  ]}
                >
                  {cat.beneficios_count || 0}
                </span>

                <span
                  class={[
                    "flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
                    isSelected
                      ? "text-primary"
                      : "text-secondary group-hover:text-primary",
                  ]}
                >
                  {getCategoryIcon(
                    cat.descripcion,
                    "w-8 h-8 text-current stroke-[1.5]",
                  )}
                </span>
                <span class="text-[11px] font-black uppercase tracking-wider mt-2.5 line-clamp-2 leading-tight max-w-[96px]">
                  {cat.descripcion}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  },
);
