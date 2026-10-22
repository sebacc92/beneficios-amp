import type { RequestEventBase } from "@builder.io/qwik-city";
import { getDB } from "~/db";
import { benefits } from "~/db/schema";
import { BENEFIT_FILTERS_CACHE_KEY, getSavedBenefitFilters } from "./benefit-filters";

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
  isActive?: boolean;
}

export interface Filters {
  categorias: Category[];
  ubicaciones: Location[];
  ofertas: Offer[];
}

interface BenefitsPageResponse {
  data?: Benefit[];
  last_page?: number;
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
    const filtersRes = await fetchWithTimeout('https://beneficios.lprc.ar/api/v1/filtros/beneficios', {}, 8000);
    if (!filtersRes.ok) throw new Error(`Filters API returned ${filtersRes.status}`);
    const filtersData = await filtersRes.json() as Filters;

    // Test page 1 first to check if API is responding fast
    const testPageRes = await fetchWithTimeout('https://beneficios.lprc.ar/api/v1/beneficios?page=1', {}, 8000);
    if (!testPageRes.ok) throw new Error(`API returned ${testPageRes.status} on page 1`);
    const testPageJson = await testPageRes.json() as BenefitsPageResponse;
    const totalPages = testPageJson.last_page || 45;

    const allData: Benefit[] = [...(testPageJson.data || [])];
    const batchSize = 4; // Smaller batch size to prevent overloading WAF / rate limits

    for (let i = 2; i <= totalPages; i += batchSize) {
      const batchPromises: Promise<Benefit[]>[] = [];
      for (let page = i; page < i + batchSize && page <= totalPages; page++) {
        batchPromises.push(
          fetchWithTimeout(`https://beneficios.lprc.ar/api/v1/beneficios?page=${page}`, {}, 10000)
            .then(async (res) => {
              if (!res.ok) throw new Error(`Status ${res.status}`);
              const json = await res.json() as BenefitsPageResponse;
              return json.data || [];
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

async function loadFilters(requestEvent?: RequestEventBase): Promise<Filters> {
  await initCache();
  const cache = globalCached.__benefitsCache;
  if (!cache || !cache.filters) {
    return { categorias: [], ubicaciones: [], ofertas: [] };
  }

  const filters: Filters = {
    categorias: [...cache.filters.categorias],
    ubicaciones: [...cache.filters.ubicaciones],
    ofertas: [...cache.filters.ofertas],
  };
  const categoryCounts: Record<number, number> = {};

  if (requestEvent) {
    const [saved, customBenefits] = await Promise.all([
      getSavedBenefitFilters(requestEvent).catch((error) => {
        console.error("Failed to load saved benefit filters:", error);
        return [];
      }),
      getCustomBenefitRows(requestEvent).catch((error) => {
        console.error("Failed to load benefits for filter counts:", error);
        return [];
      }),
    ]);
    for (const option of saved) {
      if (!filters[option.type].some((existing) => existing.id === option.id)) {
        filters[option.type].push({ id: option.id, descripcion: option.descripcion });
      }
    }
    for (const benefit of customBenefits) {
      if (benefit.validUntil === "draft" || benefit.validUntil?.startsWith("draft|")) continue;
      categoryCounts[benefit.categoryId] = (categoryCounts[benefit.categoryId] || 0) + 1;
    }
  } else {
    for (const benefit of cache.benefits || []) {
      for (const category of benefit.categorias || []) {
        if (category?.id) {
          categoryCounts[category.id] = (categoryCounts[category.id] || 0) + 1;
        }
      }
    }
  }

  const sortedCategorias = filters.categorias
    .map((cat) => ({
      ...cat,
      beneficios_count: categoryCounts[cat.id] || 0,
    }))
    .sort((a, b) => b.beneficios_count - a.beneficios_count);

  return {
    ...filters,
    categorias: sortedCategorias,
  };
}

export function getFilters(requestEvent?: RequestEventBase): Promise<Filters> {
  if (!requestEvent) return loadFilters();
  const cached = requestEvent.sharedMap.get(BENEFIT_FILTERS_CACHE_KEY) as Promise<Filters> | undefined;
  if (cached) return cached;
  const pending = loadFilters(requestEvent);
  requestEvent.sharedMap.set(BENEFIT_FILTERS_CACHE_KEY, pending);
  return pending;
}

// NOTE: seeding used to happen here, on every request, and it deleted the whole
// table whenever the row count did not match the seed file (so creating a 6th
// benefit wiped the other five on the next page load). Seeding is now an explicit,
// insert-only operation: `pnpm seed`. See scripts/seed.mjs.

const CUSTOM_BENEFITS_KEY = "__custom_benefits";
const CUSTOM_BENEFIT_ROWS_KEY = "__custom_benefit_rows";

export function getCustomBenefitRows(requestEvent: RequestEventBase) {
  type Rows = (typeof benefits.$inferSelect)[];
  const memoized = requestEvent.sharedMap.get(CUSTOM_BENEFIT_ROWS_KEY) as Promise<Rows> | undefined;
  if (memoized) return memoized;
  const pending = Promise.resolve().then(() => getDB(requestEvent).select().from(benefits));
  requestEvent.sharedMap.set(CUSTOM_BENEFIT_ROWS_KEY, pending);
  return pending;
}

// Transforms DB custom benefits schema into standard cached Benefit interface elements
async function loadCustomBenefits(requestEvent: RequestEventBase): Promise<Benefit[]> {
  try {
    const [dbBenefits, filters] = await Promise.all([
      getCustomBenefitRows(requestEvent),
      getFilters(requestEvent),
    ]);

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
        isPremiumOnly: cb.isPremiumOnly,
        isFeatured: cb.isFeatured,
        pdfUrl: cb.pdfUrl || null,
        imagenMobile: cb.imagenMobile || null,
        created_at: cb.createdAt,
        isActive,
      } as Benefit;
    });

    return mapped;
  } catch (err) {
    console.error("Failed to load custom benefits from DB:", err);
    return [];
  }
}

export function getCustomBenefits(requestEvent: RequestEventBase): Promise<Benefit[]> {
  // Store the pending promise too, since parallel loaders share this request.
  const cached = requestEvent.sharedMap.get(CUSTOM_BENEFITS_KEY) as Promise<Benefit[]> | undefined;
  if (cached) return cached;
  const pending = loadCustomBenefits(requestEvent);
  requestEvent.sharedMap.set(CUSTOM_BENEFITS_KEY, pending);
  return pending;
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

  // 1. Text search filter
  if (query) {
    filtered = filtered.filter(b => {
      const titleMatch = b.titulo.toLowerCase().includes(query);
      const descMatch = b.descripcion.toLowerCase().includes(query);
      const catMatch = b.categorias.some(c => c.descripcion.toLowerCase().includes(query));
      const locMatch = b.ubicacion.some(l => l.descripcion.toLowerCase().includes(query));
      return titleMatch || descMatch || catMatch || locMatch;
    });
  }

  // 2. Category filter
  if (categoryId) {
    filtered = filtered.filter(b => b.categorias.some(c => c.id === categoryId));
  }

  // 3. Location filter
  if (locationId) {
    filtered = filtered.filter(b => b.ubicacion.some(l => l.id === locationId));
  }

  // 4. Offer/Discount filter
  if (offerId) {
    filtered = filtered.filter(b => b.ofertas.some(o => o.id === offerId));
  }

  // 5. Gold/Premium filter
  if (params.isPremiumOnly) {
    filtered = filtered.filter(b => b.isPremiumOnly);
  }

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
