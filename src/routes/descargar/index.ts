import { type RequestHandler } from "@builder.io/qwik-city";
import { serveMedia } from "~/server/media";
import { ownDocumentUrl } from "./own-document";

/** Same-origin files are read from their bindings: a Worker fetching its own custom domain is not reliable. */
async function loadOwnDocument(platformEnv: CloudflareEnv | undefined, source: URL): Promise<Response> {
  if (source.pathname.startsWith("/media/") && platformEnv?.MEDIA) {
    return serveMedia(new Request(source), platformEnv);
  }
  if (platformEnv?.ASSETS) return await platformEnv.ASSETS.fetch(new Request(source));
  return fetch(source, { redirect: "manual" });
}

export const onGet: RequestHandler = async (requestEvent) => {
  const { url, headers, send } = requestEvent;
  const source = ownDocumentUrl(url.searchParams.get("url"), url.origin);
  if (!source) {
    throw requestEvent.error(400, "Solo se pueden descargar documentos publicados en el portal.");
  }

  // Header-safe ASCII name plus the UTF-8 one for browsers that read filename*.
  const requested = (url.searchParams.get("filename") || "documento").trim().slice(0, 120) || "documento";
  const filename = /\.pdf$/i.test(requested) ? requested : `${requested}.pdf`;
  const asciiName = filename.normalize("NFD").replace(/[^\w.\- ]/g, "").trim() || "documento.pdf";

  let response: Response;
  try {
    response = await loadOwnDocument(requestEvent.platform.env, source);
  } catch (err) {
    console.error("Error in download proxy:", err);
    throw requestEvent.error(502, "No se pudo descargar el documento.");
  }
  if (!response.ok) throw requestEvent.error(response.status === 404 ? 404 : 502, "No se pudo descargar el documento.");
  if (!(response.headers.get("Content-Type") ?? "").toLowerCase().includes("application/pdf")) {
    throw requestEvent.error(400, "El archivo solicitado no es un PDF.");
  }

  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", "public, max-age=3600");
  send(200, new Uint8Array(await response.arrayBuffer()));
};
