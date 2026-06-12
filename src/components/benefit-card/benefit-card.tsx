import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { Benefit } from "~/server/cache";

interface BenefitCardProps {
  benefit: Benefit;
  variant?: "new" | "standard";
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
};export const BenefitCard = component$<BenefitCardProps>(({ benefit, variant = "standard" }) => {
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
  const discountText = benefit.resumen || "Exclusivo";
  const formattedDiscount = discountText.replace("Descuento del", "").trim();

  // --- 1. VARIANT: NEW (NUEVOS BENEFICIOS) ---
  if (variant === "new") {
    const dateVal = benefit.created_at || (benefit as any).createdAt;
    const timeAgo = getTimeAgo(dateVal);
    const formattedDate = formatDate(dateVal);

    return (
      <Link
        href={`/beneficio/${benefit.url}`}
        class="group block bg-white border border-slate-100 rounded-[1.8rem] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 relative h-[396px] select-none text-left"
      >
        {/* Card Image */}
        <div class="relative h-[180px] bg-slate-100 overflow-hidden flex items-center justify-center">
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
            <div class="flex flex-col items-center justify-center p-6 text-center h-full w-full bg-gradient-to-br from-slate-50 to-slate-100">
              <span class="text-brand-green-dark font-display font-black text-2xl">AMP+</span>
              <span class="text-slate-400 text-[11px] font-bold uppercase tracking-wider mt-1">
                {primaryCat}
              </span>
            </div>
          )}

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
            <h3 class="text-[12px] font-black text-slate-400 uppercase tracking-widest truncate leading-none">
              {primaryLoc}
            </h3>
            <h4 class="text-[15.5px] font-display font-extrabold text-slate-800 line-clamp-2 leading-snug group-hover:text-brand-green transition-colors duration-200">
              {benefit.titulo}
            </h4>
          </div>
          <div class="flex items-center justify-between pt-3.5 border-t border-slate-100 mt-auto">
            <div class="flex items-center space-x-2 text-left">
              <div class="w-7.5 h-7.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="flex flex-col">
                <span class="text-[8.5px] font-black text-slate-400 uppercase tracking-widest leading-none">Inicio</span>
                <span class="text-[12px] font-bold text-slate-650 tracking-tight mt-0.5 leading-none">{formattedDate}</span>
              </div>
            </div>
            <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[13px] font-black bg-emerald-50 text-emerald-705 border border-emerald-100/70 shadow-sm uppercase tracking-wide">
              {formattedDiscount}
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
      <div class="relative h-[180px] bg-slate-50 overflow-hidden flex items-center justify-center">
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
            <span class="text-brand-green font-display font-black text-2xl">AMP+</span>
            <span class="text-slate-400 text-[11px] font-bold uppercase tracking-wider mt-1">{primaryCat}</span>
          </div>
        )}

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
            {formattedDiscount}
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
