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
  url: string; // This is the slug, e.g. "2339-sanar-es-vivir-masajes"
  indice?: number;
  latitud: string | null;
  longitud: string | null;
  resumen: string;
  orden_app?: number | null;
  mostrar_app?: number;
  categorias: Category[];
  ubicacion: Location[]; // Note: Singular in original API response but is an array
  ofertas: Offer[];
  isPremiumOnly?: boolean; // Premium badge
  isFeatured?: boolean; // Featured status
  pdfUrl?: string | null; // PDF file document URL or path
  imagenMobile?: string | null; // Mobile image URL or path
  galeria?: string[]; // Extra gallery image URLs
  validUntil?: string | null; // Vigencia (fecha de vencimiento) si aplica
  terms?: string | null; // Términos y condiciones
  isActive?: boolean;
  orden?: number; // Orden manual del listado (0 = sin orden → va al final)
}

export interface Filters {
  categorias: Category[];
  ubicaciones: Location[];
  ofertas: Offer[];
}

// Support Node/Vite HMR persistence by storing the cache in globalThis
const globalCached = globalThis as any;
if (!globalCached.__benefitsCache) {
  globalCached.__benefitsCache = {
    benefits: null,
    filters: null,
    lastFetchTime: 0
  };
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function initCache(force = false): Promise<{ benefitsCount: number; success: boolean }> {
  const now = Date.now();
  const cache = globalCached.__benefitsCache;
  if (!force && cache.benefits && cache.filters && now - cache.lastFetchTime < CACHE_TTL) {
    return { benefitsCount: cache.benefits.length, success: true };
  }

  console.log('[Cache] Refreshing benefits and filters cache...');
  try {
    // To completely prevent Vercel 504 Function Invocation Timeout, we serve the local seed data by default.
    // The live database custom benefits are queried directly from Turso, so they are always 100% up-to-date.
    if (!force) {
      const localSeed = await import('./data/seed.json').catch(() => null);
      if (localSeed && localSeed.benefits && localSeed.filters) {
        globalCached.__benefitsCache = {
          benefits: localSeed.benefits as Benefit[],
          filters: localSeed.filters as Filters,
          lastFetchTime: now
        };
        console.log(`[Cache] Instantly initialized cache from local seed: ${localSeed.benefits.length} benefits.`);
        return { benefitsCount: localSeed.benefits.length, success: true };
      }
    }

    // 1. Fetch filters with an 8 second timeout to avoid blocking startup
    const filtersRes = await fetchWithTimeout('https://beneficios.amepla.org.ar/api/v1/filtros/beneficios', {}, 8000);
    if (!filtersRes.ok) throw new Error(`Filters API returned ${filtersRes.status}`);
    const filtersData = await filtersRes.json() as Filters;

    // Test page 1 first to check if API is responding fast
    const testPageRes = await fetchWithTimeout('https://beneficios.amepla.org.ar/api/v1/beneficios?page=1', {}, 8000);
    if (!testPageRes.ok) throw new Error(`API returned ${testPageRes.status} on page 1`);
    const testPageJson = await testPageRes.json();
    const totalPages = testPageJson.last_page || 45;

    const allData: Benefit[] = [...(testPageJson.data || [])];
    const batchSize = 4; // Smaller batch size to prevent overloading WAF / rate limits

    for (let i = 2; i <= totalPages; i += batchSize) {
      const batchPromises: Promise<Benefit[]>[] = [];
      for (let page = i; page < i + batchSize && page <= totalPages; page++) {
        batchPromises.push(
          fetchWithTimeout(`https://beneficios.amepla.org.ar/api/v1/beneficios?page=${page}`, {}, 10000)
            .then(async (res) => {
              if (!res.ok) throw new Error(`Status ${res.status}`);
              const json = await res.json();
              return (json.data || []) as Benefit[];
            })
            .catch((err) => {
              console.error(`[Cache] Error page ${page}:`, err.message);
              return [] as Benefit[];
            })
        );
      }
      const results = await Promise.all(batchPromises);
      for (const items of results) {
        allData.push(...items);
      }
    }

    // Remove duplicates by ID just in case
    const seenIds = new Set<number>();
    const uniqueBenefits: Benefit[] = [];
    
    for (const item of allData) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        uniqueBenefits.push(item);
      }
    }

    if (uniqueBenefits.length === 0) {
      throw new Error('No benefits fetched from API');
    }

    globalCached.__benefitsCache = {
      benefits: uniqueBenefits.map(item => ({
        ...item,
        isFeatured: item.orden_app !== null && item.orden_app !== undefined && item.orden_app > 0
      })),
      filters: filtersData,
      lastFetchTime: now
    };

    console.log(`[Cache] Successfully cached ${uniqueBenefits.length} benefits and filters.`);
    return { benefitsCount: uniqueBenefits.length, success: true };
  } catch (error: any) {
    console.error('[Cache] Failed to fetch live data:', error.message);
    
    // Attempt fallback from local JSON files if they exist (helps with build & offline dev)
    try {
      const localSeed = await import('./data/seed.json').catch(() => null);
      if (localSeed && localSeed.benefits && localSeed.filters) {
        globalCached.__benefitsCache = {
          benefits: localSeed.benefits as Benefit[],
          filters: localSeed.filters as Filters,
          lastFetchTime: now
        };
        console.log(`[Cache] Loaded fallback seed data: ${localSeed.benefits.length} benefits.`);
        return { benefitsCount: localSeed.benefits.length, success: true };
      }
    } catch (fallbackError) {
      console.error('[Cache] Fallback seed loading failed:', fallbackError);
    }

    // If cache is empty and API failed, initialize with empty structures to avoid crash
    if (!globalCached.__benefitsCache.benefits) globalCached.__benefitsCache.benefits = [];
    if (!globalCached.__benefitsCache.filters) globalCached.__benefitsCache.filters = { categorias: [], ubicaciones: [], ofertas: [] };
    
    return { benefitsCount: globalCached.__benefitsCache.benefits.length, success: false };
  }
}

