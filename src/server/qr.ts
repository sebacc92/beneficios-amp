import QRCode from "qrcode";

/** Generate an SVG locally: no member data or coupon codes reach a QR service. */
export async function createQrDataUrl(value: string): Promise<string> {
  const svg = await QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    width: 240,
    color: { dark: "#0b1526", light: "#ffffff" },
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
