import type { RequestHandler } from "@builder.io/qwik-city";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "~/server/admin-auth";

/**
 * Endpoint para subidas de archivos directas del navegador a Vercel Blob
 * (client uploads). El navegador pide acá un token de subida y luego sube el
 * archivo DIRECTO a Blob, sin pasar por esta función. Así se evita el límite de
 * ~4.5 MB de cuerpo de Vercel y se soportan PDFs grandes (menús, listas, bases).
 *
 * Solo lo usan los formularios de admin, por eso se valida la sesión de admin.
 */
export const onPost: RequestHandler = async ({ request, json, env, cookie }) => {
  const body = (await request.json()) as HandleUploadBody;

  // Solo se exige sesión de admin para GENERAR el token (request del navegador).
  // El evento "upload-completed" lo dispara Vercel Blob (sin cookie) y lo valida
  // internamente handleUpload por firma, así que ese no se gatea acá.
  if (body.type === "blob.generate-client-token") {
    const adminId = await verifyAdminSessionToken(env, cookie.get(ADMIN_SESSION_COOKIE)?.value);
    if (adminId === null) {
      json(403, { error: "No autorizado." });
      return;
    }
  }

  try {
    const result = await handleUpload({
      body,
      request,
      token: env.get("BLOB_READ_WRITE_TOKEN"),
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["application/pdf"],
        maximumSizeInBytes: 20 * 1024 * 1024, // 20 MB
      }),
      // Notificación webhook de Blob al completar (solo en producción con URL
      // pública). El URL ya lo tiene el cliente, así que no hace falta hacer nada.
      onUploadCompleted: async () => {},
    });
    json(200, result);
  } catch (err: any) {
    console.error("[blob-upload] error:", err?.message || err);
    json(400, { error: err?.message || "No se pudo generar el token de subida." });
  }
};
