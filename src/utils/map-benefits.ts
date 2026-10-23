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

/** Catalog images: legacy rows store bare file names from the previous portal. */
export function benefitImageUrl(image: string | null | undefined): string | null {
  if (!image) return null;
  return /^(https?:)?\//.test(image) ? image : `https://beneficios.lprc.ar/files/${image}`;
}

export interface MerchantDetails {
  address: string | null;
  hours: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  email: string | null;
}

/** What older benefits keep inside the description HTML ("<b>DIRECCIÓN</b>: …"). */
export function extractContacts(html: string): Partial<MerchantDetails> {
  const contacts: Partial<MerchantDetails> = {};
  if (!html) return contacts;
  const field = (labels: string) =>
    html.match(new RegExp(`<b>(?:${labels})</b>\\.?:\\s*([^<]+)`, "i"))?.[1].trim() || undefined;

  contacts.address = field("DIRECCIÓN|DIRECCION|DOMICILIO");
  contacts.hours = field("HORARIOS?");
  contacts.phone = field("CEL|TEL|TELÉFONO|TELEFONO");
  contacts.whatsapp = field("WHATSAPP");
  // Older entries list a mobile as "CEL" and expect it to work on WhatsApp too.
  if (!contacts.whatsapp && contacts.phone && /^(221|11)|-/.test(contacts.phone)) contacts.whatsapp = contacts.phone;

  const email = html.match(/href="mailto:([^"]+)"/i) || html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (email) contacts.email = (email[1] || email[0]).trim();

  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (href.includes("instagram.com")) contacts.instagram = href;
    else if (!/^(mailto|tel):/i.test(href) && !href.includes("facebook.com")) contacts.website = href;
  }
  return contacts;
}

/** "@local", "local" or a profile URL -> profile URL; null when it is not an Instagram account. */
export function instagramUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const handle = /instagram\.com/i.test(raw)
    ? raw.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "").split(/[/?#]/)[0]
    : raw.replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : null;
}

export function instagramHandle(url: string): string {
  return `@${url.replace(/^https:\/\/www\.instagram\.com\//, "").replace(/\/$/, "")}`;
}

/** Only http(s) pages; a bare domain gets https. Anything else (javascript:, relative paths) is dropped. */
export function websiteUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(raw) ? `https://${raw}` : null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function websiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type MerchantSource = { descripcion?: string | null } & Partial<
  Record<"address" | "hours" | "phone" | "whatsapp" | "instagram" | "website", string | null>
>;

/** Structured columns win; the description is only a fallback for benefits loaded before they existed. */
export function merchantDetails(benefit: MerchantSource): MerchantDetails {
  const legacy = extractContacts(benefit.descripcion ?? "");
  const pick = (value: string | null | undefined, fallback?: string | null) => value?.trim() || fallback?.trim() || null;
  return {
    address: pick(benefit.address, legacy.address),
    hours: pick(benefit.hours, legacy.hours),
    phone: pick(benefit.phone, legacy.phone),
    whatsapp: pick(benefit.whatsapp, legacy.whatsapp),
    instagram: instagramUrl(pick(benefit.instagram, legacy.instagram)),
    website: websiteUrl(pick(benefit.website, legacy.website)),
    email: legacy.email?.trim() || null,
  };
}

export function phoneUrl(number: string): string | null {
  const digits = number.replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 6 ? `tel:${digits}` : null;
}

/** Local numbers ("221 555-1234") need Argentina's mobile prefix (549) for wa.me. */
export function merchantWhatsappUrl(number: string): string | null {
  const digits = number.replace(/\D/g, "").replace(/^0/, "");
  if (digits.length < 8) return null;
  const international = digits.startsWith("54") ? digits : `549${digits}`;
  const text = "Hola! Te escribo desde el portal de beneficios de La Plata Rugby Club.";
  return `https://wa.me/${international}?text=${encodeURIComponent(text)}`;
}

/** Google Maps directions: exact coordinates when the benefit has them, otherwise the address. */
export function directionsUrl(place: {
  latitud?: unknown;
  longitud?: unknown;
  address?: string | null;
  locality?: string | null;
}): string | null {
  const coordinates = parseCoordinates(place.latitud, place.longitud);
  const address = place.address?.trim();
  const locality = place.locality?.trim();
  const destination = coordinates
    ? `${coordinates.latitude},${coordinates.longitude}`
    : address && locality && !address.toLowerCase().includes(locality.toLowerCase())
      ? `${address}, ${locality}`
      : address || null;
  return destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
    : null;
}

/**
 * Leaflet divIcon options for the brand pins: a yellow square with a navy border for
 * merchants and a navy one with the club crest for the club grounds. Styles: MAP_PIN_STYLES.
 */
export function mapPinIcon(kind: "benefit" | "club") {
  return kind === "club"
    ? {
        className: "lprc-pin-icon",
        html: '<span class="lprc-pin lprc-pin--club"><img src="/lprc.avif" alt="" width="26" height="29"></span>',
        iconSize: [42, 52],
        iconAnchor: [21, 52],
        popupAnchor: [0, -46],
      }
    : {
        className: "lprc-pin-icon",
        html: '<span class="lprc-pin"><span class="lprc-pin__glyph">%</span></span>',
        iconSize: [34, 44],
        iconAnchor: [17, 44],
        popupAnchor: [0, -38],
      };
}

/** Pins and square Leaflet chrome; loaded with useStyles$ by every page that draws a map. */
export const MAP_PIN_STYLES = `
.lprc-pin-icon { background: none; border: 0; }
.lprc-pin { position: relative; display: block; width: 100%; height: 100%; filter: drop-shadow(0 2px 3px rgb(2 6 23 / 0.45)); }
.lprc-pin::before { content: ""; position: absolute; inset: 0 0 10px 0; background: #FFD700; border: 3px solid #0a1128; }
.lprc-pin::after { content: ""; position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); border-style: solid; border-width: 11px 9px 0 9px; border-color: #0a1128 transparent transparent transparent; }
.lprc-pin__glyph { position: absolute; inset: 0 0 10px 0; z-index: 1; display: flex; align-items: center; justify-content: center; color: #0a1128; font: 700 15px/1 "Oswald", sans-serif; }
.lprc-pin--club::before { background: #0a1128; border-color: #FFD700; }
.lprc-pin--club::after { border-top-color: #FFD700; }
.lprc-pin--club img { position: absolute; z-index: 1; left: 50%; top: 5px; transform: translateX(-50%); width: 26px; height: 29px; object-fit: contain; }
.lprc-pin--active::before { background: #0a1128; border-color: #FFD700; }
.lprc-pin--active .lprc-pin__glyph { color: #FFD700; }
.lprc-pin--active::after { border-top-color: #FFD700; }
.leaflet-container .leaflet-popup-content-wrapper, .leaflet-container .leaflet-popup-tip { border-radius: 0; box-shadow: 0 4px 16px rgb(2 6 23 / 0.25); }
.leaflet-container .leaflet-popup-content { margin: 14px 16px; font-family: "Inter", sans-serif; }
.leaflet-container a.leaflet-popup-close-button { width: 32px; height: 32px; font-size: 22px; line-height: 30px; color: #0a1128; }
.leaflet-container .leaflet-bar, .leaflet-container .leaflet-bar a { border-radius: 0 !important; }
`;
