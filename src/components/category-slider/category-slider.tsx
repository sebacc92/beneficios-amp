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
  /** Hide categories without benefits (the active one always stays, so it can be removed). */
  filterEmpty?: boolean;
  title?: string;
  /** "blocks": navy tiles that fill the row (home). "chips": compact quick filters (catalog). */
  variant?: "blocks" | "chips";
}

const arrowButton =
  "flex h-11 w-11 items-center justify-center border border-primary bg-surface text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-default disabled:opacity-35 disabled:hover:bg-surface disabled:hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const CategorySlider = component$<CategorySliderProps>(
  ({
    categorias,
    activeCategoryId = null,
    sliderId = "category-scroll-container",
    filterEmpty = false,
    title = "Explorá por rubro",
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
      ? categorias.filter((c) => (c.beneficios_count || 0) > 0 || c.id === activeCategoryId)
      : categorias;

    // Arrows only matter while the row scrolls (mobile); on desktop the blocks wrap.
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track, cleanup }) => {
      track(() => displayList.length);
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

    // From the home every category opens the catalog; in the catalog a chip toggles its filter.
    const hrefFor = (id: number | null) => {
      if (location.url.pathname === "/") return id ? `/beneficios/?categoria=${id}` : "/beneficios/";
      const params = new URLSearchParams(location.url.search);
      if (id === null || id === activeCategoryId) params.delete("categoria");
      else params.set("categoria", String(id));
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
            <Link href={hrefFor(null)} aria-current={activeCategoryId ? undefined : "true"} class={chip(!activeCategoryId)}>
              Todos
            </Link>
          </li>
          {displayList.map((cat) => {
            const isSelected = activeCategoryId === cat.id;
            return (
              <li key={cat.id} class="shrink-0">
                <Link
                  href={hrefFor(cat.id)}
                  aria-current={isSelected ? "true" : undefined}
                  aria-label={`${cat.descripcion}: ${cat.beneficios_count || 0} beneficios${isSelected ? ". Quitar filtro" : ""}`}
                  class={chip(isSelected)}
                >
                  <span class={isSelected ? "text-accent" : "text-secondary"}>
                    {getCategoryIcon(cat.descripcion, "h-4 w-4 stroke-2 text-current")}
                  </span>
                  <span>{cat.descripcion}</span>
                  <span class={`text-xs ${isSelected ? "text-accent" : "text-slate-500"}`}>{cat.beneficios_count || 0}</span>
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
                aria-label="Ver rubros anteriores"
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
                aria-label="Ver más rubros"
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
          {displayList.map((cat) => {
            const isSelected = activeCategoryId === cat.id;
            const count = cat.beneficios_count || 0;
            return (
              <li key={cat.id} class="w-36 shrink-0 snap-start md:w-auto">
                <Link
                  href={hrefFor(cat.id)}
                  aria-current={isSelected ? "true" : undefined}
                  aria-label={`${cat.descripcion}: ${count} ${count === 1 ? "beneficio" : "beneficios"}${isSelected ? ". Quitar filtro" : ""}`}
                  class={`flex h-full min-h-32 flex-col justify-between gap-4 p-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    isSelected ? "bg-accent text-primary" : "bg-primary text-white hover:bg-secondary"
                  }`}
                >
                  <span class={isSelected ? "text-primary" : "text-accent"}>
                    {getCategoryIcon(cat.descripcion, "h-7 w-7 stroke-[1.5] text-current")}
                  </span>
                  <span>
                    <span class="heading-display line-clamp-2 block text-base leading-tight">{cat.descripcion}</span>
                    <span class={`mt-1 block text-xs font-semibold ${isSelected ? "text-primary" : "text-accent"}`}>
                      {count} {count === 1 ? "beneficio" : "beneficios"}
                    </span>
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
