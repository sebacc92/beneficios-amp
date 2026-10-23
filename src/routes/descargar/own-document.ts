/** Folders where the portal keeps its own uploads (public/uploads and the R2 media bucket). */
const OWN_DOCUMENT_FOLDERS = ["/uploads/", "/media/"];

/**
 * The download proxy only serves the portal's own PDFs: a same-origin path inside an
 * upload folder. Anything else (other hosts, other paths, "..") is refused, so the
 * endpoint cannot be used to fetch arbitrary URLs from the server.
 */
export function ownDocumentUrl(raw: string | null | undefined, origin: string): URL | null {
  const value = raw?.trim();
  if (!value || value.startsWith("//") || value.includes("\\")) return null;
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return null;
  }
  if (url.origin !== new URL(origin).origin || url.username || url.password) return null;
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (path.includes("..") || !OWN_DOCUMENT_FOLDERS.some((folder) => path.startsWith(folder))) return null;
  url.search = "";
  url.hash = "";
  return url;
}

/** Link for the "Descargar" button, or null when the PDF is hosted elsewhere (open it directly instead). */
export function documentDownloadHref(pdfUrl: string | null | undefined, filename: string, origin: string): string | null {
  const source = ownDocumentUrl(pdfUrl, origin);
  if (!source) return null;
  const params = new URLSearchParams({ url: source.pathname, filename });
  return `/descargar/?${params}`;
}
