import type { RequestEventBase } from "@builder.io/qwik-city";

/** Serve public objects before Qwik, including responses with no body (HEAD/304). */
export async function serveMedia(request: Request, env: CloudflareEnv): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Método no permitido.", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  let key: string;
  try {
    key = decodeURIComponent(new URL(request.url).pathname.slice("/media/".length));
  } catch {
    return new Response("Ruta inválida.", { status: 400 });
  }
  if (!key || !/^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(key) || key.includes("..")) {
    return new Response("Archivo no encontrado.", { status: 404 });
  }

  const ifNoneMatch = request.headers.get("If-None-Match");
  const object = await env.MEDIA.get(key, ifNoneMatch ? {
    onlyIf: new Headers({ "If-None-Match": ifNoneMatch }),
  } : undefined);
  if (!object) return new Response("Archivo no encontrado.", { status: 404 });

  const headers = new Headers({
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  });
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (!("body" in object)) return new Response(null, { status: 304, headers });

  headers.set("Content-Length", String(object.size));
  if (request.method === "HEAD") {
    await object.body.cancel();
    return new Response(null, { headers });
  }
  return new Response(object.body, { headers });
}

export function getMediaBucket(event: RequestEventBase): CloudflareEnv["MEDIA"] | undefined {
  return event.platform.env?.MEDIA;
}

/** Unique keys keep existing media URLs immutable when an administrator edits a file. */
export async function putMedia(
  event: RequestEventBase,
  filename: string,
  body: Blob | ArrayBuffer | ArrayBufferView,
): Promise<string> {
  const bucket = getMediaBucket(event);
  if (!bucket) throw new Error("Almacenamiento de archivos no configurado (MEDIA).");

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, ".");
  const key = `${crypto.randomUUID()}-${safeName}`;
  const extension = safeName.split(".").pop()?.toLowerCase() || "";
  const types: Record<string, string> = {
    webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", avif: "image/avif", pdf: "application/pdf", svg: "image/svg+xml",
  };
  await bucket.put(key, body, {
    httpMetadata: {
      contentType: types[extension] || "application/octet-stream",
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return `/media/${encodeURIComponent(key)}`;
}

/** Prefer the client-optimized image, keeping the original file as its fallback. */
export async function putImage(
  event: RequestEventBase,
  prefix: string,
  optimizedImage: string | undefined,
  file: unknown,
): Promise<string | null> {
  if (optimizedImage?.startsWith("data:image")) {
    const binary = atob(optimizedImage.replace(/^data:image\/\w+;base64,/, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return putMedia(event, `${prefix}-${Date.now()}.webp`, bytes);
  }
  if (file && typeof file === "object" && (file as Blob).size > 0) {
    const image = file as File;
    const extension = image.name.split(".").pop() || "png";
    return putMedia(event, `${prefix}-${Date.now()}.${extension}`, image);
  }
  return null;
}
