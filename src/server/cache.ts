import type { RequestEventBase } from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { customBenefits } from "~/db/schema";

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
}

export interface Filters {
  categorias: Category[];
  ubicaciones: Location[];
  ofertas: Offer[];
}

// In-memory cache variables on the server
let cachedBenefits: Benefit[] | null = null;
let cachedFilters: Filters | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 8000): Promise<Response> {
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
  if (!force && cachedBenefits && cachedFilters && now - lastFetchTime < CACHE_TTL) {
    return { benefitsCount: cachedBenefits.length, success: true };
  }

  console.log('[Cache] Refreshing benefits and filters cache...');
  try {
    // 1. Fetch filters
    const filtersRes = await fetchWithTimeout('https://beneficios.amepla.org.ar/api/v1/filtros/beneficios');
    if (!filtersRes.ok) throw new Error(`Filters API returned ${filtersRes.status}`);
    const filtersData = await filtersRes.json() as Filters;

    // 2. Fetch benefits pages in parallel (original has ~42-45 pages)
    const totalPages = 45;
    const pagePromises: Promise<Benefit[]>[] = [];
    
    for (let page = 1; page <= totalPages; page++) {
      pagePromises.push(
        fetchWithTimeout(`https://beneficios.amepla.org.ar/api/v1/beneficios?page=${page}`)
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

    const results = await Promise.all(pagePromises);
    const allData: Benefit[] = [];
    for (const items of results) {
      allData.push(...items);
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

    cachedBenefits = uniqueBenefits;
    cachedFilters = filtersData;
    lastFetchTime = now;

    console.log(`[Cache] Successfully cached ${cachedBenefits.length} benefits and filters.`);
    return { benefitsCount: cachedBenefits.length, success: true };
  } catch (error: any) {
    console.error('[Cache] Failed to fetch live data:', error.message);
    
    // Attempt fallback from local JSON files if they exist (helps with build & offline dev)
    try {
      const localSeed = await import('./data/seed.json').catch(() => null);
      if (localSeed && localSeed.benefits && localSeed.filters) {
        cachedBenefits = localSeed.benefits as Benefit[];
        cachedFilters = localSeed.filters as Filters;
        lastFetchTime = now;
        console.log(`[Cache] Loaded fallback seed data: ${cachedBenefits.length} benefits.`);
        return { benefitsCount: cachedBenefits.length, success: true };
      }
    } catch (fallbackError) {
      console.error('[Cache] Fallback seed loading failed:', fallbackError);
    }

    // If cache is empty and API failed, initialize with empty structures to avoid crash
    if (!cachedBenefits) cachedBenefits = [];
    if (!cachedFilters) cachedFilters = { categorias: [], ubicaciones: [], ofertas: [] };
    
    return { benefitsCount: cachedBenefits.length, success: false };
  }
}

export async function getBenefits(): Promise<Benefit[]> {
  await initCache();
  return cachedBenefits || [];
}

export async function getFilters(): Promise<Filters> {
  await initCache();
  return cachedFilters || { categorias: [], ubicaciones: [], ofertas: [] };
}

// Transforms DB custom benefits schema into standard cached Benefit interface elements
export async function getCustomBenefits(requestEvent: RequestEventBase): Promise<Benefit[]> {
  try {
    const db = getDB(requestEvent);
    const dbBenefits = await db.select().from(customBenefits);
    const filters = await getFilters();

    return dbBenefits.map((cb) => {
      const cat = filters.categorias.find((c) => c.id === cb.categoryId) || { id: cb.categoryId, descripcion: "Otro" };
      const loc = filters.ubicaciones.find((l) => l.id === cb.locationId) || { id: cb.locationId, descripcion: "La Plata" };
      const off = filters.ofertas.find((o) => o.id === cb.offerId) || { id: cb.offerId, descripcion: "Especial" };

      // Derive numerical ID from slug string or use a hashed representation
      const numId = cb.slug.split("-")[0] && !isNaN(Number(cb.slug.split("-")[0]))
        ? Number(cb.slug.split("-")[0])
        : Math.floor(Math.random() * 10000) + 90000;

      return {
        id: numId,
        titulo: cb.titulo,
        descripcion: cb.descripcion,
        imagen: cb.imagen || null,
        url: cb.slug,
        resumen: cb.resumen,
        latitud: null,
        longitud: null,
        categorias: [cat],
        ubicacion: [loc],
        ofertas: [off],
        orden_app: cb.isFeatured ? 1 : 0,
        mostrar_app: 1,
        isPremiumOnly: cb.isPremiumOnly,
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
}

export interface SearchResult {
  data: Benefit[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export async function searchBenefits(params: SearchParams): Promise<SearchResult> {
  const allBenefits = [...await getBenefits()];
  
  // Include custom benefits from Turso if requestEvent is active
  if (params.requestEvent) {
    const customList = await getCustomBenefits(params.requestEvent);
    allBenefits.unshift(...customList); // Prepend custom CRUD benefits
  }
  
  const query = params.query?.toLowerCase().trim() || '';
  const categoryId = params.categoryId ? Number(params.categoryId) : null;
  const locationId = params.locationId ? Number(params.locationId) : null;
  const offerId = params.offerId ? Number(params.offerId) : null;
  const page = params.page && params.page > 0 ? Number(params.page) : 1;
  const limit = params.limit && params.limit > 0 ? Number(params.limit) : 12;

  let filtered = allBenefits;

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
