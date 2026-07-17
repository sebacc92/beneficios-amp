/**
 * Sanitizador de HTML enriquecido con whitelist ESTRICTA, sin dependencias
 * (compatible con el runtime Edge — no usa DOM ni librerías con jsdom).
 *
 * Tags permitidos: p, br, strong, em, ul, ol, li, a.
 *   - `b` → `strong`, `i` → `em` (normalización).
 *   - En `a` sólo se conserva `href` y sólo si es http/https; se fuerza
 *     target="_blank" rel="noopener noreferrer". Links inválidos (javascript:,
 *     data:, relativos) se descartan conservando el texto.
 *   - Cualquier otro tag/atributo se elimina (se conserva el texto interno).
 *   - <script>, <style>, <iframe>, etc. se eliminan con su contenido.
 *
 * Punto canónico: se sanitiza al GUARDAR (fuente de verdad) y también al RENDER
 * como defensa en profundidad. La función es **idempotente**: correrla N veces
 * equivale a correrla una — no re-escapa entidades ya válidas (`&nbsp;`, `&amp;`,
 * `&#123;`…), evitando el doble escapado (`&amp;nbsp;`) que producía contentEditable.
 */

const ALLOWED = new Set(["p", "br", "strong", "em", "ul", "ol", "li", "a"]);
const TAG_MAP: Record<string, string> = { b: "strong", strong: "strong", i: "em", em: "em" };
// Tags cuyo contenido se descarta por completo.
const DROP_WITH_CONTENT = "script|style|iframe|object|embed|svg|math|noscript|template|title|head|link|meta";

// Escapa un `&` SOLO si no inicia ya una entidad válida (nombrada o numérica).
// Así el escapado es idempotente: `&nbsp;`/`&amp;`/`&#38;` no se vuelven a escapar.
const AMP_NOT_ENTITY = /&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g;

function escapeText(s: string): string {
  return s.replace(AMP_NOT_ENTITY, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(AMP_NOT_ENTITY, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Extrae y valida el href de un tag `a`. Devuelve la URL si es http/https, o null. */
function extractSafeHref(rawTag: string): string | null {
  const m = rawTag.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!m) return null;
  let href = (m[2] ?? m[3] ?? m[4] ?? "").trim();
  // Decodificar entidades básicas que podrían usarse para ofuscar el esquema.
  href = href.replace(/&amp;/gi, "&");
  // Sólo se aceptan URLs absolutas http/https (bloquea javascript:, data:, etc.).
  if (!/^https?:\/\//i.test(href)) return null;
  return href;
}

export function sanitizeRichText(input: string | null | undefined): string {
  if (!input) return "";

  // 0. Normalizar el espacio duro que mete contentEditable a un espacio normal.
  //    Se contempla el carácter ( ), la entidad `&nbsp;` y sus variantes
  //    sobre-escapadas (`&amp;nbsp;`, `&amp;amp;nbsp;`…) heredadas del bug previo.
  let s = String(input)
    .replace(/\u00a0/g, " ")
    .replace(/&(?:amp;)*nbsp;/gi, " ");

  // 1. Quitar comentarios y elementos peligrosos junto con su contenido.
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(new RegExp(`<(${DROP_WITH_CONTENT})\\b[\\s\\S]*?<\\/\\s*\\1\\s*>`, "gi"), "");
  // Aperturas sueltas de esos tags (sin cierre).
  s = s.replace(new RegExp(`<\\/?(${DROP_WITH_CONTENT})\\b[^>]*>`, "gi"), "");

  let out = "";
  let i = 0;
  const n = s.length;
  const stack: string[] = [];

  while (i < n) {
    const lt = s.indexOf("<", i);
    if (lt === -1) {
      out += escapeText(s.slice(i));
      break;
    }
    out += escapeText(s.slice(i, lt));

    const gt = s.indexOf(">", lt);
    if (gt === -1) {
      // "<" sin cierre: se trata como texto.
      out += escapeText(s.slice(lt));
      break;
    }

    const rawTag = s.slice(lt + 1, gt).trim();
    i = gt + 1;
    if (!rawTag) continue;

    const isClose = rawTag.startsWith("/");
    const nameMatch = (isClose ? rawTag.slice(1) : rawTag).match(/^([a-zA-Z0-9]+)/);
    if (!nameMatch) continue;

    let tag = nameMatch[1].toLowerCase();
    tag = TAG_MAP[tag] || tag;
    if (!ALLOWED.has(tag)) continue; // se descarta el markup, se conserva el texto

    if (isClose) {
      const idx = stack.lastIndexOf(tag);
      if (idx !== -1) {
        out += `</${tag}>`;
        stack.splice(idx, 1);
      }
      continue;
    }

    // Apertura
    if (tag === "br") {
      out += "<br>";
      continue;
    }
    if (tag === "a") {
      const href = extractSafeHref(rawTag);
      if (href) {
        out += `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">`;
        stack.push("a");
      }
      // href inválido → no abrimos el <a> (el texto se conserva; el </a> luego no matchea)
      continue;
    }
    out += `<${tag}>`;
    stack.push(tag);
  }

  // Cerrar los tags que quedaron abiertos.
  for (let k = stack.length - 1; k >= 0; k--) {
    out += `</${stack[k]}>`;
  }

  return out.trim();
}
