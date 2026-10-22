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
  // If no sponsors, don't render or show a subtle bar
  if (!sponsors || sponsors.length === 0) {
    return null;
  }

  // To make the marquee infinite and seamless, we duplicate the list of sponsors
  const doubleSponsors = [...sponsors, ...sponsors, ...sponsors];

  return (
    <div class="w-full bg-[#0B1526] border-y border-secondary py-8 overflow-hidden relative select-none">
      {/* Decorative side fade gradients for premium smooth overlay */}
      <div class="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#040811] to-transparent z-10 pointer-events-none"></div>
      <div class="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#040811] to-transparent z-10 pointer-events-none"></div>

      <div class="flex items-center overflow-hidden">
        {/* CSS Keyframes animation container */}
        <div class="animate-marquee">
          {doubleSponsors.map((sponsor, idx) => {
            const imageSrc = sponsor.imageUrl.startsWith("http") || sponsor.imageUrl.startsWith("/")
              ? sponsor.imageUrl
              : `/uploads/${sponsor.imageUrl}`;

            const itemContent = (
              <div class="flex items-center justify-center px-8 sm:px-12 shrink-0">
                <img
                  src={imageSrc}
                  alt={sponsor.name}
                  class="h-9 sm:h-12 w-auto object-contain opacity-40 hover:opacity-100 transition-all duration-300 filter grayscale hover:grayscale-0 contrast-125"
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
                  class="inline-block"
                >
                  {itemContent}
                </a>
              );
            }

            return <div key={`${sponsor.id}-${idx}`} class="inline-block">{itemContent}</div>;
          })}
        </div>
      </div>
    </div>
  );
});
