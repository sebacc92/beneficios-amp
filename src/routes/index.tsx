import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$, Link, useLocation, type DocumentHead, server$ } from "@builder.io/qwik-city";
import { searchBenefits, getFilters, getCustomBenefits, type Benefit } from "~/server/cache";
import { CAMPAIGN_DEFAULTS, selectHomeBenefits } from "~/utils/home-benefits";
import { CategorySlider } from "~/components/category-slider/category-slider";
import { OfferSlider } from "~/components/offer-slider/offer-slider";
import { BenefitCard } from "~/components/ui/BenefitCard";
import { HeroSlider } from "~/components/hero-slider/hero-slider";
import { CuratedRow } from "~/components/curated-row/curated-row";
import { EditorialCards } from "~/components/editorial-cards/editorial-cards";
import { SponsorMarquee } from "~/components/ui/SponsorMarquee";
import { LPRCButton } from "~/components/ui/LPRCButton";
import { POPUP_STORAGE_KEY, PopupModal, popupVersion } from "~/components/popup-modal/popup-modal";
import { getSettings } from "~/server/chatbotDb";
import { rateLimitByIp } from "~/server/rate-limit";
import { getDB } from "~/db";
import { sponsors as sponsorsTable, heroSlides as heroSlidesTable, merchantRequests } from "~/db/schema";
import { asc, eq } from "drizzle-orm";

// Loader to fetch sponsors sorted by display order (y)
export const useSponsorsData = routeLoader$(async (event) => {
  try {
    const db = getDB(event);
    return await db.select().from(sponsorsTable).orderBy(sponsorsTable.y);
  } catch (err) {
    console.error("Failed to load sponsors on home:", err);
    return [];
  }
});

// Server Loader to retrieve benefits and filters
export const useBenefitsData = routeLoader$(async (event) => {
  const url = new URL(event.url);
  const query = url.searchParams.get("buscar") || "";
  const categoryId = url.searchParams.get("categoria") ? Number(url.searchParams.get("categoria")) : undefined;
  const locationId = url.searchParams.get("ubicacion") ? Number(url.searchParams.get("ubicacion")) : undefined;
  const offerId = url.searchParams.get("oferta") ? Number(url.searchParams.get("oferta")) : undefined;
  const page = url.searchParams.get("page") ? Number(url.searchParams.get("page")) : 1;
  const isGoldOnly = url.searchParams.get("gold") === "1";
  const isMap = url.searchParams.get("vista") === "mapa";

  const searchResult = await searchBenefits({
    query, categoryId, locationId, offerId, page,
    limit: isMap ? 1000 : 12,
    requestEvent: event,
    isPremiumOnly: isGoldOnly
  });

  const filters = await getFilters(event);

  let settings = null;
  try { settings = await getSettings(event); } catch (err) { console.error("Failed to load settings in homepage loader:", err); }

  let curatedRows = null;
  if (!query && !categoryId && !locationId && !offerId && !isGoldOnly && page === 1) {
    try {
      // Reuse the catalog already memoized by searchBenefits for this request.
      const items = await getCustomBenefits(event);
      curatedRows = selectHomeBenefits(items, settings?.campaignQuery);
    } catch (e) { console.error("Failed to compile curated rows:", e); }
  }

  let slides: any[] = [];
  try {
    const db = getDB(event);
    slides = await db.select().from(heroSlidesTable).where(eq(heroSlidesTable.isActive, 1)).orderBy(asc(heroSlidesTable.orderIndex));
  } catch (err) {
    // No fallback slides: the old ones pointed at a domain that no longer exists, so the
    // home simply skips the carousel until the slides load again.
    console.error("Failed to load slides on homepage:", err);
  }

  return { searchResult, filters, curatedRows, slides, settings, activeFilters: { query, categoryId, locationId, offerId, page } };
});

