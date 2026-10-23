import type { Benefit } from "~/server/cache";

/** What the home shows for each campaign field the admin leaves empty. */
export const CAMPAIGN_DEFAULTS = {
  tag: "Selección Gourmet",
  emoji: "☕",
  title: "Cafecitos & Desayunos",
  subtitle: "Disfrutá del mejor aroma a café, desayunos premium y meriendas increíbles con tu credencial digital LPRC.",
  query: "cafe,café,desayuno,factura,gastronomia,gastro",
};

/** The home shows at most this many campaign benefits. */
export const CAMPAIGN_LIMIT = 4;

type CampaignCandidate = Pick<Benefit, "titulo" | "descripcion" | "resumen" | "categorias">;

function createdAt(benefit: Benefit): number {
  const timestamp = Date.parse(benefit.created_at || "");
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
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

export function selectHomeBenefits(benefits: Benefit[], campaignQuery?: string | null) {
  const active = benefits.filter((benefit) => benefit.mostrar_app !== 0 && benefit.isActive !== false);
  const recent = [...active].sort((a, b) => {
    const dateA = createdAt(a);
    const dateB = createdAt(b);
    if (dateA !== dateB) return dateB > dateA ? 1 : -1;
    // Slugs are unique and stable; mapped numeric IDs can change between requests.
    return a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
  });
  const terms = campaignTerms(campaignQuery);

  return {
    gold: recent.filter((benefit) => benefit.isFeatured).slice(0, 6),
    nuevos: recent.slice(0, 6),
    cafecitos: active.filter((benefit) => matchesCampaign(benefit, terms)).slice(0, CAMPAIGN_LIMIT),
  };
}
