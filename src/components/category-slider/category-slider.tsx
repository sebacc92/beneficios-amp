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
  LuPlane
} from "@qwikest/icons/lucide";

// central category icon selector
export const getCategoryIcon = (desc: string, className = "w-12 h-12 text-current stroke-[1.5]") => {
  const d = desc.toLowerCase();
  if (d.includes("gastro") || d.includes("restaurante") || d.includes("comida") || d.includes("café")) return <LuUtensils class={className} />;
  if (d.includes("turismo") || d.includes("viaje")) return <LuPlane class={className} />;
  if (d.includes("hotel") || d.includes("alojamiento")) return <LuHotel class={className} />;
  if (d.includes("moda") || d.includes("ropa") || d.includes("indumentaria") || d.includes("calzado")) return <LuShirt class={className} />;
  if (d.includes("estética") || d.includes("belleza") || d.includes("peluquería") || d.includes("spa")) return <LuSparkles class={className} />;
  if (d.includes("salud") || d.includes("cuidado") || d.includes("farmacia") || d.includes("ortopedia") || d.includes("médic")) return <LuHeartPulse class={className} />;
  if (d.includes("deporte") || d.includes("gimnasio") || d.includes("club") || d.includes("fitness")) return <LuDumbbell class={className} />;
  if (d.includes("entretenimiento") || d.includes("cine") || d.includes("teatro") || d.includes("espectáculo")) return <LuFilm class={className} />;
  if (d.includes("evento") || d.includes("fiesta") || d.includes("reunión")) return <LuCalendar class={className} />;
  if (d.includes("fotografía") || d.includes("foto")) return <LuCamera class={className} />;
  if (d.includes("educación") || d.includes("curso") || d.includes("colegio") || d.includes("universidad") || d.includes("librería")) return <LuGraduationCap class={className} />;
  if (d.includes("banco") || d.includes("financiero") || d.includes("seguro") || d.includes("crédito")) return <LuCreditCard class={className} />;
  if (d.includes("compras") || d.includes("supermercado") || d.includes("regalo") || d.includes("mayorista")) return <LuShoppingBag class={className} />;
  if (d.includes("hogar") || d.includes("deco") || d.includes("mueble") || d.includes("inmobiliari") || d.includes("construc")) return <LuHome class={className} />;
  if (d.includes("servicio") || d.includes("auto") || d.includes("taller") || d.includes("mecánica")) return <LuCar class={className} />;
  return <LuTags class={className} />;
};

interface CategorySliderProps {
  categorias: Category[];
  activeCategoryId?: number | null;
  sliderId?: string;
  filterEmpty?: boolean;
  title?: string;
}

export const CategorySlider = component$<CategorySliderProps>(({
  categorias,
  activeCategoryId = null,
  sliderId = "category-scroll-container",
  filterEmpty = false,
  title = "Explorá por Categoría"
}) => {
  const location = useLocation();
  const showControls = useSignal(false);

  const scrollLeft = $(() => {
    const container = document.getElementById(sliderId);
    if (container) {
      container.scrollBy({ left: -280, behavior: "smooth" });
    }
  });

  const scrollRight = $(() => {
    const container = document.getElementById(sliderId);
    if (container) {
      container.scrollBy({ left: 280, behavior: "smooth" });
    }
  });

  const displayList = filterEmpty
    ? categorias.filter((c) => (c.beneficios_count || 0) > 0)
    : categorias;

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track, cleanup }) => {
    track(() => displayList.length);

    const checkScroll = () => {
      const container = document.getElementById(sliderId);
      if (container) {
        showControls.value = container.scrollWidth > container.clientWidth;
      }
    };

    // Check after DOM layout calculation
    const handle = setTimeout(checkScroll, 100);
    window.addEventListener("resize", checkScroll);

    cleanup(() => {
      clearTimeout(handle);
      window.removeEventListener("resize", checkScroll);
    });
  });

  return (
    <div class="w-full text-left">
      <div class="flex items-center justify-between mb-2 border-b border-slate-200/60 pb-1">
        <h3 class="text-[12px] font-black tracking-widest text-slate-400 uppercase pl-1 m-0">
          {title}
        </h3>
        {/* Category scroll controllers */}
        {showControls.value && (
          <div class="flex items-center space-x-1.5 select-none">
            <button
              type="button"
              onClick$={scrollLeft}
              class="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-sm transition-all active:scale-90 cursor-pointer"
              aria-label="Anterior"
            >
              <svg class="w-3.5 h-3.5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick$={scrollRight}
              class="w-7 h-7 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-sm transition-all active:scale-90 cursor-pointer"
              aria-label="Siguiente"
            >
              <svg class="w-3.5 h-3.5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
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
              class={[
                "relative flex flex-col items-center justify-center text-center px-2 py-1.5 rounded-xl border transition-all duration-300 w-24 h-[68px] flex-shrink-0 select-none cursor-pointer group snap-start shadow-sm",
                isSelected
                  ? "bg-brand-green border-brand-green text-white shadow-lg shadow-brand-green/20 scale-105"
                  : "bg-white border-slate-200 hover:border-brand-green/45 text-slate-700 hover:text-brand-green hover:shadow-md hover:scale-105"
              ]}
            >
              {/* Floating Benefit Count Badge */}
              <span
                class={[
                  "absolute top-1 right-1 text-[8px] font-black px-1 py-0.5 rounded-full shadow-sm transition-all duration-300 flex items-center justify-center min-w-[16px] h-4 leading-none",
                  isSelected
                    ? "bg-brand-gold text-slate-950 shadow-md shadow-brand-gold/10"
                    : "bg-slate-100 text-slate-500 group-hover:bg-brand-green group-hover:text-white"
                ]}
              >
                {cat.beneficios_count || 0}
              </span>

              <span
                class={[
                  "flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
                  isSelected ? "text-white" : "text-brand-green/85 group-hover:text-brand-green"
                ]}
              >
                {getCategoryIcon(cat.descripcion, "w-6 h-6 text-current stroke-[1.5]")}
              </span>
              <span class="text-[9px] font-black uppercase tracking-wide mt-1 truncate max-w-[84px] leading-tight">
                {cat.descripcion}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
});