export const submitMerchantRequest = server$(async function (data: {
  businessName: string; category: string; contactName: string; email: string; phone: string; proposal: string;
}) {
  // Table creation lives in scripts/migrate.mjs, not in the submit path.
  const limit = rateLimitByIp(this, "merchant-request", 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return { success: false, message: "Ya enviaste varias solicitudes. Probá de nuevo más tarde." };
  }

  try {
    const db = getDB(this);
    const id = Math.random().toString(36).substring(2, 9);
    await db.insert(merchantRequests).values({ id, businessName: data.businessName, category: data.category, contactName: data.contactName, email: data.email, phone: data.phone, proposal: data.proposal, status: "pending", createdAt: new Date().toISOString() });
    return { success: true, message: "¡Solicitud enviada con éxito!" };
  } catch (err) {
    console.error("Error inserting merchant request:", err);
    return { success: false, message: "Hubo un error al procesar tu solicitud." };
  }
});

export default component$(() => {
  const location = useLocation();
  const data = useBenefitsData();
  const sponsorsData = useSponsorsData();
  const showPopup = useSignal(false);

  // Show each popup version once: a closed popup returns only when its content changes.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const settings = data.value.settings;
    if (location.url.pathname !== "/" || !settings?.popupActive || (window as any).__popupClosed) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(POPUP_STORAGE_KEY) === popupVersion(settings);
    } catch {
      // Storage can be unavailable (private mode); the in-memory flag still covers this visit.
    }
    if (!dismissed) showPopup.value = true;
  });

  const { searchResult, filters, curatedRows, slides, settings } = data.value;
  const { data: benefits } = searchResult;

  return (
    <div class="relative min-h-screen bg-background">
      <h1 class="sr-only">Club de Beneficios La Plata Rugby Club</h1>
      {/* Curated Showcase (homepage only) */}
      {curatedRows && (
        <>
          {/* Hero Slider */}
          <HeroSlider slides={slides} />

          {/* Category Slider */}
          <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 print:hidden text-left animate-fade-in-up">
            <CategorySlider categorias={filters.categorias} sliderId="home-category-container" filterEmpty={true} />
          </div>

          {/* Offer Slider */}
          <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-4 print:hidden text-left animate-fade-in-up">
            <OfferSlider ofertas={filters.ofertas} sliderId="home-offer-container" filterEmpty={true} />
          </div>

          {/* Gold/Featured Benefits Row */}
          <CuratedRow
            title="Beneficios Destacados"
            subtitle="Selección Especial"
            accentColor="emerald"
            containerId="gold-container"
            benefits={curatedRows.gold}
            variant="standard"
          />

          {/* Nuevos Benefits Row */}
          <CuratedRow
            title="Nuevos Beneficios"
            subtitle="Recién incorporados"
            accentColor="emerald"
            containerId="nuevos-container"
            benefits={curatedRows.nuevos}
            variant="new"
          />

          {/* Campaign Spotlight */}
          {settings?.campaignActive !== false && curatedRows.cafecitos && curatedRows.cafecitos.length > 0 && (
            <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-10 print:hidden text-left animate-fade-in-up">
              <div class="bg-gradient-to-br from-white to-surface-muted border border-line rounded-[3rem] p-8 md:p-12 shadow-xl grid grid-cols-1 lg:grid-cols-4 gap-8 items-center relative overflow-hidden">
                <div class="absolute -right-16 -top-16 w-60 h-60 bg-brand-gold/10 rounded-full blur-[80px] pointer-events-none" />
                <div class="absolute -left-16 -bottom-16 w-60 h-60 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
                <div class="lg:col-span-1 space-y-5 relative z-10 text-primary flex flex-col justify-center h-full">
                  <div class="inline-flex items-center space-x-2"><span class="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse"></span><span class="text-[11px] font-black tracking-widest text-amber-900 uppercase">{settings?.campaignTag || CAMPAIGN_DEFAULTS.tag}</span></div>
                  <h2 class="text-4xl md:text-5xl font-display font-black text-primary tracking-tight leading-tight">{settings?.campaignEmoji || CAMPAIGN_DEFAULTS.emoji} {settings?.campaignTitle || CAMPAIGN_DEFAULTS.title}</h2>
                  <p class="text-sm text-slate-600 font-medium leading-relaxed">{settings?.campaignSubtitle || CAMPAIGN_DEFAULTS.subtitle}</p>
                  <div class="pt-2"><Link href="/beneficios/?campana=1" class="inline-flex items-center space-x-2 px-6 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-primary hover:text-slate-900 border border-accent/40 hover:border-accent text-sm font-black uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer"><span>Ver todos</span><span class="text-sm">&rarr;</span></Link></div>
                </div>
                <div class="lg:col-span-3">
                  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                    {curatedRows.cafecitos.map((benefit: Benefit) => (
                      <Link key={`coffee-${benefit.id}`} href={`/beneficio/${benefit.url}`} class="group block bg-surface hover:bg-slate-50 border border-line rounded-3xl p-4 transition-all duration-300 hover:-translate-y-1 relative">
                        <div class="relative h-28 rounded-2xl overflow-hidden bg-surface-muted flex items-center justify-center">
                          {benefit.imagen ? (<img src={benefit.imagen.startsWith('http') || benefit.imagen.startsWith('/') ? benefit.imagen : `https://beneficios.lprc.ar/files/${benefit.imagen}`} alt={benefit.titulo} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" width={200} height={112} loading="lazy" />) : (<span class="text-amber-900 font-display font-extrabold text-base">LPRC</span>)}
                          <div class="absolute bottom-2 right-2 z-10"><span class="inline-flex items-center px-3 py-1 rounded-xl text-[11px] font-black bg-brand-gold text-slate-950 shadow-lg tracking-tight border border-white/10">{benefit.resumen.replace("Descuento del", "").trim()}</span></div>
                        </div>
                        <div class="mt-3.5 text-left"><h4 class="text-[11px] font-bold text-amber-900 uppercase tracking-wider truncate">{benefit.ubicacion[0]?.descripcion || "La Plata"}</h4><h3 class="text-sm font-display font-black text-primary group-hover:text-primary line-clamp-2 mt-1 leading-snug">{benefit.titulo}</h3></div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Editorial Cards + Modals */}
          <EditorialCards />

          {/* Sponsors Marquee */}
          <SponsorMarquee sponsors={sponsorsData.value as any} />
        </>
      )}

      {/* All Benefits Preview */}
      <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div class="border-b border-line pb-5 mb-8 text-left animate-fade-in-up">
          <h2 class="text-3xl font-display font-extrabold text-primary tracking-tight leading-none">Ver todos los beneficios</h2>
          <p class="text-slate-600 text-sm mt-2 font-medium">Explorá nuestro catálogo de descuentos exclusivos</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {benefits.slice(0, 4).map((benefit: Benefit, idx: number) => {
            const isLocked = false;
            return (
              <div key={benefit.id} class={`animate-fade-in-up animate-stagger-${idx + 1}`}>
                <BenefitCard benefit={benefit} isLocked={isLocked} />
              </div>
            );
          })}
        </div>
        <div class="flex justify-center pt-10 mt-8 border-t border-line">
          <LPRCButton href="/beneficios" variant="accent">
            Ver todos
          </LPRCButton>
        </div>
      </div>

      {/* Configurable Popup Modal */}
      {showPopup.value && settings && (
        <PopupModal
          settings={settings}
          onClose$={() => {
            showPopup.value = false;
            (window as any).__popupClosed = true;
            try {
              localStorage.setItem(POPUP_STORAGE_KEY, popupVersion(settings));
            } catch {
              // See above: without storage the popup simply shows again next visit.
            }
          }}
        />
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "Portal de Beneficios Oficial - La Plata Rugby Club",
  meta: [
    { name: "description", content: "Exclusivo club de beneficios para socios y empleados de la LPRC. Disfrutá de más de 250 comercios con descuentos especiales, promociones, y sorteos increíbles." },
    { property: "og:title", content: "Portal de Beneficios Oficial - La Plata Rugby Club" },
    { property: "og:description", content: "Ahorrá y disfrutá con el catálogo oficial de beneficios de La Plata Rugby Club. Descuentos en turismo, gastronomía, indumentaria, recreación y mucho más." }
  ]
};
