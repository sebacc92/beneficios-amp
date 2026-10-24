import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$, Link, useLocation, type DocumentHead, server$ } from "@builder.io/qwik-city";
import { getFilters, getCustomBenefits } from "~/server/cache";
import { CAMPAIGN_DEFAULTS, commonLocation, isPublicBenefit, selectHomeBenefits, withLiveCounts } from "~/utils/home-benefits";
import { CategorySlider } from "~/components/category-slider/category-slider";
import { OfferSlider } from "~/components/offer-slider/offer-slider";
import { BenefitCard } from "~/components/ui/BenefitCard";
import { ClubHero } from "~/components/hero-slider/club-hero";
import { CuratedRow } from "~/components/curated-row/curated-row";
import { EditorialCards } from "~/components/editorial-cards/editorial-cards";
import { SponsorMarquee } from "~/components/ui/SponsorMarquee";
import { POPUP_STORAGE_KEY, PopupModal, popupVersion } from "~/components/popup-modal/popup-modal";
import { CampaignSpotlight } from "~/components/campaign-spotlight/campaign-spotlight";
import { SectionHeading } from "~/components/section-heading/section-heading";
import { HaceteSocio } from "~/components/hacete-socio/hacete-socio";
import { useLayoutUser } from "~/routes/layout";
import { shouldShowPopup } from "~/utils/popup";
import { getSettings } from "~/server/chatbotDb";
import { rateLimitByIp } from "~/server/rate-limit";
import { getDB } from "~/db";
import { sponsors as sponsorsTable, heroSlides as heroSlidesTable, merchantRequests } from "~/db/schema";
import { asc, eq } from "drizzle-orm";

/** Filters that used to work on the home; the catalog owns them now. */
const CATALOG_PARAMS = ["buscar", "categoria", "ubicacion", "oferta", "gold", "page"];

// Loader to fetch sponsors sorted by display order (y)
export const useSponsorsData = routeLoader$(async (event) => {
  try {
    const db = getDB(event);
    // Hidden sponsors stay in the panel without reaching the site.
    return await db.select().from(sponsorsTable).where(eq(sponsorsTable.isActive, true)).orderBy(sponsorsTable.y);
  } catch (err) {
    console.error("Failed to load sponsors on home:", err);
    return [];
  }
});

