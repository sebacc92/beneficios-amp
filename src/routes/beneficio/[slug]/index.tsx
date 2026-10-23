import { component$, useVisibleTask$, useSignal, useStyles$, $ } from "@builder.io/qwik";
import {
  routeLoader$,
  Link,
  type DocumentHead,
  server$,
} from "@builder.io/qwik-city";
import {
  LuArrowRight,
  LuCalendarCheck,
  LuClock,
  LuDownload,
  LuFileText,
  LuGlobe,
  LuInfo,
  LuInstagram,
  LuMail,
  LuMapPin,
  LuMessageCircle,
  LuNavigation,
  LuPhone,
  LuShare2,
} from "@qwikest/icons/lucide";
import { getBenefitBySlug, searchBenefits, type Benefit } from "~/server/cache";
import { useLayoutUser } from "../../layout";
import { and, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { benefits, coupons } from "~/db/schema";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { createSession } from "~/server/auth";
import { findUsersByDni } from "~/server/member-dni";
import { rateLimitByIp } from "~/server/rate-limit";
import { AthleteProfileCard } from "~/components/ui/AthleteProfileCard";
import { HaceteSocio } from "~/components/hacete-socio/hacete-socio";
import { SectionHeading } from "~/components/section-heading/section-heading";
import {
  CouponGenerationError,
  couponQrDataUrl,
  generateMemberCoupon,
  isCouponBenefitAvailable,
} from "~/server/coupons";
import { isValidDni, normalizeDni } from "~/utils/dni";
import { formatValidUntil } from "~/utils/benefit-admin";
import { loginUrl } from "~/utils/return-path";
import { dniHelpMessage, whatsappLink } from "~/utils/club";
import {
  MAP_PIN_STYLES,
  benefitImageUrl,
  directionsUrl,
  instagramHandle,
  mapPinIcon,
  merchantDetails,
  merchantWhatsappUrl,
  parseCoordinates,
  phoneUrl,
  websiteLabel,
} from "~/utils/map-benefits";
import { documentDownloadHref } from "~/routes/descargar/own-document";
import { CopyCodeButton, CouponLiveStatus, type CouponStatus } from "~/components/ui/coupon-tools";

// Server Loader to retrieve single benefit and similar recommendations
export const useBenefitData = routeLoader$(async (event) => {
  const benefit = await getBenefitBySlug(event.params.slug, event);
  const user = event.sharedMap.get("user") as AuthenticatedUser | null;
  if (user) event.headers.set("Cache-Control", "private, no-store");
  const isAdmin = user?.role === "admin";

  if (!benefit || (benefit.isActive === false && !isAdmin)) {
    event.status(404);
    return null;
  }

  // Up to four recommendations: the same category first, then the rest of the live catalog.
  const catalog = (await searchBenefits({ limit: 1000, requestEvent: event })).data.filter(
    (item) => item.url !== benefit.url && isCouponBenefitAvailable({ validUntil: item.validUntil ?? null }),
  );
  const categoryIds = new Set(benefit.categorias.map((c) => c.id));
  const sameCategory = catalog.filter((item) => item.categorias.some((c) => categoryIds.has(c.id)));
  const similar = [...sameCategory, ...catalog.filter((item) => !sameCategory.includes(item))].slice(0, 4);

  const merchant = merchantDetails(benefit);
  const directions = directionsUrl({
    latitud: benefit.latitud,
    longitud: benefit.longitud,
    address: merchant.address,
    locality: benefit.ubicacion[0]?.descripcion,
  });

  // Vigencia and conditions are only kept on the DB row, not in the cached catalog entry.
  let validUntilLabel: string | null = null;
  let isAvailable = true;
  let terms: string | null = null;
  let merchantCode: string | null = null;
  try {
    const [row] = await getDB(event)
      .select({ validUntil: benefits.validUntil, terms: benefits.terms, couponCode: benefits.couponCode })
      .from(benefits)
      .where(eq(benefits.slug, benefit.url))
      .limit(1);
    validUntilLabel = formatValidUntil(row?.validUntil);
    isAvailable = !row || isCouponBenefitAvailable({ validUntil: row.validUntil });
    terms = row?.terms?.trim() || null;
    merchantCode = row?.couponCode?.trim() || null;
  } catch (err) {
    console.error("Error fetching benefit conditions:", err);
  }

  // Check if current user has an active coupon for this benefit
  let activeCoupon = null;
  if (user) {
    try {
      const db = getDB(event);
      const [couponRecord] = await db
        .select({
          id: coupons.id,
          code: coupons.code,
          status: coupons.status,
          createdAt: coupons.createdAt,
          validUntil: benefits.validUntil,
        })
        .from(coupons)
        .innerJoin(benefits, eq(benefits.id, coupons.benefitId))
        .where(
          and(
            eq(coupons.userId, user.id),
            eq(benefits.slug, benefit.url),
            eq(coupons.status, "active"),
          ),
        )
        .limit(1);
      if (couponRecord && isCouponBenefitAvailable(couponRecord)) {
        activeCoupon = {
          id: couponRecord.id,
          code: couponRecord.code,
          status: couponRecord.status,
          createdAt: couponRecord.createdAt,
          qrDataUrl: await couponQrDataUrl(event.url.origin, couponRecord.code),
        };
      }
    } catch (err) {
      console.error("Error fetching active coupon:", err);
    }
  }

  return {
    benefit,
    similar,
    merchant,
    directions,
    activeCoupon,
    validUntilLabel,
    isAvailable,
    terms,
    merchantCode,
    pdfDownloadHref: documentDownloadHref(benefit.pdfUrl, benefit.titulo || "documento", event.url.origin),
  };
});

export const generateCouponAction = server$(async function (
  benefitSlug: string,
) {
  const user = this.sharedMap.get("user") as AuthenticatedUser | null;
  if (!user)
    return {
      success: false as const,
      sessionExpired: true,
      error: "Tu sesión venció. Volvé a ingresar para obtener el cupón.",
    };
  try {
    const coupon = await generateMemberCoupon(this, user, { benefitSlug });
    return {
      success: true as const,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        status: coupon.status,
        createdAt: coupon.createdAt,
        qrDataUrl: coupon.qrDataUrl,
      },
    };
  } catch (error) {
    if (error instanceof CouponGenerationError)
      return { success: false as const, error: error.message };
    console.error("Error generating coupon:", error);
    return {
      success: false as const,
      error: "No se pudo generar el cupón. Intentá de nuevo.",
    };
  }
});

