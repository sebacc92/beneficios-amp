import { type RequestHandler } from "@builder.io/qwik-city";

export const onGet: RequestHandler = async (requestEvent) => {
  const { url, headers, send } = requestEvent;
  const fileUrl = url.searchParams.get("url");
  let filename = url.searchParams.get("filename") || "documento.pdf";

  if (!fileUrl) {
    throw requestEvent.error(400, "Falta el parámetro 'url'");
  }

  // Ensure filename has .pdf extension
  if (!filename.toLowerCase().endsWith(".pdf")) {
    filename = `${filename}.pdf`;
  }

  try {
    // Resolve absolute URL if relative
    let absoluteUrl = fileUrl;
    if (fileUrl.startsWith("/")) {
      const origin = url.origin;
      absoluteUrl = `${origin}${fileUrl}`;
    }

    const response = await fetch(absoluteUrl);
    if (!response.ok) {
      throw requestEvent.error(502, "Error al descargar el archivo original");
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", `attachment; filename="${filename}"`);

    send(200, buffer);
  } catch (err) {
    console.error("Error in download proxy:", err);
    throw requestEvent.error(500, "Error interno al procesar la descarga");
  }
};
