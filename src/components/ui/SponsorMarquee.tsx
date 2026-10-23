import { component$, type JSXOutput } from "@builder.io/qwik";

export type SponsorTier = "principal" | "oficial" | "proveedor";

export const SPONSOR_TIERS: { value: SponsorTier; label: string; hint: string }[] = [
  { value: "principal", label: "Principal", hint: "Se muestra primero, fijo y más grande." },
  { value: "oficial", label: "Oficial", hint: "Tamaño estándar, en la franja de marcas." },
  { value: "proveedor", label: "Proveedor", hint: "Logo más chico, al final de la franja." },
];

interface Sponsor {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl?: string | null;
  /** Older rows (and callers) without a tier count as "oficial". */
  tier?: string | null;
}

interface SponsorMarqueeProps {
  sponsors: Sponsor[];
  /** Admin preview: no links and no animation, so every logo stays in view at its real size. */
  preview?: boolean;
}

const TIER_RANK: Record<SponsorTier, number> = { principal: 0, oficial: 1, proveedor: 2 };

const LOGO_SIZES: Record<SponsorTier, { width: number; height: number; class: string }> = {
  principal: { width: 240, height: 64, class: "h-16 w-[240px]" },
  oficial: { width: 180, height: 48, class: "h-12 w-[180px]" },
  proveedor: { width: 140, height: 36, class: "h-9 w-[140px]" },
};

export function sponsorTier(value: string | null | undefined): SponsorTier {
  return value === "principal" || value === "proveedor" ? value : "oficial";
}

/** Stable: within a tier the admin's order is kept. */
export function sortSponsorsByTier<T extends { tier?: string | null }>(sponsors: T[]): T[] {
  return sponsors
    .map((sponsor, index) => ({ sponsor, index }))
    .sort((a, b) => TIER_RANK[sponsorTier(a.sponsor.tier)] - TIER_RANK[sponsorTier(b.sponsor.tier)] || a.index - b.index)
    .map(({ sponsor }) => sponsor);
}

function logoSrc(imageUrl: string) {
  return /^(https?:|\/|data:|blob:)/.test(imageUrl) ? imageUrl : `/uploads/${imageUrl}`;
}

export const SponsorMarquee = component$<SponsorMarqueeProps>(({ sponsors, preview = false }) => {
  if (!sponsors || sponsors.length === 0) return null;

  // Like lprc.com.ar, the main sponsors get their own fixed row above the rest.
  const sorted = sortSponsorsByTier(sponsors);
  const principal = sorted.filter((sponsor) => sponsorTier(sponsor.tier) === "principal");
  const rest = sorted.filter((sponsor) => sponsorTier(sponsor.tier) !== "principal");
  const useMarquee = !preview && rest.length > 4;
  const displayRest = useMarquee ? [...rest, ...rest] : rest;

  const renderLogo = (sponsor: Sponsor, key: string, isDuplicate: boolean): JSXOutput => {
    const size = LOGO_SIZES[sponsorTier(sponsor.tier)];
    const itemContent = (
      <div class="flex items-center justify-center px-6 sm:px-10 shrink-0">
        <img
          src={logoSrc(sponsor.imageUrl)}
          alt={isDuplicate ? "" : sponsor.name}
          width={size.width}
          height={size.height}
          class={`${size.class} object-contain`}
          loading={preview ? "eager" : "lazy"}
        />
      </div>
    );

    if (sponsor.linkUrl && !preview) {
      return (
        <a
          key={key}
          href={sponsor.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-hidden={isDuplicate ? "true" : undefined}
          tabIndex={isDuplicate ? -1 : undefined}
          class="inline-flex min-h-11 shrink-0 items-center transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {itemContent}
        </a>
      );
    }

    return <div key={key} class="shrink-0" aria-hidden={isDuplicate ? "true" : undefined}>{itemContent}</div>;
  };

  return (
    <section
      aria-label="Marcas que nos acompañan"
      class="w-full bg-surface border-y border-line py-8 overflow-hidden relative select-none"
    >
      {useMarquee && (
        <>
          <div class="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
          <div class="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>
        </>
      )}
      <p class="eyebrow mb-6 px-4 text-center text-slate-600">Nos acompañan</p>
      {principal.length > 0 && (
        <div class={["flex flex-wrap items-center justify-center gap-y-6 px-4", rest.length > 0 && "mb-6"]}>
          {principal.map((sponsor) => renderLogo(sponsor, `principal-${sponsor.id}`, false))}
        </div>
      )}
      {rest.length > 0 && (
        <div class="flex items-center overflow-hidden">
          <div
            class={useMarquee
              ? "animate-marquee hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
              : "flex w-full flex-wrap items-center justify-center gap-y-6"}
          >
            {displayRest.map((sponsor, idx) => renderLogo(sponsor, `${sponsor.id}-${idx}`, idx >= rest.length))}
          </div>
        </div>
      )}
    </section>
  );
});
