import type { Benefit } from "~/server/cache";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface UserPosition extends Coordinates {
  accuracy: number;
}

export function parseCoordinates(
  latitude: unknown,
  longitude: unknown,
): Coordinates | null {
  const parse = (value: unknown) =>
    typeof value === "number" ||
    (typeof value === "string" && value.trim() !== "")
      ? Number(value)
      : NaN;
  const lat = parse(latitude);
  const lng = parse(longitude);
  return Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
    ? { latitude: lat, longitude: lng }
    : null;
}

/** Great-circle distance in km; the location stays in browser memory. */
export function distanceKm(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    6371 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)))
  );
}

export function formatDistance(kilometers: number): string {
  if (kilometers < 1) return `${Math.round((kilometers * 1000) / 10) * 10} m`;
  return `${kilometers.toLocaleString("es-AR", { maximumFractionDigits: kilometers < 10 ? 1 : 0 })} km`;
}

export function rankMapBenefits(
  benefits: Benefit[],
  position: Coordinates | null,
) {
  const results = benefits.map((benefit) => ({
    benefit,
    distance: position
      ? distanceKm(
          position,
          parseCoordinates(benefit.latitud, benefit.longitud)!,
        )
      : null,
  }));
  if (position)
    results.sort(
      (a, b) => a.distance! - b.distance! || a.benefit.id - b.benefit.id,
    );
  return results;
}

export function filterMapBenefits(
  benefits: Benefit[],
  query: string,
  categoryId: number | null,
  locationId: number | null,
  offerId: number | null = null,
): Benefit[] {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es-AR");
  const normalizedQuery = normalize(query.trim());
  return benefits.filter((benefit) => {
    if (!parseCoordinates(benefit.latitud, benefit.longitud)) return false;
    if (
      categoryId &&
      !benefit.categorias.some((category) => category.id === categoryId)
    )
      return false;
    if (
      locationId &&
      !benefit.ubicacion.some((location) => location.id === locationId)
    )
      return false;
    if (offerId && !benefit.ofertas.some((offer) => offer.id === offerId))
      return false;
    return (
      !normalizedQuery ||
      normalize(
        [
          benefit.titulo,
          benefit.descripcion,
          ...benefit.categorias.map((category) => category.descripcion),
          ...benefit.ubicacion.map((location) => location.descripcion),
        ].join(" "),
      ).includes(normalizedQuery)
    );
  });
}
