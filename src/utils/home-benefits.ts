import type { Benefit, Filters } from "~/server/cache";

/** What the home shows for each campaign field the admin leaves empty. */
export const CAMPAIGN_DEFAULTS = {
  tag: "Para arrancar el día",
  // lprc.com.ar headings carry no emojis; the admin can still add one on purpose.
  emoji: "",
  title: "Cafecitos y desayunos",
  subtitle: "Cafeterías, desayunos y meriendas con descuento para socios. Mostrá tu cupón antes de pagar.",
  query: "cafe,café,desayuno,factura,gastronomia,gastro",
};

/** The home shows at most this many campaign benefits. */
export const CAMPAIGN_LIMIT = 4;

const ROW_LIMIT = 6;
const MORE_LIMIT = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

type CampaignCandidate = Pick<Benefit, "titulo" | "descripcion" | "resumen" | "categorias">;

function createdAt(benefit: Pick<Benefit, "created_at">): number {
  const timestamp = Date.parse(benefit.created_at || "");
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

/** Slugs are unique and stable; mapped numeric IDs can change between requests. */
function bySlug(a: Benefit, b: Benefit): number {
  return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
}

function byNewest(a: Benefit, b: Benefit): number {
  const dateA = createdAt(a);
  const dateB = createdAt(b);
  if (dateA !== dateB) return dateB > dateA ? 1 : -1;
  return bySlug(a, b);
}

export function isPublicBenefit(benefit: Pick<Benefit, "mostrar_app" | "isActive">): boolean {
  return benefit.mostrar_app !== 0 && benefit.isActive !== false;
}

export function campaignTerms(campaignQuery?: string | null): string[] {
  return (campaignQuery || CAMPAIGN_DEFAULTS.query)
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

export function matchesCampaign(benefit: CampaignCandidate, terms: string[]): boolean {
  const text = [benefit.titulo, benefit.descripcion, benefit.resumen, ...benefit.categorias.map((category) => category.descripcion)]
    .map((value) => value.toLowerCase());
  return terms.some((term) => text.some((value) => value.includes(term)));
}

/** Items not yet shown go first; shown ones only fill the gaps so a block is never emptied by the rule. */
function preferUnseen(items: Benefit[], seen: Set<string>, limit: number): Benefit[] {
  return [...items.filter((item) => !seen.has(item.url)), ...items.filter((item) => seen.has(item.url))].slice(0, limit);
}

/**
 * Rows of the home page. Each block avoids repeating what an earlier one already shows:
 * - `gold`: newest featured benefits.
 * - `nuevos`: newest benefits loaded after the catalog's first day, minus `gold`. The
 *   first load (often the whole catalog at once) is not "new", so a catalog loaded in a
 *   single day has no `nuevos` at all.
 * - `cafecitos`: the campaign. `campaignSlugs`, when the admin picked benefits by hand,
 *   replaces the keyword match and keeps the admin's order; keyword matches prefer
 *   benefits not shown above.
 * - `mas`: the "more benefits" preview, preferring benefits shown nowhere else.
 */
export function selectHomeBenefits(benefits: Benefit[], campaignQuery?: string | null, campaignSlugs: string[] = []) {
  const active = benefits.filter(isPublicBenefit);
  const recent = [...active].sort(byNewest);

  const gold = recent.filter((benefit) => benefit.isFeatured).slice(0, ROW_LIMIT);
  const seen = new Set(gold.map((benefit) => benefit.url));

  const dated = active.map(createdAt).filter(Number.isFinite);
  const firstDayEnds = dated.length ? Math.min(...dated) + DAY_MS : Number.POSITIVE_INFINITY;
  const nuevos = recent
    .filter((benefit) => createdAt(benefit) >= firstDayEnds && !seen.has(benefit.url))
    .slice(0, ROW_LIMIT);
  for (const benefit of nuevos) seen.add(benefit.url);

  const terms = campaignTerms(campaignQuery);
  const cafecitos = campaignSlugs.length
    ? campaignSlugs
        .map((slug) => active.find((benefit) => benefit.url === slug))
        .filter((benefit): benefit is Benefit => Boolean(benefit))
        .slice(0, CAMPAIGN_LIMIT)
    : preferUnseen(active.filter((benefit) => matchesCampaign(benefit, terms)), seen, CAMPAIGN_LIMIT);
  for (const benefit of cafecitos) seen.add(benefit.url);

  return { gold, nuevos, cafecitos, mas: preferUnseen(active, seen, MORE_LIMIT) };
}

/**
 * Filters with counts taken from the given benefits (published only). The saved options
 * keep stale counts, or none for options created in the admin, which hid real discounts.
 * Options keep their order so chips do not jump around as the counts change.
 */
export function withLiveCounts(filters: Filters, benefits: Benefit[]): Filters {
  const counts = { categorias: new Map<number, number>(), ubicaciones: new Map<number, number>(), ofertas: new Map<number, number>() };
  const add = (map: Map<number, number>, id: number) => map.set(id, (map.get(id) || 0) + 1);
  for (const benefit of benefits.filter(isPublicBenefit)) {
    for (const option of benefit.categorias) add(counts.categorias, option.id);
    for (const option of benefit.ubicacion) add(counts.ubicaciones, option.id);
    for (const option of benefit.ofertas) add(counts.ofertas, option.id);
  }
  const count = <T extends { id: number }>(options: T[], map: Map<number, number>) =>
    options.map((option) => ({ ...option, beneficios_count: map.get(option.id) || 0 }));
  return {
    categorias: count(filters.categorias, counts.categorias),
    ubicaciones: count(filters.ubicaciones, counts.ubicaciones),
    ofertas: count(filters.ofertas, counts.ofertas),
  };
}

/**
 * Display text for a benefit's discount ("10 % OFF" → "10% OFF", "15% de descuento" →
 * "15% OFF"), so cards read the same however each benefit was typed in.
 */
export function formatDiscount(resumen?: string | null): string {
  const text = (resumen || "")
    .replace(/^\s*descuento del\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "Exclusivo";
  return text
    .replace(/(\d)\s*%/g, "$1%")
    .replace(/%\s*de descuento/gi, "% OFF")
    .replace(/\boff\b/gi, "OFF");
}

/** Label of a discount filter option ("25%" → "25% OFF"; "Socios free" stays as is). */
export function offerLabel(descripcion: string): string {
  if (/promoci/i.test(descripcion)) return "Promociones";
  const text = formatDiscount(descripcion);
  return /%/.test(text) && !/OFF|free|gratis/i.test(text) ? `${text} OFF` : text;
}

/** Highest percentage a benefit offers; free activities rank above any discount. */
export function discountValue(benefit: Pick<Benefit, "resumen" | "ofertas">): number {
  const texts = [benefit.resumen || "", ...benefit.ofertas.map((offer) => offer.descripcion)];
  if (texts.some((text) => /\b(free|gratis)\b/i.test(text))) return 100;
  const values = texts.flatMap((text) => [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map((match) => Number(match[1].replace(",", "."))));
  return values.length ? Math.max(...values) : -1;
}

export const CATALOG_SORTS = [
  { value: "", label: "Destacados" },
  { value: "nuevos", label: "Más nuevos" },
  { value: "descuento", label: "Mayor descuento" },
  { value: "az", label: "A–Z" },
] as const;

export type CatalogSort = (typeof CATALOG_SORTS)[number]["value"];

export function parseCatalogSort(value: string | null | undefined): CatalogSort {
  return CATALOG_SORTS.find((sort) => sort.value === value)?.value ?? "";
}

/** Catalog order for `?orden=`. The default keeps the catalog order with featured benefits first. */
export function sortCatalog(benefits: Benefit[], sort: CatalogSort): Benefit[] {
  const items = [...benefits];
  if (sort === "nuevos") return items.sort(byNewest);
  if (sort === "az") {
    return items.sort((a, b) => a.titulo.localeCompare(b.titulo, "es", { sensitivity: "base" }) || bySlug(a, b));
  }
  if (sort === "descuento") return items.sort((a, b) => discountValue(b) - discountValue(a) || bySlug(a, b));
  // Array#sort is stable, so non-featured benefits keep their catalog order.
  return items.sort((a, b) => Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)));
}

/**
 * The location most results share, so cards can skip repeating it ("La Plata" on every
 * card). Null when no location covers more than half of the results.
 */
export function commonLocation(benefits: Pick<Benefit, "ubicacion">[]): string | null {
  const counts = new Map<string, { name: string; count: number }>();
  for (const benefit of benefits) {
    const name = benefit.ubicacion[0]?.descripcion?.trim();
    if (!name) continue;
    const entry = counts.get(name.toLowerCase()) || { name, count: 0 };
    entry.count++;
    counts.set(name.toLowerCase(), entry);
  }
  const best = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  return best && best.count * 2 > benefits.length ? best.name : null;
}

/** "En el club" benefits deserve a highlight instead of a plain location line. */
export function isClubLocation(name?: string | null): boolean {
  return /en el club/i.test(name || "");
}
