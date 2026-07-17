import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$, Link, useLocation, type DocumentHead, server$ } from "@builder.io/qwik-city";
import { searchBenefits, getFilters, type Benefit, ensureHeroSlidesSeeded, ensureGalleryTable, ensureMerchantRequestsTable } from "~/server/cache";
import { useLayoutUser } from "./layout";
import { CategorySlider } from "~/components/category-slider/category-slider";
import { OfferSlider } from "~/components/offer-slider/offer-slider";
import { BenefitCard } from "~/components/benefit-card/benefit-card";
import { HeroSlider } from "~/components/hero-slider/hero-slider";
import { CuratedRow } from "~/components/curated-row/curated-row";
import { EditorialCards } from "~/components/editorial-cards/editorial-cards";
import { SponsorMarquee } from "~/components/sponsor-marquee/sponsor-marquee";
import { PopupModal } from "~/components/popup-modal/popup-modal";
import { Gallery } from "~/components/gallery/gallery";
import { getSettings } from "~/server/chatbotDb";
import { getDB } from "~/db";
import { sponsors as sponsorsTable, heroSlides as heroSlidesTable, galleryImages as galleryImagesTable, merchantRequests } from "~/db/schema";
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

// Loader to fetch active gallery images sorted by display order
export const useGalleryData = routeLoader$(async (event) => {
  try {
    const db = getDB(event);
    await ensureGalleryTable(db);
    return await db
      .select()
      .from(galleryImagesTable)
      .where(eq(galleryImagesTable.isActive, 1))
      .orderBy(asc(galleryImagesTable.orderIndex));
  } catch (err) {
    console.error("Failed to load gallery images on home:", err);
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
  const isMap = url.searchParams.get("vista") === "mapa";

  const searchResult = await searchBenefits({
    query, categoryId, locationId, offerId, page,
    limit: isMap ? 1000 : 12,
    requestEvent: event,
  });

  const filters = await getFilters(event);

  let settings = null;
  try { settings = await getSettings(event); } catch (err) { console.error("Failed to load settings in homepage loader:", err); }

  let curatedRows = null;
  if (!query && !categoryId && !locationId && !offerId && page === 1) {
    try {
      const all = await searchBenefits({ limit: 1000, requestEvent: event });
      const items = all.data;
      
      let cafecitos: Benefit[] = [];
      if (settings?.campaignBenefitIds) {
        const selectedSlugsOrIds = settings.campaignBenefitIds.split(",").map(s => s.trim()).filter(Boolean);
        if (selectedSlugsOrIds.length > 0) {
          const matchedBenefitsMap = new Map<string, Benefit>();
          for (const b of items) {
            matchedBenefitsMap.set(String(b.id), b);
            matchedBenefitsMap.set(b.url, b);
          }
          cafecitos = selectedSlugsOrIds
            .map(slugOrId => matchedBenefitsMap.get(slugOrId))
            .filter((b): b is Benefit => !!b)
            .slice(0, 8);
        }
      }

      if (cafecitos.length === 0) {
        const queryTerms = (settings?.campaignQuery || "cafe,café,desayuno,factura,gastronomia,gastro").split(",").map(term => term.trim().toLowerCase()).filter(Boolean);
        cafecitos = items.filter(b => {
          const tl = b.titulo.toLowerCase(); const dl = b.descripcion.toLowerCase(); const rl = b.resumen.toLowerCase();
          return queryTerms.some(term => tl.includes(term) || dl.includes(term) || rl.includes(term) || b.categorias.some(c => c.descripcion.toLowerCase().includes(term)));
        }).slice(0, 4);
      }
      const parseDate = (dateStr?: string) => {
        if (!dateStr) return 0;
        const normalized = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
        const date = new Date(normalized);
        return isNaN(date.getTime()) ? 0 : date.getTime();
      };
      const gold = items.filter(b => b.isFeatured).slice(0, 6);
      const nuevos = items
        .filter(b => !b.isFeatured)
        .sort((a, b) => parseDate(b.created_at) - parseDate(a.created_at))
        .slice(0, 6);
      curatedRows = { gold, nuevos, cafecitos };
    } catch (e) { console.error("Failed to compile curated rows:", e); }
  }

  let slides: any[] = [];
  try {
    const db = getDB(event);
    await ensureHeroSlidesSeeded(db);
    slides = await db.select().from(heroSlidesTable).where(eq(heroSlidesTable.isActive, 1)).orderBy(asc(heroSlidesTable.orderIndex));
  } catch (err) {
    console.error("Failed to load slides on homepage:", err);
    slides = [
      { id: "s1", imageUrl: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/23-PHOTO-2026-05-05-16-00-15.jpg", title: "Beneficios de Temporada", subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos." },
      { id: "s2", imageUrl: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/24-23-930289de-f986-4060-b33c-2858b5b7ddef.jpg", title: "Salud & Cuidado", subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos." },
    ];
  }

  return { searchResult, filters, curatedRows, slides, settings, activeFilters: { query, categoryId, locationId, offerId, page } };
});

export const submitMerchantRequest = server$(async function (data: {
  businessName: string; category: string; contactName: string; email: string; phone: string; proposal: string;
}) {
  try {
    const db = getDB(this);
    try {
      await ensureMerchantRequestsTable(db);
    } catch { console.info("merchant_requests table check completed."); }
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
  const user = useLayoutUser();
  const sponsorsData = useSponsorsData();
  const galleryData = useGalleryData();
  const showPopup = useSignal(false);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const isClosed = (window as any).__popupClosed;
    if (!isClosed && location.url.pathname === "/" && data.value.settings?.popupActive) {
      showPopup.value = true;
    }
  });

  const { searchResult, filters, curatedRows, slides, settings } = data.value;
  const { data: benefits } = searchResult;

  return (
    <div class="relative min-h-screen bg-slate-50">
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
          {settings?.campaignActive !== false && curatedRows.cafecitos && curatedRows.cafecitos.length > 0 && (() => {
            const cafecitosCount = curatedRows.cafecitos.length;
            let gridColsClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"; // default fallback
            if (cafecitosCount === 1) {
              gridColsClass = "grid-cols-1 max-w-sm mx-auto";
            } else if (cafecitosCount === 2) {
              gridColsClass = "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto";
            } else if (cafecitosCount === 3) {
              // 2 columnas en resoluciones medias (evita títulos truncados), 3 solo en pantallas grandes
              gridColsClass = "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
            } else {
              gridColsClass = "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4";
            }

            return (
              <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-10 print:hidden text-left animate-fade-in-up">
                <div class="bg-gradient-to-br from-[#0B1527] to-[#020617] border border-slate-800/80 rounded-4xl sm:rounded-[3rem] p-6 sm:p-8 md:p-12 shadow-2xl flex flex-col xl:flex-row xl:items-stretch gap-8 xl:gap-12 relative overflow-hidden">
                  <div class="absolute -right-16 -top-16 w-60 h-60 bg-brand-gold/10 rounded-full blur-[80px] pointer-events-none" />
                  <div class="absolute -left-16 -bottom-16 w-60 h-60 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />
                  
                  {/* Left Column: Spotlight Info */}
                  <div class="w-full xl:w-[320px] xl:shrink-0 flex flex-col justify-between space-y-6 relative z-10 text-white">
                    <div class="space-y-5">
                      {/* Tag pill */}
                      <div class="inline-flex items-center space-x-2 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-3.5 py-1.5 w-fit">
                        <span class="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse"></span>
                        <span class="text-[10px] font-black tracking-widest text-brand-gold uppercase">
                          {settings?.campaignTag || "Selección Especial"}
                        </span>
                      </div>

                      {/* Floating Emoji card + Title */}
                      <div class="space-y-4">
                        <div class="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center text-3xl shadow-lg shadow-black/25 animate-float">
                          <span>{settings?.campaignEmoji || "🎁"}</span>
                        </div>
                        <h2 class="text-3xl sm:text-4xl md:text-5xl font-display font-black text-white tracking-tight leading-tight text-balance">
                          {settings?.campaignTitle || "Especial de Temporada"}
                        </h2>
                      </div>

                      <p class="text-sm text-slate-400 font-medium leading-relaxed max-w-md">
                        {settings?.campaignSubtitle || "Disfrutá de beneficios exclusivos seleccionados especialmente para vos con tu credencial digital AMP+."}
                      </p>
                    </div>

                    <div class="pt-2">
                      <Link
                        href="/beneficios?campana=true"
                        class="group inline-flex items-center space-x-2 px-6 py-3 rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-light hover:from-white hover:to-white text-slate-950 font-black uppercase tracking-wider text-xs transition-all duration-350 shadow-lg hover:shadow-brand-gold/20 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                      >
                        <span>Ver todos</span>
                        <span class="transform group-hover:translate-x-1 transition-transform duration-300">&rarr;</span>
                      </Link>
                    </div>
                  </div>

                  {/* Right Column: Dynamic grid of benefits */}
                  <div class="w-full xl:flex-1 relative z-10 flex items-center">
                    <div class={`grid gap-5 sm:gap-6 w-full ${gridColsClass}`}>
                      {curatedRows.cafecitos.map((benefit: Benefit) => {
                        const discountText = benefit.resumen.replace("Descuento del", "").trim();
                        const isLongDiscount = discountText.length > 12;

                        return (
                          <Link
                            key={`coffee-${benefit.id}`}
                            href={`/beneficio/${benefit.url}`}
                            class="group flex flex-col justify-between h-full bg-slate-950/40 hover:bg-slate-900/70 border border-white/5 hover:border-brand-gold/30 rounded-3xl p-4 transition-all duration-350 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(212,163,23,0.12)] relative"
                          >
                            <div class="flex h-full flex-col">
                              {/* Card Image Container */}
                              <div class="relative aspect-video rounded-2xl overflow-hidden bg-white flex items-center justify-center p-3">
                                {benefit.imagen ? (
                                  <img
                                    src={
                                      benefit.imagen.startsWith('http') || benefit.imagen.startsWith('/')
                                        ? benefit.imagen
                                        : `https://beneficios.amepla.org.ar/files/${benefit.imagen}`
                                    }
                                    alt={benefit.titulo}
                                    class="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-500"
                                    width={200}
                                    height={112}
                                    loading="lazy"
                                  />
                                ) : (
                                  <span class="text-brand-gold font-display font-extrabold text-base">AMP+</span>
                                )}

                                {/* Marco consistente sobre fondo blanco para integrar los logos con la tarjeta */}
                                <div class="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5" />

                                {/* Overlay discount badge (only if short) */}
                                <div class="absolute bottom-2 right-2 z-10">
                                  <span class="inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black bg-brand-gold text-slate-950 shadow-lg tracking-tight border border-white/10">
                                    {isLongDiscount ? "Promo" : discountText}
                                  </span>
                                </div>
                              </div>

                              {/* Bloque de texto/badges: altura reservada y alineado abajo para que los títulos coincidan */}
                              <div class="mt-3.5 flex flex-1 flex-col justify-end gap-2 min-h-[6.5rem]">
                                {/* Long discount tag: cada elemento en su línea, permite 2 líneas sin pisar la ubicación */}
                                {isLongDiscount && (
                                  <div class="flex items-start gap-1.5 self-start bg-brand-gold/10 border border-brand-gold/20 rounded-xl px-2.5 py-1.5">
                                    <span class="text-brand-gold text-[10px] leading-tight mt-px">✨</span>
                                    <span class="text-brand-gold text-[10px] font-extrabold uppercase tracking-wide line-clamp-2 leading-tight">
                                      {discountText}
                                    </span>
                                  </div>
                                )}

                                <div class="text-left space-y-1">
                                  <h4 class="text-[10px] font-extrabold text-brand-gold uppercase tracking-wider line-clamp-1">
                                    {benefit.ubicacion[0]?.descripcion || "La Plata"}
                                  </h4>
                                  <h3 class="text-sm font-display font-bold text-slate-200 group-hover:text-white line-clamp-2 leading-snug min-h-[2.5rem]">
                                    {benefit.titulo}
                                  </h3>
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* Editorial Cards + Modals */}
          <EditorialCards user={user} />

          {/* Sponsors Marquee */}
          <SponsorMarquee sponsors={sponsorsData.value as any} />

          {/* Photo Gallery */}
          {galleryData.value.length > 0 && <Gallery images={galleryData.value} />}
        </>
      )}

      {/* All Benefits Preview */}
      <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div class="border-b border-slate-200 pb-5 mb-8 text-left animate-fade-in-up">
          <h2 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">Ver todos los beneficios</h2>
          <p class="text-slate-500 text-sm mt-2 font-medium">Explorá nuestra cartilla de descuentos exclusivos</p>
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
        <div class="flex justify-center pt-10 mt-8 border-t border-slate-200/60">
          <Link href="/beneficios" class="inline-flex items-center justify-center space-x-2.5 py-4 px-12 rounded-[2rem] bg-brand-green text-white hover:bg-brand-green-light font-black text-base shadow-lg shadow-brand-green/20 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border border-transparent">
            <span>Ver todos</span>
            <svg class="w-5 h-5 stroke-current fill-none stroke-[2.5] transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </Link>
        </div>
      </div>

      {/* Configurable Popup Modal */}
      {showPopup.value && settings && (
        <PopupModal
          settings={settings}
          onClose$={() => {
            showPopup.value = false;
            (window as any).__popupClosed = true;
          }}
        />
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "Portal de Beneficios Oficial - Agremiación Médica Platense",
  meta: [
    { name: "description", content: "Exclusivo club de beneficios para agremiados y empleados de la AMP. Disfrutá de más de 250 comercios con descuentos especiales, promociones, y sorteos increíbles." },
    { property: "og:title", content: "Portal de Beneficios Oficial - Agremiación Médica Platense" },
    { property: "og:description", content: "Ahorrá y disfrutá con la cartilla de beneficios médicos de la AMP. Descuentos en turismo, gastronomía, indumentaria, belleza y mucho más." }
  ]
};
