import { component$, $ } from "@builder.io/qwik";
import type { Benefit } from "~/server/cache";
import { BenefitCard } from "~/components/ui/BenefitCard";

interface CuratedRowProps {
  title: string;
  subtitle: string;
  accentColor: "gold" | "green" | "emerald";
  containerId: string;
  benefits: Benefit[];
  variant: "gold" | "new" | "standard";
}

export const CuratedRow = component$<CuratedRowProps>(({
  title,
  subtitle,
  containerId,
  benefits,
  variant,
}) => {
  const scrollContainer = $((direction: "left" | "right") => {
    const container = document.getElementById(containerId);
    if (container) {
      container.scrollBy({
        left: direction === "left" ? -340 : 340,
        behavior: "smooth",
      });
    }
  });

  if (!benefits || benefits.length === 0) return null;

  const dotColorClass = "bg-accent";
  const labelColorClass = "text-accent";

  return (
    <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 print:hidden text-left animate-fade-in-up">
      <div class="flex items-end justify-between border-b border-secondary pb-3 mb-6">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <span class={`w-1.5 h-1.5 rounded-full ${dotColorClass} animate-pulse`}></span>
            <span class={`text-[11px] font-black tracking-widest ${labelColorClass} uppercase`}>{subtitle}</span>
          </div>
          <h2 class="text-2xl font-display font-extrabold text-white tracking-tight leading-none">
            {title}
          </h2>
        </div>
        {/* Arrow navigation buttons */}
        <div class="flex items-center space-x-2 pb-0.5">
          <button
            type="button"
            onClick$={() => scrollContainer("left")}
            class="w-8 h-8 rounded-full border border-secondary bg-[#0B1526] hover:bg-[#1E2B45] text-slate-350 flex items-center justify-center shadow-sm transition-all active:scale-90 cursor-pointer"
            aria-label="Anterior"
          >
            <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick$={() => scrollContainer("right")}
            class="w-8 h-8 rounded-full border border-secondary bg-[#0B1526] hover:bg-[#1E2B45] text-slate-350 flex items-center justify-center shadow-sm transition-all active:scale-90 cursor-pointer"
            aria-label="Siguiente"
          >
            <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div id={containerId} class="flex items-center space-x-6 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
        {benefits.map((benefit: Benefit) => (
          <div key={`${variant}-${benefit.id}`} class="w-[280px] sm:w-[320px] flex-shrink-0 snap-start select-none">
            <BenefitCard benefit={benefit} variant={variant} />
          </div>
        ))}
      </div>
    </section>
  );
});
