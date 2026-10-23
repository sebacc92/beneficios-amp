/**
 * Club facts shared by every page, taken from lprc.com.ar so both sites say the same thing.
 * Change contact data here only: header, footer, help pages and CTAs read from this module.
 */
export const CLUB = {
  name: "La Plata Rugby Club",
  shortName: "LPRC",
  foundedYear: 1934,
  site: "https://lprc.com.ar",
  agendaUrl: "https://lprc.com.ar/eventos",
  clubUrl: "https://lprc.com.ar/el-club",
  fixtureUrl: "https://lprc.com.ar/fixture",
  address: "Camino Parque Centenario e/ 495 y 496",
  locality: "B1897 Manuel B. Gonnet, La Plata",
  memberAccess: "Acceso socios por calle 496",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=La+Plata+Rugby+Club+Gonnet",
  phoneDisplay: "(0221) 484-0412",
  phoneHref: "tel:+542214840412",
  whatsappNumber: "5492216796537",
  whatsappDisplay: "+54 9 221 679-6537",
  /** Club location (OpenStreetMap), used as a reference pin on maps. */
  coordinates: { lat: -34.8787758, lng: -58.0196405 },
  social: {
    instagram: "https://www.instagram.com/laplatarugbyclub/",
    facebook: "https://www.facebook.com/LaPlataRugbyClub",
    x: "https://x.com/laplatarugby",
  },
} as const;

/** Prefilled WhatsApp messages, in the club's informal voice. */
export const WHATSAPP_MESSAGES = {
  haceteSocio: "Hola! Vengo desde el portal de beneficios y quiero hacerme socio de La Plata Rugby Club.",
  dniNoFigura: "Hola! Soy socio de La Plata Rugby Club y mi DNI no figura en el portal de beneficios.",
  consulta: "Hola! Tengo una consulta sobre el portal de beneficios de La Plata Rugby Club.",
  comercio: "Hola! Tengo un comercio adherido al portal de beneficios de La Plata Rugby Club y necesito ayuda para validar un cupón.",
} as const;

/** WhatsApp link with an optional prefilled text (same API lprc.com.ar uses for "Hacete socio"). */
export function whatsappLink(text?: string, number: string = CLUB.whatsappNumber): string {
  const digits = number.replace(/\D/g, "");
  const query = text ? `&text=${encodeURIComponent(text)}` : "";
  return `https://api.whatsapp.com/send?phone=${digits}${query}`;
}

/** "Mi DNI no figura" message, with the DNI the member typed when we have it. */
export function dniHelpMessage(dni?: string | null): string {
  const clean = (dni ?? "").replace(/\D/g, "");
  return clean ? `${WHATSAPP_MESSAGES.dniNoFigura} Mi DNI es ${clean}.` : WHATSAPP_MESSAGES.dniNoFigura;
}
