import { upload } from "@vercel/blob/client";

export type UploadFileResult = { url: string } | { error: string };

/**
 * Sube un archivo (ej. PDF) DIRECTO del navegador a Vercel Blob usando client
 * uploads: pide un token a /api/blob-upload y sube el archivo a Blob sin pasar
 * por la función serverless. Evita el límite de ~4.5 MB de cuerpo de Vercel y
 * mantiene el POST del formulario liviano.
 */
export async function uploadFileToBlob(file: File, prefix = "file"): Promise<UploadFileResult> {
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "archivo";
    const blob = await upload(`${prefix}-${Date.now()}-${safeName}`, file, {
      access: "public",
      handleUploadUrl: "/api/blob-upload",
      contentType: file.type || undefined,
    });
    return { url: blob.url };
  } catch (err: any) {
    console.error("[uploadFileToBlob] falló la subida:", err?.message || err);
    return { error: "No se pudo subir el archivo. Probá de nuevo." };
  }
}
