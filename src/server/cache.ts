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

/**
 * Inicializa la caché en memoria del "catálogo base" (categorías, ubicaciones,
 * ofertas y el snapshot de beneficios) desde `data/seed.json`.
 *
 * Históricamente esto se traía en vivo desde `beneficios.amepla.org.ar`, pero ese
 * sitio se reemplaza por este, así que ese fetch quedó obsoleto (se usó una sola
 * vez para generar el seed). Los beneficios reales/editables salen de la base
 * (Turso) vía getCustomBenefits(); este seed solo aporta el catálogo de filtros
 * y un fallback estático. Al ser estático, se carga una vez y queda cacheado.
 */
export async function initCache(): Promise<{ benefitsCount: number; success: boolean }> {
  const cache = globalCached.__benefitsCache;
  if (cache.benefits && cache.filters) {
    return { benefitsCount: cache.benefits.length, success: true };
  }

  try {
    const localSeed = await import('./data/seed.json').catch(() => null);
    if (localSeed && localSeed.benefits && localSeed.filters) {
      globalCached.__benefitsCache = {
        benefits: localSeed.benefits as Benefit[],
        filters: localSeed.filters as Filters,
        lastFetchTime: Date.now()
      };
      return { benefitsCount: localSeed.benefits.length, success: true };
    }
  } catch (error) {
    console.error('[Cache] No se pudo cargar el seed local:', error);
  }

  // Sin seed: estructuras vacías para no romper el render.
  if (!globalCached.__benefitsCache.benefits) globalCached.__benefitsCache.benefits = [];
  if (!globalCached.__benefitsCache.filters) globalCached.__benefitsCache.filters = { categorias: [], ubicaciones: [], ofertas: [] };
  return { benefitsCount: globalCached.__benefitsCache.benefits.length, success: false };
}

export async function getBenefits(): Promise<Benefit[]> {
  await initCache();
  return globalCached.__benefitsCache.benefits || [];
}

export async function getFilters(requestEvent?: RequestEventBase): Promise<Filters> {
  await initCache();
  const cache = globalCached.__benefitsCache;
  if (!cache || !cache.filters) {
    return { categorias: [], ubicaciones: [], ofertas: [] };
  }

  // Universo para contar. Con requestEvent se cuenta contra la BASE (catálogo real,
  // solo visibles); si no, contra el snapshot seed. getCustomBenefits llama a
  // getFilters() SIN requestEvent, así que no hay recursión.
  let countingBenefits: Benefit[] = cache.benefits || [];
  if (requestEvent) {
    try {
      const dbBenefits = await getCustomBenefits(requestEvent);
      countingBenefits = dbBenefits.filter((b) => b.mostrar_app !== 0 && b.isActive !== false);
    } catch (e) {
      console.error("[getFilters] no se pudo contar desde la base; se usa el seed:", e);
    }
  }

  const categoryCounts: Record<number, number> = {};
  const locationCounts: Record<number, number> = {};
  const offerCounts: Record<number, number> = {};
  for (const b of countingBenefits) {
    for (const cat of b.categorias || []) if (cat?.id) categoryCounts[cat.id] = (categoryCounts[cat.id] || 0) + 1;
    for (const loc of b.ubicacion || []) if (loc?.id) locationCounts[loc.id] = (locationCounts[loc.id] || 0) + 1;
    for (const off of b.ofertas || []) if (off?.id) offerCounts[off.id] = (offerCounts[off.id] || 0) + 1;
  }

  const sortedCategorias = [...(cache.filters.categorias || [])]
    .map((cat: any) => ({ ...cat, beneficios_count: categoryCounts[cat.id] || 0 }))
    .sort((a: any, b: any) => (b.beneficios_count || 0) - (a.beneficios_count || 0));
  const ubicaciones = [...(cache.filters.ubicaciones || [])]
    .map((loc: any) => ({ ...loc, beneficios_count: locationCounts[loc.id] || 0 }));
  const ofertas = [...(cache.filters.ofertas || [])]
    .map((off: any) => ({ ...off, beneficios_count: offerCounts[off.id] || 0 }));

  return {
    ...cache.filters,
    categorias: sortedCategorias,
    ubicaciones,
    ofertas,
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
        categoryId: catId,
        locationId: locId,
        offerId: offId,
        couponCode: "AMEPLA" + b.id,
        // Vigencia y condiciones quedan vacías: solo se muestran si el admin las carga.
        validUntil: null,
        terms: null,
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

/**
 * Limpia (una vez por instancia) los defaults genéricos de vigencia/condiciones
 * que el seed histórico metía en todos los beneficios. A partir de ahora esos
 * campos son opcionales: solo se muestran si el admin los carga. Solo se anulan
 * los valores exactos del default (no toca vigencias/condiciones reales ni el
 * flag de borrador `draft|`, que nunca es igual a `2026-12-31`).
 */
export async function ensureBenefitDefaultsCleanup(db: any) {
  const g = globalThis as any;
  if (g.__benefitDefaultsCleaned) return;
  try {
    const { sql } = await import("drizzle-orm");
    await db.run(sql`UPDATE custom_benefits SET valid_until = NULL WHERE valid_until = '2026-12-31'`);
    await db.run(sql`UPDATE custom_benefits SET terms = NULL WHERE terms = 'Válido presentando credencial digital.'`);
    g.__benefitDefaultsCleaned = true;
  } catch (err) {
    console.error("[Cleanup] no se pudieron limpiar los defaults de vigencia/condiciones:", err);
  }
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

/**
 * Crea la tabla `merchant_requests` en runtime (patrón de seeding del proyecto).
 * Antes solo se creaba al enviar el formulario de "sumate como comercio", así que
 * si nadie lo había usado todavía la tabla no existía y las stats fallaban con
 * "no such table: merchant_requests". La garantizamos también al leer.
 */
export async function ensureMerchantRequestsTable(db: any) {
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
  // Memoización por request: una misma solicitud puede pedir el catálogo varias
  // veces (listado + filtros + similares). Se cachea en sharedMap para no repetir
  // las consultas a la base dentro del mismo request.
  const cached = requestEvent.sharedMap.get("__customBenefits") as Benefit[] | undefined;
  if (cached) return cached;
  try {
    const db = getDB(requestEvent);
    // Automatically guarantee database is populated from seed.json on start
    await ensureDbSeeded(db);
    // Anula los defaults genéricos de vigencia/condiciones heredados del seed.
    await ensureBenefitDefaultsCleanup(db);

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

    const mapped = dbBenefits.map((cb) => {
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

    requestEvent.sharedMap.set("__customBenefits", mapped);
    return mapped;
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
