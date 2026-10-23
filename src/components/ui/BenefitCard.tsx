import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { Benefit } from "~/server/cache";

interface BenefitCardProps {
  benefit: Benefit;
  variant?: "gold" | "new" | "standard";
  isLocked?: boolean;
}

// --- DATE HELPERS ---
const parseDate = (dateStr?: string) => {
  if (!dateStr) return null;
  const normalized = dateStr.includes("T")
    ? dateStr
    : dateStr.replace(" ", "T");
  const date = new Date(normalized);
  return isNaN(date.getTime()) ? null : date;
};

const formatDate = (dateStr?: string) => {
  const date = parseDate(dateStr);
  if (!date) return "Reciente";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const getTimeAgo = (dateStr?: string) => {
  const date = parseDate(dateStr);
  if (!date) return "Nuevo";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffDays < 1) {
    if (diffHours < 1) {
      return "Hace instantes";
    }
    return `Hace ${diffHours} h`;
  }
  if (diffDays === 1) {
    return "Desde ayer";
  }
  if (diffDays < 7) {
    return `Hace ${diffDays} días`;
  }
  if (diffWeeks === 1) {
    return "Hace 1 sem";
  }
  if (diffWeeks < 4) {
    return `Hace ${diffWeeks} sem`;
  }
  if (diffMonths === 1) {
    return "Hace 1 mes";
  }
  if (diffMonths < 12) {
    return `Hace ${diffMonths} meses`;
  }
  return `Hace ${Math.floor(diffMonths / 12)} años`;
};