export const useBenefitsData = routeLoader$(async (event) => {
  if (CATALOG_PARAMS.some((key) => event.url.searchParams.has(key))) {
    throw event.redirect(301, `/beneficios/${event.url.search}`);
  }

  let settings = null;
  try { settings = await getSettings(event); } catch (err) { console.error("Failed to load settings in homepage loader:", err); }

  const [items, savedFilters] = await Promise.all([getCustomBenefits(event), getFilters(event)]);
  const active = items.filter(isPublicBenefit);
  const curatedRows = selectHomeBenefits(items, settings?.campaignQuery, settings?.campaignBenefitSlugs);
  const filters = withLiveCounts(savedFilters, items);

  let slides: (typeof heroSlidesTable.$inferSelect)[] = [];
  try {
    const db = getDB(event);
    slides = await db.select().from(heroSlidesTable).where(eq(heroSlidesTable.isActive, 1)).orderBy(asc(heroSlidesTable.orderIndex));
  } catch (err) {
    // No fallback slides: the old ones pointed at a domain that no longer exists, so the
    // home simply skips the carousel until the slides load again.
    console.error("Failed to load slides on homepage:", err);
  }

  const popupVisible = settings ? shouldShowPopup(settings, { loggedIn: Boolean(event.sharedMap.get("user")) }) : false;

  return {
    curatedRows,
    filters,
    slides,
    settings,
    popupVisible,
    benefitCount: active.length,
    categoryCount: filters.categorias.filter((category) => (category.beneficios_count || 0) > 0).length,
    // Cards skip the city most benefits share ("La Plata") and only show the exceptions.
    commonLocation: commonLocation(active),
  };
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
  const user = useLayoutUser();
  const showPopup = useSignal(false);

  // Show each popup version once: a closed popup returns only when its content changes.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const settings = data.value.settings;
    if (location.url.pathname !== "/" || !settings || !data.value.popupVisible || (window as any).__popupClosed) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(POPUP_STORAGE_KEY) === popupVersion(settings);
    } catch {
      // Storage can be unavailable (private mode); the in-memory flag still covers this visit.
    }
    if (!dismissed) showPopup.value = true;
  });

  const { curatedRows, filters, slides, settings, benefitCount, categoryCount, commonLocation: sharedLocation } = data.value;
  const showCampaign = settings?.campaignActive !== false && curatedRows.cafecitos.length > 0;

  return (
    <div class="relative min-h-screen bg-background">
      <ClubHero
        loggedIn={Boolean(user.value)}
        memberName={user.value?.name}
        benefitCount={benefitCount}
        categoryCount={categoryCount}
        slides={slides}
      />

      <section class="mx-auto max-w-[90rem] px-4 pt-6 pb-2 text-left print:hidden sm:px-6 sm:pb-4 sm:pt-10 lg:px-8" aria-labelledby="home-explore-title">
        <SectionHeading id="home-explore-title" eyebrow="Encontrá lo que buscás" title="Rubros y descuentos" size="md" />
        <div class="mt-4 space-y-3 sm:mt-6 sm:space-y-6">
          <div class="md:hidden">
            <p class="mb-1 text-xs font-semibold text-slate-600">Por rubro</p>
            <CategorySlider categorias={filters.categorias} sliderId="home-category-chips" variant="chips" filterEmpty={true} title="Por rubro" />
          </div>
          <div class="hidden md:block">
            <CategorySlider categorias={filters.categorias} sliderId="home-category-container" filterEmpty={true} title="Por rubro" />
          </div>
          <div class="md:hidden">
            <p class="mb-1 text-xs font-semibold text-slate-600">Por descuento</p>
            <OfferSlider ofertas={filters.ofertas} sliderId="home-offer-chips" variant="chips" filterEmpty={true} title="Por descuento" />
          </div>
          <div class="hidden md:block">
            <OfferSlider ofertas={filters.ofertas} sliderId="home-offer-container" filterEmpty={true} title="Por descuento" />
          </div>
        </div>
      </section>

      <CuratedRow
        title="Beneficios destacados"
        subtitle="Selección del club"
        containerId="gold-container"
        benefits={curatedRows.gold}
        variant="standard"
        commonLocation={sharedLocation}
      />

      {/* Empty (and hidden) when the whole catalog was loaded on the same day. */}
      <CuratedRow
        title="Nuevos beneficios"
        subtitle="Recién incorporados"
        containerId="nuevos-container"
        benefits={curatedRows.nuevos}
        variant="new"
        commonLocation={sharedLocation}
      />

      {showCampaign && (
        <CampaignSpotlight
          tag={settings?.campaignTag || CAMPAIGN_DEFAULTS.tag}
          title={settings?.campaignTitle || CAMPAIGN_DEFAULTS.title}
          subtitle={settings?.campaignSubtitle || CAMPAIGN_DEFAULTS.subtitle}
          emoji={settings?.campaignEmoji}
          benefits={curatedRows.cafecitos}
        />
      )}

      {curatedRows.mas.length > 0 && (
        <section class="mx-auto max-w-[90rem] px-4 py-10 text-left sm:px-6 lg:px-8" aria-labelledby="home-more-title">
          <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
            <SectionHeading id="home-more-title" eyebrow="Catálogo completo" title="Más beneficios" size="md" />
            <Link href="/beneficios/" class="btn btn-outline">
              {benefitCount > curatedRows.mas.length ? `Ver los ${benefitCount} beneficios` : "Ver el catálogo"}
            </Link>
          </div>
          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {curatedRows.mas.map((benefit) => (
              <BenefitCard key={benefit.id} benefit={benefit} commonLocation={sharedLocation} />
            ))}
          </div>
        </section>
      )}

      {!user.value && <HaceteSocio variant="band" class="my-6" />}

      <EditorialCards />

      <SponsorMarquee sponsors={sponsorsData.value as any} />

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

const DESCRIPTION =
  "Portal oficial de beneficios de La Plata Rugby Club: descuentos en comercios adheridos, actividades en el club y sorteos para socios. Ingresá con tu DNI, generá tu cupón y mostralo antes de pagar.";

export const head: DocumentHead = {
  title: "Beneficios para socios - La Plata Rugby Club",
  meta: [
    { name: "description", content: DESCRIPTION },
    { property: "og:title", content: "Beneficios para la familia amarilla - La Plata Rugby Club" },
    { property: "og:description", content: DESCRIPTION },
  ],
};