export async function getBenefits(): Promise<Benefit[]> {
  await initCache();
  return globalCached.__benefitsCache.benefits || [];
}

export async function getFilters(): Promise<Filters> {
  await initCache();
  const cache = globalCached.__benefitsCache;
  if (!cache || !cache.filters) {
    return { categorias: [], ubicaciones: [], ofertas: [] };
  }

  const benefits = cache.benefits || [];
  const categoryCounts: Record<number, number> = {};

  for (const b of benefits) {
    if (b.categorias) {
      for (const cat of b.categorias) {
        if (cat && cat.id) {
          categoryCounts[cat.id] = (categoryCounts[cat.id] || 0) + 1;
        }
      }
    }
  }

  const sortedCategorias = [...(cache.filters.categorias || [])]
    .map((cat: any) => ({
      ...cat,
      beneficios_count: categoryCounts[cat.id] || 0,
    }))
    .sort((a: any, b: any) => (b.beneficios_count || 0) - (a.beneficios_count || 0));

  return {
    ...cache.filters,
    categorias: sortedCategorias,
  };
}

// Helper to automatically seed DB if it's empty
export async function ensureDbSeeded(db: any) {
  try {
    // Ensure benefit with ID 775 is completely deleted from the database
    await db.delete(customBenefits).where(eq(customBenefits.id, "775"));

    const existing = await db.select().from(customBenefits);
    const lacksCoordinates = existing.length > 0 && existing.some((x: any) => x.latitud === null || x.latitud === undefined);

    if (lacksCoordinates) {
      console.log("[Seeder] Custom benefits lacking coordinates detected. Re-seeding table with coordinates...");
      await db.delete(customBenefits);
    } else if (existing.length > 5) {
      return;
    }

    console.log("[Seeder] custom_benefits table is empty or needs coordinate updates. Seeding from seed.json...");
    const seedData = await import("./data/seed.json");
    if (!seedData || !seedData.benefits) {
      console.warn("[Seeder] Could not load seed.json");
      return;
    }

    const benefitsToInsert = [];
    for (const b of seedData.benefits) {
      const alreadyExists = existing.some((ex: any) => ex.slug === b.url || ex.id === String(b.id));
      if (alreadyExists) continue;

      const catId = b.categorias?.[0]?.id || 109; // Default category
      const locId = b.ubicacion?.[0]?.id || 25; // Default location
      const offId = b.ofertas?.[0]?.id || 1; // Default offer

      benefitsToInsert.push({
        id: String(b.id),
        titulo: b.titulo,
        resumen: b.resumen || "Descuento especial",
        descripcion: b.descripcion || "",
        imagen: b.imagen || null,
        slug: b.url,
        isFeatured: b.orden_app !== null && b.orden_app !== undefined && b.orden_app > 0,
        isPremiumOnly: false,
        categoryId: catId,
        locationId: locId,
        offerId: offId,
        couponCode: "AMEPLA" + b.id,
        validUntil: "2026-12-31",
        terms: "Válido presentando credencial digital.",
        latitud: b.latitud || null,
        longitud: b.longitud || null,
        imagenMobile: null,
        createdAt: b.created_at || new Date().toISOString(),
      });
    }

    if (benefitsToInsert.length > 0) {
      console.log(`[Seeder] Inserting ${benefitsToInsert.length} seed benefits into custom_benefits in SQLite...`);
      // Chunk to prevent SQLite limit
      const chunkSize = 40;
      for (let i = 0; i < benefitsToInsert.length; i += chunkSize) {
        const chunk = benefitsToInsert.slice(i, i + chunkSize);
        await db.insert(customBenefits).values(chunk);
      }
      console.log("[Seeder] SQLite seeding completed successfully.");
    }
  } catch (err) {
    console.error("[Seeder] Error seeding benefits table:", err);
  }
}

