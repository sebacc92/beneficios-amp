import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export interface Coupon {
  id: string;
  code: string;
  benefitId: string;
  benefitTitle: string;
  benefitResumen: string;
  status: "active" | "used" | "expired";
  createdAt: string;
  usedAt?: string | null;
}

interface CouponCardProps {
  coupon: Coupon;
}

export const CouponCard = component$<CouponCardProps>(({ coupon }) => {
  const isUsed = coupon.status === "used";
  const isExpired = coupon.status === "expired";
  const isActive = coupon.status === "active";

  const couponUrl = `/perfil/cupon/${encodeURIComponent(coupon.id)}/`;

  // Format date safely
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
      });
    } catch {
      return "Reciente";
    }
  };

  return (
    <div class="bg-secondary/40 border border-secondary hover:border-slate-700 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-200">
      {/* Left section: Info */}
      <div class="space-y-1 text-left flex-grow">
        <div class="flex items-center gap-2">
          <span class="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-primary px-2 py-0.5 rounded border border-slate-800">
            Cupón
          </span>
          {isActive && (
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[8.5px] font-bold bg-accent/10 text-accent border border-accent/20">
              ● Activo
            </span>
          )}
          {isUsed && (
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[8.5px] font-bold bg-slate-800 text-slate-500">
              ✓ Usado
            </span>
          )}
          {isExpired && (
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[8.5px] font-bold bg-red-950/20 text-red-400 border border-red-900/30">
              ✕ Vencido
            </span>
          )}
        </div>

        <h4 class="font-display font-bold text-base text-white leading-tight mt-1">
          {coupon.benefitTitle}
        </h4>
        <p class="text-xs text-slate-400 font-semibold">
          Descuento:{" "}
          <span class="text-accent font-bold">{coupon.benefitResumen}</span>
        </p>
        <p class="text-[10px] text-slate-500 font-semibold">
          Generado el {formatDate(coupon.createdAt)}
        </p>
        {isUsed && coupon.usedAt && (
          <p class="text-[10px] text-slate-400">
            Utilizado el {formatDate(coupon.usedAt)}
          </p>
        )}
      </div>

      {/* Middle section: Bold Code */}
      <div class="flex flex-col items-start sm:items-center shrink-0">
        <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
          Código de Canje
        </span>
        <span class="font-mono font-black text-lg text-accent bg-primary px-3 py-1.5 rounded-xl border border-secondary tracking-wider shadow-inner">
          {coupon.code}
        </span>
      </div>

      {/* Right section: Action Buttons */}
      <div class="flex gap-2 w-full sm:w-auto justify-end">
        {isActive && (
          <>
            <a
              href={`${couponUrl}?print=1`}
              target="_blank"
              rel="noopener noreferrer"
              class="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer border border-slate-700"
            >
              Imprimir
            </a>
            <Link
              href={couponUrl}
              class="w-full sm:w-auto px-4 py-2 text-xs font-bold text-primary bg-accent hover:bg-accent-hover rounded-xl text-center transition-colors cursor-pointer"
            >
              Ver QR
            </Link>
          </>
        )}
        {!isActive && (
          <Link
            href={couponUrl}
            class="text-xs text-slate-300 hover:text-accent underline underline-offset-4 font-bold py-2"
          >
            Ver detalle
          </Link>
        )}
      </div>
    </div>
  );
});
