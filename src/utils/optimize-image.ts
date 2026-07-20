/**
 * Optimización de imágenes client-side (navegador): redimensiona a un máximo
 * sensato y re-codifica a WebP con compresión. Es el MISMO pipeline que usa el
 * alta de beneficios (canvas → toDataURL webp), extraído acá para reutilizarlo
 * también en la subida de slides del carrusel.
 *
 * Devuelve un data URL `image/webp` listo para `uploadImageDataUrl`.
 */
export async function optimizeImageFileToWebp(
  file: File,
  maxW: number,
  maxH: number,
  quality = 0.82
): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  return await optimizeDataUrlToWebp(dataUrl, maxW, maxH, quality);
}

/**
 * Igual que `optimizeImageFileToWebp` pero partiendo de un data URL ya leído.
 */
export function optimizeDataUrlToWebp(
  srcDataUrl: string,
  maxW: number,
  maxH: number,
  quality = 0.82
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    loadImage(srcDataUrl)
      .then((img) => {
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        resolve(drawToWebp(img, w, h, quality));
      })
      .catch(reject);
  });
}

export type ImageVariant = { width: number; dataUrl: string };

/**
 * Genera VARIAS variantes por ancho (para srcset responsive). No hace upscaling:
 * si la fuente es más chica que un ancho objetivo, se usa el ancho de la fuente
 * y se deduplica. Devuelve las variantes ordenadas de menor a mayor ancho.
 */
export async function optimizeImageFileToWebpVariants(
  file: File,
  widths: number[],
  quality = 0.82
): Promise<ImageVariant[]> {
  const src = await readFileAsDataUrl(file);
  const img = await loadImage(src);
  const out: ImageVariant[] = [];
  const seen = new Set<number>();
  for (const target of [...widths].sort((a, b) => a - b)) {
    const w = Math.min(target, img.width);
    if (seen.has(w)) continue; // fuente más chica que dos objetivos → un solo archivo
    seen.add(w);
    const h = Math.round((img.height * w) / img.width);
    out.push({ width: w, dataUrl: drawToWebp(img, w, h, quality) });
  }
  return out;
}

/** Construye el string srcset a partir de variantes ya subidas (url + width). */
export function buildSrcset(entries: { url: string; width: number }[]): string {
  return entries.map((e) => `${e.url} ${e.width}w`).join(", ");
}

// --- helpers internos ---

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

function loadImage(srcDataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    img.src = srcDataUrl;
  });
}

function drawToWebp(img: HTMLImageElement, w: number, h: number, quality: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/webp", quality);
}

/** Máximos por variante del hero (ver hero-slider.tsx). */
export const SLIDE_MAX_DESKTOP = { maxW: 1920, maxH: 1920 } as const;
export const SLIDE_MAX_MOBILE = { maxW: 1080, maxH: 1920 } as const;

/** Anchos de las variantes responsive del hero (srcset). */
export const SLIDE_WIDTHS_DESKTOP = [1280, 1920];
export const SLIDE_WIDTHS_MOBILE = [480, 768];
