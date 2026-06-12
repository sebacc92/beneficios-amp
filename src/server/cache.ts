import type { RequestEventBase } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { customBenefits, heroSlides } from "~/db/schema";

export interface Category {
  id: number;
  descripcion: string;
  created_at?: string;
  updated_at?: string;
  indice?: number;
  beneficios_count?: number;
}

export interface Location {
  id: number;
  descripcion: string;
  indice?: number;
  beneficios_count?: number;
}

export interface Offer {
  id: number;
  descripcion: string;
  indice?: number;
  beneficios_count?: number;
}

export interface Benefit {
  id: number;
  titulo: string;
  descripcion: string;
  imagen: string | null;
  created_at?: string;
  updated_at?: string;
  url: string;
  indice?: number;
  latitud: string | null;
  longitud: string | null;
  resumen: string;
  orden_app?: number | null;
  mostrar_app?: number;
  categorias: Category[];
  ubicacion: Location[];
  ofertas: Offer[];
  isFeatured?: boolean;
  pdfUrl?: string | null;
  imagenMobile?: string | null;
  isActive?: boolean;
}

export interface Filters {
  categorias: Category[];
  ubicaciones: Location[];
  ofertas: Offer[];
}

interface SeedCache {
  benefits: Benefit[];
  filters: Filters;
}

// One-shot, isolate-wide cache. The seed.json is bundled at build time so
// loading it is essentially free — we just need to dedupe parsing across
// concurrent requests in the same isolate.
const globalState = globalThis as unknown as { __ampSeedPromise?: Promise<SeedCache> };

function loadSeed(): Promise<SeedCache> {
  if (!globalState.__ampSeedPromise) {
    globalState.__ampSeedPromise = (async () => {
      try {
        const localSeed = await import("./data/seed.json");
        const benefits = (localSeed.benefits as Benefit[]).map((item) => ({
          ...item,
          isFeatured:
            item.orden_app !== null && item.orden_app !== undefined && item.orden_app > 0,
        }));
        return {
          benefits,
          filters: localSeed.filters as Filters,
        };
      } catch (err) {
        console.error("[Cache] Failed to load bundled seed:", err);
        return {
          benefits: [],
          filters: { categorias: [], ubicaciones: [], ofertas: [] },
        };
      }
    })();
  }
  return globalState.__ampSeedPromise;
}

export async function getBenefits(): Promise<Benefit[]> {
  const seed = await loadSeed();
  return seed.benefits;
}

export async function getFilters(): Promise<Filters> {
  const seed = await loadSeed();
  const benefits = seed.benefits;
  const categoryCounts: Record<number, number> = {};

  for (const b of benefits) {
    if (!b.categorias) continue;
    for (const cat of b.categorias) {
      if (cat && cat.id) {
        categoryCounts[cat.id] = (categoryCounts[cat.id] || 0) + 1;
      }
    }
  }

  const sortedCategorias = [...(seed.filters.categorias || [])]
    .map((cat) => ({
      ...cat,
      beneficios_count: categoryCounts[cat.id] || 0,
    }))
    .sort((a, b) => (b.beneficios_count || 0) - (a.beneficios_count || 0));

  return {
    ...seed.filters,
    categorias: sortedCategorias,
  };
}

// Track which isolates have already seeded so we don't repeat the work on
// every request. Each flag is keyed in globalThis so it survives HMR.
const seedFlags = globalThis as unknown as {
  __benefitsSeeded?: boolean;
  __heroSlidesSeeded?: boolean;
};

export async function ensureDbSeeded(db: any) {
  if (seedFlags.__benefitsSeeded) return;
  try {
    const existing = await db.select().from(customBenefits);
    const lacksCoordinates =
      existing.length > 0 && existing.some((x: any) => x.latitud === null || x.latitud === undefined);

    if (lacksCoordinates) {
      console.log("[Seeder] Custom benefits lacking coordinates detected. Re-seeding...");
      await db.delete(customBenefits);
    } else if (existing.length > 5) {
      seedFlags.__benefitsSeeded = true;
      return;
    }

    const seedData = await import("./data/seed.json");
    if (!seedData || !seedData.benefits) {
      console.warn("[Seeder] Could not load seed.json");
      seedFlags.__benefitsSeeded = true;
      return;
    }

    const existingSlugs = new Set(existing.map((ex: any) => ex.slug));
    const existingIds = new Set(existing.map((ex: any) => ex.id));

    const benefitsToInsert = seedData.benefits
      .filter((b: any) => !existingSlugs.has(b.url) && !existingIds.has(String(b.id)))
      .map((b: any) => ({
        id: String(b.id),
        titulo: b.titulo,
        resumen: b.resumen || "Descuento especial",
        descripcion: b.descripcion || "",
        imagen: b.imagen || null,
        slug: b.url,
        isFeatured: b.orden_app !== null && b.orden_app !== undefined && b.orden_app > 0,
        categoryId: b.categorias?.[0]?.id || 109,
        locationId: b.ubicacion?.[0]?.id || 25,
        offerId: b.ofertas?.[0]?.id || 1,
        couponCode: "AMEPLA" + b.id,
        validUntil: "2026-12-31",
        terms: "Válido presentando credencial digital.",
        latitud: b.latitud || null,
        longitud: b.longitud || null,
        imagenMobile: null,
        createdAt: b.created_at || new Date().toISOString(),
      }));

    if (benefitsToInsert.length > 0) {
      console.log(`[Seeder] Inserting ${benefitsToInsert.length} seed benefits...`);
      const chunkSize = 40;
      for (let i = 0; i < benefitsToInsert.length; i += chunkSize) {
        await db.insert(customBenefits).values(benefitsToInsert.slice(i, i + chunkSize));
      }
    }
    seedFlags.__benefitsSeeded = true;
  } catch (err) {
    console.error("[Seeder] Error seeding benefits table:", err);
  }
}

