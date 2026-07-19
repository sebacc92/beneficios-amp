// Helpers para integrar los datos de contacto (dirección, WhatsApp, teléfono,
// redes y sitio web) dentro de la descripción HTML del beneficio. Se guardan como
// bloques <p><b>ETIQUETA</b>: valor</p> al final de la descripción; la ficha
// pública los lee (extractContacts) y arma los enlaces al renderizar.

export interface BenefitContacts {
  direccion?: string;
  whatsapp?: string;
  telefono?: string; // teléfono fijo (separado de WhatsApp)
  instagram?: string;
  facebook?: string;
  twitter?: string; // X (Twitter)
  website?: string; // sitio web
}

// Etiquetas de los bloques de contacto (para poder quitarlos del cuerpo).
const LABELS = "DIRECCIÓN|DOMICILIO|WHATSAPP|TELÉFONO|INSTAGRAM|FACEBOOK|TWITTER|SITIO WEB";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Quita del cuerpo los bloques de contacto (para editar/mostrar sin duplicar). */
export function stripContactBlocks(html: string): string {
  const re = new RegExp(`<p>(?:(?!</p>).)*?<b>\\s*(?:${LABELS})\\s*</b>(?:(?!</p>).)*?</p>`, "gis");
  return (html || "").replace(re, "").trim();
}

// Devuelve el texto que sigue a una etiqueta <b>LABEL</b>: ... (o "" si no está).
function textAfterLabel(html: string, label: string): string {
  const m = html.match(new RegExp(`<b>\\s*${label}\\s*</b>\\s*:?\\s*([^<]+)`, "i"));
  return m ? m[1].trim() : "";
}
// Devuelve el href que contiene `needle` (para descripciones heredadas con links).
function hrefContaining(html: string, needle: string): string {
  const m = html.match(new RegExp(`href="([^"]*${needle.replace(/\./g, "\\.")}[^"]*)"`, "i"));
  return m ? m[1].trim() : "";
}

/** Separa la descripción en cuerpo + todos los datos de contacto (para editar). */
export function splitContacts(html: string): { body: string } & BenefitContacts {
  const s = html || "";
  return {
    body: stripContactBlocks(s),
    direccion: textAfterLabel(s, "(?:DIRECCIÓN|DOMICILIO)"),
    whatsapp: textAfterLabel(s, "WHATSAPP"),
    telefono: textAfterLabel(s, "TELÉFONO"),
    // Redes: primero el bloque de texto propio; si no, un href heredado.
    instagram: textAfterLabel(s, "INSTAGRAM") || hrefContaining(s, "instagram.com"),
    facebook: textAfterLabel(s, "FACEBOOK") || hrefContaining(s, "facebook.com"),
    twitter: textAfterLabel(s, "TWITTER") || hrefContaining(s, "twitter.com") || hrefContaining(s, "x.com"),
    website: textAfterLabel(s, "SITIO WEB"),
  };
}

/**
 * Reconstruye la descripción integrando los datos de contacto como bloques de
 * TEXTO crudo (no links): la ficha arma los enlaces al renderizar. Guardar el
 * valor tal cual el admin lo escribió permite editarlo sin pérdidas.
 */
export function mergeContacts(body: string, contacts: BenefitContacts): string {
  const clean = stripContactBlocks(body || "");
  const parts: string[] = [clean].filter(Boolean);
  const block = (label: string, value?: string) => {
    const v = (value || "").trim();
    if (v) parts.push(`<p><b>${label}</b>: ${escapeHtml(v)}</p>`);
  };
  block("DIRECCIÓN", contacts.direccion);
  block("WHATSAPP", contacts.whatsapp);
  block("TELÉFONO", contacts.telefono);
  block("INSTAGRAM", contacts.instagram);
  block("FACEBOOK", contacts.facebook);
  block("TWITTER", contacts.twitter);
  block("SITIO WEB", contacts.website);
  return parts.join("");
}
