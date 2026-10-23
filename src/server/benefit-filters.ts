import type { RequestEventBase } from "@builder.io/qwik-city";
import { sql } from "drizzle-orm";
import { getDB } from "~/db";
import { benefitFilterOptions } from "~/db/schema";

export type BenefitFilterType = "categorias" | "ubicaciones" | "ofertas";

export interface BenefitFilterOption {
  id: number;
  descripcion: string;
}

export class BenefitFilterValidationError extends Error {
  /** Form field the message belongs to, so the admin form can show it next to that select. */
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

export const BENEFIT_FILTERS_CACHE_KEY = "__benefit_filters";
const SAVED_FILTERS_CACHE_KEY = "__saved_benefit_filters";
const FILTER_TYPES: BenefitFilterType[] = ["categorias", "ubicaciones", "ofertas"];
const SELECTION_FIELDS = {
  categoryId: { type: "categorias", message: "Seleccioná una categoría válida." },
  locationId: { type: "ubicaciones", message: "Seleccioná una ubicación válida." },
  offerId: { type: "ofertas", message: "Seleccioná un descuento válido." },
} as const;

type BenefitFilterSelection = Record<keyof typeof SELECTION_FIELDS, string>;

function cleanDescription(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeDescription(value: string): string {
  return cleanDescription(value).toLowerCase();
}

export function getSavedBenefitFilters(event: RequestEventBase) {
  type Rows = (typeof benefitFilterOptions.$inferSelect)[];
  const cached = event.sharedMap.get(SAVED_FILTERS_CACHE_KEY) as Promise<Rows> | undefined;
  if (cached) return cached;

  const pending = Promise.resolve().then(() =>
    getDB(event).select().from(benefitFilterOptions).orderBy(benefitFilterOptions.id),
  );
  event.sharedMap.set(SAVED_FILTERS_CACHE_KEY, pending);
  return pending;
}

/** Validate the selected options before uploading media or writing a benefit. */
export async function validateBenefitFilterSelection(
  event: RequestEventBase,
  selection: BenefitFilterSelection,
): Promise<void> {
  const fields = Object.keys(SELECTION_FIELDS) as (keyof BenefitFilterSelection)[];
  for (const field of fields) {
    const value = selection[field];
    if (typeof value !== "string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
      throw new BenefitFilterValidationError(SELECTION_FIELDS[field].message, field);
    }
  }

  const { getFilters } = await import("./cache");
  // Avoid loading benefit rows here: loaders must see the benefit written by
  // this action, rather than memoized rows from before the write.
  const [filters, saved] = await Promise.all([getFilters(), getSavedBenefitFilters(event)]);
  for (const field of fields) {
    const { type, message } = SELECTION_FIELDS[field];
    const id = Number(selection[field]);
    if (!filters[type].some((option) => option.id === id) && !saved.some((option) => option.type === type && option.id === id)) {
      throw new BenefitFilterValidationError(message, field);
    }
  }
}

export async function createBenefitFilter(
  event: RequestEventBase,
  type: BenefitFilterType,
  descripcion: string,
): Promise<BenefitFilterOption> {
  if (!FILTER_TYPES.includes(type)) {
    throw new BenefitFilterValidationError("Seleccioná un tipo de opción válido.");
  }
  const description = typeof descripcion === "string" ? cleanDescription(descripcion) : "";
  if (!description || description.length > 100) {
    throw new BenefitFilterValidationError("Ingresá un nombre de entre 1 y 100 caracteres.");
  }

  // Load the API/seed values without invoking the persisted filters reader again.
  const { getFilters } = await import("./cache");
  const filters = await getFilters();
  const normalizedName = normalizeDescription(description);
  const existing = filters[type].find((option) => normalizeDescription(option.descripcion) === normalizedName);
  if (existing) return { id: existing.id, descripcion: existing.descripcion };

  const seedMaxId = Math.max(0, ...FILTER_TYPES.flatMap((key) => filters[key].map((option) => option.id)));
  const [option] = await getDB(event).insert(benefitFilterOptions).values({
    // Allocation and duplicate resolution happen in one statement so concurrent
    // additions cannot select the same ID or insert duplicate names.
    id: sql`(select max(coalesce(max(id), 0), ${seedMaxId}) + 1 from ${benefitFilterOptions})`,
    type,
    descripcion: description,
    normalizedName,
  }).onConflictDoUpdate({
    target: [benefitFilterOptions.type, benefitFilterOptions.normalizedName],
    set: { normalizedName },
  }).returning({
    id: benefitFilterOptions.id,
    descripcion: benefitFilterOptions.descripcion,
  });

  event.sharedMap.delete(SAVED_FILTERS_CACHE_KEY);
  event.sharedMap.delete(BENEFIT_FILTERS_CACHE_KEY);
  return option;
}