export const loginAndGenerateCouponAction = server$(async function (
  dni: string,
  benefitSlug: string,
) {
  const limit = rateLimitByIp(this, "member-login", 10, 10 * 60 * 1000);
  if (!limit.allowed)
    return {
      success: false,
      error: `Demasiados intentos. Probá de nuevo en ${Math.ceil(limit.retryAfter / 60)} minuto(s).`,
    };
  const cleanDni = normalizeDni(dni);
  if (!isValidDni(cleanDni))
    return {
      success: false,
      error: "Ingresá un DNI de 5 a 9 números, con o sin puntos.",
    };

  const matches = await findUsersByDni(this, cleanDni);
  if (matches.length > 1)
    return {
      success: false,
      error: "Hay más de una cuenta asociada a este DNI. Contactá a la administración del club.",
    };
  const [user] = matches;
  if (!user)
    return {
      success: false,
      error:
        "El DNI ingresado no se encuentra registrado. Contactá a la administración del club.",
    };
  if (user.role === "admin")
    return {
      success: false,
      error:
        "Las cuentas de administración ingresan desde el ingreso de administración (/admin/login/) con su contraseña.",
    };

  try {
    await generateMemberCoupon(this, user, { benefitSlug });
    await createSession(this, user.id);
    return { success: true };
  } catch (error) {
    if (error instanceof CouponGenerationError)
      return { success: false, error: error.message };
    console.error("Express coupon generation failed:", error);
    return {
      success: false,
      error: "No se pudo generar el cupón. Intentá de nuevo.",
    };
  }
});

const EXPRESS_LOGIN_FLAG = "lprc-express-login";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

