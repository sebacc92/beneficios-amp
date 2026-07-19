import { uploadFileDataUrl } from "./upload-image";

export type UploadFileResult = { url: string } | { error: string };

/**
 * Sube un archivo (ej. PDF) a Vercel Blob. Lee el archivo como data URL en el
 * navegador y delega el `put` a un `server$` (upload-image.ts), evitando el SDK
 * `@vercel/blob/client` en el cliente —que arrastraba un polyfill de crypto de
 * Node roto (`u.promisify is not a function`) y rompía otros chunks—.
 *
 * El archivo viaja en el cuerpo del server$ (límite ~4.5 MB de Vercel), más que
 * suficiente para un PDF de menú / lista de precios.
 */
export async function uploadFileToBlob(file: File, prefix = "file"): Promise<UploadFileResult> {
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
      reader.readAsDataURL(file);
    });
    return await uploadFileDataUrl(dataUrl, file.name, prefix);
  } catch (err: any) {
    console.error("[uploadFileToBlob] falló la subida:", err?.message || err);
    return { error: "No se pudo subir el archivo. Probá de nuevo." };
  }
}
