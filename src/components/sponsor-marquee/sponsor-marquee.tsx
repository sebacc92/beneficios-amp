import { component$ } from "@builder.io/qwik";
import {
  LuHotel,
  LuDumbbell,
  LuUtensils,
  LuShoppingBag,
  LuCompass
} from "@qwikest/icons/lucide";

interface Sponsor {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl?: string | null;
}

interface SponsorMarqueeProps {
  sponsors: Sponsor[];
}

const MockBrands = [
  { name: "Dazzler Hoteles", label: "DAZZLER HOTELES", icon: "hotel" },
  { name: "Tred Gimnasio", label: "TRED GIMNASIO", icon: "dumbbell" },
  { name: "Mercado 55", label: "MERCADO 55", icon: "utensils" },
  { name: "Nini Supermercado", label: "NINI SUPERMERCADO", icon: "shop" },
  { name: "Finca Los Cauquenes", label: "FINCA LOS CAUQUENES", icon: "compass" }
];

const MockIcon = ({ icon }: { icon: string }) => {
  if (icon === "hotel") return <LuHotel class="w-10 h-10 text-brand-green stroke-[2]" />;
  if (icon === "dumbbell") return <LuDumbbell class="w-10 h-10 text-brand-green stroke-[2]" />;
  if (icon === "utensils") return <LuUtensils class="w-10 h-10 text-brand-green stroke-[2]" />;
  if (icon === "shop") return <LuShoppingBag class="w-10 h-10 text-brand-green stroke-[2]" />;
  if (icon === "compass") return <LuCompass class="w-10 h-10 text-brand-green stroke-[2]" />;
  return null;
};


export const SponsorMarquee = component$<SponsorMarqueeProps>(({ sponsors }) => {
  const hasSponsors = sponsors && sponsors.length > 0;
  const useMarquee = hasSponsors ? sponsors.length > 4 : true;

  return (
    <section class="relative w-full overflow-hidden py-10 select-none bg-white border-y border-slate-100/80 my-6 print:hidden">
      <div class="absolute inset-y-0 left-0 w-24 sm:w-32 bg-gradient-to-r from-white via-white/80 to-transparent z-20 pointer-events-none"></div>
      <div class="absolute inset-y-0 right-0 w-24 sm:w-32 bg-gradient-to-l from-white via-white/80 to-transparent z-20 pointer-events-none"></div>

      <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <p class="text-center text-[12px] font-black tracking-widest text-slate-500 uppercase">Nuestras Marcas Asociadas</p>
      </div>

      <div class="flex w-full overflow-hidden relative">
        <div class={`flex items-center py-2 ${useMarquee ? "animate-marquee gap-12 hover:[animation-play-state:paused]" : "gap-8 justify-center mx-auto w-full flex-wrap"}`}>
          {hasSponsors ? (
            <>
              {sponsors.map((sp) => (
                <a
                  key={`sp-a-${sp.id}`}
                  href={sp.linkUrl || "#"}
                  target={sp.linkUrl ? "_blank" : undefined}
                  rel={sp.linkUrl ? "noopener noreferrer" : undefined}
                  class="flex items-center justify-center p-2 hover:scale-110 transition-all duration-300 group relative cursor-pointer min-w-[220px] h-[110px]"
                >
                  <img
                    src={sp.imageUrl}
                    alt={sp.name}
                    width={220}
                    height={80}
                    class="h-20 max-w-[220px] object-contain filter hover:brightness-105 transition-all duration-300"
                  />
                </a>
              ))}
              {sponsors.length > 4 && sponsors.map((sp) => (
                <a
                  key={`sp-b-${sp.id}`}
                  href={sp.linkUrl || "#"}
                  target={sp.linkUrl ? "_blank" : undefined}
                  rel={sp.linkUrl ? "noopener noreferrer" : undefined}
                  class="flex items-center justify-center p-2 hover:scale-110 transition-all duration-300 group relative cursor-pointer min-w-[220px] h-[110px]"
                  aria-hidden="true"
                >
                  <img
                    src={sp.imageUrl}
                    alt={sp.name}
                    width={220}
                    height={80}
                    class="h-20 max-w-[220px] object-contain filter hover:brightness-105 transition-all duration-300"
                  />
                </a>
              ))}
            </>
          ) : (
            <>
              {MockBrands.map((mock, idx) => (
                <div key={`mock-a-${idx}`} class="flex items-center space-x-3 p-2 hover:scale-110 transition-all duration-300 cursor-default group relative min-w-[220px] h-[110px] justify-center">
                  <MockIcon icon={mock.icon} />
                  <span class="text-brand-green font-display font-black text-lg tracking-wider uppercase">{mock.label}</span>
                </div>
              ))}
              {MockBrands.map((mock, idx) => (
                <div key={`mock-b-${idx}`} class="flex items-center space-x-3 p-2 hover:scale-110 transition-all duration-300 cursor-default group relative min-w-[220px] h-[110px] justify-center" aria-hidden="true">
                  <MockIcon icon={mock.icon} />
                  <span class="text-brand-green font-display font-black text-lg tracking-wider uppercase">{mock.label}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
});