export async function ensureHeroSlidesSeeded(db: any) {
  try {
    const existing = await db.select().from(heroSlides);
    if (existing.length > 0) {
      return;
    }

    console.log("[Seeder] hero_slides table is empty. Seeding from default slides...");
    const defaults = [
      {
        id: "slide-1",
        imageUrl: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/23-PHOTO-2026-05-05-16-00-15.jpg",
        title: "Beneficios de Temporada",
        subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos.",
        buttonText: "Explorar",
        buttonLink: "/",
        orderIndex: 1,
        createdAt: new Date().toISOString(),
        preTitle: "Exclusivo AMP+",
        imageMobile: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/23-PHOTO-2026-05-05-16-00-15.jpg",
        isActive: 1,
      },
      {
        id: "slide-2",
        imageUrl: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/24-23-930289de-f986-4060-b33c-2858b5b7ddef.jpg",
        title: "Salud & Cuidado",
        subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos.",
        buttonText: "Explorar",
        buttonLink: "/",
        orderIndex: 2,
        createdAt: new Date().toISOString(),
        preTitle: "Cuidado Médico",
        imageMobile: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/24-23-930289de-f986-4060-b33c-2858b5b7ddef.jpg",
        isActive: 1,
      },
      {
        id: "slide-3",
        imageUrl: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/-DAZZLER_SLIDE.jpg",
        title: "Hotelería Dazzler",
        subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos.",
        buttonText: "Explorar",
        buttonLink: "/",
        orderIndex: 3,
        createdAt: new Date().toISOString(),
        preTitle: "Turismo & Escapadas",
        imageMobile: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/-DAZZLER_SLIDE.jpg",
        isActive: 1,
      },
      {
        id: "slide-4",
        imageUrl: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/26-0e3e1eaa-1394-4eed-a06e-da739f49e404.jpg",
        title: "Indumentaria & Calzado",
        subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos.",
        buttonText: "Explorar",
        buttonLink: "/",
        orderIndex: 4,
        createdAt: new Date().toISOString(),
        preTitle: "Tendencias & Moda",
        imageMobile: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/26-0e3e1eaa-1394-4eed-a06e-da739f49e404.jpg",
        isActive: 1,
      },
      {
        id: "slide-5",
        imageUrl: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/27-PHOTO-2025-11-03-12-09-52.jpg",
        title: "Estética & Spa",
        subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos.",
        buttonText: "Explorar",
        buttonLink: "/",
        orderIndex: 5,
        createdAt: new Date().toISOString(),
        preTitle: "Bienestar & Relax",
        imageMobile: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/27-PHOTO-2025-11-03-12-09-52.jpg",
        isActive: 1,
      },
      {
        id: "slide-6",
        imageUrl: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/-Tred_Slide.jpg",
        title: "Gimnasio Tred",
        subtitle: "Presentá tu credencial digital y disfrutá de los mejores descuentos.",
        buttonText: "Explorar",
        buttonLink: "/",
        orderIndex: 6,
        createdAt: new Date().toISOString(),
        preTitle: "Fitness & Salud",
        imageMobile: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/-Tred_Slide.jpg",
        isActive: 1,
      },
    ];

    for (const slide of defaults) {
      await db.insert(heroSlides).values(slide);
    }
    console.log("[Seeder] hero_slides table successfully seeded.");
  } catch (err) {
    console.error("[Seeder] Error seeding hero_slides table:", err);
  }
}

