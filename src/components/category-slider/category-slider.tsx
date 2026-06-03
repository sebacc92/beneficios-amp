import { component$, $ } from "@builder.io/qwik";
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
export const getCategoryIcon = (desc: string) => {
  const d = desc.toLowerCase();
  if (d.includes("gastro") || d.includes("restaurante") || d.includes("comida") || d.includes("café")) return <LuUtensils class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("turismo") || d.includes("viaje")) return <LuPlane class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("hotel") || d.includes("alojamiento")) return <LuHotel class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("moda") || d.includes("ropa") || d.includes("indumentaria") || d.includes("calzado")) return <LuShirt class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("estética") || d.includes("belleza") || d.includes("peluquería") || d.includes("spa")) return <LuSparkles class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("salud") || d.includes("cuidado") || d.includes("farmacia") || d.includes("ortopedia") || d.includes("médic")) return <LuHeartPulse class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("deporte") || d.includes("gimnasio") || d.includes("club") || d.includes("fitness")) return <LuDumbbell class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("entretenimiento") || d.includes("cine") || d.includes("teatro") || d.includes("espectáculo")) return <LuFilm class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("evento") || d.includes("fiesta") || d.includes("reunión")) return <LuCalendar class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("fotografía") || d.includes("foto")) return <LuCamera class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("educación") || d.includes("curso") || d.includes("colegio") || d.includes("universidad") || d.includes("librería")) return <LuGraduationCap class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("banco") || d.includes("financiero") || d.includes("seguro") || d.includes("crédito")) return <LuCreditCard class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("compras") || d.includes("supermercado") || d.includes("regalo") || d.includes("mayorista")) return <LuShoppingBag class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("hogar") || d.includes("deco") || d.includes("mueble") || d.includes("inmobiliari") || d.includes("construc")) return <LuHome class="w-12 h-12 text-current stroke-[1.5]" />;
  if (d.includes("servicio") || d.includes("auto") || d.includes("taller") || d.includes("mecánica")) return <LuCar class="w-12 h-12 text-current stroke-[1.5]" />;
  return <LuTags class="w-12 h-12 text-current stroke-[1.5]" />;
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

  return (
    <div class="w-full text-left">
      <div class="flex items-center justify-between mb-5 border-b border-slate-200/60 pb-3">
        <h3 class="text-[13px] font-black tracking-widest text-slate-400 uppercase pl-1 m-0">
          {title}
        </h3>
        {/* Category scroll controllers */}
        <div class="flex items-center space-x-2 select-none">
          <button
            type="button"
            onClick$={scrollLeft}
            class="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-sm transition-all active:scale-90 cursor-pointer"
            aria-label="Anterior"
          >
            <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick$={scrollRight}
            class="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-sm transition-all active:scale-90 cursor-pointer"
            aria-label="Siguiente"
          >
            <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div
        id={sliderId}
        class="flex items-center space-x-4 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory"
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
                "relative flex flex-col items-center justify-center text-center p-4 rounded-[2.2rem] border transition-all duration-300 w-36 h-36 flex-shrink-0 select-none cursor-pointer group snap-start shadow-sm",
                isSelected
                  ? "bg-brand-green border-brand-green text-white shadow-lg shadow-brand-green/20 scale-105"
                  : "bg-white border-slate-200 hover:border-brand-green/45 text-slate-700 hover:text-brand-green hover:shadow-md hover:scale-105"
              ]}
            >
              {/* Floating Benefit Count Badge */}
              <span
                class={[
                  "absolute top-3 right-3 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm transition-all duration-300 flex items-center justify-center min-w-[20px] h-5",
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
                {getCategoryIcon(cat.descripcion)}
              </span>
              <span class="text-[12px] font-black uppercase tracking-wider mt-4 truncate max-w-[124px]">
                {cat.descripcion}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
});
