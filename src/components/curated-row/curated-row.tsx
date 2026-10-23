import { component$, $ } from "@builder.io/qwik";
import type { Benefit } from "~/server/cache";
import { BenefitCard } from "~/components/ui/BenefitCard";
import { SectionHeading } from "~/components/section-heading/section-heading";

interface CuratedRowProps {
  title: string;
  subtitle: string;
  /** @deprecated Kept for older callers; every row now uses the club colors. */
  accentColor?: "gold" | "green" | "emerald";
  containerId: string;
  benefits: Benefit[];
  variant: "gold" | "new" | "standard";
  /** Passed to each card so the shared city is not repeated on every one. */
  commonLocation?: string | null;
}

const arrowButton =
  "flex h-11 w-11 items-center justify-center border border-primary bg-surface text-primary transition-colors hover:bg-primary hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const CuratedRow = component$<CuratedRowProps>(({ title, subtitle, containerId, benefits, variant, commonLocation }) => {
  const scrollContainer = $((direction: "left" | "right") => {
    const container = document.getElementById(containerId);
    if (container) {
      container.scrollBy({
        left: direction === "left" ? -340 : 340,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
    }
  });

  if (!benefits || benefits.length === 0) return null;

  return (
    <section class="mx-auto max-w-[90rem] px-4 py-8 text-left print:hidden sm:px-6 lg:px-8" aria-labelledby={`${containerId}-title`}>
      <div class="mb-6 flex items-end justify-between gap-4">
        <SectionHeading id={`${containerId}-title`} eyebrow={subtitle} title={title} size="md" />
        {/* Phones swipe; four cards fit a desktop row, so arrows only help in between or with more. */}
        <div class={`hidden shrink-0 items-center gap-2 ${benefits.length > 1 ? "sm:flex" : ""} ${benefits.length > 4 ? "" : "lg:hidden"}`}>
          <button
            type="button"
            onClick$={() => scrollContainer("left")}
            class={arrowButton}
            aria-label={`Ver beneficios anteriores en ${title}`}
            aria-controls={containerId}
          >
            <svg class="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="square" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick$={() => scrollContainer("right")}
            class={arrowButton}
            aria-label={`Ver más beneficios en ${title}`}
            aria-controls={containerId}
          >
            <svg class="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="square" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <ul id={containerId} class="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pb-3 sm:mx-0 sm:scroll-px-0 sm:px-0">
        {benefits.map((benefit: Benefit) => (
          <li key={`${variant}-${benefit.id}`} class="flex w-[17.5rem] shrink-0 snap-start sm:w-[19rem] lg:w-[calc((100%-3.75rem)/4)]">
            <BenefitCard benefit={benefit} variant={variant} commonLocation={commonLocation} />
          </li>
        ))}
      </ul>
    </section>
  );
});