/**
 * Garantiza (una vez por instancia) las columnas de contadores en
 * `custom_benefits` y la tabla `credential_scans`. SQLite no soporta
 * ADD COLUMN IF NOT EXISTS, así que intentamos y absorbemos el error de
 * "columna ya existe" para que sea idempotente.
 */
export async function ensureTrackingSchema(db: any) {
  const g = globalThis as any;
  if (g.__trackingSchemaReady) return;
  const { sql } = await import("drizzle-orm");
  const addColumn = async (ddl: string) => {
    try {
      await db.run(sql.raw(ddl));
    } catch {
      // La columna ya existe: es esperado, no hacemos nada.
    }
  };
  await addColumn("ALTER TABLE custom_benefits ADD COLUMN views INTEGER NOT NULL DEFAULT 0");
  await addColumn("ALTER TABLE custom_benefits ADD COLUMN pdf_downloads INTEGER NOT NULL DEFAULT 0");
  // Orden manual del listado (0 = sin orden asignado → va al final).
  await addColumn("ALTER TABLE custom_benefits ADD COLUMN orden INTEGER NOT NULL DEFAULT 0");
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS credential_scans (
      id TEXT PRIMARY KEY,
      ok INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  g.__trackingSchemaReady = true;
}

/** Suma 1 a un contador (`views` o `pdf_downloads`) de un beneficio por slug. No bloquea si falla. */
export async function bumpBenefitCounter(
  requestEvent: RequestEventBase,
  slug: string,
  column: "views" | "pdf_downloads"
): Promise<void> {
  try {
    const db = getDB(requestEvent);
    await ensureTrackingSchema(db);
    const { sql } = await import("drizzle-orm");
    const col = column === "views" ? sql`views` : sql`pdf_downloads`;
    await db.run(sql`UPDATE custom_benefits SET ${col} = COALESCE(${col}, 0) + 1 WHERE slug = ${slug}`);
  } catch (err) {
    console.error(`[Tracking] bumpBenefitCounter(${column}) failed:`, err);
  }
}

/** Lee el mapa id → orden manual de los beneficios. */
export async function getBenefitOrdenMap(requestEvent: RequestEventBase): Promise<Record<string, number>> {
  try {
    const db = getDB(requestEvent);
    await ensureTrackingSchema(db);
    const { sql } = await import("drizzle-orm");
    const rows = (await db.all(sql`SELECT id, COALESCE(orden, 0) AS orden FROM custom_benefits`)) as any[];
    const map: Record<string, number> = {};
    for (const r of rows) map[String(r.id)] = Number(r.orden || 0);
    return map;
  } catch (err) {
    console.error("[Orden] getBenefitOrdenMap failed:", err);
    return {};
  }
}

/** Persiste el orden manual: cada id recibe orden = posición + 1 (1-based). */
export async function persistBenefitOrder(requestEvent: RequestEventBase, orderedIds: string[]): Promise<void> {
  if (!orderedIds || orderedIds.length === 0) return;
  const db = getDB(requestEvent);
  await ensureTrackingSchema(db);
  const { sql } = await import("drizzle-orm");
  const whens = orderedIds.map((id, i) => sql`WHEN ${id} THEN ${i + 1}`);
  await db.run(sql`UPDATE custom_benefits SET orden = CASE id ${sql.join(whens, sql` `)} ELSE orden END`);
}

/** Registra un escaneo de verificación de credencial (válido o no). No bloquea si falla. */
export async function recordCredentialScan(requestEvent: RequestEventBase, ok: boolean): Promise<void> {
  try {
    const db = getDB(requestEvent);
    await ensureTrackingSchema(db);
    const { sql } = await import("drizzle-orm");
    await db.run(
      sql`INSERT INTO credential_scans (id, ok, created_at) VALUES (${crypto.randomUUID()}, ${ok ? 1 : 0}, ${new Date().toISOString()})`
    );
  } catch (err) {
    console.error("[Tracking] recordCredentialScan failed:", err);
  }
}

/** Crea la tabla `gallery_images` en runtime (patrón de seeding del proyecto). */
export async function ensureGalleryTable(db: any) {
  const { sql } = await import("drizzle-orm");
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS gallery_images (
      id TEXT PRIMARY KEY,
      image_url TEXT NOT NULL,
      title TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);
}

// Transforms DB custom benefits schema into standard cached Benefit interface elements
export async function getCustomBenefits(requestEvent: RequestEventBase): Promise<Benefit[]> {
  try {
    const db = getDB(requestEvent);
    // Automatically guarantee database is populated from seed.json on start
    await ensureDbSeeded(db);

    const dbBenefits = await db.select().from(customBenefits);
    const filters = await getFilters();

    // Orden manual (columna gestionada por SQL crudo, fuera del schema de Drizzle).
    let ordenMap: Record<string, number> = {};
    try {
      await ensureTrackingSchema(db);
      const { sql } = await import("drizzle-orm");
      const ordenRows = (await db.all(sql`SELECT id, COALESCE(orden, 0) AS orden FROM custom_benefits`)) as any[];
      for (const r of ordenRows) ordenMap[String(r.id)] = Number(r.orden || 0);
    } catch (e) {
      console.error("[Orden] no se pudo leer el orden manual:", e);
      ordenMap = {};
    }

    return dbBenefits.map((cb) => {
      const cat = filters.categorias.find((c) => c.id === cb.categoryId) || { id: cb.categoryId, descripcion: "Otro" };
      const loc = filters.ubicaciones.find((l) => l.id === cb.locationId) || { id: cb.locationId, descripcion: "La Plata" };
      const off = filters.ofertas.find((o) => o.id === cb.offerId) || { id: cb.offerId, descripcion: "Especial" };

      // Derive numerical ID from slug string or use a hashed representation
      const numId = cb.slug.split("-")[0] && !isNaN(Number(cb.slug.split("-")[0]))
        ? Number(cb.slug.split("-")[0])
        : Math.floor(Math.random() * 10000) + 90000;

      // Extract real validUntil and isActive status
      const rawValidUntil = cb.validUntil;
      const isDraft = rawValidUntil?.startsWith("draft|") || rawValidUntil === "draft";
      const cleanValidUntil = isDraft
        ? (rawValidUntil === "draft" ? null : rawValidUntil!.substring(6))
        : rawValidUntil;
      const isActive = !isDraft;

      // Parse gallery JSON array (defensively)
      let galeria: string[] = [];
      if (cb.galeria) {
        try {
          const parsed = JSON.parse(cb.galeria);
          if (Array.isArray(parsed)) {
            galeria = parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
          }
        } catch {
          galeria = [];
        }
      }

      return {
        id: numId,
        titulo: cb.titulo,
        descripcion: cb.descripcion,
        imagen: cb.imagen || null,
        galeria,
        url: cb.slug,
        resumen: cb.resumen,
        latitud: cb.latitud || null,
        longitud: cb.longitud || null,
        categorias: [cat],
        ubicacion: [loc],
        ofertas: [off],
        orden_app: cb.isFeatured ? 1 : 0,
        mostrar_app: isActive ? 1 : 0,
        isPremiumOnly: cb.isPremiumOnly,
        isFeatured: cb.isFeatured,
        pdfUrl: cb.pdfUrl || null,
        imagenMobile: cb.imagenMobile || null,
        validUntil: cleanValidUntil || null,
        terms: cb.terms || null,
        created_at: cb.createdAt,
        isActive,
        orden: ordenMap[cb.id] ?? 0,
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
    const customMatch = customList.find(b => b.url === slug);
    if (customMatch) return customMatch;

    // Check fallback match by ID prefix on customList
    const idPrefix = slug.split('-')[0];
    if (idPrefix && !isNaN(Number(idPrefix))) {
      const id = Number(idPrefix);
      return customList.find(b => b.id === id) || null;
    }
    return null;
  }

  const benefits = await getBenefits();
  const benefit = benefits.find(b => b.url === slug);
  if (benefit) return benefit;

  // Fallback to match by ID prefix
  const idPrefix = slug.split('-')[0];
  if (idPrefix && !isNaN(Number(idPrefix))) {
    const id = Number(idPrefix);
    return benefits.find(b => b.id === id) || null;
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
  requestEvent?: RequestEventBase; // Support fetching custom DB benefits
  isPremiumOnly?: boolean;
  isCampaignOnly?: boolean;
}

export interface SearchResult {
  data: Benefit[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export async function searchBenefits(params: SearchParams): Promise<SearchResult> {
  let uniqueBenefits: Benefit[] = [];
  
  if (params.requestEvent) {
    uniqueBenefits = await getCustomBenefits(params.requestEvent);
  } else {
    uniqueBenefits = await getBenefits();
  }
  
  const query = params.query?.toLowerCase().trim() || '';
  const categoryId = params.categoryId ? Number(params.categoryId) : null;
  const locationId = params.locationId ? Number(params.locationId) : null;
  const offerId = params.offerId ? Number(params.offerId) : null;
  const page = params.page && params.page > 0 ? Number(params.page) : 1;
  const limit = params.limit && params.limit > 0 ? Number(params.limit) : 12;

  let filtered = uniqueBenefits;

  // Filter out inactive benefits for public viewing
  filtered = filtered.filter(b => b.mostrar_app !== 0);

  // 1. Campaign filter (highest priority before specific queries)
  if (params.isCampaignOnly && params.requestEvent) {
    try {
      const { getSettings } = await import("./chatbotDb");
      const settings = await getSettings(params.requestEvent);
      if (settings?.campaignActive) {
        let campaignBenefits: Benefit[] = [];
        
        // Try manual list first
        if (settings.campaignBenefitIds) {
          const selectedSlugsOrIds = settings.campaignBenefitIds.split(",").map(s => s.trim()).filter(Boolean);
          if (selectedSlugsOrIds.length > 0) {
            const matchedBenefitsMap = new Map<string, Benefit>();
            for (const b of filtered) {
              matchedBenefitsMap.set(String(b.id), b);
              matchedBenefitsMap.set(b.url, b);
            }
            campaignBenefits = selectedSlugsOrIds
              .map(slugOrId => matchedBenefitsMap.get(slugOrId))
              .filter((b): b is Benefit => !!b);
          }
        }

        // Fall back to keyword query terms
        if (campaignBenefits.length === 0 && settings.campaignQuery) {
          const queryTerms = settings.campaignQuery.split(",").map(term => term.trim().toLowerCase()).filter(Boolean);
          campaignBenefits = filtered.filter(b => {
            const tl = b.titulo.toLowerCase();
            const dl = b.descripcion.toLowerCase();
            const rl = b.resumen.toLowerCase();
            return queryTerms.some(term => 
              tl.includes(term) || 
              dl.includes(term) || 
              rl.includes(term) || 
              b.categorias.some(c => c.descripcion.toLowerCase().includes(term))
            );
          });
        }

        filtered = campaignBenefits;
      }
    } catch (e) {
      console.error("Failed to apply campaign filter in searchBenefits:", e);
    }
  }

  // 2. Text search filter
  if (query) {
    filtered = filtered.filter(b => {
      const titleMatch = b.titulo.toLowerCase().includes(query);
      const descMatch = b.descripcion.toLowerCase().includes(query);
      const catMatch = b.categorias.some(c => c.descripcion.toLowerCase().includes(query));
      const locMatch = b.ubicacion.some(l => l.descripcion.toLowerCase().includes(query));
      return titleMatch || descMatch || catMatch || locMatch;
    });
  }

  // 3. Category filter
  if (categoryId) {
    filtered = filtered.filter(b => b.categorias.some(c => c.id === categoryId));
  }

  // 4. Location filter
  if (locationId) {
    filtered = filtered.filter(b => b.ubicacion.some(l => l.id === locationId));
  }

  // 5. Offer/Discount filter
  if (offerId) {
    filtered = filtered.filter(b => b.ofertas.some(o => o.id === offerId));
  }

  // 6. Gold/Premium filter
  if (params.isPremiumOnly) {
    filtered = filtered.filter(b => b.isPremiumOnly);
  }

  // Orden consistente: destacados primero, luego alfabético por título.
  // Orden: primero los que tienen orden manual (asc); el resto (orden 0) al final,
  // como hasta ahora: destacados primero, luego alfabético por título.
  filtered = [...filtered].sort((a, b) => {
    const oa = a.orden || 0;
    const ob = b.orden || 0;
    const ha = oa > 0 ? 0 : 1;
    const hb = ob > 0 ? 0 : 1;
    if (ha !== hb) return ha - hb;
    if (oa > 0 && ob > 0 && oa !== ob) return oa - ob;
    const fa = a.isFeatured ? 1 : 0;
    const fb = b.isFeatured ? 1 : 0;
    if (fa !== fb) return fb - fa;
    return a.titulo.localeCompare(b.titulo, "es", { sensitivity: "base" });
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginatedData = filtered.slice(offset, offset + limit);

  return {
    data: paginatedData,
    total,
    totalPages,
    page,
    limit
  };
}
