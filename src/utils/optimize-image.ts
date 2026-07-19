/**
 * Optimización de imágenes client-side (navegador): redimensiona a un máximo
 * sensato y re-codifica a WebP con compresión. Es el MISMO pipeline que usa el
 * alta de beneficios (canvas → toDataURL webp), extraído acá para reutilizarlo
 * también en la subida de slides del carrusel —que antes subía los JPG/PNG
 * crudos (800–1080 KiB) y era la causa #1 del LCP alto—.
 *
 * Devuelve un data URL `image/webp` listo para `uploadImageDataUrl`.
 */
export async function optimizeImageFileToWebp(
  file: File,
  maxW: number,
  maxH: number,
  quality = 0.82
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });

  return await optimizeDataUrlToWebp(dataUrl, maxW, maxH, quality);
}

/**
 * Igual que `optimizeImageFileToWebp` pero partiendo de un data URL ya leído
 * (útil cuando se descarga/lee la imagen por otro medio).
 */
export function optimizeDataUrlToWebp(
  srcDataUrl: string,
  maxW: number,
  maxH: number,
  quality = 0.82
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No se pudo procesar la imagen."));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/webp", quality));
    };
    img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
    img.src = srcDataUrl;
  });
}

/** Máximos por variante del hero (ver hero-slider.tsx). */
export const SLIDE_MAX_DESKTOP = { maxW: 1920, maxH: 1920 } as const;
export const SLIDE_MAX_MOBILE = { maxW: 1080, maxH: 1920 } as const;
