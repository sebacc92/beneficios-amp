import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { formatValidUntil } from "~/utils/benefit-admin";

export interface Coupon {
  id: string;
  code: string;
  benefitId: string;
  benefitTitle: string;
  benefitResumen: string;
  status: "active" | "used" | "expired";
  createdAt: string;
  usedAt?: string | null;
  /** The benefit's `valid_until`: coupons expire with their benefit, not on their own. */
  validUntil?: string | null;
}

interface CouponCardProps {
  coupon: Coupon;
  /** "dark" (default) sits on navy blocks; "light" on the white page background. */
  tone?: "dark" | "light";
}

export const CouponCard = component$<CouponCardProps>(({ coupon, tone = "dark" }) => {
  const isUsed = coupon.status === "used";
  const isExpired = coupon.status === "expired";
  const isActive = coupon.status === "active";
  const dark = tone === "dark";

  const couponUrl = `/perfil/cupon/${encodeURIComponent(coupon.id)}/`;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
      });
    } catch {
      return "Reciente";
    }
  };
  // Only shown when the history query provides the benefit's date.
  const validUntilLabel = "validUntil" in coupon ? formatValidUntil(coupon.validUntil) : undefined;
  const muted = dark ? "text-slate-400" : "text-slate-600";

  return (
    <div
      class={`flex flex-col items-start justify-between gap-4 border p-5 sm:flex-row sm:items-center ${dark ? "border-secondary bg-secondary/40 text-white" : "border-line bg-surface text-primary"}`}
    >
      <div class="flex-grow space-y-1 text-left">
        <div class="flex items-center gap-2">
          {isActive && <span class="badge badge-accent">Activo</span>}
          {isUsed && <span class={`badge ${dark ? "bg-slate-800 text-slate-300" : "badge-muted"}`}>Canjeado</span>}
          {isExpired && <span class={`badge ${dark ? "bg-red-950 text-red-300" : "bg-red-100 text-red-800"}`}>Vencido</span>}
        </div>

        <h3 class="heading-display mt-1 text-lg leading-tight">{coupon.benefitTitle}</h3>
        <p class={`text-xs font-semibold ${muted}`}>
          Descuento:{" "}
          <span class={`font-bold ${dark ? "text-accent" : "text-amber-900"}`}>{coupon.benefitResumen}</span>
        </p>
        <p class={`text-[11px] font-semibold ${muted}`}>Generado el {formatDate(coupon.createdAt)}</p>
        {isActive && validUntilLabel !== undefined && (
          <p class={`text-[11px] font-semibold ${dark ? "text-slate-300" : "text-slate-700"}`}>
            {validUntilLabel ? `Válido hasta el ${validUntilLabel}` : "Válido mientras el beneficio esté vigente"}
          </p>
        )}
        {isUsed && coupon.usedAt && (
          <p class={`text-[11px] ${muted}`}>Utilizado el {formatDate(coupon.usedAt)}</p>
        )}
      </div>

      <div class="flex shrink-0 flex-col items-start sm:items-center">
        <span class={`mb-1 text-[11px] font-bold uppercase leading-none tracking-widest ${muted}`}>
          Código de canje
        </span>
        <span
          class={`border px-3 py-1.5 font-mono text-lg font-black tracking-wider ${dark ? "border-secondary bg-primary text-accent" : "border-line bg-surface-muted text-primary"} ${isActive ? "" : "line-through opacity-70"}`}
        >
          {coupon.code}
        </span>
      </div>

      <div class="flex w-full justify-end gap-2 sm:w-auto">
        {isActive ? (
          <>
            <a
              href={`${couponUrl}?print=1`}
              target="_blank"
              rel="noopener noreferrer"
              class={`btn btn-sm w-full sm:w-auto ${dark ? "btn-outline-light" : "btn-outline"}`}
            >
              Imprimir
            </a>
            <Link href={couponUrl} class="btn btn-primary btn-sm w-full sm:w-auto">
              Ver QR
            </Link>
          </>
        ) : (
          <Link
            href={couponUrl}
            class={`inline-flex min-h-11 items-center text-xs font-bold underline underline-offset-4 ${dark ? "text-slate-300 hover:text-accent" : "text-primary hover:text-amber-900"}`}
          >
            Ver detalle
          </Link>
        )}
      </div>
    </div>
  );
});
