import { component$, $ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import type { Offer } from "~/server/cache";


interface OfferSliderProps {
  ofertas: Offer[];
  activeOfferId?: number | null;
  sliderId?: string;
  filterEmpty?: boolean;
  title?: string;
}

export const OfferSlider = component$<OfferSliderProps>(({
  ofertas,
  activeOfferId = null,
  sliderId = "offer-scroll-container",
  filterEmpty = false,
  title = "Explorá por Descuento"
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

  return (
    <div class="w-full text-left">
      <div class="flex items-center justify-between mb-5 border-b border-slate-200/60 pb-3">
        <h3 class="text-[13px] font-black tracking-widest text-slate-400 uppercase pl-1 m-0">
          {title}
        </h3>
        {/* Scroll controllers */}
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
              class={[
                "flex items-center justify-between space-x-2.5 px-4 py-2.5 rounded-full border transition-all duration-300 flex-shrink-0 select-none cursor-pointer group snap-start shadow-sm text-xs font-black uppercase tracking-wider",
                isSelected
                  ? "bg-brand-green border-brand-green text-white shadow-md shadow-brand-green/20 scale-105"
                  : "bg-white border-slate-200 hover:border-brand-green/45 text-slate-700 hover:text-brand-green hover:shadow-sm hover:scale-105"
              ]}
            >
              <span>
                {off.descripcion.toLowerCase().includes("promoci") ? "Promociones" : `${off.descripcion} OFF`}
              </span>
              <span
                class={[
                  "flex items-center justify-center text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] h-5 leading-none transition-all duration-300",
                  isSelected
                    ? "bg-brand-gold text-slate-950 font-black shadow-sm"
                    : "bg-slate-100 text-slate-500 group-hover:bg-brand-green group-hover:text-white"
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
});
