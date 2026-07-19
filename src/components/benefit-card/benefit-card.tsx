import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { Benefit } from "~/server/cache";
import { benefitDiscounts, formatDiscountBadge, formatDiscountChip } from "~/utils/discount";

interface BenefitCardProps {
  benefit: Benefit;
  variant?: "gold" | "new" | "standard";
  isLocked?: boolean;
}

// --- DATE HELPERS ---

const parseDate = (dateStr?: string) => {
  if (!dateStr) return null;
  const normalized = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
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

// Placeholder de marca para beneficios sin imagen: el nombre del comercio se
// presenta como un tratamiento tipográfico sobre fondo de marca (logo-less).
const brandPlaceholder = (title: string, category: string, tone: "light" | "gold" = "light") => (
  <div
    class={[
      "flex flex-col items-center justify-center h-full w-full p-5 text-center relative overflow-hidden",
      tone === "gold"
        ? "bg-gradient-to-br from-slate-950 to-slate-900"
        : "bg-gradient-to-br from-brand-green-dark to-brand-green",
    ]}
  >
    <span
      class={[
        "absolute -right-5 -bottom-8 font-display font-black text-[8rem] leading-none select-none pointer-events-none",
        tone === "gold" ? "text-brand-gold/10" : "text-white/10",
      ]}
    >
      +
    </span>
    <span class="relative font-display font-black leading-tight line-clamp-3 text-white text-lg">
      {title}
    </span>
    <span
      class={[
        "relative mt-2 text-[10px] font-bold uppercase tracking-widest",
        tone === "gold" ? "text-brand-gold/80" : "text-white/65",
      ]}
    >
      {category}
    </span>
  </div>
);

// Encuadre unificado del logo/imagen del comercio. Fuente mixta (logos PNG y
// fotos de fachada/producto), por eso priorizamos object-contain para no
// arriesgar recortes en ningún caso, con padding interno consistente para
// emparejar la presentación visual entre imágenes de distinta proporción.
const benefitImage = (
  desktopImageSrc: string,
  mobileImageSrc: string,
  title: string,
  category: string,
  tone: "light" | "gold",
) =>
  desktopImageSrc ? (
    <picture class="w-full h-full flex items-center justify-center p-5">
      {mobileImageSrc && (
        <source media="(max-width: 640px)" srcset={mobileImageSrc} />
      )}
      <img
        src={desktopImageSrc}
        alt={title}
        class="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
        width={400}
        height={400}
        loading="lazy"
      />
    </picture>
  ) : (
    brandPlaceholder(title, category, tone)
  );

export const BenefitCard = component$<BenefitCardProps>(({ benefit, variant = "standard" }) => {
  const isLocked = false;
  const desktopImageSrc = benefit.imagen
    ? (benefit.imagen.startsWith("http") || benefit.imagen.startsWith("/") 
        ? benefit.imagen 
        : `https://beneficios.amepla.org.ar/files/${benefit.imagen}`)
    : "";

  const mobileImageSrc = benefit.imagenMobile
    ? (benefit.imagenMobile.startsWith("http") || benefit.imagenMobile.startsWith("/") 
        ? benefit.imagenMobile 
        : `https://beneficios.amepla.org.ar/files/${benefit.imagenMobile}`)
    : "";

  const primaryCat = benefit.categorias?.[0]?.descripcion || "Beneficios";
  const primaryLoc = benefit.ubicacion?.[0]?.descripcion || "La Plata";

  // Descuentos (múltiples): badge compacto ("20/25%" o "Hasta 25%") + chip con
  // todos los porcentajes ("5% / 20%"). Compatible con beneficios de 1 descuento.
  const discounts = benefitDiscounts(benefit);
  const offerLabel = formatDiscountBadge(discounts) || "Beneficio";
  const resumenText = formatDiscountChip(discounts);

  // --- 1. VARIANT: GOLD ---
  if (variant === "gold") {
    return (
      <Link
        href={`/beneficio/${benefit.url}`}
        class="group block bg-[#091522] border border-[#d4af37]/35 rounded-[1.8rem] overflow-hidden shadow-xl hover:shadow-[#d4af37]/15 hover:-translate-y-1.5 transition-all duration-300 relative select-none text-left"
      >
        {/* Card Image */}
        <div class="relative aspect-square bg-white overflow-hidden flex items-center justify-center">
          {benefitImage(desktopImageSrc, mobileImageSrc, benefit.titulo, primaryCat, "gold")}

          {/* Floating Badges */}
          <div class="absolute top-3.5 left-3.5 z-10">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-brand-gold text-slate-955 uppercase tracking-widest shadow-sm">
              {primaryCat}
            </span>
          </div>
          <div class="absolute top-3.5 right-3.5 z-10">
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black bg-slate-950/80 text-brand-gold backdrop-blur-sm tracking-wider uppercase">
              ★ GOLD
            </span>
          </div>
        </div>

        {/* Card Body - Optimized padding (pb-8) and custom spacing for maximum breathing room */}
        <div class="pt-5 px-6 pb-8 flex flex-col justify-between h-[192px] bg-[#091522] text-left">
          <div class="space-y-1.5">
            <h3 class="text-[12px] font-black text-brand-gold/80 uppercase tracking-wider truncate">
              {primaryLoc}
            </h3>
            <h4 class="text-[16.5px] font-display font-extrabold text-white line-clamp-2 leading-snug group-hover:text-brand-gold transition-colors duration-205">
              {benefit.titulo}
            </h4>
          </div>
          <div class="flex items-center justify-between pt-3.5 border-t border-slate-800/80 mt-auto">
            <span class="text-[12px] font-black text-brand-gold/75 uppercase tracking-wider">Membresía Gold</span>
            <span class="inline-flex items-center px-4 py-1.5 rounded-xl text-[14.5px] font-black bg-brand-gold text-slate-950 shadow-md uppercase tracking-wide border border-[#d4af37]/30">
              {offerLabel}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  // --- 2. VARIANT: NEW (NUEVOS BENEFICIOS) ---
  if (variant === "new") {
    const dateVal = benefit.created_at || (benefit as any).createdAt;
    const timeAgo = getTimeAgo(dateVal);
    const formattedDate = formatDate(dateVal);

    return (
      <Link
        href={`/beneficio/${benefit.url}`}
        class="group block bg-white border border-slate-100 rounded-[1.8rem] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 relative select-none text-left"
      >
        {/* Card Image */}
        <div class="relative aspect-square bg-white overflow-hidden flex items-center justify-center">
          {benefitImage(desktopImageSrc, mobileImageSrc, benefit.titulo, primaryCat, "light")}

          {/* Floating Badges */}
          <div class="absolute top-3.5 left-3.5 z-10 flex items-center justify-between w-[calc(100%-1.75rem)]">
            <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[9.5px] font-black bg-slate-950/60 text-slate-100 backdrop-blur-sm border border-slate-800/40 uppercase tracking-widest leading-none">
              {primaryCat}
            </span>
            <span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-slate-950/70 text-emerald-400 backdrop-blur-sm border border-emerald-505/25 tracking-widest uppercase leading-none">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{timeAgo}</span>
            </span>
          </div>
        </div>

        {/* Card Body - Optimized padding (pb-8) and custom spacing for maximum breathing room */}
        <div class="pt-5 px-6 pb-8 flex flex-col justify-between h-[220px] bg-white text-left">
          <div class="space-y-1.5">
            <h3 class="text-[12px] font-black text-slate-500 uppercase tracking-widest truncate leading-none">
              {primaryLoc}
            </h3>
            <h4 class="text-[15.5px] font-display font-extrabold text-slate-800 line-clamp-2 leading-snug group-hover:text-brand-green transition-colors duration-200">
              {benefit.titulo}
            </h4>
          </div>
          <div class="flex items-center justify-between pt-3.5 border-t border-slate-100 mt-auto">
            <div class="flex flex-col text-left">
              <span class="text-[8.5px] font-black text-slate-500 uppercase tracking-widest leading-none">Inicio</span>
              <span class="text-[12px] font-bold text-slate-650 tracking-tight mt-0.5 leading-none">{formattedDate}</span>
            </div>
            <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[13px] font-black bg-emerald-50 text-emerald-705 border border-emerald-100/70 shadow-sm uppercase tracking-wide">
              {offerLabel}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  // --- 3. VARIANT: STANDARD (CATALOG SEARCH RESULTS) ---
  return (
    <div class="bg-white border border-slate-100/80 rounded-[2.2rem] overflow-hidden hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group shadow-sm select-none text-left">
      {/* Image & floating elements */}
      <div class="relative aspect-square bg-white overflow-hidden flex items-center justify-center">
        {benefitImage(desktopImageSrc, mobileImageSrc, benefit.titulo, primaryCat, "light")}

        {/* Exclusive Gold locking label */}
        {isLocked && (
          <div class="absolute inset-0 bg-slate-955/40 backdrop-blur-[1px] flex flex-col justify-center items-center z-20 text-white animate-fade-in">
            <span class="text-3xl">🔒</span>
            <span class="text-[12px] font-extrabold tracking-widest uppercase text-brand-gold mt-1.5">
              Exclusivo Agremiados
            </span>
          </div>
        )}

        {/* Floating Offer Badge */}
        <div class="absolute top-3.5 right-3.5 z-10">
          <span class="inline-flex items-center px-4 py-2 rounded-2xl text-[15px] font-black bg-brand-gold text-brand-green-dark border-2 border-brand-gold/60 shadow-lg uppercase tracking-wider">
            {offerLabel}
          </span>
        </div>

        {/* Floating Category Pill */}
        <div class="absolute bottom-3 left-3 z-10">
          <span class="inline-flex items-center px-3.5 py-1 rounded-full text-[12px] font-bold bg-black/55 backdrop-blur-sm border border-white/10 uppercase tracking-wide text-white">
            {primaryCat}
          </span>
        </div>
      </div>

      {/* Benefit Card Body - Optimized pt-6 px-6 pb-8 asymmetrical padding */}
      <div class="flex-grow pt-6 px-6 pb-8 flex flex-col justify-between">
        <div class="space-y-2.5 text-left mb-5">
          {/* Location pin badge */}
          <div class="flex items-center text-brand-green-light space-x-1">
            <svg class="w-4 h-4 text-brand-gold fill-current" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span class="text-[13.5px] font-black uppercase tracking-wider text-slate-500">
              {primaryLoc}
            </span>
          </div>

          <h3 class="text-[20px] font-display font-black text-slate-900 leading-snug line-clamp-2 group-hover:text-brand-green transition-colors duration-300">
            {benefit.titulo}
          </h3>

          {/* Resumen del beneficio (frase completa, antes rompía el badge) */}
          {resumenText && (
            <p class="text-[13.5px] font-black text-brand-green uppercase tracking-tight leading-snug line-clamp-2 min-h-10">
              {resumenText}
            </p>
          )}

          {/* Short descriptions */}
          <p class="text-[14.5px] text-slate-550 leading-relaxed font-medium line-clamp-3">
            {benefit.descripcion
              ? benefit.descripcion.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
              : "No hay descripción disponible para este beneficio."}
          </p>
        </div>

        {/* Action Link Button */}
        <div class="pt-5 border-t border-slate-100 mt-auto">
          {isLocked ? (
            <button
              type="button"
              class="w-full text-center text-xs font-black uppercase tracking-wider py-3.5 rounded-2xl bg-slate-100 text-slate-450 hover:bg-slate-150 active:scale-95 transition-all shadow-inner border border-slate-200 cursor-pointer"
              onClick$={() => {
                alert("Este beneficio es exclusivo para agremiados. Iniciá sesión para acceder.");
              }}
            >
              🔑 Iniciá sesión para acceder
            </button>
          ) : (
            <Link
              href={`/beneficio/${benefit.url}`}
              class="block text-center text-xs font-black uppercase tracking-wider py-3.5 rounded-2xl bg-brand-green text-white hover:bg-brand-green-light active:scale-95 transition-all shadow-md cursor-pointer"
            >
              Ver Descuento &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
});
