import { component$ } from "@builder.io/qwik";

interface Sponsor {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl?: string | null;
}

interface SponsorMarqueeProps {
  sponsors: Sponsor[];
}

export const SponsorMarquee = component$<SponsorMarqueeProps>(({ sponsors }) => {
  if (!sponsors || sponsors.length === 0) return null;

  const useMarquee = sponsors.length > 4;
  const displaySponsors = useMarquee ? [...sponsors, ...sponsors] : sponsors;

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
      <p class="mb-6 px-4 text-center text-[11px] font-black uppercase tracking-widest text-slate-600">
        Nos acompañan
      </p>
      <div class="flex items-center overflow-hidden">
        <div
          class={useMarquee
            ? "animate-marquee hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]"
            : "flex w-full flex-wrap items-center justify-center gap-y-6"}
        >
          {displaySponsors.map((sponsor, idx) => {
            const imageSrc = sponsor.imageUrl.startsWith("http") || sponsor.imageUrl.startsWith("/")
              ? sponsor.imageUrl
              : `/uploads/${sponsor.imageUrl}`;
            const isDuplicate = idx >= sponsors.length;

            const itemContent = (
              <div class="flex items-center justify-center px-6 sm:px-10 shrink-0">
                <img
                  src={imageSrc}
                  alt={isDuplicate ? "" : sponsor.name}
                  width={180}
                  height={48}
                  class="h-12 w-[180px] object-contain"
                  loading="lazy"
                />
              </div>
            );

            if (sponsor.linkUrl) {
              return (
                <a
                  key={`${sponsor.id}-${idx}`}
                  href={sponsor.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-hidden={isDuplicate ? "true" : undefined}
                  tabIndex={isDuplicate ? -1 : undefined}
                  class="inline-flex min-h-11 shrink-0 items-center rounded-md transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {itemContent}
                </a>
              );
            }

            return <div key={`${sponsor.id}-${idx}`} class="shrink-0" aria-hidden={isDuplicate ? "true" : undefined}>{itemContent}</div>;
          })}
        </div>
      </div>
    </section>
  );
});