export const BenefitCard = component$<BenefitCardProps>(
  ({ benefit, variant = "standard", isLocked = false }) => {
    const desktopImageSrc = benefit.imagen
      ? /^(https?:|data:|blob:|\/)/.test(benefit.imagen)
        ? benefit.imagen
        : `https://beneficios.lprc.ar/files/${benefit.imagen}`
      : "";

    const mobileImageSrc = benefit.imagenMobile
      ? /^(https?:|data:|blob:|\/)/.test(benefit.imagenMobile)
        ? benefit.imagenMobile
        : `https://beneficios.lprc.ar/files/${benefit.imagenMobile}`
      : "";

    const primaryCat = benefit.categorias?.[0]?.descripcion || "Beneficios";
    const primaryLoc = benefit.ubicacion?.[0]?.descripcion || "La Plata";
    const discountText = benefit.resumen || "Exclusivo";
    const formattedDiscount = discountText.replace("Descuento del", "").trim();

    // --- 1. VARIANT: GOLD / PREMIUM ---
    if (variant === "gold") {
      return (
        <Link
          href={`/beneficio/${benefit.url}`}
          class="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent bg-surface border border-accent/30 rounded-[1.8rem] overflow-hidden shadow-xl hover:shadow-accent/10 hover:-translate-y-1.5 transition-all duration-300 relative min-h-[368px] text-left"
        >
          {/* Card Image */}
          <div class="relative h-[180px] bg-surface-muted overflow-hidden flex items-center justify-center">
            {desktopImageSrc ? (
              <picture class="w-full h-full block">
                {mobileImageSrc && (
                  <source media="(max-width: 640px)" srcset={mobileImageSrc} />
                )}
                <img
                  src={desktopImageSrc}
                  alt={benefit.titulo}
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  width={320}
                  height={180}
                  loading="lazy"
                />
              </picture>
            ) : (
              <div class="flex flex-col items-center justify-center p-6 text-center h-full w-full bg-surface-muted">
                <span class="text-primary font-display font-black text-2xl">
                  LPRC GOLD
                </span>
                <span class="text-slate-600 text-[11px] font-bold uppercase tracking-wider mt-1">
                  {primaryCat}
                </span>
              </div>
            )}

            {/* Floating Badges */}
            <div class="absolute top-3.5 left-3.5 z-10">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black bg-accent text-primary uppercase tracking-widest shadow-sm">
                {primaryCat}
              </span>
            </div>
            <div class="absolute top-3.5 right-3.5 z-10 max-w-[calc(100%-1.75rem)]">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-primary/80 text-accent backdrop-blur-sm tracking-wider uppercase border border-accent/20">
                ★ GOLD
              </span>
            </div>
          </div>

          {/* Card Body */}
          <div class="pt-5 px-6 pb-8 flex flex-col justify-between min-h-[192px] gap-4 bg-surface text-left">
            <div class="space-y-1.5">
              <h3 class="text-[12px] font-black text-slate-600 uppercase tracking-wider truncate">
                {primaryLoc}
              </h3>
              <h4 class="text-[16.5px] font-display font-extrabold text-primary line-clamp-2 leading-snug group-hover:text-slate-700 transition-colors duration-200">
                {benefit.titulo}
              </h4>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 pt-3.5 border-t border-line mt-auto">
              <span class="text-[12px] font-black text-slate-600 uppercase tracking-wider">
                Membresía Gold
              </span>
              <span class="inline-flex items-center px-4 py-1.5 rounded-xl text-[14.5px] font-black bg-accent text-primary shadow-md uppercase tracking-wide border border-accent/20">
                {formattedDiscount}
              </span>
            </div>
          </div>
        </Link>
      );
    }

    // --- 2. VARIANT: NEW ---
    if (variant === "new") {
      const dateVal = benefit.created_at;
      const timeAgo = getTimeAgo(dateVal);
      const formattedDate = formatDate(dateVal);

      return (
        <Link
          href={`/beneficio/${benefit.url}`}
          class="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent bg-surface border border-line rounded-[1.8rem] overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 relative min-h-[396px] text-left"
        >
          {/* Card Image */}
          <div class="relative h-[180px] bg-surface-muted overflow-hidden flex items-center justify-center">
            {desktopImageSrc ? (
              <picture class="w-full h-full block">
                {mobileImageSrc && (
                  <source media="(max-width: 640px)" srcset={mobileImageSrc} />
                )}
                <img
                  src={desktopImageSrc}
                  alt={benefit.titulo}
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  width={320}
                  height={180}
                  loading="lazy"
                />
              </picture>
            ) : (
              <div class="flex flex-col items-center justify-center p-6 text-center h-full w-full bg-surface-muted">
                <span class="text-primary font-display font-black text-2xl">
                  LPRC
                </span>
                <span class="text-slate-600 text-[11px] font-bold uppercase tracking-wider mt-1">
                  {primaryCat}
                </span>
              </div>
            )}

            {/* Floating Badges */}
            <div class="absolute top-3.5 left-3.5 z-10 flex items-center justify-between w-[calc(100%-1.75rem)]">
              <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-black bg-primary/70 text-slate-100 backdrop-blur-sm border border-line uppercase tracking-widest leading-none">
                {primaryCat}
              </span>
              <span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-black bg-primary/80 text-accent backdrop-blur-sm border border-accent/20 tracking-widest uppercase leading-none">
                <span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
                <span>{timeAgo}</span>
              </span>
            </div>
          </div>

          {/* Card Body */}
          <div class="pt-5 px-6 pb-8 flex flex-col justify-between min-h-[220px] gap-4 bg-surface text-left">
            <div class="space-y-1.5">
              <h3 class="text-[12px] font-black text-slate-600 uppercase tracking-widest truncate leading-none">
                {primaryLoc}
              </h3>
              <h4 class="text-[15.5px] font-display font-extrabold text-primary line-clamp-2 leading-snug group-hover:text-slate-700 transition-colors duration-200">
                {benefit.titulo}
              </h4>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2 pt-3.5 border-t border-line mt-auto">
              <div class="flex items-center space-x-2 text-left">
                <div class="w-7.5 h-7.5 rounded-lg bg-surface-muted border border-line flex items-center justify-center text-slate-600 flex-shrink-0">
                  <svg
                    class="w-3.5 h-3.5 text-primary"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2.5"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div class="flex flex-col">
                  <span class="text-[11px] font-black text-slate-600 uppercase tracking-widest leading-none">
                    Inicio
                  </span>
                  <span class="text-[12px] font-bold text-slate-700 tracking-tight mt-0.5 leading-none">
                    {formattedDate}
                  </span>
                </div>
              </div>
              <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[13px] font-black bg-accent/10 text-amber-900 border border-accent/40 shadow-sm uppercase tracking-wide">
                {formattedDiscount}
              </span>
            </div>
          </div>
        </Link>
      );
    }

    // --- 3. VARIANT: STANDARD ---
    return (
      <Link
        href={`/beneficio/${benefit.url}`}
        aria-label={`${benefit.titulo}: ${discountText}. Ver beneficio`}
        class="bg-surface border border-line rounded-[2.2rem] overflow-hidden hover:shadow-xl hover:shadow-accent/5 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent shadow-md text-left"
      >
        {/* Image & floating elements */}
        <div class="relative h-[180px] bg-surface-muted overflow-hidden flex items-center justify-center">
          {desktopImageSrc ? (
            <picture class="w-full h-full block">
              {mobileImageSrc && (
                <source media="(max-width: 640px)" srcset={mobileImageSrc} />
              )}
              <img
                src={desktopImageSrc}
                alt={benefit.titulo}
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                width={320}
                height={180}
                loading="lazy"
              />
            </picture>
          ) : (
            <div class="flex flex-col items-center justify-center p-6 text-center">
              <span class="text-primary font-display font-black text-2xl">
                LPRC
              </span>
              <span class="text-slate-600 text-[11px] font-bold uppercase tracking-wider mt-1">
                {primaryCat}
              </span>
            </div>
          )}

          {/* Exclusive Gold locking label */}
          {isLocked && (
            <div class="absolute inset-0 bg-primary/60 backdrop-blur-[2px] flex flex-col justify-center items-center z-20 text-white animate-fade-in">
              <span class="text-3xl">🔒</span>
              <span class="text-[12px] font-extrabold tracking-widest uppercase text-accent mt-1.5">
                Exclusivo Socios
              </span>
            </div>
          )}

          {/* Floating Offer Badge */}
          <div class="absolute top-3.5 right-3.5 z-10 max-w-[calc(100%-1.75rem)]">
            <span class="inline-flex max-w-full items-center px-4 py-2 rounded-2xl text-right leading-snug text-[15px] font-black bg-accent text-primary border border-accent/20 shadow-lg uppercase tracking-wider">
              {formattedDiscount}
            </span>
          </div>

          {/* Floating Category Pill */}
          <div class="absolute bottom-3 left-3 z-10">
            <span class="inline-flex items-center px-3.5 py-1 rounded-full text-[12px] font-bold bg-primary/70 backdrop-blur-sm border border-line uppercase tracking-wide text-white">
              {primaryCat}
            </span>
          </div>
        </div>

        {/* Benefit Card Body */}
        <div class="flex-grow pt-6 px-6 pb-8 flex flex-col justify-between">
          <div class="space-y-2.5 text-left mb-5">
            {/* Location pin badge */}
            <div class="flex items-center text-primary space-x-1">
              <svg class="w-4 h-4 text-primary fill-current" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span class="text-[13.5px] font-black uppercase tracking-wider text-slate-600">
                {primaryLoc}
              </span>
            </div>

            <h3 class="text-[20px] font-display font-black text-primary leading-snug line-clamp-2 group-hover:text-slate-700 transition-colors duration-300">
              {benefit.titulo}
            </h3>

            <p class="text-[14.5px] text-slate-600 leading-relaxed font-medium line-clamp-3">
              {benefit.descripcion
                ? benefit.descripcion
                    .replace(/<[^>]*>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
                : "No hay descripción disponible para este beneficio."}
            </p>
          </div>

          {/* Action Link Button */}
          <div class="pt-5 border-t border-line mt-auto">
            <span class="block text-center text-xs font-black uppercase tracking-wider py-3.5 rounded-2xl bg-accent text-primary group-hover:bg-accent-hover transition-colors shadow-md">
              Ver beneficio &rarr;
            </span>
          </div>
        </div>
      </Link>
    );
  },
);