export async function ensureHeroSlidesSeeded(db: any) {
  if (seedFlags.__heroSlidesSeeded) return;
  try {
    const existing = await db.select().from(heroSlides);
    if (existing.length > 0) {
      seedFlags.__heroSlidesSeeded = true;
      return;
    }

    const defaults = [
      {
        id: "slide-1",
        imageUrl: "https://beneficios.amepla.org.ar/images/slider/23-PHOTO-2026-05-05-16-00-15.jpg",
        title: "Beneficios de Temporada",
        subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos.",
        buttonText: "Explorar",
        buttonLink: "/",
        orderIndex: 1,
        createdAt: new Date().toISOString(),
        preTitle: "Exclusivo AMP+",
        imageMobile: "https://beneficios.amepla.org.ar/images/slider/23-PHOTO-2026-05-05-16-00-15.jpg",
        isActive: true,
      },
      {
        id: "slide-2",
        imageUrl: "https://beneficios.amepla.org.ar/images/slider/24-23-930289de-f986-4060-b33c-2858b5b7ddef.jpg",
        title: "Salud & Cuidado",
        subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos.",
        buttonText: "Explorar",
        buttonLink: "/",
        orderIndex: 2,
        createdAt: new Date().toISOString(),
        preTitle: "Cuidado Médico",
        imageMobile: "https://beneficios.amepla.org.ar/images/slider/24-23-930289de-f986-4060-b33c-2858b5b7ddef.jpg",
        isActive: true,
      },
      {
        id: "slide-3",
        imageUrl: "https://beneficios.amepla.org.ar/images/slider/-DAZZLER SLIDE.jpg",
        title: "Hotelería Dazzler",
        subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos.",
        buttonText: "Explorar",
        buttonLink: "/",
        orderIndex: 3,
        createdAt: new Date().toISOString(),
        preTitle: "Turismo & Escapadas",
        imageMobile: "https://beneficios.amepla.org.ar/images/slider/-DAZZLER SLIDE.jpg",
        isActive: true,
      },
      {
        id: "slide-4",
        imageUrl: "https://beneficios.amepla.org.ar/images/slider/26-0e3e1eaa-1394-4eed-a06e-da739f49e404.jpg",
        title: "Indumentaria & Calzado",
        subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos.",
        buttonText: "Explorar",
        buttonLink: "/",
        orderIndex: 4,
        createdAt: new Date().toISOString(),
        preTitle: "Tendencias & Moda",
        imageMobile: "https://beneficios.amepla.org.ar/images/slider/26-0e3e1eaa-1394-4eed-a06e-da739f49e404.jpg",
        isActive: true,
      },
      {
        id: "slide-5",
        imageUrl: "https://beneficios.amepla.org.ar/images/slider/27-PHOTO-2025-11-03-12-09-52.jpg",
        title: "Estética & Spa",
        subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos.",
        buttonText: "Explorar",
        buttonLink: "/",
        orderIndex: 5,
        createdAt: new Date().toISOString(),
        preTitle: "Bienestar & Relax",
        imageMobile: "https://beneficios.amepla.org.ar/images/slider/27-PHOTO-2025-11-03-12-09-52.jpg",
        isActive: true,
      },
      {
        id: "slide-6",
        imageUrl: "https://beneficios.amepla.org.ar/images/slider/-Tred Slide.jpg",
        title: "Gimnasio Tred",
        subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos.",
        buttonText: "Explorar",
        buttonLink: "/",
        orderIndex: 6,
        createdAt: new Date().toISOString(),
        preTitle: "Fitness & Salud",
        imageMobile: "https://beneficios.amepla.org.ar/images/slider/-Tred Slide.jpg",
        isActive: true,
      },
    ];

    for (const slide of defaults) {
      await db.insert(heroSlides).values(slide);
    }
    seedFlags.__heroSlidesSeeded = true;
  } catch (err) {
    console.error("[Seeder] Error seeding hero_slides table:", err);
  }
}

