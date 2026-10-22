import { component$, useVisibleTask$ } from "@builder.io/qwik";
import { Link, routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { and, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { benefits, coupons } from "~/db/schema";
import { getSessionUser } from "~/server/auth";
import { couponQrDataUrl, isCouponBenefitAvailable } from "~/server/coupons";

export const useCoupon = routeLoader$(async (event) => {
  event.headers.set("Cache-Control", "private, no-store");
  const user = getSessionUser(event);
  if (!user) throw event.redirect(302, "/login/");

  // Ownership is part of the query, including for administrator accounts.
  const [record] = await getDB(event)
    .select({
      coupon: coupons,
      benefit: { slug: benefits.slug, validUntil: benefits.validUntil },
    })
    .from(coupons)
    .leftJoin(benefits, eq(benefits.id, coupons.benefitId))
    .where(and(eq(coupons.id, event.params.id), eq(coupons.userId, user.id)))
    .limit(1);
  if (!record) throw event.error(404, "Cupón no encontrado.");

  const available = isCouponBenefitAvailable(record.benefit);
  const status =
    record.coupon.status === "active" && !available
      ? ("expired" as const)
      : record.coupon.status;
  return {
    coupon: { ...record.coupon, status },
    benefitUrl:
      record.benefit && available ? `/beneficio/${record.benefit.slug}/` : null,
    qrDataUrl:
      status === "active"
        ? await couponQrDataUrl(event.url.origin, record.coupon.code)
        : null,
    print: event.url.searchParams.get("print") === "1",
  };
});

export default component$(() => {
  const data = useCoupon();
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    if (!data.value.print) return;
    const qr = document.getElementById("coupon-qr") as HTMLImageElement | null;
    if (qr) await qr.decode().catch(() => undefined);
    await document.fonts.ready;
    window.print();
  });
  const { coupon, qrDataUrl, benefitUrl } = data.value;
  const active = coupon.status === "active";
  const statusLabel = active
    ? "Activo"
    : coupon.status === "used"
      ? "Usado"
      : "Vencido o no disponible";
  const date = (value: string) =>
    new Date(value).toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
    });

  return (
    <div class="min-h-[70vh] bg-[#040811] px-4 py-8 sm:py-12 text-white print:bg-white print:text-slate-950">
      <div class="max-w-lg mx-auto">
        <Link
          href="/perfil/#mis-cupones"
          class="inline-block mb-6 text-sm font-bold text-slate-300 hover:text-accent print:hidden"
        >
          ← Mis cupones
        </Link>
        <article class="rounded-3xl border border-secondary bg-primary p-6 sm:p-8 text-center space-y-6 shadow-lg print:bg-white print:border-slate-300 print:shadow-none">
          <div class="flex items-center justify-center gap-3">
            <img
              src="/lprc.avif"
              alt="La Plata Rugby Club"
              width={54}
              height={60}
              class="h-16 w-14 object-contain"
            />
            <span class="text-left font-display text-lg font-bold leading-tight">
              Club de Beneficios
              <br />
              <span class="text-sm font-sans text-slate-400 print:text-slate-600">
                La Plata Rugby Club
              </span>
            </span>
          </div>
          <div class="space-y-3">
            <span
              class={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${active ? "text-accent border-accent/30 print:text-slate-950" : "text-slate-400 border-slate-600 print:text-slate-600"}`}
            >
              {statusLabel}
            </span>
            <h1 class="font-display text-3xl font-extrabold">
              {coupon.benefitTitle}
            </h1>
            <p class="text-accent font-bold print:text-slate-950">
              {coupon.benefitResumen}
            </p>
          </div>
          {qrDataUrl && (
            <img
              id="coupon-qr"
              src={qrDataUrl}
              alt="QR del cupón para validar en el comercio"
              width={240}
              height={240}
              class="w-60 h-60 max-w-full mx-auto rounded-2xl bg-white"
            />
          )}
          <div>
            <p class="text-xs uppercase tracking-wider text-slate-400 print:text-slate-600">
              Código de canje
            </p>
            <p class="font-mono text-4xl tracking-[0.16em] font-black mt-2">
              {coupon.code}
            </p>
          </div>
          <dl class="border-y border-secondary py-4 space-y-2 text-left text-sm print:border-slate-200">
            <div class="flex flex-wrap justify-between gap-2">
              <dt class="text-slate-400 print:text-slate-600">Socio</dt>
              <dd class="font-semibold">{coupon.userName}</dd>
            </div>
            <div class="flex flex-wrap justify-between gap-2">
              <dt class="text-slate-400 print:text-slate-600">
                DNI / Nro. socio
              </dt>
              <dd class="font-mono">{coupon.numeroSocio || "Sin informar"}</dd>
            </div>
            <div class="flex justify-between gap-2">
              <dt class="text-slate-400 print:text-slate-600">Generado</dt>
              <dd>{date(coupon.createdAt)}</dd>
            </div>
            {coupon.usedAt && (
              <div class="flex justify-between gap-2">
                <dt class="text-slate-400 print:text-slate-600">Utilizado</dt>
                <dd>{date(coupon.usedAt)}</dd>
              </div>
            )}
          </dl>
          <p class="text-sm text-slate-300 leading-relaxed print:text-slate-700">
            {active
              ? "Antes de pagar, mostrá este QR o el código junto a tu credencial. El comercio verifica tu DNI y registra el canje; el cupón se puede usar una sola vez."
              : "Este cupón ya no se puede canjear. Consultá tus cupones activos o los beneficios disponibles."}
          </p>
          <div class="flex flex-col gap-3 print:hidden">
            {active && (
              <button
                type="button"
                onClick$={() => window.print()}
                class="min-h-12 rounded-xl bg-accent text-primary font-bold px-5 py-3 hover:bg-accent-hover cursor-pointer"
              >
                Imprimir o guardar como PDF
              </button>
            )}
            {benefitUrl && (
              <Link
                href={benefitUrl}
                class="text-sm font-bold text-slate-300 hover:text-accent underline underline-offset-4"
              >
                Ver beneficio y condiciones
              </Link>
            )}
          </div>
        </article>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Mi cupón — Beneficios LPRC",
  meta: [{ name: "robots", content: "noindex, nofollow, noarchive" }],
};
