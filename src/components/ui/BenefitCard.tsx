import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { LuLock, LuMapPin } from "@qwikest/icons/lucide";
import type { Benefit } from "~/server/cache";
import { formatDiscount, isClubLocation } from "~/utils/home-benefits";

interface BenefitCardProps {
  benefit: Benefit;
  /** "new" adds how long ago the benefit was loaded; "gold" marks it for Gold members. */
  variant?: "gold" | "new" | "standard";
  isLocked?: boolean;
  /**
   * Location most cards in the list share (see `commonLocation`). Cards there do not
   * repeat it; cards elsewhere still show theirs.
   */
  commonLocation?: string | null;
}

const parseDate = (dateStr?: string) => {
  if (!dateStr) return null;
  const date = new Date(dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T"));
  return isNaN(date.getTime()) ? null : date;
};

const getTimeAgo = (dateStr?: string) => {
  const date = parseDate(dateStr);
  if (!date) return "Nuevo";

  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffDays < 1) return diffHours < 1 ? "Nuevo" : `Nuevo · hace ${diffHours} h`;
  if (diffDays === 1) return "Nuevo · desde ayer";
  if (diffDays < 7) return `Nuevo · hace ${diffDays} días`;
  if (diffWeeks < 5) return `Nuevo · hace ${diffWeeks} sem`;
  return "Nuevo";
};

const imageSrc = (path?: string | null) =>
  path ? (/^(https?:|data:|blob:|\/)/.test(path) ? path : `https://beneficios.lprc.ar/files/${path}`) : "";

export const BenefitCard = component$<BenefitCardProps>(({ benefit, variant = "standard", isLocked = false, commonLocation }) => {
  const desktopImageSrc = imageSrc(benefit.imagen);
  const mobileImageSrc = imageSrc(benefit.imagenMobile);
  const primaryCat = benefit.categorias?.[0]?.descripcion || "Beneficios";
  const location = benefit.ubicacion?.[0]?.descripcion?.trim() || "";
  const discount = formatDiscount(benefit.resumen);
  const atClub = isClubLocation(location);
  // The address says more than the city; the city only when it differs from the list's.
  const place = benefit.address?.trim() || (location && !atClub && location.toLowerCase() !== commonLocation?.toLowerCase() ? location : "");
  const description = benefit.descripcion
    ? benefit.descripcion.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    : "";
  const statusLabel =
    variant === "new" ? getTimeAgo(benefit.created_at) : variant === "gold" || benefit.isPremiumOnly ? "Socios Gold" : "";

  return (
    <Link
      href={`/beneficio/${benefit.url}`}
      aria-label={`${benefit.titulo}: ${discount}. Ver beneficio`}
      class="group card flex h-full w-full flex-col overflow-hidden text-left transition-[border-color,box-shadow] duration-200 hover:border-primary hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
    >
      <div class="relative aspect-[16/9] shrink-0 overflow-hidden bg-primary">
        {desktopImageSrc ? (
          <picture class="block h-full w-full">
            {mobileImageSrc && <source media="(max-width: 640px)" srcset={mobileImageSrc} />}
            <img
              src={desktopImageSrc}
              alt=""
              class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              width={320}
              height={180}
              loading="lazy"
            />
          </picture>
        ) : (
          <div class="flex h-full w-full items-center justify-center">
            <img src="/lprc.avif" alt="" width={120} height={101} class="h-16 w-auto opacity-90" loading="lazy" />
          </div>
        )}

        {isLocked && (
          <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-primary/85 text-white">
            <LuLock class="h-7 w-7 text-accent" aria-hidden="true" />
            <span class="eyebrow mt-2 text-white">Exclusivo socios</span>
          </div>
        )}

        <span class="badge badge-accent absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)] whitespace-normal px-2.5 py-1.5 text-left text-sm leading-tight">
          {discount}
        </span>
        <div class="absolute inset-x-3 bottom-3 z-10 flex items-end justify-between gap-2">
          <span class="badge badge-dark truncate">{primaryCat}</span>
          {statusLabel && <span class="badge shrink-0 bg-white text-primary">{statusLabel}</span>}
        </div>
      </div>

      <div class="flex flex-1 flex-col p-5">
        <h3 class="heading-display line-clamp-2 min-h-[2lh] text-lg text-primary">{benefit.titulo}</h3>
        {atClub && !benefit.address ? (
          <p class="mt-2">
            <span class="badge badge-dark">En el club</span>
          </p>
        ) : (
          place && (
            <p class="mt-2 flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-700">
              <LuMapPin class="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
              <span class="truncate">{place}</span>
            </p>
          )
        )}
        <p class="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
          {description || "Mirá las condiciones en la ficha del beneficio."}
        </p>
        <span class="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-secondary group-hover:underline">
          Ver beneficio <span aria-hidden="true">&rarr;</span>
        </span>
      </div>
    </Link>
  );
});
