import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link, routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { and, eq } from "drizzle-orm";
import { LuCalendarCheck, LuClock, LuMapPin, LuNavigation, LuPhone, LuPrinter } from "@qwikest/icons/lucide";
import { getDB } from "~/db";
import { benefits, coupons } from "~/db/schema";
import { getSessionUser } from "~/server/auth";
import { couponQrDataUrl, isCouponBenefitAvailable, maskDni } from "~/server/coupons";
import { CopyCodeButton, CouponLiveStatus, type CouponStatus } from "~/components/ui/coupon-tools";
import { formatValidUntil } from "~/utils/benefit-admin";
import { directionsUrl, merchantDetails, phoneUrl } from "~/utils/map-benefits";
import { loginUrl } from "~/utils/return-path";

export const useCoupon = routeLoader$(async (event) => {
  event.headers.set("Cache-Control", "private, no-store");
  const user = getSessionUser(event);
  if (!user) throw event.redirect(302, loginUrl(event.url.pathname + event.url.search));

  // Ownership is part of the query, including for administrator accounts.
  const [record] = await getDB(event)
    .select({
      coupon: coupons,
      benefit: {
        slug: benefits.slug,
        validUntil: benefits.validUntil,
        terms: benefits.terms,
        descripcion: benefits.descripcion,
        latitud: benefits.latitud,
        longitud: benefits.longitud,
        address: benefits.address,
        hours: benefits.hours,
        phone: benefits.phone,
      },
    })
    .from(coupons)
    .leftJoin(benefits, eq(benefits.id, coupons.benefitId))
    .where(and(eq(coupons.id, event.params.id), eq(coupons.userId, user.id)))
    .limit(1);
  if (!record) throw event.error(404, "Cupón no encontrado.");

  const { coupon, benefit } = record;
  const available = isCouponBenefitAvailable(benefit);
  const status =
    coupon.status === "active" && !available ? ("expired" as const) : coupon.status;
  const merchant = benefit ? merchantDetails(benefit) : null;
  return {
    // Only what the voucher shows: the full DNI never reaches the page.
    coupon: {
      id: coupon.id,
      code: coupon.code,
      benefitTitle: coupon.benefitTitle,
      benefitResumen: coupon.benefitResumen,
      userName: coupon.userName,
      maskedDni: maskDni(coupon.numeroSocio),
      status,
      createdAt: coupon.createdAt,
      usedAt: coupon.usedAt,
    },
    // Coupons have no expiry of their own: they last as long as the benefit does.
    validUntilLabel: formatValidUntil(benefit?.validUntil),
    benefitUrl: benefit && available ? `/beneficio/${benefit.slug}/` : null,
    hasTerms: Boolean(benefit?.terms?.trim()),
    merchant: merchant && {
      address: merchant.address,
      hours: merchant.hours,
      phone: merchant.phone,
      phoneHref: merchant.phone ? phoneUrl(merchant.phone) : null,
      directions: directionsUrl({ latitud: benefit?.latitud, longitud: benefit?.longitud, address: merchant.address }),
    },
    qrDataUrl:
      status === "active"
        ? await couponQrDataUrl(event.url.origin, coupon.code)
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
  const { coupon, qrDataUrl, benefitUrl, validUntilLabel, merchant, hasTerms } = data.value;
  // Starts from the loader and is refreshed in place while the coupon is on screen.
  const status = useSignal<CouponStatus>(coupon.status);
  const active = status.value === "active";
  const date = (value: string) =>
    new Date(value).toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const statusBadge = active
    ? { label: "Activo", class: "badge badge-dark" }
    : status.value === "used"
      ? { label: "Canjeado", class: "badge badge-muted" }
      : { label: "Vencido", class: "badge bg-red-100 text-red-800" };
  const validity = status.value === "used"
    ? coupon.usedAt
      ? `Canjeado el ${date(coupon.usedAt)}.`
      : "Canjeado."
    : !active
      ? validUntilLabel
        ? `Venció el ${validUntilLabel}, junto con el beneficio.`
        : "El beneficio ya no está disponible."
      : validUntilLabel
        ? `Válido hasta el ${validUntilLabel}.`
        : "Válido mientras el beneficio esté vigente.";
  const hasMerchantInfo = Boolean(merchant && (merchant.address || merchant.hours || merchant.phoneHref));

  return (
    <div class="min-h-[70vh] bg-primary px-4 py-4 sm:py-10 print:bg-white print:p-0">
      <div class="mx-auto max-w-md">
        <Link
          href="/perfil/#mis-cupones"
          class="mb-2 inline-flex min-h-11 items-center text-sm font-bold text-slate-300 hover:text-accent sm:mb-4 print:hidden"
        >
          ← Mis cupones
        </Link>
        <article aria-labelledby="coupon-title" class="bg-white text-primary shadow-xl print:border print:border-slate-400 print:shadow-none">
          {/* A <div>, not <header>: the global print styles hide every header element. */}
          <div class="flex items-center gap-4 border-b-8 border-accent bg-primary px-5 py-3 text-white sm:py-4 print:bg-white print:text-primary">
            <img
              src="/lprc.avif"
              alt="Escudo de La Plata Rugby Club"
              width={64}
              height={72}
              class="h-14 w-12 shrink-0 object-contain sm:h-18 sm:w-16"
            />
            <div>
              <p class="eyebrow text-accent print:text-amber-900">
                Cupón oficial<span class="hidden sm:inline"> · Club de Beneficios</span>
              </p>
              <p class="heading-display mt-1 text-xl sm:text-2xl">La Plata Rugby Club</p>
            </div>
          </div>

          <div class="space-y-4 px-5 py-5 sm:space-y-5 sm:px-7 sm:py-6">
            <div class="flex items-start justify-between gap-3">
              <h1 id="coupon-title" class="heading-display text-2xl sm:text-3xl">{coupon.benefitTitle}</h1>
              <span class={`${statusBadge.class} mt-1 shrink-0`}>{statusBadge.label}</span>
            </div>

            <div class="bg-accent px-4 py-2.5 sm:py-3 print:border-2 print:border-primary">
              <p class="eyebrow">Descuento para socios</p>
              <p class="heading-display mt-1 text-3xl sm:text-5xl">{coupon.benefitResumen}</p>
            </div>

            <CouponLiveStatus couponId={coupon.id} status={status} />

            {active && qrDataUrl && (
              <figure class="text-center">
                <img
                  id="coupon-qr"
                  src={qrDataUrl}
                  alt={`QR del cupón ${coupon.code} para validar en el comercio`}
                  width={240}
                  height={240}
                  class="mx-auto h-56 w-56 max-w-full border border-line bg-white p-2 sm:h-60 sm:w-60"
                />
                <figcaption class="mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-600">
                  El comercio lo escanea para validarlo
                </figcaption>
              </figure>
            )}

            <div class="text-center">
              <p class="text-[11px] font-bold uppercase tracking-widest text-slate-600">Código de canje</p>
              <p class={`mt-1 font-mono text-4xl font-black tracking-[0.18em] ${active ? "text-primary" : "text-slate-400 line-through"}`}>
                {coupon.code}
              </p>
              {active && (
                <div class="mt-2 print:hidden">
                  <CopyCodeButton code={coupon.code} class="btn btn-outline btn-sm" />
                </div>
              )}
            </div>

            <p class={`flex items-start gap-2 border-y border-line py-3 text-sm font-semibold ${active ? "text-primary" : "text-slate-700"}`}>
              <LuCalendarCheck class="mt-0.5 h-5 w-5 shrink-0 text-amber-900" aria-hidden="true" />
              {validity}
            </p>

            <dl class="space-y-2 text-sm">
              <div class="flex flex-wrap justify-between gap-2">
                <dt class="text-slate-600">Socio</dt>
                <dd class="font-semibold">{coupon.userName}</dd>
              </div>
              <div class="flex flex-wrap justify-between gap-2">
                <dt class="text-slate-600">DNI</dt>
                <dd class="font-mono">{coupon.maskedDni || "Sin informar"}</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-slate-600">Generado</dt>
                <dd>{date(coupon.createdAt)}</dd>
              </div>
              {coupon.usedAt && (
                <div class="flex justify-between gap-2">
                  <dt class="text-slate-600">Utilizado</dt>
                  <dd>{date(coupon.usedAt)}</dd>
                </div>
              )}
            </dl>

            <p class="text-sm leading-relaxed text-slate-700">
              {active
                ? (
                    <>
                      Antes de pagar, mostrá este QR o el código. El comercio verifica tu DNI y registra el canje; el cupón se usa una sola vez.
                      <span class="print:hidden"> La pantalla se mantiene encendida mientras lo mostrás.</span>
                    </>
                  )
                : status.value === "used"
                  ? "El comercio registró el canje de este cupón. ¡Que lo disfrutes!"
                  : "Este cupón ya no se puede canjear. Consultá tus cupones activos o los beneficios vigentes."}
            </p>

            {active && (
              <div class="grid gap-3 sm:grid-cols-2 print:hidden">
                {merchant?.directions && (
                  <a href={merchant.directions} target="_blank" rel="noopener" class="btn btn-dark">
                    <LuNavigation class="h-4 w-4" aria-hidden="true" />
                    Cómo llegar
                    <span class="sr-only"> (Google Maps, abre en una pestaña nueva)</span>
                  </a>
                )}
                <button type="button" onClick$={() => window.print()} class="btn btn-outline">
                  <LuPrinter class="h-4 w-4" aria-hidden="true" />
                  Imprimir o PDF
                </button>
              </div>
            )}
          </div>

          {(hasMerchantInfo || benefitUrl) && (
            <div class="space-y-3 border-t-2 border-dashed border-line bg-surface-muted px-5 py-5 text-sm sm:px-7">
              <h2 class="eyebrow text-amber-900">El comercio</h2>
              {merchant?.address && (
                <p class="flex items-start gap-2">
                  <LuMapPin class="mt-0.5 h-4 w-4 shrink-0 text-amber-900" aria-hidden="true" />
                  {merchant.address}
                </p>
              )}
              {merchant?.hours && (
                <p class="flex items-start gap-2 whitespace-pre-line">
                  <LuClock class="mt-0.5 h-4 w-4 shrink-0 text-amber-900" aria-hidden="true" />
                  {merchant.hours}
                </p>
              )}
              {merchant?.phoneHref && (
                <p class="flex items-start gap-2">
                  <LuPhone class="mt-0.5 h-4 w-4 shrink-0 text-amber-900" aria-hidden="true" />
                  <a href={merchant.phoneHref} class="font-semibold underline underline-offset-4">{merchant.phone}</a>
                </p>
              )}
              {benefitUrl && (
                <Link
                  href={hasTerms ? `${benefitUrl}#condiciones` : benefitUrl}
                  class="inline-flex min-h-11 items-center font-bold underline underline-offset-4 hover:text-amber-900 print:hidden"
                >
                  Ver beneficio y condiciones
                </Link>
              )}
            </div>
          )}
        </article>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Mi cupón — Beneficios LPRC",
  meta: [{ name: "robots", content: "noindex, nofollow, noarchive" }],
};