export async function getCustomBenefits(requestEvent: RequestEventBase): Promise<Benefit[]> {
  try {
    const db = getDB(requestEvent);
    await ensureDbSeeded(db);

    const dbBenefits = await db.select().from(customBenefits);
    const filters = await getFilters();

    return dbBenefits.map((cb) => {
      const cat = filters.categorias.find((c) => c.id === cb.categoryId) || { id: cb.categoryId, descripcion: "Otro" };
      const loc = filters.ubicaciones.find((l) => l.id === cb.locationId) || { id: cb.locationId, descripcion: "La Plata" };
      const off = filters.ofertas.find((o) => o.id === cb.offerId) || { id: cb.offerId, descripcion: "Especial" };

      const numId = cb.slug.split("-")[0] && !isNaN(Number(cb.slug.split("-")[0]))
        ? Number(cb.slug.split("-")[0])
        : Math.floor(Math.random() * 10000) + 90000;

      const rawValidUntil = cb.validUntil;
      const isDraft = rawValidUntil?.startsWith("draft|") || rawValidUntil === "draft";
      const cleanValidUntil = isDraft
        ? (rawValidUntil === "draft" ? null : rawValidUntil!.substring(6))
        : rawValidUntil;
      const isActive = !isDraft;

      return {
        id: numId,
        titulo: cb.titulo,
        descripcion: cb.descripcion,
        imagen: cb.imagen || null,
        url: cb.slug,
        resumen: cb.resumen,
        latitud: cb.latitud || null,
        longitud: cb.longitud || null,
        categorias: [cat],
        ubicacion: [loc],
        ofertas: [off],
        orden_app: cb.isFeatured ? 1 : 0,
        mostrar_app: isActive ? 1 : 0,
        isFeatured: cb.isFeatured,
        pdfUrl: cb.pdfUrl || null,
        imagenMobile: cb.imagenMobile || null,
        created_at: cb.createdAt,
        isActive,
        validUntil: cleanValidUntil,
      } as Benefit;
    });
  } catch (err) {
    console.error("Failed to load custom benefits from DB:", err);
    return [];
  }
}

export async function getBenefitBySlug(slug: string, requestEvent?: RequestEventBase): Promise<Benefit | null> {
  if (requestEvent) {
    const customList = await getCustomBenefits(requestEvent);
    const customMatch = customList.find((b) => b.url === slug);
    if (customMatch) return customMatch;

    const idPrefix = slug.split("-")[0];
    if (idPrefix && !isNaN(Number(idPrefix))) {
      const id = Number(idPrefix);
      return customList.find((b) => b.id === id) || null;
    }
    return null;
  }

  const benefits = await getBenefits();
  const benefit = benefits.find((b) => b.url === slug);
  if (benefit) return benefit;

  const idPrefix = slug.split("-")[0];
  if (idPrefix && !isNaN(Number(idPrefix))) {
    const id = Number(idPrefix);
    return benefits.find((b) => b.id === id) || null;
  }
  return null;
}

export interface SearchParams {
  query?: string;
  categoryId?: number;
  locationId?: number;
  offerId?: number;
  page?: number;
  limit?: number;
  requestEvent?: RequestEventBase;
}

export interface SearchResult {
  data: Benefit[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export async function searchBenefits(params: SearchParams): Promise<SearchResult> {
  const uniqueBenefits: Benefit[] = params.requestEvent
    ? await getCustomBenefits(params.requestEvent)
    : await getBenefits();

  const query = params.query?.toLowerCase().trim() || "";
  const categoryId = params.categoryId ? Number(params.categoryId) : null;
  const locationId = params.locationId ? Number(params.locationId) : null;
  const offerId = params.offerId ? Number(params.offerId) : null;
  const page = params.page && params.page > 0 ? Number(params.page) : 1;
  const limit = params.limit && params.limit > 0 ? Number(params.limit) : 12;

  let filtered = uniqueBenefits.filter((b) => b.mostrar_app !== 0);

  if (query) {
    filtered = filtered.filter((b) => {
      const titleMatch = b.titulo.toLowerCase().includes(query);
      const descMatch = b.descripcion.toLowerCase().includes(query);
      const catMatch = b.categorias.some((c) => c.descripcion.toLowerCase().includes(query));
      const locMatch = b.ubicacion.some((l) => l.descripcion.toLowerCase().includes(query));
      return titleMatch || descMatch || catMatch || locMatch;
    });
  }

  if (categoryId) {
    filtered = filtered.filter((b) => b.categorias.some((c) => c.id === categoryId));
  }
  if (locationId) {
    filtered = filtered.filter((b) => b.ubicacion.some((l) => l.id === locationId));
  }
  if (offerId) {
    filtered = filtered.filter((b) => b.ofertas.some((o) => o.id === offerId));
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginatedData = filtered.slice(offset, offset + limit);

  return { data: paginatedData, total, totalPages, page, limit };
}
