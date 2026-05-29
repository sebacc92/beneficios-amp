import { component$, useSignal, $, useVisibleTask$ } from "@builder.io/qwik";
import { routeLoader$, Link, useLocation, type DocumentHead, server$ } from "@builder.io/qwik-city";
import { searchBenefits, getFilters, type Benefit, ensureHeroSlidesSeeded } from "~/server/cache";
import { useLayoutUser } from "./layout";
import { getSettings } from "~/server/chatbotDb";
import { getDB } from "~/db";
import { sponsors as sponsorsTable, heroSlides as heroSlidesTable, merchantRequests } from "~/db/schema";
import { asc, eq } from "drizzle-orm";
import {
  LuSmartphone,
  LuGift,
  LuStore,
  LuUtensils,
  LuPlane,
  LuShirt,
  LuHeartPulse,
  LuDumbbell,
  LuFilm,
  LuHome,
  LuCar,
  LuTags,
  LuCompass,
  LuHotel,
  LuShoppingBag,
  LuSparkles,
  LuCalendar,
  LuCamera,
  LuGraduationCap,
  LuCreditCard
} from "@qwikest/icons/lucide";

// Loader to fetch sponsors grid layout
export const useSponsorsData = routeLoader$(async (event) => {
  try {
    const db = getDB(event);
    return await db.select().from(sponsorsTable).orderBy(sponsorsTable.y, sponsorsTable.x);
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
    query,
    categoryId,
    locationId,
    offerId,
    page,
    limit: isMap ? 1000 : 12,
    requestEvent: event,
    isPremiumOnly: isGoldOnly
  });

  const filters = await getFilters();

  let settings = null;
  try {
    settings = await getSettings(event);
  } catch (err) {
    console.error("Failed to load settings in homepage loader:", err);
  }

  let curatedRows = null;
  if (!query && !categoryId && !locationId && !offerId && !isGoldOnly && page === 1) {
    try {
      // Fetch a wider set of benefits to populate curated rows
      const all = await searchBenefits({
        limit: 60,
        requestEvent: event
      });
      const items = all.data;

      // Curate themed campaign benefits based on dynamic settings query
      const queryTerms = (settings?.campaignQuery || "cafe,café,desayuno,factura,gastronomia,gastro")
        .split(",")
        .map(term => term.trim().toLowerCase())
        .filter(Boolean);

      const cafecitos = items.filter(b => {
        const titleLower = b.titulo.toLowerCase();
        const descLower = b.descripcion.toLowerCase();
        const resLower = b.resumen.toLowerCase();
        return queryTerms.some(term =>
          titleLower.includes(term) ||
          descLower.includes(term) ||
          resLower.includes(term) ||
          b.categorias.some(c => c.descripcion.toLowerCase().includes(term))
        );
      }).slice(0, 4);

      // Curate themed rows with distinct slices of live data
      const gold = items.filter(b => b.isPremiumOnly).slice(0, 6);
      const destacados = items.filter(b => b.isFeatured && !b.isPremiumOnly).slice(0, 6);
      const nuevos = items.filter(b => !b.isFeatured && !b.isPremiumOnly).slice(0, 6);

      curatedRows = {
        gold,
        destacados,
        nuevos,
        cafecitos
      };
    } catch (e) {
      console.error("Failed to compile curated rows:", e);
    }
  }

  let slides: any[] = [];
  try {
    const db = getDB(event);
    await ensureHeroSlidesSeeded(db);
    slides = await db.select().from(heroSlidesTable).where(eq(heroSlidesTable.isActive, 1)).orderBy(asc(heroSlidesTable.orderIndex));
  } catch (err) {
    console.error("Failed to load slides on homepage:", err);
    slides = [
      { id: "s1", imageUrl: "https://beneficios.amepla.org.ar/images/slider/23-PHOTO-2026-05-05-16-00-15.jpg", title: "Beneficios de Temporada", subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos." },
      { id: "s2", imageUrl: "https://beneficios.amepla.org.ar/images/slider/24-23-930289de-f986-4060-b33c-2858b5b7ddef.jpg", title: "Salud & Cuidado", subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos." },
      { id: "s3", imageUrl: "https://beneficios.amepla.org.ar/images/slider/-DAZZLER SLIDE.jpg", title: "Hotelería Dazzler", subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos." },
    ];
  }

  return {
    searchResult,
    filters,
    curatedRows,
    slides,
    settings,
    activeFilters: {
      query,
      categoryId,
      locationId,
      offerId,
      page
    }
  };
});

export const submitMerchantRequest = server$(async function(data: {
  businessName: string;
  category: string;
  contactName: string;
  email: string;
  phone: string;
  proposal: string;
}) {
  try {
    const db = getDB(this);
    // Auto-create table dynamically on runtime if not exists
    try {
      const { sql } = await import("drizzle-orm");
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS merchant_requests (
          id TEXT PRIMARY KEY,
          business_name TEXT NOT NULL,
          category TEXT NOT NULL,
          contact_name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT NOT NULL,
          proposal TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL
        )
      `);
    } catch {
      console.info("merchant_requests table check completed.");
    }

    const id = Math.random().toString(36).substring(2, 9);
    await db.insert(merchantRequests).values({
      id,
      businessName: data.businessName,
      category: data.category,
      contactName: data.contactName,
      email: data.email,
      phone: data.phone,
      proposal: data.proposal,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    return { success: true, message: "¡Solicitud enviada con éxito!" };
  } catch (err) {
    console.error("Error inserting merchant request:", err);
    return { success: false, message: "Hubo un error al procesar tu solicitud." };
  }
});

const getCategoryIcon = (desc: string) => {
  const d = desc.toLowerCase();
  if (d.includes("gastro") || d.includes("restaurante") || d.includes("comida") || d.includes("café")) return <LuUtensils class="w-14 h-14 text-current stroke-[1.5]" />;
  if (d.includes("turismo") || d.includes("viaje") || d.includes("hotel") || d.includes("alojamiento")) return <LuPlane class="w-14 h-14 text-current stroke-[1.5]" />;
  if (d.includes("moda") || d.includes("ropa") || d.includes("indumentaria") || d.includes("calzado")) return <LuShirt class="w-14 h-14 text-current stroke-[1.5]" />;
  if (d.includes("estética") || d.includes("belleza") || d.includes("peluquería")) return <LuSparkles class="w-14 h-14 text-current stroke-[1.5]" />;
  if (d.includes("salud") || d.includes("cuidado") || d.includes("farmacia") || d.includes("ortopedia") || d.includes("médic")) return <LuHeartPulse class="w-14 h-14 text-current stroke-[1.5]" />;
  if (d.includes("deporte") || d.includes("gimnasio") || d.includes("club") || d.includes("fitness")) return <LuDumbbell class="w-14 h-14 text-current stroke-[1.5]" />;
  if (d.includes("entretenimiento") || d.includes("cine") || d.includes("teatro") || d.includes("espectáculo")) return <LuFilm class="w-14 h-14 text-current stroke-[1.5]" />;
  if (d.includes("evento") || d.includes("fiesta") || d.includes("reunión")) return <LuCalendar class="w-14 h-14 text-current stroke-[1.5]" />;
  if (d.includes("fotografía") || d.includes("foto")) return <LuCamera class="w-14 h-14 text-current stroke-[1.5]" />;
  if (d.includes("educación") || d.includes("curso") || d.includes("colegio") || d.includes("universidad") || d.includes("librería")) return <LuGraduationCap class="w-14 h-14 text-current stroke-[1.5]" />;
  if (d.includes("banco") || d.includes("financiero") || d.includes("seguro") || d.includes("crédito")) return <LuCreditCard class="w-14 h-14 text-current stroke-[1.5]" />;
  if (d.includes("compras") || d.includes("supermercado") || d.includes("regalo") || d.includes("mayorista")) return <LuShoppingBag class="w-14 h-14 text-current stroke-[1.5]" />;
  if (d.includes("hogar") || d.includes("deco") || d.includes("mueble") || d.includes("inmobiliari") || d.includes("construc")) return <LuHome class="w-14 h-14 text-current stroke-[1.5]" />;
  if (d.includes("servicio") || d.includes("auto") || d.includes("taller") || d.includes("mecánica")) return <LuCar class="w-14 h-14 text-current stroke-[1.5]" />;
  return <LuTags class="w-14 h-14 text-current stroke-[1.5]" />;
};

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
  return `Hace ${diffMonths} meses`;
};

export default component$(() => {
  const location = useLocation();
  const data = useBenefitsData();
  const currentSlide = useSignal(0);
  const user = useLayoutUser();
  const sponsorsData = useSponsorsData();

  const isCredentialModalOpen = useSignal(false);
  const isRaffleModalOpen = useSignal(false);
  const isMerchantModalOpen = useSignal(false);

  const merchantBusinessName = useSignal("");
  const merchantCategory = useSignal("");
  const merchantContactName = useSignal("");
  const merchantEmail = useSignal("");
  const merchantPhone = useSignal("");
  const merchantProposal = useSignal("");
  const isMerchantSubmitting = useSignal(false);
  const merchantSubmitSuccess = useSignal(false);
  const merchantSubmitError = useSignal("");

  const showPopup = useSignal(false);

  const scrollContainer = $((id: string, direction: "left" | "right") => {
    const container = document.getElementById(id);
    if (container) {
      const scrollAmount = 340;
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  });

  useVisibleTask$(() => {
    const isClosed = (window as any).__popupClosed;
    if (!isClosed && location.url.pathname === "/" && data.value.settings?.popupActive) {
      showPopup.value = true;
    }
  });





  const { searchResult, filters, curatedRows, slides, settings } = data.value;
  const { data: benefits } = searchResult;

  // Navigation handlers
  const handlePrevSlide = $(() => {
    currentSlide.value = (currentSlide.value - 1 + slides.length) % slides.length;
  });

  const handleNextSlide = $(() => {
    currentSlide.value = (currentSlide.value + 1) % slides.length;
  });



  return (
    <div class="relative min-h-screen bg-slate-50">
      {/* Main Curated Showcase for Page 1 Home (When not in map mode, no filters are active, and not showing all) */}
      {curatedRows && (
        <>
          {/* 1. Optimized Hero Slider (Carousel) - Full Bleed Width */}
          <section class="relative w-full h-[340px] md:h-[480px] lg:h-auto lg:aspect-[1600/646] bg-[#020617] overflow-hidden print:hidden group">
            {/* Slides */}
            <div class="relative w-full h-full flex items-center">
              {slides.map((slide, idx) => (
                <div
                  key={slide.id || idx}
                  class={`absolute inset-0 w-full h-full transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) ${idx === currentSlide.value ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0 pointer-events-none"
                    }`}
                >
                  <div class="absolute inset-0 bg-gradient-to-t from-[#020617]/95 via-[#020617]/40 to-transparent z-10" />
                  {/* Desktop Image */}
                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    fetchPriority={idx === 0 ? "high" : "low"}
                    loading={idx === 0 ? "eager" : "lazy"}
                    class="hidden md:block w-full h-full object-cover select-none group-hover:scale-105 transition-transform duration-1000"
                    width={1600}
                    height={646}
                  />
                  {/* Mobile Image */}
                  <img
                    src={slide.imageMobile || slide.imageUrl}
                    alt={slide.title}
                    fetchPriority={idx === 0 ? "high" : "low"}
                    loading={idx === 0 ? "eager" : "lazy"}
                    class="block md:hidden w-full h-full object-cover select-none group-hover:scale-105 transition-transform duration-1000"
                    width={480}
                    height={600}
                  />
                  <div class="absolute bottom-12 left-6 md:left-14 lg:left-20 z-20 max-w-2xl text-white text-left">
                    <span class="inline-flex items-center px-5 py-2 rounded-full text-[12px] font-black bg-brand-gold text-brand-green-dark mb-4 shadow-lg tracking-widest uppercase border border-white/10">
                      {slide.preTitle || "Exclusivo AMP+"}
                    </span>
                    <h2 class="text-5xl md:text-6xl font-display font-black tracking-tight drop-shadow-md text-white mb-3 leading-none">
                      {slide.title}
                    </h2>
                    <p class="text-slate-100 text-base md:text-lg drop-shadow font-medium max-w-xl leading-relaxed">
                      {slide.subtitle || "Presentá tu credencial digital y disfrutá de los mejores descuentos."}
                    </p>
                    {slide.buttonText && (
                      <a
                        href={slide.buttonLink || "/"}
                        class="inline-flex items-center justify-center mt-5 px-8 py-3.5 rounded-full bg-brand-gold hover:bg-brand-gold-light text-brand-green-dark text-sm font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        {slide.buttonText}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Carousel Prev/Next Buttons */}
            {slides.length > 1 && (
              <>
                <button
                  onClick$={handlePrevSlide}
                  class="absolute left-6 top-1/2 -translate-y-1/2 z-20 w-14 h-14 flex items-center justify-center rounded-full bg-black/35 hover:bg-brand-gold/90 text-white hover:text-brand-green-dark border border-white/20 hover:border-transparent transition-all duration-300 backdrop-blur-sm cursor-pointer shadow-md"
                  aria-label="Slide anterior"
                >
                  <svg class="w-7 h-7 stroke-current" fill="none" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick$={handleNextSlide}
                  class="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-14 h-14 flex items-center justify-center rounded-full bg-black/35 hover:bg-brand-gold/90 text-white hover:text-brand-green-dark border border-white/20 hover:border-transparent transition-all duration-300 backdrop-blur-sm cursor-pointer shadow-md"
                  aria-label="Próximo slide"
                >
                  <svg class="w-7 h-7 stroke-current" fill="none" viewBox="0 0 24 24" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {/* Slide Indicators */}
            {slides.length > 1 && (
              <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex space-x-2.5">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick$={() => (currentSlide.value = idx)}
                    class={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === currentSlide.value ? "bg-brand-gold w-7" : "bg-white/55 hover:bg-white/80"
                      }`}
                    aria-label={`Ir al slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Beautiful Horizontal Category Slider Bar */}
          <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8 print:hidden text-left">
            <p class="text-[13px] font-black tracking-widest text-slate-450 uppercase mb-5 pl-1">Explorá por Categoría</p>
            <div class="flex items-center space-x-4 overflow-x-auto pb-3 scrollbar-none">
              {filters.categorias
                .filter((c: any) => (c.beneficios_count || 0) > 0)
                .map((cat: any) => {
                  const icon = getCategoryIcon(cat.descripcion);
                  return (
                    <Link
                      key={cat.id}
                      href={`/beneficios?categoria=${cat.id}`}
                      class="flex flex-col items-center justify-center text-center p-4 rounded-[2.5rem] border transition-all duration-300 w-[164px] h-[164px] flex-shrink-0 select-none cursor-pointer group bg-white border-slate-200 text-slate-700 hover:border-brand-green/45 hover:shadow-md hover:scale-105"
                    >
                      <span class="flex items-center justify-center transition-transform duration-300 text-slate-400 group-hover:text-brand-green group-hover:scale-110">
                        {icon}
                      </span>
                      <span class="text-[12px] font-black uppercase tracking-wider mt-4 truncate max-w-[148px]">
                        {cat.descripcion}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </div>

          {/* Row Gold: Beneficios Gold (Premium Exclusivos) */}
          {curatedRows.gold && curatedRows.gold.length > 0 && (
            <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 print:hidden text-left">
              <div class="flex items-end justify-between border-b border-slate-200/60 pb-3 mb-6">
                <div class="space-y-1">
                  <div class="flex items-center space-x-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse"></span>
                    <span class="text-[11px] font-black tracking-widest text-brand-gold uppercase">Selección Exclusiva Gold</span>
                  </div>
                  <h2 class="text-2xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
                    Beneficios Gold
                  </h2>
                </div>
                {/* Arrow navigation buttons */}
                <div class="flex items-center space-x-2 pb-0.5">
                  <button
                    type="button"
                    onClick$={() => scrollContainer("gold-container", "left")}
                    class="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-sm transition-all active:scale-90 cursor-pointer"
                    aria-label="Anterior"
                  >
                    <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick$={() => scrollContainer("gold-container", "right")}
                    class="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-sm transition-all active:scale-90 cursor-pointer"
                    aria-label="Siguiente"
                  >
                    <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              <div id="gold-container" class="flex items-center space-x-6 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
                {curatedRows.gold.map((benefit: Benefit) => (
                  <div key={`gold-${benefit.id}`} class="w-[280px] sm:w-[320px] flex-shrink-0 snap-start select-none">
                    <Link
                      href={`/beneficio/${benefit.url}`}
                      class="group block bg-[#091522] border border-[#d4af37]/35 rounded-[1.8rem] overflow-hidden shadow-xl hover:shadow-[#d4af37]/10 hover:-translate-y-1 transition-all duration-300 relative h-[348px]"
                    >
                      <div class="relative h-44 bg-slate-900 overflow-hidden flex items-center justify-center">
                        {benefit.imagen ? (
                          <img
                            src={benefit.imagen.startsWith('http') || benefit.imagen.startsWith('/') ? benefit.imagen : `https://beneficios.amepla.org.ar/files/${benefit.imagen}`}
                            alt={benefit.titulo}
                            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                            width={320}
                            height={176}
                            loading="lazy"
                          />
                        ) : (
                          <div class="flex flex-col items-center justify-center p-6 text-center h-full w-full bg-gradient-to-br from-slate-950 to-slate-900">
                            <span class="text-brand-gold font-display font-black text-2xl">AMP+ GOLD</span>
                            <span class="text-slate-400 text-[11px] font-bold uppercase tracking-wider mt-1">{benefit.categorias[0]?.descripcion}</span>
                          </div>
                        )}
                        <div class="absolute top-3.5 left-3.5 z-10">
                          <span class="inline-flex items-center px-3.5 py-1 rounded-full text-[11px] font-black bg-brand-gold text-slate-950 uppercase tracking-widest shadow-sm">
                            {benefit.categorias[0]?.descripcion || "Premium"}
                          </span>
                        </div>
                        <div class="absolute top-3.5 right-3.5 z-10">
                          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-950/80 text-brand-gold backdrop-blur-sm tracking-wider">
                            ★ GOLD
                          </span>
                        </div>
                      </div>
                      <div class="p-6 flex flex-col justify-between h-[172px] bg-[#091522] text-left">
                        <div class="space-y-1">
                          <h3 class="text-[13px] font-black text-brand-gold/80 uppercase tracking-wider truncate">
                            {benefit.ubicacion[0]?.descripcion || "La Plata"}
                          </h3>
                          <h4 class="text-[17px] font-display font-extrabold text-white line-clamp-2 leading-snug group-hover:text-brand-gold transition-colors duration-200">
                            {benefit.titulo}
                          </h4>
                        </div>
                        <div class="flex items-center justify-between pt-3 border-t border-slate-800">
                          <span class="text-[12.5px] font-black text-brand-gold/70 uppercase tracking-wider">Membresía Gold</span>
                          <span class="inline-flex items-center px-4.5 py-2 rounded-xl text-[15px] font-black bg-brand-gold text-slate-950 shadow-md uppercase tracking-wide border border-[#d4af37]/30">
                            {benefit.resumen.replace("Descuento del", "").trim()}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}



          {/* Row 3: Nuevos Beneficios */}
          {curatedRows.nuevos && curatedRows.nuevos.length > 0 && (
            <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 print:hidden text-left">
              <div class="flex items-end justify-between border-b border-slate-200/60 pb-3 mb-6">
                <div class="space-y-1">
                  <div class="flex items-center space-x-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span class="text-[11px] font-black tracking-widest text-emerald-650 uppercase">Recién incorporados</span>
                  </div>
                  <h2 class="text-2xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
                    Nuevos Beneficios
                  </h2>
                </div>
                {/* Arrow navigation buttons */}
                <div class="flex items-center space-x-2 pb-0.5">
                  <button
                    type="button"
                    onClick$={() => scrollContainer("nuevos-container", "left")}
                    class="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-sm transition-all active:scale-90 cursor-pointer"
                    aria-label="Anterior"
                  >
                    <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick$={() => scrollContainer("nuevos-container", "right")}
                    class="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-sm transition-all active:scale-90 cursor-pointer"
                    aria-label="Siguiente"
                  >
                    <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              <div id="nuevos-container" class="flex items-center space-x-6 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
                {curatedRows.nuevos.map((benefit: Benefit) => {
                  const dateVal = benefit.created_at || (benefit as any).createdAt;
                  const timeAgo = getTimeAgo(dateVal);
                  const formattedDate = formatDate(dateVal);
                  return (
                    <div key={`new-${benefit.id}`} class="w-[280px] sm:w-[320px] flex-shrink-0 snap-start select-none">
                      <Link
                        href={`/beneficio/${benefit.url}`}
                        class="group block bg-white border border-slate-100 rounded-[1.8rem] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative h-[372px]"
                      >
                        <div class="relative h-44 bg-slate-100 overflow-hidden flex items-center justify-center">
                          {benefit.imagen ? (
                            <img
                              src={benefit.imagen.startsWith('http') || benefit.imagen.startsWith('/') ? benefit.imagen : `https://beneficios.amepla.org.ar/files/${benefit.imagen}`}
                              alt={benefit.titulo}
                              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              width={320}
                              height={176}
                              loading="lazy"
                            />
                          ) : (
                            <div class="flex flex-col items-center justify-center p-6 text-center h-full w-full bg-gradient-to-br from-slate-50 to-slate-100">
                              <span class="text-brand-green-dark font-display font-black text-2xl">AMP+</span>
                              <span class="text-slate-400 text-[11px] font-bold uppercase tracking-wider mt-1">{benefit.categorias[0]?.descripcion}</span>
                            </div>
                          )}
                          <div class="absolute top-3 left-3 z-10 flex items-center justify-between w-[calc(100%-1.5rem)]">
                            <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-[9.5px] font-black bg-slate-950/60 text-slate-100 backdrop-blur-sm border border-slate-800/40 uppercase tracking-widest leading-none">
                              {benefit.categorias[0]?.descripcion || "Especial"}
                            </span>
                            <span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-slate-950/70 text-emerald-400 backdrop-blur-sm border border-emerald-500/25 tracking-widest uppercase leading-none">
                              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              <span>{timeAgo}</span>
                            </span>
                          </div>
                        </div>
                        <div class="p-6 flex flex-col justify-between h-[196px] bg-white text-left">
                          <div class="space-y-1.5">
                            <h3 class="text-[12px] font-black text-slate-400 uppercase tracking-widest truncate leading-none">
                              {benefit.ubicacion[0]?.descripcion || "La Plata"}
                            </h3>
                            <h4 class="text-[15.5px] font-display font-extrabold text-slate-800 line-clamp-2 leading-snug group-hover:text-brand-green transition-colors duration-200">
                              {benefit.titulo}
                            </h4>
                          </div>
                          <div class="flex items-center justify-between pt-3 border-t border-slate-100">
                            <div class="flex items-center space-x-2 text-left">
                              <div class="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div class="flex flex-col">
                                <span class="text-[8.5px] font-black text-slate-400 uppercase tracking-widest leading-none">Inicio</span>
                                <span class="text-[12px] font-bold text-slate-600 tracking-tight mt-0.5 leading-none">{formattedDate}</span>
                              </div>
                            </div>
                            <span class="inline-flex items-center px-3 py-1.5 rounded-lg text-[13px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100/70 shadow-sm uppercase tracking-wide">
                              {benefit.resumen.replace("Descuento del", "").trim()}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Curated Spotlight Section: Dynamic Campaigns & Specials */}
          {settings?.campaignActive !== false && curatedRows.cafecitos && curatedRows.cafecitos.length > 0 && (
            <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-10 print:hidden text-left">
              <div class="bg-gradient-to-br from-[#0B1527] to-[#020617] border border-slate-800 rounded-[3rem] p-8 md:p-12 shadow-xl grid grid-cols-1 lg:grid-cols-4 gap-8 items-center relative overflow-hidden">
                <div class="absolute -right-16 -top-16 w-60 h-60 bg-brand-gold/10 rounded-full blur-[80px] pointer-events-none" />
                <div class="absolute -left-16 -bottom-16 w-60 h-60 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

                {/* Left column info */}
                <div class="lg:col-span-1 space-y-5 relative z-10 text-white flex flex-col justify-center h-full">
                  <div class="inline-flex items-center space-x-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse"></span>
                    <span class="text-[11px] font-black tracking-widest text-brand-gold uppercase">
                      {settings?.campaignTag || "Selección Especial"}
                    </span>
                  </div>
                  <h2 class="text-4xl md:text-5xl font-display font-black text-white tracking-tight leading-tight">
                    {settings?.campaignEmoji || "🎁"} {settings?.campaignTitle || "Especial de Temporada"}
                  </h2>
                  <p class="text-sm text-slate-450 font-medium leading-relaxed">
                    {settings?.campaignSubtitle || "Disfrutá de beneficios exclusivos seleccionados especialmente para vos con tu credencial digital AMP+."}
                  </p>
                  <div class="pt-2">
                    <Link
                      href={`/beneficios?buscar=${encodeURIComponent((settings?.campaignQuery || "café").split(",")[0])}`}
                      class="inline-flex items-center space-x-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white text-white hover:text-slate-900 border border-white/10 hover:border-transparent text-sm font-black uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer"
                    >
                      <span>Ver todos</span>
                      <span class="text-sm">&rarr;</span>
                    </Link>
                  </div>
                </div>

                {/* Right column coffee cards grid */}
                <div class="lg:col-span-3">
                  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                    {curatedRows.cafecitos.map((benefit: Benefit) => (
                      <Link
                        key={`coffee-${benefit.id}`}
                        href={`/beneficio/${benefit.url}`}
                        class="group block bg-slate-900/60 hover:bg-slate-900 border border-slate-800 rounded-3xl p-4 transition-all duration-300 hover:-translate-y-1 relative"
                      >
                        <div class="relative h-28 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center">
                          {benefit.imagen ? (
                            <img
                              src={benefit.imagen.startsWith('http') || benefit.imagen.startsWith('/') ? benefit.imagen : `https://beneficios.amepla.org.ar/files/${benefit.imagen}`}
                              alt={benefit.titulo}
                              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              width={200}
                              height={112}
                              loading="lazy"
                            />
                          ) : (
                            <span class="text-brand-gold font-display font-extrabold text-base">AMP+</span>
                          )}
                          <div class="absolute bottom-2 right-2 z-10">
                            <span class="inline-flex items-center px-3 py-1 rounded-xl text-[11px] font-black bg-brand-gold text-slate-950 shadow-lg tracking-tight border border-white/10">
                              {benefit.resumen.replace("Descuento del", "").trim()}
                            </span>
                          </div>
                        </div>
                        <div class="mt-3.5 text-left">
                          <h4 class="text-[11px] font-bold text-brand-gold uppercase tracking-wider truncate">
                            {benefit.ubicacion[0]?.descripcion || "La Plata"}
                          </h4>
                          <h3 class="text-sm font-display font-black text-slate-100 group-hover:text-white line-clamp-2 mt-1 leading-snug">
                            {benefit.titulo}
                          </h3>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 5. Editorial Space: Tu espacio Club AMP+ */}
          <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-14 print:hidden text-left">
            <div class="border-t border-slate-200/80 pt-12 mb-10 space-y-2">
              <p class="text-[11px] font-black tracking-widest text-slate-400 uppercase">Beneficios y Novedades</p>
              <h2 class="text-3xl sm:text-4xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
                Tu espacio Club AMP<span class="text-brand-gold">+</span>
              </h2>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
              <div 
                onClick$={() => isCredentialModalOpen.value = true}
                class="bg-white border border-slate-100 rounded-3xl p-10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
              >
                <LuSmartphone class="w-12 h-12 text-brand-green mb-6 stroke-[1.75] group-hover:scale-110 transition-transform duration-300" />
                <h3 class="text-xl sm:text-[22px] font-display font-black text-slate-800 leading-tight group-hover:text-brand-green transition-colors duration-200">Credencial Digital</h3>
                <p class="text-[15px] text-slate-500 mt-3.5 leading-relaxed font-medium">
                  Tu credencial digital médica integrada. Presentala en los comercios para validar tus descuentos al instante.
                </p>
              </div>

              <div 
                onClick$={() => isRaffleModalOpen.value = true}
                class="bg-white border border-slate-100 rounded-3xl p-10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
              >
                <LuGift class="w-12 h-12 text-brand-green mb-6 stroke-[1.75] group-hover:scale-110 transition-transform duration-300" />
                <h3 class="text-xl sm:text-[22px] font-display font-black text-slate-800 leading-tight group-hover:text-brand-green transition-colors duration-200">Sorteos de Fin de Mes</h3>
                <p class="text-[15px] text-slate-500 mt-3.5 leading-relaxed font-medium">
                  Visualizá los sorteos activos, el mecanismo oficial de participación y conocé a los ganadores previos.
                </p>
              </div>

              <div 
                onClick$={() => isMerchantModalOpen.value = true}
                class="bg-white border border-slate-100 rounded-3xl p-10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
              >
                <LuStore class="w-12 h-12 text-brand-green mb-6 stroke-[1.75] group-hover:scale-110 transition-transform duration-300" />
                <h3 class="text-xl sm:text-[22px] font-display font-black text-slate-800 leading-tight group-hover:text-brand-green transition-colors duration-200">Sumate al Club</h3>
                <p class="text-[15px] text-slate-500 mt-3.5 leading-relaxed font-medium">
                  ¿Querés sumar tu comercio o empresa al Club AMP+? Envianos tu solicitud y propuesta comercial al instante.
                </p>
              </div>
            </div>

            {/* Modal 1: Credencial Digital */}
            {isCredentialModalOpen.value && (
              <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                <div class="max-w-md w-full bg-white rounded-[2rem] p-8 shadow-2xl relative border border-slate-100 flex flex-col items-center text-center overflow-hidden">
                  <button 
                    onClick$={() => isCredentialModalOpen.value = false}
                    class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all"
                  >
                    ✕
                  </button>
                  
                  <div class="mb-6">
                    <span class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-brand-green/10 text-brand-green border border-brand-green/20 uppercase tracking-widest leading-none">
                      AMP+ Wallet
                    </span>
                  </div>

                  {user.value ? (
                    <div class="w-full space-y-6">
                      {/* Physical Card Mock */}
                      <div class="w-full h-52 bg-gradient-to-br from-brand-green-dark to-brand-green text-white rounded-2xl p-6 relative shadow-lg overflow-hidden flex flex-col justify-between text-left border border-emerald-400/25">
                        <div class="absolute right-0 top-0 w-36 h-36 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div class="absolute left-1/3 bottom-0 w-44 h-44 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
                        
                        <div class="flex items-center justify-between">
                          <div class="flex flex-col">
                            <span class="text-[9px] font-black text-brand-gold uppercase tracking-wider leading-none">Portal Oficial</span>
                            <span class="text-[13px] font-display font-black tracking-tight mt-0.5">Agremiación Médica Platense</span>
                          </div>
                          <LuCreditCard class="w-6 h-6 text-brand-gold/80 stroke-[2]" />
                        </div>

                        <div>
                          <span class="text-[8.5px] font-black text-emerald-300 uppercase tracking-widest leading-none">Médico Agremiado</span>
                          <h4 class="text-lg font-display font-extrabold tracking-wide truncate mt-0.5">{user.value.name}</h4>
                          <span class="text-[11px] font-mono bg-slate-900/30 px-2 py-0.5 rounded text-emerald-100 mt-1.5 inline-block">
                            M.P. {user.value.matricula || "12345"}
                          </span>
                        </div>

                        <div class="flex items-center justify-between border-t border-white/10 pt-2.5 mt-1">
                          <span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[8.5px] font-black bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 tracking-widest uppercase leading-none">
                            <span class="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>Socio Activo</span>
                          </span>
                          <span class="text-[9px] font-black text-brand-gold uppercase tracking-widest leading-none">
                            {user.value.role === "admin" ? "ADMIN" : user.value.role === "premium" ? "SOCIO PREMIUM" : "MIEMBRO"}
                          </span>
                        </div>
                      </div>

                      {/* Barcode / QR Component */}
                      <div class="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
                        <svg class="w-32 h-32 text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                          <rect x="0" y="0" width="25" height="25" fill="currentColor" />
                          <rect x="3" y="3" width="19" height="19" fill="white" />
                          <rect x="7" y="7" width="11" height="11" fill="currentColor" />

                          <rect x="75" y="0" width="25" height="25" fill="currentColor" />
                          <rect x="78" y="3" width="19" height="19" fill="white" />
                          <rect x="82" y="7" width="11" height="11" fill="currentColor" />

                          <rect x="0" y="75" width="25" height="25" fill="currentColor" />
                          <rect x="3" y="78" width="19" height="19" fill="white" />
                          <rect x="7" y="82" width="11" height="11" fill="currentColor" />
                          
                          <rect x="70" y="70" width="10" height="10" fill="currentColor" />
                          <rect x="72" y="72" width="6" height="6" fill="white" />
                          <rect x="74" y="74" width="2" height="2" fill="currentColor" />

                          <rect x="35" y="5" width="5" height="5" />
                          <rect x="45" y="0" width="5" height="10" />
                          <rect x="60" y="10" width="10" height="5" />
                          <rect x="30" y="20" width="15" height="5" />
                          <rect x="50" y="20" width="5" height="15" />
                          
                          <rect x="5" y="35" width="10" height="5" />
                          <rect x="20" y="30" width="5" height="10" />
                          <rect x="0" y="45" width="15" height="5" />
                          <rect x="25" y="45" width="10" height="10" />
                          
                          <rect x="35" y="35" width="30" height="5" />
                          <rect x="40" y="45" width="5" height="15" />
                          <rect x="55" y="45" width="15" height="5" />
                          <rect x="35" y="60" width="15" height="5" />
                          
                          <rect x="75" y="35" width="10" height="10" />
                          <rect x="90" y="40" width="5" height="15" />
                          <rect x="80" y="55" width="15" height="5" />
                          
                          <rect x="35" y="75" width="5" height="15" />
                          <rect x="45" y="85" width="15" height="5" />
                          <rect x="60" y="75" width="5" height="20" />
                          <rect x="50" y="70" width="5" height="5" />
                        </svg>

                        <div class="text-center space-y-1">
                          <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Código Dinámico de Validación</span>
                          <p class="text-sm font-mono font-bold text-slate-700">AMP-{user.value.matricula || "12345"}-{Math.floor(Date.now() / 1000000)}</p>
                          <p class="text-[11px] text-slate-400 font-medium">Presentá este código o QR en caja para recibir tu beneficio.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div class="flex flex-col items-center py-6 space-y-5">
                      <div class="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <svg class="w-8 h-8 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      
                      <div class="space-y-2">
                        <h4 class="text-lg font-display font-extrabold text-slate-800">Credencial Protegida</h4>
                        <p class="text-slate-500 text-[13.5px] leading-relaxed max-w-xs font-medium">
                          Tu credencial digital es un beneficio exclusivo y personalizado para médicos pertenecientes a la AMP.
                        </p>
                      </div>

                      <div class="pt-2 w-full">
                        <Link 
                          href="/login" 
                          class="w-full block bg-brand-green hover:bg-brand-green-dark text-white py-3.5 px-6 rounded-2xl font-extrabold text-sm uppercase tracking-wider transition-all shadow-md shadow-brand-green/20"
                        >
                          Iniciar Sesión
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal 2: Sorteos de Fin de Mes */}
            {isRaffleModalOpen.value && (
              <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                <div class="max-w-xl w-full bg-white rounded-[2rem] p-8 shadow-2xl relative border border-slate-100 flex flex-col overflow-y-auto max-h-[85vh] text-left text-slate-800">
                  <button 
                    onClick$={() => isRaffleModalOpen.value = false}
                    class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all"
                  >
                    ✕
                  </button>

                  <div class="flex items-center space-x-3 mb-6">
                    <div class="w-10 h-10 rounded-xl bg-amber-50 border border-brand-gold/20 flex items-center justify-center text-brand-gold">
                      <LuGift class="w-5 h-5 stroke-[2]" />
                    </div>
                    <div>
                      <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Club AMP+ Especial</span>
                      <h3 class="text-xl font-display font-black text-slate-800 mt-0.5 leading-none">Sorteos de Fin de Mes</h3>
                    </div>
                  </div>

                  <div class="space-y-6">
                    {/* Premios */}
                    <div class="space-y-3 bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                      <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest leading-none border-b border-slate-200/60 pb-2">Premios Activos - Sorteo de Junio</h4>
                      
                      <div class="space-y-3 pt-1">
                        <div class="flex items-start space-x-3">
                          <span class="text-xl">🏆</span>
                          <div>
                            <p class="text-sm font-bold text-slate-800">1° Premio: Escapada Soñada a Bariloche</p>
                            <p class="text-xs text-slate-500 font-medium">Estadía de 3 noches para 2 personas en <strong>Finca Los Cauquenes</strong> con aéreos incluidos + 1 Cena Gourmet en <strong>Mercado 55</strong>.</p>
                          </div>
                        </div>

                        <div class="flex items-start space-x-3">
                          <span class="text-xl">🍷</span>
                          <div>
                            <p class="text-sm font-bold text-slate-800">2° Premio: Set de Degustación Los Cauquenes</p>
                            <p class="text-xs text-slate-500 font-medium">Caja de madera premium con Vinos de Selección Exclusiva y fiambres ahumados artesanales.</p>
                          </div>
                        </div>

                        <div class="flex items-start space-x-3">
                          <span class="text-xl">💪</span>
                          <div>
                            <p class="text-sm font-bold text-slate-800">3° Premio: Bienestar & Supermercado</p>
                            <p class="text-xs text-slate-500 font-medium">1 Membresía VIP Anual en <strong>Tred Gimnasio</strong> + Orden de Compra de $150.000 en <strong>Nini Supermercado</strong>.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mecanismo */}
                    <div class="space-y-2">
                      <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest">¿Cómo se realiza el sorteo?</h4>
                      <p class="text-[13px] text-slate-600 leading-relaxed font-medium">
                        <strong>¡Participación 100% Automática!</strong> Todos los médicos agremiados con la cuota social al día participan de forma directa con los <strong>últimos 4 dígitos de su Matrícula Provincial (M.P.)</strong>.
                      </p>
                      <p class="text-[13px] text-slate-600 leading-relaxed font-medium">
                        El sorteo se determina utilizando los números ganadores del <strong>Sorteo Nocturno de la Lotería de la Provincia de Buenos Aires</strong> el último viernes de cada mes.
                      </p>
                    </div>

                    {/* Ganadores Previos */}
                    <div class="space-y-3">
                      <h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Médicos Ganadores Recientes</h4>
                      
                      <div class="space-y-2">
                        <div class="flex justify-between items-center text-xs font-semibold bg-emerald-50/50 border border-emerald-100/50 px-4 py-2.5 rounded-xl">
                          <div class="flex items-center space-x-2">
                            <span class="text-base">🎉</span>
                            <span class="text-slate-800 font-bold">Dr. Hugo Gómez (M.P. 51849)</span>
                          </div>
                          <span class="text-brand-green font-bold">Escapada en Dazzler (Mayo)</span>
                        </div>

                        <div class="flex justify-between items-center text-xs font-semibold bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl">
                          <div class="flex items-center space-x-2">
                            <span>🎁</span>
                            <span class="text-slate-700 font-bold">Dra. Marina Rossi (M.P. 44621)</span>
                          </div>
                          <span class="text-slate-500 font-bold">Degustación Cauquenes (Abril)</span>
                        </div>

                        <div class="flex justify-between items-center text-xs font-semibold bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl">
                          <div class="flex items-center space-x-2">
                            <span>🎁</span>
                            <span class="text-slate-700 font-bold">Dr. Esteban Benítez (M.P. 39912)</span>
                          </div>
                          <span class="text-slate-500 font-bold">Pase Tred & Nini (Marzo)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Modal 3: Sumate al Club */}
            {isMerchantModalOpen.value && (
              <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                <div class="max-w-lg w-full bg-white rounded-[2rem] p-8 shadow-2xl relative border border-slate-100 flex flex-col overflow-y-auto max-h-[90vh] text-left text-slate-800">
                  <button 
                    onClick$={() => { isMerchantModalOpen.value = false; merchantSubmitSuccess.value = false; }}
                    class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all"
                  >
                    ✕
                  </button>

                  {merchantSubmitSuccess.value ? (
                    <div class="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                      <div class="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-100 animate-bounce">
                        <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 class="text-xl font-bold text-slate-800">¡Propuesta Recibida!</h3>
                      <p class="text-slate-500 text-sm max-w-sm font-medium">
                        Hemos recibido con éxito la propuesta para incorporar a <strong class="text-slate-800">{merchantBusinessName.value}</strong> al Club de Beneficios.
                      </p>
                      <p class="text-slate-400 text-xs max-w-xs leading-relaxed">
                        Nuestro equipo comercial analizará la oferta y se pondrá en contacto al correo <strong>{merchantEmail.value}</strong> dentro de las próximas 48 horas hábiles.
                      </p>
                      
                      <div class="pt-4">
                        <button 
                          onClick$={() => { 
                            isMerchantModalOpen.value = false; 
                            merchantSubmitSuccess.value = false; 
                          }} 
                          class="px-8 py-3 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md"
                        >
                          Entendido
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div class="space-y-5">
                      <div class="flex items-center space-x-3 mb-2">
                        <div class="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-brand-green">
                          <LuStore class="w-5 h-5 stroke-[2]" />
                        </div>
                        <div>
                          <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Club AMP+ Partners</span>
                          <h3 class="text-xl font-display font-black text-slate-800 mt-0.5 leading-none">Sumate al Club</h3>
                        </div>
                      </div>

                      <p class="text-[13px] text-slate-500 leading-relaxed font-medium">
                        Ofrecé descuentos y beneficios a una red exclusiva de más de 4.000 médicos agremiados en la región y potenciá la visibilidad de tu negocio.
                      </p>

                      <form 
                        onSubmit$={async (e) => {
                          e.preventDefault();
                          if (!merchantBusinessName.value || !merchantCategory.value || !merchantContactName.value || !merchantEmail.value || !merchantPhone.value || !merchantProposal.value) {
                            merchantSubmitError.value = "Por favor, completá todos los campos del formulario.";
                            return;
                          }
                          merchantSubmitError.value = "";
                          isMerchantSubmitting.value = true;
                          try {
                            const res = await submitMerchantRequest({
                              businessName: merchantBusinessName.value,
                              category: merchantCategory.value,
                              contactName: merchantContactName.value,
                              email: merchantEmail.value,
                              phone: merchantPhone.value,
                              proposal: merchantProposal.value,
                            });
                            if (res.success) {
                              merchantSubmitSuccess.value = true;
                            } else {
                              merchantSubmitError.value = res.message;
                            }
                          } catch {
                            merchantSubmitError.value = "Ocurrió un error inesperado al enviar el formulario.";
                          } finally {
                            isMerchantSubmitting.value = false;
                          }
                        }}
                        class="space-y-4 pt-1"
                      >
                        {merchantSubmitError.value && (
                          <div class="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold">
                            ⚠️ {merchantSubmitError.value}
                          </div>
                        )}

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre del Comercio / Empresa</label>
                            <input 
                              type="text" 
                              required 
                              placeholder="Ej: Café Plaza"
                              bind:value={merchantBusinessName}
                              class="w-full bg-slate-50 border border-slate-200 focus:border-brand-green focus:bg-white text-slate-800 text-xs p-3 rounded-xl focus:outline-none transition-all font-semibold"
                            />
                          </div>

                          <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rubro / Categoría</label>
                            <select 
                              required 
                              bind:value={merchantCategory}
                              class="w-full bg-slate-50 border border-slate-200 focus:border-brand-green focus:bg-white text-slate-800 text-xs p-3 rounded-xl focus:outline-none transition-all font-semibold"
                            >
                              <option value="">Seleccionar rubro...</option>
                              <option value="Gastronomía">Gastronomía</option>
                              <option value="Turismo">Turismo & Hotelería</option>
                              <option value="Indumentaria">Moda & Calzado</option>
                              <option value="Salud & Estética">Salud, Belleza & Estética</option>
                              <option value="Deportes">Deportes & Bienestar</option>
                              <option value="Otros">Otros Servicios</option>
                            </select>
                          </div>
                        </div>

                        <div class="space-y-1">
                          <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre del Contacto</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="Ej: Juan Pérez"
                            bind:value={merchantContactName}
                            class="w-full bg-slate-50 border border-slate-200 focus:border-brand-green focus:bg-white text-slate-800 text-xs p-3 rounded-xl focus:outline-none transition-all font-semibold"
                          />
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Correo Electrónico</label>
                            <input 
                              type="email" 
                              required 
                              placeholder="Ej: contacto@empresa.com"
                              bind:value={merchantEmail}
                              class="w-full bg-slate-50 border border-slate-200 focus:border-brand-green focus:bg-white text-slate-800 text-xs p-3 rounded-xl focus:outline-none transition-all font-semibold"
                            />
                          </div>

                          <div class="space-y-1">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Teléfono / WhatsApp</label>
                            <input 
                              type="tel" 
                              required 
                              placeholder="Ej: 2215555555"
                              bind:value={merchantPhone}
                              class="w-full bg-slate-50 border border-slate-200 focus:border-brand-green focus:bg-white text-slate-800 text-xs p-3 rounded-xl focus:outline-none transition-all font-semibold"
                            />
                          </div>
                        </div>

                        <div class="space-y-1">
                          <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Detalle del Beneficio Propuesto</label>
                          <textarea 
                            required 
                            rows={3} 
                            placeholder="Ej: 15% de descuento los días lunes y martes abonando en efectivo o transferencia..."
                            bind:value={merchantProposal}
                            class="w-full bg-slate-50 border border-slate-200 focus:border-brand-green focus:bg-white text-slate-800 text-xs p-3 rounded-xl focus:outline-none transition-all font-semibold resize-none"
                          />
                        </div>

                        <div class="pt-2">
                          <button 
                            type="submit" 
                            disabled={isMerchantSubmitting.value}
                            class="w-full bg-brand-green hover:bg-brand-green-dark text-white py-3.5 px-6 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-55 flex items-center justify-center space-x-2"
                          >
                            <span>{isMerchantSubmitting.value ? "Enviando..." : "Enviar Propuesta"}</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Brands row */}
          <section class="bg-white border-y border-slate-100 py-10 print:hidden my-6">
            <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
              <p class="text-center text-[12px] font-black tracking-widest text-slate-500 uppercase mb-6">Nuestras Marcas Asociadas</p>
              <div class="flex flex-wrap items-center justify-center gap-6 sm:gap-8 md:gap-10">
                {sponsorsData.value && sponsorsData.value.length > 0 ? (
                  sponsorsData.value.map((sp) => (
                    <a 
                      key={sp.id}
                      href={sp.linkUrl || "#"}
                      target={sp.linkUrl ? "_blank" : undefined}
                      rel={sp.linkUrl ? "noopener noreferrer" : undefined}
                      class="flex items-center justify-center bg-slate-50 border border-slate-200/60 px-6 py-3 rounded-2xl shadow-sm hover:scale-105 hover:bg-slate-100 hover:border-slate-300 transition-all duration-300 group relative cursor-pointer min-w-[140px] h-[58px]"
                    >
                      <img 
                        src={sp.imageUrl} 
                        alt={sp.name} 
                        class="h-8 max-w-[120px] object-contain filter grayscale group-hover:grayscale-0 opacity-70 group-hover:opacity-100 transition-all duration-300"
                      />
                      {/* Tooltip con título de la marca */}
                      <span class="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-30 pointer-events-none uppercase tracking-wider">
                        {sp.name}
                      </span>
                    </a>
                  ))
                ) : (
                  <>
                    <div class="flex items-center space-x-2 bg-slate-50 border border-slate-200/60 px-6 py-3.5 rounded-2xl shadow-sm hover:scale-105 hover:bg-slate-100 transition-all duration-300 cursor-default group relative">
                      <LuHotel class="w-4 h-4 text-brand-green stroke-[2]" />
                      <span class="text-brand-green font-display font-black text-sm tracking-wider">DAZZLER HOTELES</span>
                      <span class="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-30 pointer-events-none uppercase tracking-wider">
                        Dazzler Hoteles
                      </span>
                    </div>
                    <div class="flex items-center space-x-2 bg-slate-50 border border-slate-200/60 px-6 py-3.5 rounded-2xl shadow-sm hover:scale-105 hover:bg-slate-100 transition-all duration-300 cursor-default group relative">
                      <LuDumbbell class="w-4 h-4 text-brand-green stroke-[2]" />
                      <span class="text-brand-green font-display font-black text-sm tracking-wider">TRED GIMNASIO</span>
                      <span class="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-30 pointer-events-none uppercase tracking-wider">
                        Tred Gimnasio
                      </span>
                    </div>
                    <div class="flex items-center space-x-2 bg-slate-50 border border-slate-200/60 px-6 py-3.5 rounded-2xl shadow-sm hover:scale-105 hover:bg-slate-100 transition-all duration-300 cursor-default group relative">
                      <LuUtensils class="w-4 h-4 text-brand-green stroke-[2]" />
                      <span class="text-brand-green font-display font-black text-sm tracking-wider">MERCADO 55</span>
                      <span class="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-30 pointer-events-none uppercase tracking-wider">
                        Mercado 55
                      </span>
                    </div>
                    <div class="flex items-center space-x-2 bg-slate-50 border border-slate-200/60 px-6 py-3.5 rounded-2xl shadow-sm hover:scale-105 hover:bg-slate-100 transition-all duration-300 cursor-default group relative">
                      <LuShoppingBag class="w-4 h-4 text-brand-green stroke-[2]" />
                      <span class="text-brand-green font-display font-black text-sm tracking-wider">NINI SUPERMERCADO</span>
                      <span class="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-30 pointer-events-none uppercase tracking-wider">
                        Nini Supermercado
                      </span>
                    </div>
                    <div class="flex items-center space-x-2 bg-slate-50 border border-slate-200/60 px-6 py-3.5 rounded-2xl shadow-sm hover:scale-105 hover:bg-slate-100 transition-all duration-300 cursor-default group relative">
                      <LuCompass class="w-4 h-4 text-brand-green stroke-[2]" />
                      <span class="text-brand-green font-display font-black text-sm tracking-wider">FINCA LOS CAUQUENES</span>
                      <span class="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-30 pointer-events-none uppercase tracking-wider">
                        Finca Los Cauquenes
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* 2. Main Preview Section */}
      <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div class="border-b border-slate-200 pb-5 mb-8 text-left">
          <h2 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Ver todos los beneficios
          </h2>
          <p class="text-slate-500 text-sm mt-2 font-medium">
            Explorá nuestra cartilla de descuentos exclusivos
          </p>
        </div>

        {/* Benefits Grid Preview - Single Row (4 cards) */}
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {benefits.slice(0, 4).map((benefit: Benefit) => {
            const imageUrl = benefit.imagen
              ? (benefit.imagen.startsWith('http') || benefit.imagen.startsWith('/') ? benefit.imagen : `https://beneficios.amepla.org.ar/files/${benefit.imagen}`)
              : null;

            const primaryCat = benefit.categorias[0]?.descripcion || "Beneficio";
            const primaryLoc = benefit.ubicacion[0]?.descripcion || "Prov. Buenos Aires";
            const discountText = benefit.resumen?.trim() || "Beneficio Exclusivo";
            const isPremiumOnly = benefit.isPremiumOnly;
            const isLocked = isPremiumOnly && !user.value;

            return (
              <div
                key={benefit.id}
                class="bg-white border border-slate-100 rounded-[2.2rem] overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group shadow-sm select-none"
              >
                <div class="relative h-52 bg-slate-50 overflow-hidden flex items-center justify-center">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={benefit.titulo}
                      loading="lazy"
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      width={320}
                      height={208}
                    />
                  ) : (
                    <div class="flex flex-col items-center justify-center p-6 text-center">
                      <span class="text-brand-green font-display font-black text-2xl">AMP+</span>
                      <span class="text-slate-400 text-[11px] font-bold uppercase tracking-wider mt-1">{primaryCat}</span>
                    </div>
                  )}

                  {isLocked && (
                    <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex flex-col justify-center items-center z-20 text-white">
                      <span class="text-3xl">🔒</span>
                      <span class="text-[12px] font-extrabold tracking-widest uppercase text-brand-gold mt-1.5">
                        Exclusivo Premium
                      </span>
                    </div>
                  )}

                  <div class="absolute top-3.5 right-3.5 z-10">
                    <span class="inline-flex items-center px-4 py-2 rounded-2xl text-[15px] font-black bg-brand-gold text-brand-green-dark border-2 border-brand-gold/60 shadow-lg uppercase tracking-wider">
                      {discountText.replace("Descuento del", "").trim()}
                    </span>
                  </div>

                  <div class="absolute bottom-3 left-3 z-10">
                    <span class="inline-flex items-center px-3.5 py-1 rounded-full text-[12px] font-bold bg-black/55 backdrop-blur-sm border border-white/10 uppercase tracking-wide text-white">
                      {primaryCat}
                    </span>
                  </div>
                </div>

                <div class="flex-grow p-6 flex flex-col justify-between text-left">
                  <div class="space-y-2.5">
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

                    <p class="text-[14.5px] text-slate-550 leading-relaxed font-medium line-clamp-3">
                      {benefit.descripcion
                        ? benefit.descripcion.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
                        : "No hay descripción disponible para este beneficio."}
                    </p>
                  </div>

                  <div class="pt-5 border-t border-slate-100 mt-4">
                    {isLocked ? (
                      <button
                        type="button"
                        class="w-full text-center text-xs font-black uppercase tracking-wider py-3.5 rounded-2xl bg-slate-100 text-slate-450 hover:bg-slate-150 active:scale-95 transition-all shadow-inner border border-slate-200 cursor-pointer"
                        onClick$={() => {
                          alert("Este beneficio es exclusivo para socios de la Mutual. Iniciá sesión para acceder.");
                        }}
                      >
                        🔑 Acceso Premium Exclusivo
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
          })}
        </div>

        {/* E. "Ver todos" button */}
        <div class="flex justify-center pt-10 mt-8 border-t border-slate-200/60">
          <Link
            href="/beneficios"
            class="inline-flex items-center justify-center space-x-2.5 py-4 px-12 rounded-[2rem] bg-brand-green text-white hover:bg-brand-green-light font-black text-base shadow-lg shadow-brand-green/20 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer border border-transparent"
          >
            <span>Ver todos</span>
            <svg class="w-5 h-5 stroke-current fill-none stroke-[2.5] transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </div>

        {/* Real-time Configurable Popup Modal */}
        {showPopup.value && settings && (
          <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              class="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity duration-300"
              onClick$={() => {
                showPopup.value = false;
                (window as any).__popupClosed = true;
              }}
            />

            {/* Modal Container */}
            <div class="relative w-full max-w-lg bg-white rounded-[2rem] overflow-hidden shadow-2xl border border-slate-100 flex flex-col transform transition-all duration-300 scale-100 animate-in fade-in zoom-in-95">
              {/* Close button on top-right */}
              <button
                onClick$={() => {
                  showPopup.value = false;
                  (window as any).__popupClosed = true;
                }}
                class="absolute top-4 right-4 z-10 w-9 h-9 bg-white/85 hover:bg-white text-slate-700 rounded-full flex items-center justify-center shadow-md border border-slate-200/50 transition-all duration-200 active:scale-90 cursor-pointer"
                aria-label="Cerrar"
              >
                <svg class="w-4 h-4 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Optional Image */}
              {settings.popupImageUrl && (
                <div class="relative h-52 sm:h-64 bg-slate-100 overflow-hidden">
                  <img
                    src={settings.popupImageUrl}
                    alt={settings.popupTitle || "Anuncio"}
                    class="w-full h-full object-cover"
                    loading="eager"
                    width={512}
                    height={256}
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
              )}

              {/* Content */}
              <div class="p-6 sm:p-8 flex flex-col items-center text-center space-y-4">
                <h3 class="text-xl sm:text-2xl font-display font-black text-brand-green-dark tracking-tight leading-tight">
                  {settings.popupTitle || "Anuncio Importante"}
                </h3>

                {settings.popupDescription && (
                  <p class="text-[13px] sm:text-[14.5px] text-slate-550 leading-relaxed font-medium max-h-40 overflow-y-auto pr-1">
                    {settings.popupDescription}
                  </p>
                )}

                {/* Primary Call to Action Button */}
                {settings.popupButtonLink && (
                  <div class="w-full pt-2">
                    <a
                      href={settings.popupButtonLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick$={() => {
                        showPopup.value = false;
                        (window as any).__popupClosed = true;
                      }}
                      class="inline-flex items-center justify-center w-full px-6 py-3.5 rounded-2xl bg-brand-green hover:bg-brand-green-dark text-white font-display font-black text-sm uppercase tracking-wider transition-all duration-300 shadow-md hover:shadow-lg active:scale-[0.98]"
                    >
                      {settings.popupButtonText || "Más Información"}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
  );
});

export const head: DocumentHead = {
  title: "Portal de Beneficios Oficial - Agremiación Médica Platense",
  meta: [
    {
      name: "description",
      content: "Exclusivo club de beneficios para agremiados y empleados de la AMP. Disfrutá de más de 250 comercios con descuentos especiales, promociones, y sorteos increíbles."
    },
    {
      property: "og:title",
      content: "Portal de Beneficios Oficial - Agremiación Médica Platense"
    },
    {
      property: "og:description",
      content: "Ahorrá y disfrutá con la cartilla de beneficios médicos de la AMP. Descuentos en turismo, gastronomía, indumentaria, belleza y mucho más."
    }
  ]
};
