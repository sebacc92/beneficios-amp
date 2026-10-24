/** The same spelling rules for catalog results, suggestions and map markers. */
export function normalizeSearchText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .replace(/\s+/g, " ")
    .trim();
}

type SearchableBenefit = {
  titulo: string;
  descripcion: string;
  categorias: { descripcion: string }[];
  ubicacion: { descripcion: string }[];
};

export function matchesBenefitQuery(benefit: SearchableBenefit, query: string): boolean {
  const needle = normalizeSearchText(query);
  return !needle || [
    benefit.titulo,
    benefit.descripcion,
    ...benefit.categorias.map((category) => category.descripcion),
    ...benefit.ubicacion.map((location) => location.descripcion),
  ].some((value) => normalizeSearchText(value).includes(needle));
}
