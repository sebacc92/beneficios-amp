import { server$ } from "@builder.io/qwik-city";

export type UploadResult = { url: string } | { error: string };

/**
 * Sube una imagen (data URL webp/base64 ya optimizada en el navegador) a Vercel
 * Blob y devuelve la URL pública.
 *
 * Se llama desde el cliente al SELECCIONAR la imagen —antes de enviar el
 * formulario— para que el POST de la action no viaje con las imágenes en base64.
 * Así se evita el límite de ~4.5 MB de cuerpo de Vercel (que provocaba el error
 * 400 "Error al crear el beneficio" cuando se cargaban varias fotos).
 *
 * En desarrollo sin token de Blob, cae a /public/uploads (igual que la action).
 */
export const uploadImageDataUrl = server$(async function (
  dataUrl: string,
  prefix = "benefit"
): Promise<UploadResult> {
  try {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
      return { error: "Formato de imagen inválido." };
    }

    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
    const token = process.env.BLOB_READ_WRITE_TOKEN || this.env.get("BLOB_READ_WRITE_TOKEN");

    if (token) {
      // Import dinámico: @vercel/blob es server-only (arrastra crypto de Node). Si
      // se importa estático, entra al bundle del cliente y rompe otros chunks.
      const { put } = await import("@vercel/blob");
      const blob = await put(fileName, bytes, { access: "public", token });
      return { url: blob.url };
    }

    // Fallback local (dev sin Blob configurado).
    const fsModule = await import("fs/promises");
    const uploadsDir = `${process.cwd()}/public/uploads`;
    await fsModule.mkdir(uploadsDir, { recursive: true });
    await fsModule.writeFile(`${uploadsDir}/${fileName}`, bytes);
    return { url: `/uploads/${fileName}` };
  } catch (err: any) {
    console.error("[uploadImageDataUrl] falló la subida:", err?.message || err);
    return { error: "No se pudo subir la imagen. Probá de nuevo." };
  }
});

/**
 * Sube un archivo genérico (ej. PDF) a Vercel Blob desde un data URL base64.
 * Corre en el servidor (server$) y hace el `put` ahí, evitando `@vercel/blob/client`
 * en el navegador (que arrastraba un polyfill de crypto roto). El archivo viaja
 * en el cuerpo del server$ (límite ~4.5 MB de Vercel; suficiente para PDFs de
 * menú/lista de precios).
 */
export const uploadFileDataUrl = server$(async function (
  dataUrl: string,
  filename: string,
  prefix = "file"
): Promise<UploadResult> {
  try {
    const comma = dataUrl.indexOf(",");
    const base64Data = comma >= 0 ? dataUrl.slice(comma + 1) : "";
    if (!base64Data) return { error: "Archivo inválido." };
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const safeName = (filename || "archivo").replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${prefix}-${Date.now()}-${safeName}`;
    const token = process.env.BLOB_READ_WRITE_TOKEN || this.env.get("BLOB_READ_WRITE_TOKEN");

    if (token) {
      const { put } = await import("@vercel/blob");
      const blob = await put(fileName, bytes, { access: "public", token });
      return { url: blob.url };
    }

    // Fallback local (dev sin Blob configurado).
    const fsModule = await import("fs/promises");
    const uploadsDir = `${process.cwd()}/public/uploads`;
    await fsModule.mkdir(uploadsDir, { recursive: true });
    await fsModule.writeFile(`${uploadsDir}/${fileName}`, bytes);
    return { url: `/uploads/${fileName}` };
  } catch (err: any) {
    console.error("[uploadFileDataUrl] falló la subida:", err?.message || err);
    return { error: "No se pudo subir el archivo. Probá de nuevo." };
  }
});
