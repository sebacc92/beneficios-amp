// Helpers para integrar Instagram y WhatsApp dentro de la descripción HTML del
// beneficio. La ficha pública (extractContacts) lee estos datos de la descripción,
// así que se guardan ahí en un formato normalizado.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Quita los bloques <p> de DIRECCIÓN/WHATSAPP/INSTAGRAM de la descripción. */
export function stripContactBlocks(html: string): string {
  return (html || "")
    .replace(/<p>(?:(?!<\/p>).)*?<b>\s*(?:DIRECCIÓN|DOMICILIO)\s*<\/b>(?:(?!<\/p>).)*?<\/p>/gis, "")
    .replace(/<p>(?:(?!<\/p>).)*?<b>\s*WHATSAPP\s*<\/b>(?:(?!<\/p>).)*?<\/p>/gis, "")
    .replace(/<p>(?:(?!<\/p>).)*?<b>\s*INSTAGRAM\s*<\/b>(?:(?!<\/p>).)*?<\/p>/gis, "")
    .trim();
}

/** Separa la descripción en cuerpo + dirección + whatsapp + instagram (para editar). */
export function splitContacts(html: string): { body: string; whatsapp: string; instagram: string; direccion: string } {
  const source = html || "";
  let whatsapp = "";
  let instagram = "";
  let direccion = "";

  const dir = source.match(/<b>\s*(?:DIRECCIÓN|DOMICILIO)\s*<\/b>\s*:?\s*([^<]+)/i);
  if (dir) direccion = dir[1].trim();

  const ws = source.match(/<b>\s*WHATSAPP\s*<\/b>\s*:?\s*([^<]+)/i);
  if (ws) whatsapp = ws[1].trim();

  const igLink = source.match(/href="([^"]*instagram\.com[^"]*)"/i);
  if (igLink) {
    instagram = igLink[1].trim();
  } else {
    const igText = source.match(/<b>\s*INSTAGRAM\s*<\/b>\s*:?\s*([^<]+)/i);
    if (igText) instagram = igText[1].trim();
  }

  return { body: stripContactBlocks(source), whatsapp, instagram, direccion };
}

/** Normaliza el input de Instagram a una URL + texto a mostrar. */
function normalizeInstagram(input: string): { url: string; display: string } | null {
  const t = (input || "").trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) {
    const handle = t.replace(/\/+$/, "").split("/").pop() || t;
    return { url: t, display: handle.startsWith("@") ? handle : "@" + handle };
  }
  const handle = t.replace(/^@/, "");
  return { url: `https://www.instagram.com/${handle}`, display: "@" + handle };
}

/** Reconstruye la descripción integrando Dirección, WhatsApp e Instagram normalizados. */
export function mergeContacts(body: string, whatsapp: string, instagram: string, direccion: string = ""): string {
  const clean = stripContactBlocks(body || "");
  const parts: string[] = [clean].filter(Boolean);

  if (direccion && direccion.trim()) {
    parts.push(`<p><b>DIRECCIÓN</b>: ${escapeHtml(direccion.trim())}</p>`);
  }
  if (whatsapp && whatsapp.trim()) {
    parts.push(`<p><b>WHATSAPP</b>: ${escapeHtml(whatsapp.trim())}</p>`);
  }
  const ig = normalizeInstagram(instagram);
  if (ig) {
    parts.push(`<p><b>INSTAGRAM</b>: <a href="${ig.url}" target="_blank" rel="noopener">${escapeHtml(ig.display)}</a></p>`);
  }
  return parts.join("");
}