export default component$(() => {
  useStyles$(MAP_PIN_STYLES);
  const data = useBenefitData();
  const isMapLoaded = useSignal(false);
  const mapContainerRef = useSignal<HTMLElement>();
  const showToast = useSignal(false);
  const isSharing = useSignal(false);
  const manualShareLink = useSignal("");
  const user = useLayoutUser();

  const generatedCoupon = useSignal<{
    id: string;
    code: string;
    status: string;
    createdAt: string;
    qrDataUrl: string;
  } | null>(data.value?.activeCoupon || null);
  const isGenerating = useSignal(false);
  const couponError = useSignal("");
  const couponSessionExpired = useSignal(false);
  const expressDni = useSignal("");
  const expressError = useSignal("");
  const isExpressSubmitting = useSignal(false);
  const couponStatus = useSignal<CouponStatus>("active");
  const couponAnnouncement = useSignal("");
  const couponHeadingRef = useSignal<HTMLElement>();
  const couponPanelRef = useSignal<HTMLElement>();
  const couponPanelInView = useSignal(false);
  const asideRef = useSignal<HTMLElement>();
  const benefitPath = `/beneficio/${data.value?.benefit.url ?? ""}/`;

  // After the express DNI flow reloads the page, say who is signed in and point at the coupon.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    let flagged = false;
    try {
      flagged = sessionStorage.getItem(EXPRESS_LOGIN_FLAG) === "1";
      sessionStorage.removeItem(EXPRESS_LOGIN_FLAG);
    } catch {
      // Storage blocked: skip the welcome message.
    }
    if (!flagged || !user.value) return;
    couponAnnouncement.value = `Ingresaste como ${user.value.name}. Tu cupón está listo.`;
    couponHeadingRef.value?.focus();
  });

  // The fixed mobile button only makes sense while the coupon panel is off screen.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const panel = couponPanelRef.value;
    if (!panel || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        couponPanelInView.value = entry.isIntersecting;
      },
      { threshold: 0.2 },
    );
    observer.observe(panel);
    cleanup(() => observer.disconnect());
  });

  // A sidebar taller than the window sticks by its bottom edge, so its end is never out of reach
  // (and stays clear of the floating chat and "volver arriba" buttons).
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const aside = asideRef.value;
    if (!aside || !("ResizeObserver" in window)) return;
    const update = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const top = Math.min(11 * rem, window.innerHeight - aside.offsetHeight - 6 * rem);
      aside.style.setProperty("--aside-top", `${Math.round(top)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(aside);
    window.addEventListener("resize", update);
    cleanup(() => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    });
  });

  // Leaflet is only downloaded when the merchant map gets close to the viewport.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const current = data.value;
    const container = mapContainerRef.value;
    const coordinates = current && parseCoordinates(current.benefit.latitud, current.benefit.longitud);
    if (!current || !container || !coordinates) return;
    const { benefit, merchant, directions } = current;
    let map: any = null;
    let disposed = false;

    const drawMap = () => {
      const L = (window as any).L;
      if (!L || disposed || map) return;
      const point = [coordinates.latitude, coordinates.longitude];
      map = L.map(container, {
        scrollWheelZoom: false,
        dragging: !L.Browser.mobile,
        tap: !L.Browser.mobile,
      }).setView(point, 16);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Text nodes keep merchant data from becoming popup HTML.
      const popup = document.createElement("div");
      const title = document.createElement("strong");
      title.className = "block font-display text-base uppercase tracking-wide text-primary";
      title.textContent = benefit.titulo;
      popup.appendChild(title);
      if (merchant.address) {
        const address = document.createElement("p");
        address.className = "!my-1 text-sm text-slate-700";
        address.textContent = merchant.address;
        popup.appendChild(address);
      } else if (directions) {
        const link = document.createElement("a");
        link.className = "mt-1 inline-block text-sm font-bold !text-primary underline underline-offset-2";
        link.href = directions;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Ver cómo llegar";
        popup.appendChild(link);
      }
      L.marker(point, { icon: L.divIcon(mapPinIcon("benefit")), title: benefit.titulo })
        .addTo(map)
        .bindPopup(popup)
        .openPopup();
      isMapLoaded.value = true;
    };

    const loadLeaflet = () => {
      if ((window as any).L) return drawMap();
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = LEAFLET_CSS;
        document.head.appendChild(link);
      }
      let script = document.getElementById("leaflet-js") as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "leaflet-js";
        script.src = LEAFLET_JS;
        document.head.appendChild(script);
      }
      script.addEventListener("load", drawMap, { once: true });
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        loadLeaflet();
      },
      { rootMargin: "300px" },
    );
    observer.observe(container);
    cleanup(() => {
      disposed = true;
      observer.disconnect();
      map?.remove();
    });
  });

  const handleGenerateCoupon = $(async () => {
    if (isGenerating.value || !data.value) return;
    isGenerating.value = true;
    couponError.value = "";
    try {
      const result = await generateCouponAction(data.value.benefit.url);
      if (result.success) {
        generatedCoupon.value = result.coupon;
        couponStatus.value = "active";
        couponAnnouncement.value = "Tu cupón está listo. Mostrá el QR o el código en el comercio.";
        requestAnimationFrame(() => couponHeadingRef.value?.focus());
      } else {
        couponError.value = result.error;
        couponSessionExpired.value = "sessionExpired" in result && Boolean(result.sessionExpired);
      }
    } catch {
      couponError.value =
        "No pudimos conectar. Revisá tu conexión e intentá de nuevo.";
    } finally {
      isGenerating.value = false;
    }
  });

  const handleExpressSubmit = $(async () => {
    if (isExpressSubmitting.value || !data.value) return;
    expressError.value = "";
    const dni = normalizeDni(expressDni.value);
    if (!isValidDni(dni)) {
      expressError.value =
        "Ingresá un DNI de 5 a 9 números. Podés incluir puntos o espacios.";
      return;
    }
    isExpressSubmitting.value = true;
    try {
      const result = await loginAndGenerateCouponAction(
        dni,
        data.value.benefit.url,
      );
      if (result.success) {
        // Keep the button busy until the reload: the header and coupon need the new session.
        try {
          sessionStorage.setItem(EXPRESS_LOGIN_FLAG, "1");
        } catch {
          // The coupon still shows after the reload.
        }
        window.location.reload();
        return;
      }
      expressError.value = result.error || "No se pudo verificar el DNI.";
      isExpressSubmitting.value = false;
    } catch {
      expressError.value =
        "No pudimos conectar. Revisá tu conexión e intentá de nuevo.";
      isExpressSubmitting.value = false;
    }
  });

  const handleShare = $(async () => {
    if (typeof window === "undefined" || !data.value || isSharing.value) return;
    isSharing.value = true;
    showToast.value = false;
    manualShareLink.value = "";
    const { benefit } = data.value;
    const shareData = {
      title: `${benefit.titulo} - Club de Beneficios LPRC`,
      text: `¡Mirá este beneficio exclusivo en ${benefit.titulo}! ${benefit.resumen}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (err) {
          // Closing the native share sheet is an intentional cancellation.
          if (err instanceof Error && err.name === "AbortError") return;
        }
      }

      try {
        await navigator.clipboard.writeText(window.location.href);
        showToast.value = true;
        setTimeout(() => {
          showToast.value = false;
        }, 3000);
      } catch {
        manualShareLink.value = window.location.href;
      }
    } finally {
      isSharing.value = false;
    }
  });

  if (!data.value) {
    return (
      <div class="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 class="heading-display text-3xl text-primary">Beneficio no encontrado</h1>
        <span class="title-bar mx-auto mt-3" aria-hidden="true" />
        <p class="mt-4 text-slate-600">
          El beneficio que buscás no existe o ya no está vigente.
        </p>
        <Link href="/beneficios/" class="btn btn-dark mt-6">
          Ver todos los beneficios
        </Link>
      </div>
    );
  }

  const { benefit, similar, merchant, directions, validUntilLabel, isAvailable, terms } = data.value;

  const imageUrl = benefitImageUrl(benefit.imagen);
  const imageMobileUrl = benefitImageUrl(benefit.imagenMobile);
  const primaryCategory = benefit.categorias[0];
  const primaryCat = primaryCategory?.descripcion || "Beneficio";
  const primaryLoc = benefit.ubicacion[0]?.descripcion || "Prov. Buenos Aires";
  const hasMap = Boolean(parseCoordinates(benefit.latitud, benefit.longitud));
  const whatsappUrl = merchant.whatsapp ? merchantWhatsappUrl(merchant.whatsapp) : null;
  const telUrl = merchant.phone ? phoneUrl(merchant.phone) : null;
  const hasMerchantInfo = Boolean(
    merchant.address || merchant.hours || telUrl || merchant.email || whatsappUrl || merchant.instagram || merchant.website,
  );
  const coupon = generatedCoupon.value;
  const firstName = user.value?.name.split(" ")[0];
  const outlineButton = "btn btn-outline btn-sm";

  return (
    <div class="relative bg-background pb-28 text-primary sm:pb-16">
      <div class={`mx-auto max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 ${coupon && couponStatus.value === "active" ? "print:hidden" : ""}`}>
        <p class="mb-4 hidden text-sm text-slate-700 print:block">
          Para imprimir tu cupón, ingresá en la web y tocá «Obtener mi cupón». Después lo podés imprimir desde Mis cupones.
        </p>

        <nav aria-label="Ruta de navegación" class="mb-6">
          <ol class="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-600">
            <li>
              <Link href="/" class="hover:text-amber-900">Inicio</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/beneficios/" class="hover:text-amber-900">Beneficios</Link>
            </li>
            {primaryCategory && (
              <>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href={`/beneficios/?categoria=${primaryCategory.id}`} class="hover:text-amber-900">
                    {primaryCat}
                  </Link>
                </li>
              </>
            )}
            <li aria-hidden="true">/</li>
            <li aria-current="page" class="max-w-[14rem] truncate text-primary">
              {benefit.titulo}
            </li>
          </ol>
        </nav>

        <div class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-10">
          {/* Title, discount and validity first: what a member needs before deciding. The photo leads on mobile only. */}
          <div class="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
            <header class="space-y-5">
              <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p class="eyebrow text-amber-900">
                  {primaryCat} · {primaryLoc}
                </p>
                <button
                  type="button"
                  onClick$={handleShare}
                  disabled={isSharing.value}
                  aria-busy={isSharing.value}
                  class="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 underline-offset-4 hover:text-primary hover:underline disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent print:hidden"
                >
                  <LuShare2 class="h-4 w-4" aria-hidden="true" />
                  {isSharing.value ? "Compartiendo…" : "Compartir"}
                </button>
              </div>
              <div>
                <h1 class="heading-display text-4xl text-primary sm:text-5xl">{benefit.titulo}</h1>
                <span class="title-bar mt-4" aria-hidden="true" />
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3 bg-accent px-5 py-4 text-primary sm:px-6">
                <div>
                  <p class="eyebrow">Beneficio para socios</p>
                  <p class="heading-display mt-1 text-4xl sm:text-5xl">{benefit.resumen.trim() || "Exclusivo"}</p>
                </div>
                {benefit.isPremiumOnly && <span class="badge badge-dark">Socios Gold</span>}
              </div>

              <ul class="space-y-2 text-sm text-slate-700 sm:text-base">
                <li class="flex items-start gap-2.5">
                  <LuCalendarCheck class="mt-0.5 h-5 w-5 shrink-0 text-amber-900" aria-hidden="true" />
                  <span>
                    {!isAvailable ? (
                      <strong class="text-red-700">
                        {validUntilLabel ? `Este beneficio venció el ${validUntilLabel}.` : "Este beneficio no está disponible."}
                      </strong>
                    ) : validUntilLabel ? (
                      <>
                        <strong class="text-primary">Válido hasta el {validUntilLabel}.</strong> Después de esa fecha no se pueden generar ni usar cupones.
                      </>
                    ) : (
                      <strong class="text-primary">Vigente, sin fecha de vencimiento.</strong>
                    )}
                  </span>
                </li>
                {terms && (
                  <li id="condiciones" class="flex scroll-mt-48 items-start gap-2.5">
                    <LuInfo class="mt-0.5 h-5 w-5 shrink-0 text-amber-900" aria-hidden="true" />
                    <span class="whitespace-pre-line break-words">
                      <strong class="text-primary">Condiciones:</strong> {terms}
                    </span>
                  </li>
                )}
              </ul>

              {manualShareLink.value && (
                <div class="space-y-2 border border-line bg-surface p-4">
                  <p role="status" class="text-sm text-slate-700">
                    No pudimos copiar el enlace automáticamente. Seleccionalo y copialo para compartir este beneficio.
                  </p>
                  <label for="manual-share-link" class="field-label">
                    Enlace del beneficio
                  </label>
                  <input
                    id="manual-share-link"
                    type="text"
                    readOnly
                    value={manualShareLink.value}
                    onFocus$={(_, input) => input.select()}
                    class="field text-base"
                  />
                </div>
              )}
            </header>
            <div class="order-first overflow-hidden bg-primary lg:order-none">
              {imageUrl ? (
                <picture class="block">
                  {imageMobileUrl && <source media="(max-width: 640px)" srcset={imageMobileUrl} />}
                  <img
                    src={imageUrl}
                    alt=""
                    class="aspect-[16/9] w-full object-cover lg:aspect-[2/1]"
                    width={1200}
                    height={600}
                  />
                </picture>
              ) : (
                <div class="flex aspect-[16/9] items-center justify-center lg:aspect-[2/1]">
                  <img src="/lprc.avif" alt="" width={108} height={120} class="h-28 w-auto object-contain" />
                </div>
              )}
            </div>

          </div>

          {/* Coupon first, then the credential or the invitation to join; sticky beside the details on desktop. */}
          <aside ref={asideRef} class="space-y-6 lg:sticky lg:top-[var(--aside-top,11rem)] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
            <section
              id="obtener-cupon"
              ref={couponPanelRef}
              aria-labelledby="coupon-title"
              class="scroll-mt-32 border border-line border-t-4 border-t-accent bg-surface p-5 sm:p-6 print:hidden"
            >
              <p class="sr-only" role="status" aria-live="polite">{couponAnnouncement.value}</p>
              {!isAvailable && !coupon ? (
                <>
                  <p class="eyebrow text-amber-900">Cupón</p>
                  <h2 id="coupon-title" class="heading-display mt-1 text-2xl">Beneficio no disponible</h2>
                  <p class="mt-2 text-sm text-slate-600">
                    Ya no se pueden generar cupones para este beneficio. Mirá los que siguen vigentes.
                  </p>
                  <Link href="/beneficios/" class="btn btn-dark mt-5 w-full">
                    Ver beneficios vigentes
                  </Link>
                </>
              ) : user.value && coupon ? (
                <div class="space-y-4">
                  <CouponLiveStatus couponId={coupon.id} status={couponStatus} />
                  <div>
                    <p class="eyebrow text-amber-900">Tu cupón</p>
                    <h2
                      id="coupon-title"
                      ref={couponHeadingRef}
                      tabIndex={-1}
                      class="heading-display mt-1 text-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {couponStatus.value === "active"
                        ? "Cupón activo"
                        : couponStatus.value === "used"
                          ? "Cupón canjeado"
                          : "Cupón vencido"}
                    </h2>
                  </div>
                  <div class="flex items-center justify-between gap-3 border border-line bg-surface-muted px-4 py-3">
                    <div>
                      <p class="text-[11px] font-bold uppercase tracking-wider text-slate-600">Código</p>
                      <p class="font-mono text-2xl font-black tracking-[0.25em] text-primary">{coupon.code}</p>
                    </div>
                    {couponStatus.value === "active" && (
                      <CopyCodeButton code={coupon.code} label="Copiar" class="btn btn-outline btn-sm" />
                    )}
                  </div>
                  {couponStatus.value === "active" && (
                    <img
                      src={coupon.qrDataUrl}
                      alt={`QR del cupón ${coupon.code} para validar en el comercio`}
                      width={176}
                      height={176}
                      class="mx-auto h-44 w-44 border border-line bg-white p-1"
                    />
                  )}
                  <p class="text-sm leading-relaxed text-slate-600">
                    {couponStatus.value === "active"
                      ? "Mostrá el QR o el código antes de pagar. El comercio verifica tu DNI y registra el canje; se usa una sola vez."
                      : couponStatus.value === "used"
                        ? "El comercio registró el canje de este cupón."
                        : "Este cupón ya no se puede usar."}
                  </p>
                  <Link href={`/perfil/cupon/${coupon.id}/`} class="btn btn-dark w-full">
                    Ver mi cupón
                  </Link>
                </div>
              ) : user.value ? (
                <>
                  <p class="eyebrow text-amber-900">Hola, {firstName}</p>
                  <h2 id="coupon-title" ref={couponHeadingRef} tabIndex={-1} class="heading-display mt-1 text-2xl outline-none">
                    Obtené tu cupón
                  </h2>
                  <p class="mt-2 text-sm leading-relaxed text-slate-600">
                    Generá un código con QR personal para mostrar antes de pagar. También queda guardado en Mis cupones.
                  </p>
                  <button
                    type="button"
                    onClick$={handleGenerateCoupon}
                    disabled={isGenerating.value}
                    aria-busy={isGenerating.value}
                    class="btn btn-primary mt-5 w-full disabled:cursor-wait"
                  >
                    {isGenerating.value ? "Generando…" : "Generar mi cupón"}
                  </button>
                  {couponError.value && (
                    <p role="alert" class="mt-3 text-sm text-red-700">
                      {couponError.value}
                      {couponSessionExpired.value && (
                        <>
                          {" "}
                          <a href={loginUrl(benefitPath)} class="font-bold underline underline-offset-2">
                            Ingresar de nuevo
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p class="eyebrow text-amber-900">Para socios</p>
                  <h2 id="coupon-title" class="heading-display mt-1 text-2xl">Obtené tu cupón</h2>
                  <p class="mt-2 text-sm leading-relaxed text-slate-600">
                    Ingresá con tu DNI de socio y generá un código con QR para mostrar antes de pagar.
                  </p>
                  <form class="mt-4 space-y-2" preventdefault:submit onSubmit$={handleExpressSubmit} noValidate>
                    <label for="express-dni" class="field-label">
                      DNI
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autocomplete="username"
                      autoCapitalize="off"
                      spellcheck={false}
                      id="express-dni"
                      bind:value={expressDni}
                      maxLength={20}
                      required
                      placeholder="Ej.: 12.345.678"
                      aria-invalid={!!expressError.value}
                      aria-describedby={expressError.value ? "express-dni-help express-dni-error" : "express-dni-help"}
                      class="field text-base"
                    />
                    <p id="express-dni-help" class="text-xs text-slate-600">
                      Con o sin puntos. No hace falta contraseña.
                    </p>
                    {expressError.value && (
                      <p id="express-dni-error" role="alert" class="text-sm text-red-700">
                        {expressError.value}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={isExpressSubmitting.value}
                      aria-busy={isExpressSubmitting.value}
                      class="btn btn-primary mt-2 w-full disabled:cursor-wait"
                    >
                      {isExpressSubmitting.value ? "Verificando…" : "Ingresar y obtener cupón"}
                    </button>
                  </form>
                  <a
                    href={whatsappLink(dniHelpMessage(expressDni.value))}
                    target="_blank"
                    rel="noopener"
                    class="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-slate-700 underline underline-offset-4 hover:text-primary"
                  >
                    ¿Tu DNI no figura? Escribinos
                    <span class="sr-only"> (WhatsApp del club, abre en una pestaña nueva)</span>
                  </a>
                </>
              )}
            </section>

            {user.value ? <AthleteProfileCard user={user.value} /> : <HaceteSocio variant="card" class="print:hidden" />}
          </aside>

          {/* Everything else, in reading order. */}
          <div class="space-y-10 lg:col-start-1 lg:row-start-2">
            <section aria-labelledby="como-usarlo-title" class="print:hidden">
              <SectionHeading title="Cómo usarlo" as="h2" size="md" id="como-usarlo-title" />
              <ol class="mt-5 grid gap-px border border-line bg-line sm:grid-cols-3">
                {[
                  {
                    title: "Ingresá con tu DNI",
                    text: user.value
                      ? `Listo: ingresaste como ${user.value.name}.`
                      : "Usá el DNI con el que figurás como socio. No hace falta contraseña.",
                  },
                  {
                    title: "Generá tu cupón",
                    text: "Te damos un código y un QR personal. También queda en Mis cupones.",
                  },
                  {
                    title: "Mostralo antes de pagar",
                    text: "El comercio verifica tu DNI y registra el canje. Cada cupón se usa una vez.",
                  },
                ].map((step, index) => (
                  <li key={step.title} class="flex gap-3 bg-surface p-4 sm:flex-col sm:p-5">
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center bg-accent font-display text-lg font-bold text-primary" aria-hidden="true">
                      {index + 1}
                    </span>
                    <div>
                      <h3 class="heading-display text-lg">{step.title}</h3>
                      <p class="mt-1 text-sm leading-relaxed text-slate-600">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link href="/como-funciona/" class="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline">
                Más detalles en Cómo funciona
                <LuArrowRight class="h-4 w-4" aria-hidden="true" />
              </Link>
            </section>

            <section aria-labelledby="detalle-title">
              <SectionHeading title="Detalle del beneficio" as="h2" size="md" id="detalle-title" />
              <div
                dangerouslySetInnerHTML={benefit.descripcion}
                class="mt-5 space-y-4 break-words text-sm leading-relaxed text-slate-700 md:text-base [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_b]:text-primary [&_strong]:text-primary"
              />
            </section>

            {data.value.merchantCode && (
              <div class="flex flex-wrap items-center justify-between gap-3 border border-line bg-surface p-4 text-sm text-slate-700 sm:p-5">
                <p>
                  Código del comercio:{" "}
                  <strong class="font-mono text-base tracking-[0.2em] text-primary">{data.value.merchantCode}</strong>
                  <span class="block text-xs text-slate-600">Para compras online o por teléfono, si el comercio lo pide.</span>
                </p>
                <CopyCodeButton code={data.value.merchantCode} class={outlineButton} />
              </div>
            )}

            {(hasMerchantInfo || hasMap || directions) && (
              <section aria-labelledby="comercio-title" class="border border-line bg-surface">
                <div class="p-5 sm:p-6">
                  <SectionHeading title="El comercio" as="h2" size="md" id="comercio-title" />
                  {hasMerchantInfo && (
                    <dl class="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                      {merchant.address && (
                        <div class="flex gap-3">
                          <LuMapPin class="mt-0.5 h-5 w-5 shrink-0 text-amber-900" aria-hidden="true" />
                          <div>
                            <dt class="text-[11px] font-bold uppercase tracking-wider text-slate-600">Dirección</dt>
                            <dd class="mt-0.5 text-primary">{merchant.address}</dd>
                          </div>
                        </div>
                      )}
                      {merchant.hours && (
                        <div class="flex gap-3">
                          <LuClock class="mt-0.5 h-5 w-5 shrink-0 text-amber-900" aria-hidden="true" />
                          <div>
                            <dt class="text-[11px] font-bold uppercase tracking-wider text-slate-600">Horario</dt>
                            <dd class="mt-0.5 whitespace-pre-line text-primary">{merchant.hours}</dd>
                          </div>
                        </div>
                      )}
                      {telUrl && (
                        <div class="flex gap-3">
                          <LuPhone class="mt-0.5 h-5 w-5 shrink-0 text-amber-900" aria-hidden="true" />
                          <div>
                            <dt class="text-[11px] font-bold uppercase tracking-wider text-slate-600">Teléfono</dt>
                            <dd class="mt-0.5">
                              <a href={telUrl} class="font-semibold text-primary underline underline-offset-4">{merchant.phone}</a>
                            </dd>
                          </div>
                        </div>
                      )}
                      {merchant.email && (
                        <div class="flex gap-3">
                          <LuMail class="mt-0.5 h-5 w-5 shrink-0 text-amber-900" aria-hidden="true" />
                          <div class="min-w-0">
                            <dt class="text-[11px] font-bold uppercase tracking-wider text-slate-600">Email</dt>
                            <dd class="mt-0.5 break-all">
                              <a href={`mailto:${merchant.email}`} class="font-semibold text-primary underline underline-offset-4">{merchant.email}</a>
                            </dd>
                          </div>
                        </div>
                      )}
                    </dl>
                  )}
                  {(directions || whatsappUrl || merchant.instagram || merchant.website) && (
                    <div class="mt-6 flex flex-wrap gap-3">
                      {directions && (
                        <a href={directions} target="_blank" rel="noopener" class="btn btn-dark btn-sm">
                          <LuNavigation class="h-4 w-4" aria-hidden="true" />
                          Cómo llegar
                          <span class="sr-only"> (Google Maps, abre en una pestaña nueva)</span>
                        </a>
                      )}
                      {whatsappUrl && (
                        <a href={whatsappUrl} target="_blank" rel="noopener" class={outlineButton}>
                          <LuMessageCircle class="h-4 w-4" aria-hidden="true" />
                          WhatsApp
                          <span class="sr-only"> {merchant.whatsapp} (abre en una pestaña nueva)</span>
                        </a>
                      )}
                      {merchant.instagram && (
                        <a href={merchant.instagram} target="_blank" rel="noopener" class={outlineButton}>
                          <LuInstagram class="h-4 w-4" aria-hidden="true" />
                          {instagramHandle(merchant.instagram)}
                          <span class="sr-only"> en Instagram (abre en una pestaña nueva)</span>
                        </a>
                      )}
                      {merchant.website && (
                        <a href={merchant.website} target="_blank" rel="noopener" class={outlineButton}>
                          <LuGlobe class="h-4 w-4" aria-hidden="true" />
                          {websiteLabel(merchant.website)}
                          <span class="sr-only"> (sitio web, abre en una pestaña nueva)</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
                {hasMap && (
                  <div class="relative h-64 border-t border-line bg-surface-muted sm:h-80">
                    <div
                      id="leaflet-map"
                      ref={mapContainerRef}
                      class="absolute inset-0 z-0"
                      role="region"
                      aria-label={`Mapa con la ubicación de ${benefit.titulo}`}
                    />
                    {!isMapLoaded.value && (
                      <div class="absolute inset-0 z-10 flex items-center justify-center bg-surface-muted text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Cargando mapa…
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {benefit.pdfUrl && (
              <div class="flex flex-col gap-4 border border-line bg-surface p-5 sm:flex-row sm:items-center sm:p-6">
                <LuFileText class="h-10 w-10 shrink-0 text-amber-900" aria-hidden="true" />
                <div class="flex-grow">
                  <h2 class="heading-display text-lg">Documento del beneficio</h2>
                  <p class="mt-1 text-sm text-slate-600">
                    Lista de precios, bases o información extra del comercio (PDF).
                  </p>
                </div>
                <div class="flex flex-wrap gap-3">
                  <a href={benefit.pdfUrl} target="_blank" rel="noopener" class="btn btn-dark btn-sm">
                    Ver documento
                    <span class="sr-only"> (PDF, abre en una pestaña nueva)</span>
                  </a>
                  {data.value.pdfDownloadHref && (
                    <a href={data.value.pdfDownloadHref} download class={outlineButton}>
                      <LuDownload class="h-4 w-4" aria-hidden="true" />
                      Descargar
                    </a>
                  )}
                </div>
              </div>
            )}

            <p class="text-sm text-slate-600 print:hidden">
              ¿Problema con este comercio?{" "}
              <Link
                href={`/sugerencias/?tipo=${encodeURIComponent("Problema Comercio")}&comercio=${encodeURIComponent(benefit.titulo)}`}
                class="font-bold text-primary underline underline-offset-4 hover:text-amber-900"
              >
                Avisanos
              </Link>
            </p>
          </div>
        </div>

        {similar.length > 0 && (
          <section aria-labelledby="recomendados-title" class="mt-14 border-t border-line pt-10 print:hidden">
            <SectionHeading title="Beneficios recomendados" eyebrow={`Más en ${primaryCat}`} as="h2" size="md" id="recomendados-title" />
            <ul class="-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
              {similar.map((item: Benefit) => {
                const thumbnail = benefitImageUrl(item.imagen);
                return (
                  <li key={item.id} class="w-[78%] shrink-0 snap-start sm:w-auto">
                    <Link
                      href={`/beneficio/${item.url}/`}
                      class="group flex h-full flex-col border border-line bg-surface transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <div class="relative aspect-[16/10] overflow-hidden bg-primary">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt=""
                            width={400}
                            height={250}
                            loading="lazy"
                            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div class="flex h-full items-center justify-center">
                            <img src="/lprc.avif" alt="" width={54} height={60} class="h-14 w-auto" />
                          </div>
                        )}
                        <span class="badge badge-accent absolute left-3 top-3 max-w-[calc(100%-1.5rem)] whitespace-normal text-left leading-tight">
                          {item.resumen.trim()}
                        </span>
                      </div>
                      <div class="flex-grow p-4">
                        <p class="eyebrow text-amber-900">{item.categorias[0]?.descripcion || "Beneficio"}</p>
                        <h3 class="heading-display mt-1 line-clamp-2 text-lg text-primary">{item.titulo}</h3>
                        <p class="mt-1 text-sm text-slate-600">{item.ubicacion[0]?.descripcion}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {(isAvailable || coupon) && !couponPanelInView.value && (
        <div class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(2_6_23/0.12)] sm:hidden print:hidden">
          <a
            href={coupon ? `/perfil/cupon/${coupon.id}/` : "#obtener-cupon"}
            onClick$={() => {
              if (!coupon) document.getElementById("express-dni")?.focus({ preventScroll: true });
            }}
            class="btn btn-primary w-full"
          >
            {coupon ? "Ver mi cupón" : user.value ? "Generar mi cupón" : "Obtener mi cupón"}
          </a>
        </div>
      )}

      {showToast.value && (
        <div
          role="status"
          class="animate-toast-up fixed bottom-24 left-1/2 z-50 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 bg-primary px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-xl sm:bottom-10 print:hidden"
        >
          <span class="text-accent" aria-hidden="true">✓</span>
          Enlace copiado
        </div>
      )}

      {/* Print-only voucher, shown when a member prints this page with an active coupon. */}
      {user.value && coupon && couponStatus.value === "active" ? (
        <div class="print-voucher-container mx-auto max-w-lg space-y-6 border-2 border-primary bg-white p-8 text-center font-sans">
          <div class="flex flex-col items-center border-b-4 border-accent pb-4">
            <img src="/lprc.avif" alt="La Plata Rugby Club" width={64} height={72} class="mb-2 h-18 w-16 object-contain" />
            <h2 class="heading-display text-xl text-primary">La Plata Rugby Club</h2>
            <span class="eyebrow mt-1 text-slate-700">Cupón oficial del Club de Beneficios</span>
          </div>
          <div class="space-y-2">
            <h3 class="heading-display text-2xl text-primary">{benefit.titulo}</h3>
            <p class="heading-display border-2 border-primary px-4 py-2 text-3xl text-primary">{benefit.resumen.trim()}</p>
            <p class="mx-auto max-w-sm text-xs leading-relaxed text-slate-600">
              Mostrá este cupón antes de pagar. El comercio verifica tu DNI y registra el canje.
            </p>
          </div>
          <dl class="space-y-2 border border-slate-300 p-4 text-left text-xs text-slate-700">
            <div class="flex justify-between gap-3">
              <dt>Socio</dt>
              <dd class="font-bold text-primary">{user.value.name}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt>Código de canje</dt>
              <dd class="font-mono font-bold tracking-[0.2em] text-primary">{coupon.code}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt>Válido</dt>
              <dd class="text-primary">{validUntilLabel ? `Hasta el ${validUntilLabel}` : "Mientras el beneficio esté vigente"}</dd>
            </div>
          </dl>
          <div class="flex flex-col items-center gap-1.5">
            <img
              src={coupon.qrDataUrl}
              alt="QR del cupón para validar en el comercio"
              width={200}
              height={200}
              class="h-[200px] w-[200px] object-contain"
            />
            <span class="text-[11px] font-bold uppercase tracking-widest text-slate-600">
              Escanear en el comercio para validar
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
});

export const head: DocumentHead = ({ resolveValue, url }) => {
  const data = resolveValue(useBenefitData);
  if (!data) {
    return {
      title: "Beneficio no encontrado - Portal de Beneficios LPRC",
    };
  }
  const { benefit } = data;
  // WhatsApp and other previews need an absolute URL; legacy rows store bare file names.
  const image = benefitImageUrl(benefit.imagen);
  const ogImage = image ? new URL(image, url.origin).href : null;
  const desc = benefit.descripcion
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 160);
  return {
    title: `${benefit.titulo} - Club de Beneficios LPRC`,
    meta: [
      {
        name: "description",
        content: `${benefit.resumen.trim()} en ${benefit.titulo}. ${desc}`,
      },
      {
        property: "og:title",
        content: `${benefit.titulo} - Club de Beneficios LPRC`,
      },
      {
        property: "og:description",
        content: `${benefit.resumen.trim()} en ${benefit.titulo}. Ingresá con tu DNI de socio, generá tu cupón y mostralo antes de pagar.`,
      },
      ...(ogImage
        ? [
            { property: "og:image", content: ogImage },
            { property: "og:image:alt", content: benefit.titulo },
            { name: "twitter:card", content: "summary_large_image" },
          ]
        : []),
    ],
  };
};
