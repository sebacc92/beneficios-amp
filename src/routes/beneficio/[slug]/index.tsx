import { component$, useVisibleTask$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, Link, type DocumentHead, server$ } from "@builder.io/qwik-city";
import { getBenefitBySlug, getBenefits, type Benefit } from "~/server/cache";
import { useLayoutUser } from "../../layout";
import { LuLock } from "@qwikest/icons/lucide";
import { and, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { coupons } from "~/db/schema";
import { makeCredentialToken } from "~/server/credential-token";
import type { AuthenticatedUser } from "~/routes/plugin@auth";


// Extracts structured contact details from the raw HTML description
function extractContacts(html: string) {
  const contacts: {
    phone?: string;
    whatsapp?: string;
    email?: string;
    website?: string;
    instagram?: string;
    address?: string;
  } = {};

  if (!html) return contacts;

  // Address extraction
  const addressMatch = html.match(/<b>(?:DIRECCIÓN|DOMICILIO)<\/b>\.?:\s*([^<]+)/i);
  if (addressMatch) contacts.address = addressMatch[1].trim();

  // Phone / Cel extraction
  const celMatch = html.match(/<b>(?:CEL|TEL|TELÉFONO)<\/b>\.?:\s*([^<]+)/i);
  if (celMatch) contacts.phone = celMatch[1].trim();

  // WhatsApp extraction
  const wsMatch = html.match(/<b>(?:WHATSAPP)<\/b>\.?:\s*([^<]+)/i);
  if (wsMatch) {
    contacts.whatsapp = wsMatch[1].trim();
  } else if (contacts.phone && (contacts.phone.startsWith("221") || contacts.phone.startsWith("11") || contacts.phone.includes("-"))) {
    contacts.whatsapp = contacts.phone;
  }

  // Email extraction
  const emailMatch = html.match(/href="mailto:([^"]+)"/i) || html.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) contacts.email = (emailMatch[1] || emailMatch[0]).trim();

  // Website and Instagram extraction
  const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  for (const l of links) {
    if (l.includes("instagram.com")) contacts.instagram = l;
    else if (!l.includes("mailto:") && !l.includes("tel:") && !l.includes("facebook.com")) contacts.website = l;
  }

  return contacts;
}

// Server Loader to retrieve single benefit and similar recommendations
export const useBenefitData = routeLoader$(async (event) => {
  const benefit = await getBenefitBySlug(event.params.slug, event);
  const user = event.sharedMap.get("user") as AuthenticatedUser | null;
  const isAdmin = user?.role === "admin";

  if (!benefit || (benefit.isActive === false && !isAdmin)) {
    event.status(404);
    return null;
  }

  // Find 3 similar benefits from the same category
  const allBenefits = await getBenefits();
  const categoryIds = benefit.categorias.map((c) => c.id);
  const similar = allBenefits
    .filter((b) => b.id !== benefit.id && b.categorias.some((c) => categoryIds.includes(c.id)))
    .slice(0, 3);

  // Extract contact links for quick-action buttons
  const extractedContacts = extractContacts(benefit.descripcion);

  // If the member already generated a coupon for this benefit, reuse it
  let activeCoupon: {
    id: string;
    code: string;
    status: string;
    createdAt: string;
  } | null = null;

  if (user) {
    try {
      const db = getDB(event);
      const [couponRecord] = await db
        .select()
        .from(coupons)
        .where(
          and(
            eq(coupons.userId, user.id),
            eq(coupons.benefitId, String(benefit.id)),
            eq(coupons.status, "active")
          )
        )
        .limit(1);

      if (couponRecord) {
        activeCoupon = {
          id: couponRecord.id,
          code: couponRecord.code,
          status: couponRecord.status,
          createdAt: couponRecord.createdAt,
        };
      }
    } catch (err) {
      console.error("Error fetching active coupon:", err);
    }
  }

  // URL de verificación de credencial (QR del PDF). Token cifrado: no expone
  // DNI/matrícula ni permite enumerar beneficiarios.
  let verifyUrl: string | null = null;
  if (user) {
    const idKey = (user.dni || user.matricula || "").trim();
    if (idKey) {
      const token = await makeCredentialToken(event.env, {
        d: idKey,
        m: user.matricula,
        n: user.name,
        iat: Date.now(),
      });
      verifyUrl = `${event.url.origin}/verificar/${token}`;
    }
  }

  return {
    benefit,
    similar,
    contacts: extractedContacts,
    activeCoupon,
    verifyUrl,
  };
});

// Genera (o reutiliza) un cupón activo para el agremiado logueado y lo
// registra en la tabla `coupons` para su seguimiento desde el panel admin.
export const generateCouponAction = server$(async function (
  benefitId: string,
  benefitTitle: string,
  benefitResumen: string
) {
  const user = this.sharedMap.get("user") as AuthenticatedUser | null;
  if (!user) {
    throw new Error("No estás autenticado");
  }

  const db = getDB(this);

  // Reutilizar un cupón activo si ya existe
  const [existing] = await db
    .select()
    .from(coupons)
    .where(
      and(
        eq(coupons.userId, user.id),
        eq(coupons.benefitId, benefitId),
        eq(coupons.status, "active")
      )
    )
    .limit(1);

  if (existing) {
    return {
      id: existing.id,
      code: existing.code,
      status: existing.status,
      createdAt: existing.createdAt,
    };
  }

  // Generar código único de 6 dígitos
  let code = "";
  let attempts = 0;
  while (attempts < 10) {
    code = String(Math.floor(100000 + Math.random() * 900000));
    const [dup] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, code))
      .limit(1);
    if (!dup) break;
    attempts++;
  }

  const newCoupon = {
    id: crypto.randomUUID(),
    code,
    benefitId,
    benefitTitle,
    benefitResumen,
    userId: user.id,
    userName: user.name,
    userMatricula: user.matricula || "",
    status: "active" as const,
    createdAt: new Date().toISOString(),
    usedAt: null,
  };

  await db.insert(coupons).values(newCoupon);

  return {
    id: newCoupon.id,
    code: newCoupon.code,
    status: newCoupon.status,
    createdAt: newCoupon.createdAt,
  };
});

export default component$(() => {
  const data = useBenefitData();
  const isMapLoaded = useSignal(false);
  const showToast = useSignal(false);
  const user = useLayoutUser();

  const generatedCoupon = useSignal<{
    id: string;
    code: string;
    status: string;
    createdAt: string;
  } | null>(data.value?.activeCoupon || null);
  const isDownloading = useSignal(false);

  // Imagen actualmente mostrada en el hero (galería). null = imagen principal.
  const activeImageUrl = useSignal<string | null>(null);

  // Genera el PDF completo del beneficio para el beneficiario logueado:
  // datos del beneficio + del beneficiario + QR de verificación + Code128.
  const handleDownloadPdf = $(async () => {
    if (isDownloading.value || !data.value || !user.value) return;
    isDownloading.value = true;
    try {
      const { benefit, verifyUrl } = data.value;
      const member = user.value;

      // Cupón de canje (reutiliza/crea) para tracking + código en el PDF.
      const coupon =
        generatedCoupon.value ||
        (await generateCouponAction(
          String(benefit.id),
          benefit.titulo,
          benefit.resumen
        ));
      generatedCoupon.value = coupon;

      // Carga perezosa de las librerías (solo al descargar, bundle liviano).
      const loadScript = (src: string, globalKey: string) =>
        new Promise<any>((resolve, reject) => {
          const w = window as any;
          if (w[globalKey]) return resolve(w[globalKey]);
          const script = document.createElement("script");
          script.src = src;
          script.onload = () =>
            w[globalKey] ? resolve(w[globalKey]) : reject(new Error(`${globalKey} no disponible`));
          script.onerror = () => reject(new Error(`No se pudo cargar ${globalKey}`));
          document.head.appendChild(script);
        });

      // Imagen (URL) -> PNG dataURL, para logo webp y QR.
      const toPngDataUrl = (src: string) =>
        new Promise<string | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = img.naturalWidth || 300;
              canvas.height = img.naturalHeight || 300;
              const ctx = canvas.getContext("2d");
              if (!ctx) return resolve(null);
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL("image/png"));
            } catch {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = src;
        });

      const jspdfNs = await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
        "jspdf"
      );
      const jsPDF = jspdfNs.jsPDF;

      const logoData = await toPngDataUrl("/logo-beneficios_amp2.webp");
      const qrData = verifyUrl
        ? await toPngDataUrl(
            `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&ecc=M&color=000000&bgcolor=ffffff&data=${encodeURIComponent(
              verifyUrl
            )}`
          )
        : null;

      // Código de barras Code128 con la matrícula (o DNI de fallback).
      const barcodeValue = (member.matricula || member.dni || "").replace(/[^0-9A-Za-z]/g, "");
      let barcode: { data: string; w: number; h: number } | null = null;
      if (barcodeValue) {
        try {
          const JsBarcode = await loadScript(
            "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js",
            "JsBarcode"
          );
          const canvas = document.createElement("canvas");
          JsBarcode(canvas, barcodeValue, {
            format: "CODE128",
            displayValue: true,
            fontSize: 30,
            font: "monospace",
            height: 90,
            margin: 8,
            background: "#ffffff",
            lineColor: "#000000",
          });
          barcode = {
            data: canvas.toDataURL("image/png"),
            w: canvas.width,
            h: canvas.height,
          };
        } catch (e) {
          console.error("No se pudo generar el código de barras:", e);
        }
      }

      // ── Dibujo (A4 vertical, mm) ─────────────────────────────────────────
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const GREEN_DARK: [number, number, number] = [7, 47, 29];
      const GREEN: [number, number, number] = [10, 68, 42];
      const GOLD: [number, number, number] = [212, 163, 23];
      const SLATE: [number, number, number] = [100, 116, 139];
      const SLATE_DARK: [number, number, number] = [30, 41, 59];

      const pageW = 210;
      const M = 16;
      const contentW = pageW - M * 2;

      // Marco general
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.roundedRect(M - 3, 13, contentW + 6, 268, 4, 4, "S");

      // Cabecera verde
      let y = 16;
      doc.setFillColor(...GREEN_DARK);
      doc.roundedRect(M, y, contentW, 24, 3, 3, "F");
      if (logoData) {
        try {
          doc.addImage(logoData, "PNG", M + 5, y + 4.5, 32, 15, undefined, "FAST");
        } catch { /* ignore */ }
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("AMP+ Club de Beneficios", M + contentW - 6, y + 11, { align: "right" });
      doc.setFontSize(7.5);
      doc.setTextColor(...GOLD);
      doc.text("COMPROBANTE DE BENEFICIO", M + contentW - 6, y + 17, { align: "right" });
      y += 24 + 10;

      // Helper de encabezado de sección
      const sectionTitle = (label: string) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...GREEN);
        doc.text(label.toUpperCase(), M, y);
        doc.setDrawColor(...GOLD);
        doc.setLineWidth(0.5);
        doc.line(M, y + 1.6, M + contentW, y + 1.6);
        y += 7;
      };

      // ── BENEFICIO ────────────────────────────────────────────────────────
      sectionTitle("Beneficio");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(...SLATE_DARK);
      const titleLines = doc.splitTextToSize(benefit.titulo, contentW - 46);
      doc.text(titleLines, M, y + 4);

      // Píldora de descuento (a la derecha del título)
      const descuento = (benefit.ofertas[0]?.descripcion || benefit.resumen || "Beneficio").trim();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const pillW = Math.min(46, doc.getTextWidth(descuento) + 12);
      const pillX = M + contentW - pillW;
      doc.setFillColor(...GOLD);
      doc.roundedRect(pillX, y - 2, pillW, 10, 5, 5, "F");
      doc.setTextColor(...GREEN_DARK);
      doc.text(descuento, pillX + pillW / 2, y + 4.7, { align: "center", maxWidth: pillW - 4 });
      y += titleLines.length * 6.5 + 4;

      // Datos del comercio (rubro / ubicación / dirección)
      const infoRows: [string, string][] = [
        ["Comercio", benefit.titulo],
        ["Rubro", benefit.categorias.map((c) => c.descripcion).join(", ") || "—"],
        ["Ubicación", benefit.ubicacion.map((l) => l.descripcion).join(", ") || "—"],
      ];
      if (contacts.address) infoRows.push(["Dirección", contacts.address]);
      doc.setFontSize(9.5);
      infoRows.forEach(([label, value]) => {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...SLATE);
        doc.text(label, M, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...SLATE_DARK);
        const vLines = doc.splitTextToSize(String(value), contentW - 34);
        doc.text(vLines, M + 32, y);
        y += Math.max(1, vLines.length) * 5.2;
      });
      y += 2;

      // Condiciones
      const rawTerms =
        (benefit.terms && benefit.terms.trim()) ||
        benefit.descripcion.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
      if (rawTerms) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...SLATE);
        doc.text("CONDICIONES", M, y);
        y += 4.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...SLATE_DARK);
        const termsText = rawTerms.length > 460 ? rawTerms.slice(0, 457) + "…" : rawTerms;
        const termLines = doc.splitTextToSize(termsText, contentW);
        doc.text(termLines, M, y);
        y += termLines.length * 4.6 + 2;
      }

      // Vigencia
      const vigencia = benefit.validUntil
        ? `Válido hasta el ${new Date(benefit.validUntil).toLocaleDateString("es-AR")}`
        : "Beneficio permanente (sin fecha de vencimiento)";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...GREEN);
      doc.text(`Vigencia: ${vigencia}`, M, y);
      y += 9;

      // ── BENEFICIARIO ─────────────────────────────────────────────────────
      sectionTitle("Beneficiario");
      const boxH = 30;
      doc.setFillColor(247, 248, 250);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(M, y, contentW, boxH, 3, 3, "FD");
      const bRows: [string, string][] = [
        ["Nombre", member.name],
        ["Matrícula", member.matricula || "No registrada"],
        ["DNI", member.dni || "No registrado"],
        ["Código de canje", `${coupon.code.slice(0, 3)} ${coupon.code.slice(3)}`],
      ];
      let by = y + 7;
      const colX = M + 6;
      bRows.forEach(([label, value]) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...SLATE);
        doc.text(label, colX, by);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...SLATE_DARK);
        doc.text(String(value), M + contentW - 6, by, { align: "right" });
        by += 6.5;
      });
      y += boxH + 10;

      // ── QR + CÓDIGO DE BARRAS ────────────────────────────────────────────
      const colW = contentW / 2;
      const qrSize = 40;
      // QR (columna izquierda)
      if (qrData) {
        const qrX = M + (colW - qrSize) / 2;
        try {
          doc.addImage(qrData, "PNG", qrX, y, qrSize, qrSize, undefined, "FAST");
        } catch { /* ignore */ }
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...SLATE);
      doc.text(
        verifyUrl ? "ESCANEAR PARA VERIFICAR CREDENCIAL" : "CREDENCIAL NO DISPONIBLE",
        M + colW / 2,
        y + qrSize + 5,
        { align: "center", maxWidth: colW - 4 }
      );

      // Código de barras (columna derecha)
      if (barcode) {
        const maxBW = colW - 14;
        const bw = Math.min(maxBW, 70);
        const bh = bw * (barcode.h / barcode.w);
        const bx = M + colW + (colW - bw) / 2;
        const byImg = y + (qrSize - bh) / 2;
        try {
          doc.addImage(barcode.data, "PNG", bx, byImg, bw, bh, undefined, "FAST");
        } catch { /* ignore */ }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(...SLATE);
        doc.text("MATRÍCULA DEL BENEFICIARIO", M + colW + colW / 2, y + qrSize + 5, {
          align: "center",
          maxWidth: colW - 4,
        });
      }
      y += qrSize + 12;

      // Pie
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...SLATE);
      const foot = doc.splitTextToSize(
        "Presentá este comprobante junto con tu credencial digital AMP+ en el local adherido. La validez se verifica en tiempo real contra el padrón oficial de la Agremiación Médica Platense.",
        contentW
      );
      doc.text(foot, M, y);
      y += foot.length * 4.2 + 3;
      doc.setFont("courier", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...GREEN);
      doc.text(
        `AMP-B-${benefit.id}-${coupon.code}  ·  Emitido ${new Date().toLocaleDateString("es-AR")}`,
        M,
        y
      );

      // Descargar
      const safeName = benefit.titulo
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
      doc.save(`beneficio-amp-${safeName || benefit.id}.pdf`);
    } catch (err) {
      console.error("Error al descargar el PDF:", err);
      alert("No se pudo generar el PDF. Por favor, intentá nuevamente.");
    } finally {
      isDownloading.value = false;
    }
  });

  const handleShare = $(async () => {
    if (typeof window === "undefined" || !data.value) return;
    const { benefit } = data.value;
    const shareData = {
      title: `${benefit.titulo} - Club de Beneficios AMP`,
      text: `¡Mirá este beneficio exclusivo en ${benefit.titulo}! ${benefit.resumen}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log("Shared cancelled or failed", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showToast.value = true;
        setTimeout(() => {
          showToast.value = false;
        }, 3000);
      } catch (err) {
        console.error("Failed to copy link", err);
      }
    }
  });

  if (!data.value) {
    return (
      <div class="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 class="text-3xl font-display font-extrabold text-slate-800">Beneficio No Encontrado</h2>
        <p class="text-slate-500 mt-2">El beneficio que buscas no existe o ha expirado.</p>
        <Link
          href="/"
          class="inline-flex items-center justify-center px-6 py-3 rounded-full bg-brand-green text-white text-sm font-semibold mt-6 hover:bg-brand-green-light transition-all shadow-md"
        >
          Volver al Inicio
        </Link>
      </div>
    );
  }

  const { benefit, similar, contacts } = data.value;

  // Format link functions safely
  const getWhatsAppLink = (num: string) => {
    const cleanNum = num.replace(/[^0-9]/g, "");
    // Add Argentine country prefix if missing
    const formatted = cleanNum.startsWith("54") ? cleanNum : `549${cleanNum}`;
    return `https://wa.me/${formatted}?text=Hola!%20Te%20contacto%20desde%20el%20Portal%20de%20Beneficios%20de%20la%20AMP`;
  };

  const getPhoneLink = (num: string) => {
    return `tel:${num.replace(/[^0-9+]/g, "")}`;
  };

  // Client-side initialization of Leaflet Map once component is visible
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    if (!benefit.latitud || !benefit.longitud) return;

    // Dynamically load Leaflet assets to prevent SSR crash and maintain 100/100 LCP
    const loadMap = () => {
      const L = (window as any).L;
      if (!L) return;

      const lat = parseFloat(benefit.latitud!);
      const lng = parseFloat(benefit.longitud!);

      const map = L.map("leaflet-map", {
        scrollWheelZoom: false,
        dragging: !L.Browser.mobile,
        tap: !L.Browser.mobile
      }).setView([lat, lng], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      // Custom elegant gold marker icon using SVGs
      const goldIcon = L.divIcon({
        className: "custom-div-icon",
        html: `<div class='w-8 h-8 rounded-full bg-brand-gold border-2 border-white flex items-center justify-center shadow-lg text-brand-green-dark'><svg class='w-4 h-4 fill-current' viewBox='0 0 24 24'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/></svg></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });

      L.marker([lat, lng], { icon: goldIcon })
        .addTo(map)
        .bindPopup(`<b class="font-display text-brand-green-dark">${benefit.titulo}</b><br/>${contacts.address || "Ubicación"}`)
        .openPopup();

      isMapLoaded.value = true;

      cleanup(() => {
        map.remove();
      });
    };

    if (document.getElementById("leaflet-css")) {
      loadMap();
    } else {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = loadMap;
      document.head.appendChild(script);
    }
  });

  const imageUrl = benefit.imagen
    ? (benefit.imagen.startsWith('http') || benefit.imagen.startsWith('/') ? benefit.imagen : `https://beneficios.amepla.org.ar/files/${benefit.imagen}`)
    : null;

  const imageMobileUrl = benefit.imagenMobile
    ? (benefit.imagenMobile.startsWith('http') || benefit.imagenMobile.startsWith('/') ? benefit.imagenMobile : `https://beneficios.amepla.org.ar/files/${benefit.imagenMobile}`)
    : null;

  // Galería: imagen principal + fotos adicionales (deduplicadas)
  const galeriaUrls = (benefit.galeria || []).map((g) =>
    g.startsWith('http') || g.startsWith('/') ? g : `https://beneficios.amepla.org.ar/files/${g}`
  );
  const galleryImages = imageUrl ? Array.from(new Set([imageUrl, ...galeriaUrls])) : [];
  const hasGallery = galleryImages.length > 1;

  const primaryCat = benefit.categorias[0]?.descripcion || "Beneficio";
  const primaryLoc = benefit.ubicacion[0]?.descripcion || "Prov. Buenos Aires";

  // Badge corto = facet estructurado de oferta (ej "10%", "20%", "Promociones").
  // El resumen (frase completa) se muestra aparte como línea de texto, no dentro del círculo.
  const offerLabel = (benefit.ofertas[0]?.descripcion || "").trim() || "Beneficio";
  const resumenText = (benefit.resumen || "")
    .replace(/^Descuentos?\s+del\s*/i, "")
    .replace(/^Bonificaci[oó]n\s+del\s*/i, "")
    .trim();

  return (
    <div class="relative min-h-screen py-10 bg-slate-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 print:hidden">

        {/* A. Breadcrumb */}
        <nav class="flex items-center space-x-2 text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-8">
          <Link href="/" class="hover:text-brand-green transition-colors">Inicio</Link>
          <span>/</span>
          <span class="text-slate-500">{primaryCat}</span>
          <span>/</span>
          <span class="text-slate-600 truncate max-w-[200px]">{benefit.titulo}</span>
        </nav>

        {/* B. Main Details Grid */}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* LEFT: Benefit Main Description Card (2 Columns wide) */}
          <div class="lg:col-span-2 space-y-8">
            <div class="glass-card border rounded-2xl overflow-hidden shadow-md bg-white">
              {/* Feature Hero Image */}
              <div class="relative bg-slate-50 p-5 sm:p-8 flex items-center justify-center">
                {imageUrl ? (
                  <picture class="relative w-full max-w-[440px] aspect-square rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex items-center justify-center">
                    {imageMobileUrl && !activeImageUrl.value && (
                      <source media="(max-width: 640px)" srcset={imageMobileUrl} />
                    )}
                    <img
                      src={activeImageUrl.value || imageUrl}
                      alt={benefit.titulo}
                      class="w-full h-full object-contain p-3"
                      width={800}
                      height={800}
                    />
                  </picture>
                ) : (
                  <div class="w-full max-w-[440px] aspect-square rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-green-dark to-brand-green flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
                    <span class="absolute -right-6 -bottom-10 font-display font-black text-[12rem] leading-none text-white/10 select-none pointer-events-none">+</span>
                    <span class="relative font-display font-black text-white text-3xl sm:text-4xl leading-tight line-clamp-4">
                      {benefit.titulo}
                    </span>
                    <span class="relative text-white/65 text-xs font-bold uppercase tracking-widest mt-4">
                      {primaryCat}
                    </span>
                  </div>
                )}

                {/* Floating Gold Discount Badge — muestra la oferta corta (facet), no el resumen largo */}
                <div class="absolute top-6 right-6 z-10 animate-float">
                  <span class="inline-flex flex-col items-center justify-center w-28 h-28 rounded-full bg-brand-gold text-brand-green-dark border-4 border-white shadow-xl px-2 text-center">
                    <span
                      class={[
                        "font-black font-display leading-none",
                        offerLabel.length <= 4 ? "text-3xl" : offerLabel.length <= 8 ? "text-xl" : "text-sm uppercase",
                      ]}
                    >
                      {offerLabel}
                    </span>
                    <span class="text-[11px] uppercase font-extrabold tracking-wider mt-1">Beneficio</span>
                  </span>
                </div>

                {/* Floating Category Pill */}
                <div class="absolute bottom-6 left-6 z-10 flex space-x-2">
                  {benefit.categorias.map((c) => (
                    <span
                      key={c.id}
                      class="inline-flex items-center px-4.5 py-2.5 rounded-2xl text-sm font-black bg-black/60 text-white backdrop-blur-md border border-white/20 uppercase tracking-widest"
                    >
                      {c.descripcion}
                    </span>
                  ))}
                </div>
              </div>

              {/* Gallery thumbnails */}
              {hasGallery && (
                <div class="px-5 sm:px-8 pb-5 sm:pb-6 -mt-2">
                  <div class="flex gap-2.5 overflow-x-auto pb-1 snap-x">
                    {galleryImages.map((img, i) => {
                      const isActive = (activeImageUrl.value || imageUrl) === img;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick$={() => { activeImageUrl.value = img; }}
                          class={[
                            "relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 bg-white transition-all snap-start cursor-pointer",
                            isActive
                              ? "border-brand-green ring-2 ring-brand-green/20 shadow-md"
                              : "border-slate-200 hover:border-brand-green/50 opacity-80 hover:opacity-100",
                          ]}
                          aria-label={`Ver foto ${i + 1}`}
                        >
                          <img
                            src={img}
                            alt={`${benefit.titulo} - foto ${i + 1}`}
                            class="w-full h-full object-cover"
                            width={80}
                            height={80}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Card Body */}
              <div class="p-6 sm:p-10 space-y-8">
                {/* Location and Info */}
                <div class="flex flex-wrap items-center gap-4 text-sm font-bold text-slate-400">
                  <div class="flex items-center text-brand-green-light space-x-1.5 bg-brand-green-light/5 px-4.5 py-2 rounded-full border border-brand-green-light/10">
                    <svg class="w-4 h-4 text-brand-gold fill-current" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    <span class="uppercase tracking-wider">
                      {primaryLoc}
                    </span>
                  </div>

                  {benefit.ofertas.map((o) => (
                    <div
                      key={o.id}
                      class="flex items-center text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200"
                    >
                      <span>Descuento del {o.descripcion}</span>
                    </div>
                  ))}
                </div>

                {/* Main Title */}
                <div class="space-y-3">
                  <h1 class="text-3xl sm:text-4xl font-display font-extrabold text-brand-green-dark leading-tight tracking-tight">
                    {benefit.titulo}
                  </h1>
                  {resumenText && (
                    <p class="text-base sm:text-lg font-bold text-brand-green leading-snug">
                      {resumenText}
                    </p>
                  )}
                </div>

                {/* Utility Print / Share actions bar */}
                <div class="flex flex-wrap items-center gap-3 mt-4 print-hidden pb-6 border-b border-slate-100">
                  <button
                    onClick$={handleShare}
                    class="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    <svg class="w-4 h-4 text-brand-gold fill-none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 10.742l4.62-2.31m0 7.136l-4.62-2.31M21 12a3 3 0 11-6 0 3 3 0 016 0zm-11-8a3 3 0 11-6 0 3 3 0 016 0zm0 16a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Compartir / Reenviar</span>
                  </button>
                </div>

                {/* Glassmorphic Contact Actions Tray */}
                {(contacts.phone || contacts.whatsapp || contacts.email || contacts.website || contacts.instagram) && (
                  <div class="p-5 rounded-2xl glass-panel-dark border space-y-4">
                    <h3 class="text-xs font-extrabold uppercase tracking-wider text-brand-green-light">
                      Contacto Directo
                    </h3>
                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">

                      {contacts.phone && (
                        <a
                          href={getPhoneLink(contacts.phone)}
                          class="flex flex-col items-center justify-center p-3.5 rounded-xl bg-white border border-slate-200 hover:border-brand-green hover:text-brand-green text-slate-700 text-center shadow-sm hover:shadow-md transition-all active:scale-95 group cursor-pointer"
                        >
                          <svg class="w-5 h-5 text-slate-400 group-hover:text-brand-green mb-1.5 transition-colors" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.98-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span class="text-[12px] font-black uppercase tracking-wide">Llamar</span>
                        </a>
                      )}

                      {contacts.whatsapp && (
                        <a
                          href={getWhatsAppLink(contacts.whatsapp)}
                          target="_blank"
                          rel="noopener"
                          class="flex flex-col items-center justify-center p-3.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 text-slate-700 text-center shadow-sm hover:shadow-md transition-all active:scale-95 group cursor-pointer"
                        >
                          <svg class="w-5 h-5 text-slate-400 group-hover:text-emerald-500 mb-1.5 transition-colors fill-current" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          <span class="text-[12px] font-black uppercase tracking-wide">WhatsApp</span>
                        </a>
                      )}

                      {contacts.email && (
                        <a
                          href={`mailto:${contacts.email}`}
                          class="flex flex-col items-center justify-center p-3.5 rounded-xl bg-white border border-slate-200 hover:border-brand-green hover:text-brand-green text-slate-700 text-center shadow-sm hover:shadow-md transition-all active:scale-95 group cursor-pointer"
                        >
                          <svg class="w-5 h-5 text-slate-400 group-hover:text-brand-green mb-1.5 transition-colors" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span class="text-[12px] font-black uppercase tracking-wide">E-Mail</span>
                        </a>
                      )}

                      {contacts.website && (
                        <a
                          href={contacts.website}
                          target="_blank"
                          rel="noopener"
                          class="flex flex-col items-center justify-center p-3.5 rounded-xl bg-white border border-slate-200 hover:border-brand-gold-dark hover:text-brand-gold-dark text-slate-700 text-center shadow-sm hover:shadow-md transition-all active:scale-95 group cursor-pointer"
                        >
                          <svg class="w-5 h-5 text-slate-400 group-hover:text-brand-gold-dark mb-1.5 transition-colors" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                          </svg>
                          <span class="text-[12px] font-black uppercase tracking-wide">Web</span>
                        </a>
                      )}

                      {contacts.instagram && (
                        <a
                          href={contacts.instagram}
                          target="_blank"
                          rel="noopener"
                          class="flex flex-col items-center justify-center p-3.5 rounded-xl bg-white border border-slate-200 hover:border-pink-500 hover:text-pink-600 text-slate-700 text-center shadow-sm hover:shadow-md transition-all active:scale-95 group cursor-pointer"
                        >
                          <svg class="w-5 h-5 text-slate-400 group-hover:text-pink-500 mb-1.5 transition-colors fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                          </svg>
                          <span class="text-[12px] font-black uppercase tracking-wide">Instagram</span>
                        </a>
                      )}

                    </div>
                  </div>
                )}

                {/* Description Body */}
                <div class="prose max-w-none text-slate-600 prose-slate prose-headings:font-display prose-headings:font-bold prose-headings:text-brand-green-dark prose-p:leading-relaxed">
                  <h2 class="text-xl font-display font-bold text-brand-green-dark border-b border-slate-100 pb-3 mb-4">
                    Detalle del Beneficio
                  </h2>
                  <div
                    dangerouslySetInnerHTML={benefit.descripcion}
                    class="space-y-4 text-sm md:text-base leading-relaxed break-words"
                  />
                </div>

                {/* Cómo usar este beneficio */}
                <div class="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 sm:p-8 shadow-sm space-y-6 print:hidden">
                  <div class="absolute top-0 right-0 w-32 h-32 bg-brand-gold/5 rounded-full blur-2xl pointer-events-none" />

                  <div class="flex items-center space-x-3 pb-4 border-b border-slate-100">
                    <div class="w-10 h-10 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-green-dark">
                      <svg class="w-5 h-5 text-brand-green-dark fill-none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 class="text-lg font-black text-brand-green-dark tracking-tight">Cómo usar este beneficio</h3>
                      <p class="text-xs text-slate-450 font-medium">Presentá tu credencial en el local adherido</p>
                    </div>
                  </div>

                  <ol class="space-y-4">
                    {[
                      "Acercate al local adherido y pedí el beneficio AMP+.",
                      "Mostrá tu credencial digital o indicá tu matrícula o DNI.",
                      "El comercio valida tu membresía y aplica el descuento al instante.",
                    ].map((step, i) => (
                      <li key={i} class="flex items-start gap-3.5">
                        <span class="flex-shrink-0 w-7 h-7 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-sm font-black">
                          {i + 1}
                        </span>
                        <span class="text-sm text-slate-600 leading-relaxed pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>

                  {!user.value && (
                    <Link
                      href="/login"
                      class="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                    >
                      Ver mi credencial digital
                    </Link>
                  )}
                </div>

                {/* Descargar Cupón de Descuento (PDF) */}
                <div class="relative overflow-hidden rounded-3xl border border-brand-green/20 bg-gradient-to-br from-brand-green-dark to-brand-green p-6 sm:p-8 shadow-md space-y-5 print:hidden">
                  <div class="absolute -top-10 -right-10 w-40 h-40 bg-brand-gold/10 rounded-full blur-2xl pointer-events-none" />

                  <div class="flex items-center space-x-3 pb-4 border-b border-white/10">
                    <div class="w-11 h-11 rounded-full bg-brand-gold/20 border border-brand-gold/40 flex items-center justify-center text-brand-gold-light">
                      <svg class="w-5 h-5 fill-none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 14.25l6-6m4.5-3.75a3 3 0 11-6 0 3 3 0 016 0zM12 18.75a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 class="text-lg font-black text-white tracking-tight">Descargar Beneficio en PDF</h3>
                      <p class="text-xs text-slate-300 font-medium">Comprobante con tus datos, QR de verificación y código de barras</p>
                    </div>
                  </div>

                  {user.value ? (
                    <div class="space-y-4">
                      {generatedCoupon.value && (
                        <div class="flex flex-wrap items-center gap-3 text-xs">
                          <span class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold bg-brand-gold/15 text-brand-gold-light border border-brand-gold/30 uppercase tracking-widest">
                            Cupón Activo
                          </span>
                          <span class="text-slate-300 font-medium">
                            Código de canje:{" "}
                            <span class="font-mono font-black text-white tracking-widest">
                              {generatedCoupon.value.code.slice(0, 3)} {generatedCoupon.value.code.slice(3)}
                            </span>
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick$={handleDownloadPdf}
                        disabled={isDownloading.value}
                        class="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-brand-gold hover:bg-brand-gold-light text-brand-green-dark text-sm font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isDownloading.value ? (
                          <>
                            <div class="w-4 h-4 border-2 border-brand-green-dark border-t-transparent rounded-full animate-spin" />
                            <span>Generando PDF...</span>
                          </>
                        ) : (
                          <>
                            <svg class="w-5 h-5 fill-none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Descargar PDF</span>
                          </>
                        )}
                      </button>
                      <p class="text-[11px] text-slate-350 leading-relaxed max-w-md">
                        Incluye los datos del beneficio, tu nombre, matrícula y DNI, un código QR de verificación en tiempo real y un código de barras con tu matrícula. Apto para imprimir en A4.
                      </p>
                    </div>
                  ) : (
                    <div class="rounded-2xl bg-white/5 border border-white/10 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div class="w-11 h-11 rounded-full bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold-light flex-shrink-0">
                        <LuLock class="w-5 h-5" />
                      </div>
                      <div class="flex-grow space-y-0.5">
                        <h4 class="text-sm font-black text-white uppercase tracking-wide">Acceso para agremiados</h4>
                        <p class="text-xs text-slate-300 leading-relaxed">
                          Iniciá sesión con tu cuenta de la AMP para descargar el PDF de este beneficio.
                        </p>
                      </div>
                      <Link
                        href={`/login?redirect=${encodeURIComponent(`/beneficio/${benefit.url}`)}`}
                        class="flex-shrink-0 inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-brand-gold hover:bg-brand-gold-light text-brand-green-dark text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                      >
                        Iniciar Sesión
                      </Link>
                    </div>
                  )}
                </div>

                {/* Documentación PDF Adjunta */}
                {benefit.pdfUrl && (
                  <div class="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-center gap-6 group hover:shadow-md transition-all duration-300">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all duration-500 pointer-events-none" />

                    {/* Icon container */}
                    <div class="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
                      <svg class="w-9 h-9 text-red-500 fill-current" viewBox="0 0 24 24">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9.5 6H10v1.5H8.5V9H7v5h1.5v-2H10v2h1.5V9H9.5zm5 2c0-.55-.45-1-1-1H12v5h1.5v-1.5h1c.55 0 1-.45 1-1V11zm-1.5 1.5V11h1v2h-1zm5-2.5h-2.5v5H17v-2h1.5v-1.5H17V11h2.5V9z" />
                      </svg>
                    </div>

                    {/* Text content */}
                    <div class="flex-grow text-center sm:text-left space-y-1">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-750 border border-red-100 uppercase tracking-widest">
                        Documento PDF
                      </span>
                      <h3 class="text-lg font-black text-brand-green-dark tracking-tight leading-snug">
                        Documentación y Menú Adjunto
                      </h3>
                      <p class="text-xs text-slate-450 font-medium leading-relaxed">
                        Consultá la lista de precios, bases o información extra digital de este beneficio.
                      </p>
                    </div>

                    {/* Actions */}
                    <div class="flex flex-row sm:flex-col gap-2.5 w-full sm:w-auto">
                      <a
                        href={benefit.pdfUrl}
                        target="_blank"
                        rel="noopener"
                        class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer text-center whitespace-nowrap"
                      >
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Ver Documento
                      </a>
                      <a
                        href={`/descargar/?url=${encodeURIComponent(benefit.pdfUrl)}&filename=${encodeURIComponent(benefit.titulo || "documento")}`}
                        download
                        class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer text-center whitespace-nowrap"
                      >
                        <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Descargar
                      </a>
                    </div>
                  </div>
                )}

                {/* How to use */}
                <div class="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div class="flex items-center space-x-2 text-brand-green font-bold text-sm">
                    <svg class="w-5 h-5 text-brand-gold fill-current" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                    </svg>
                    <span>¿Cómo accedo a este beneficio?</span>
                  </div>
                  <p class="text-xs text-slate-500 leading-relaxed">
                    Para hacer efectivo el descuento, presentá tu credencial digital médica a través de la app oficial de la Agremiación Médica Platense al momento de realizar tu compra o reserva en el comercio correspondiente.
                  </p>
                </div>

              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR: Credential & Interactive OSM Leaflet Map */}
          <div class="space-y-8">

            {/* 1. Interactive Digital Credential */}
            {user.value ? (
              <div class="credential-card border rounded-2xl p-6 shadow-lg relative overflow-hidden select-none animate-float">
                {/* Backglow decoratives */}
                <div class="absolute -right-16 -top-16 w-36 h-36 bg-brand-gold/15 rounded-full blur-xl" />
                <div class="absolute -left-12 -bottom-12 w-28 h-28 bg-white/5 rounded-full blur-lg" />

                <div class="flex items-center justify-between border-b border-white/20 pb-4 mb-6">
                  <div class="flex items-center space-x-2">
                    <img
                      src="/logo-beneficios_amp2.webp"
                      alt="AMP"
                      width={96}
                      height={38}
                      class="h-[38px] w-auto object-contain"
                    />
                    <span class="text-sm font-extrabold uppercase tracking-widest text-slate-200">Credencial AMP+</span>
                  </div>
                  <span class="text-[11px] font-black text-brand-gold border border-brand-gold/45 px-2.5 py-1 rounded uppercase tracking-wider">
                    Activa
                  </span>
                </div>

                <div class="space-y-4">
                  <div class="flex items-center space-x-4">
                    <div class="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-display font-extrabold text-lg text-brand-gold-light shadow-inner uppercase">
                      {(() => {
                        const nameParts = user.value.name.trim().split(/\s+/);
                        if (nameParts.length >= 2) {
                          return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
                        }
                        return nameParts[0]?.substring(0, 2).toUpperCase() || "DR";
                      })()}
                    </div>
                    <div>
                      <h4 class="text-base font-black font-display leading-none text-white tracking-wide">{user.value.name}</h4>
                      <p class="text-[12px] text-slate-300 font-black uppercase tracking-wider mt-2">Matrícula: {user.value.matricula || "N/A"}</p>
                    </div>
                  </div>

                  <div class="bg-white/5 border border-white/10 rounded-xl p-3.5 flex justify-between items-center mt-3 text-xs">
                    <div>
                      <span class="text-[11.5px] text-slate-350 font-black uppercase tracking-wider block">Afiliado Nro.</span>
                      <span class="font-mono font-black text-white text-sm mt-0.5 block">
                        {user.value.matricula ? `00-${user.value.matricula}/1-09` : "00-00000/1-09"}
                      </span>
                    </div>
                    <div class="text-right">
                      <span class="text-[11.5px] text-slate-350 font-black uppercase tracking-wider block">Vence</span>
                      <span class="font-black text-white text-sm mt-0.5 block">12 / 2028</span>
                    </div>
                  </div>

                  {/* Simulated Barcode */}
                  <div class="pt-4 border-t border-white/10 flex flex-col items-center">
                    <div class="w-full h-8 bg-white/95 rounded flex items-center justify-between px-3 py-1 space-x-0.5 overflow-hidden filter grayscale opacity-85">
                      {Array.from({ length: 42 }).map((_, i) => {
                        const widths = ["w-[1px]", "w-[2px]", "w-[3px]", "w-[1px]", "w-[4px]"];
                        const width = widths[Math.floor(Math.sin(i + (user.value?.matricula ? parseInt(user.value.matricula) : 0)) * 5) + 2] || "w-[1px]";
                        return <div key={i} class={`h-full bg-slate-900 ${width}`} />;
                      })}
                    </div>
                    <span class="text-[10px] font-mono tracking-widest text-slate-300 mt-1.5 font-bold">
                      {user.value.matricula ? `${user.value.matricula}0034988109` : "000000000034988109"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div class="credential-card-locked border rounded-2xl p-6 shadow-lg relative overflow-hidden select-none animate-float">
                {/* Blur backdrop overlay decoration */}
                <div class="absolute inset-0 bg-slate-950/20 backdrop-blur-[3px] z-10 flex flex-col items-center justify-center p-6 text-center">
                  <div class="w-12 h-12 rounded-full bg-brand-gold/15 border border-brand-gold/40 flex items-center justify-center text-brand-gold shadow-lg mb-3 animate-pulse">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25-2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <h4 class="text-sm font-black text-white uppercase tracking-wider mb-1">Credencial Digital AMP+</h4>
                  <p class="text-[11px] text-slate-300 font-medium max-w-[200px] leading-relaxed mb-4">
                    Iniciá sesión o verificá tu DNI para visualizar tu credencial digital.
                  </p>
                  <Link
                    href={`/login?redirect=${encodeURIComponent(`/beneficio/${benefit.url}`)}`}
                    class="px-4 py-2 bg-brand-gold hover:bg-brand-gold-light text-brand-green-dark text-[11px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    Verificar DNI
                  </Link>
                </div>

                {/* Mocked blurry background content to make it look realistic under the overlay */}
                <div class="opacity-30 filter blur-[2px] pointer-events-none select-none">
                  <div class="flex items-center justify-between border-b border-white/20 pb-4 mb-6">
                    <div class="flex items-center space-x-2">
                      <div class="w-10 h-6 bg-white/20 rounded" />
                      <span class="text-sm font-extrabold uppercase tracking-widest text-slate-200">Credencial AMP+</span>
                    </div>
                    <span class="text-[11px] font-black text-brand-gold border border-brand-gold/45 px-2.5 py-1 rounded uppercase tracking-wider">
                      Activa
                    </span>
                  </div>

                  <div class="space-y-4">
                    <div class="flex items-center space-x-4">
                      <div class="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-display font-extrabold text-lg text-brand-gold-light shadow-inner">
                        DR
                      </div>
                      <div>
                        <h4 class="text-base font-black font-display leading-none text-white tracking-wide">Dr. Manuel Rodriguez</h4>
                        <p class="text-[12px] text-slate-300 font-black uppercase tracking-wider mt-2">Matrícula: 115243</p>
                      </div>
                    </div>

                    <div class="bg-white/5 border border-white/10 rounded-xl p-3.5 flex justify-between items-center mt-3 text-xs">
                      <div>
                        <span class="text-[11.5px] text-slate-350 font-black uppercase tracking-wider block">Afiliado Nro.</span>
                        <span class="font-mono font-black text-white text-sm mt-0.5 block">00-34988/1-09</span>
                      </div>
                      <div class="text-right">
                        <span class="text-[11.5px] text-slate-350 font-black uppercase tracking-wider block">Vence</span>
                        <span class="font-black text-white text-sm mt-0.5 block">12 / 2027</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* 2. Lazy Map Container */}
            {benefit.latitud && benefit.longitud && (
              <div class="glass-card border rounded-2xl overflow-hidden shadow-md bg-white">
                <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                    <svg class="w-4 h-4 text-brand-gold fill-current" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                    <span>Ubicación en Mapa</span>
                  </h3>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${benefit.latitud},${benefit.longitud}`}
                    target="_blank"
                    rel="noopener"
                    class="text-[10px] font-bold text-brand-green-light hover:text-brand-green hover:underline cursor-pointer"
                  >
                    Abrir en Google Maps &rarr;
                  </a>
                </div>

                {/* Visual leafet map container */}
                <div class="relative h-64 bg-slate-100 flex items-center justify-center">
                  <div id="leaflet-map" class="w-full h-full z-10" />

                  {!isMapLoaded.value && (
                    <div class="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center space-y-3 z-20">
                      <div class="w-7 h-7 border-2 border-brand-green-light border-t-transparent rounded-full animate-spin" />
                      <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cargando Mapa...</span>
                    </div>
                  )}
                </div>

                {contacts.address && (
                  <div class="p-4 text-xs text-slate-500 bg-slate-50 leading-relaxed border-t border-slate-100">
                    <span class="font-bold text-slate-700 block mb-0.5">Dirección:</span>
                    {contacts.address}
                  </div>
                )}
              </div>
            )}

            {/* 3. Similar Benefits Recommendations Column */}
            {similar.length > 0 && (
              <div class="glass-card border rounded-2xl p-6 bg-white shadow-md space-y-5">
                <h3 class="text-sm font-black uppercase tracking-wider text-slate-700 border-l-2 border-brand-gold pl-2">
                  Beneficios Recomendados
                </h3>
                <div class="divide-y divide-slate-100 space-y-4">
                  {similar.map((b: Benefit) => {
                    const simImg = b.imagen
                      ? (b.imagen.startsWith('http') || b.imagen.startsWith('/') ? b.imagen : `https://beneficios.amepla.org.ar/files/${b.imagen}`)
                      : null;
                    return (
                      <Link
                        key={b.id}
                        href={`/beneficio/${b.url}`}
                        class="block group pt-4 first:pt-0"
                      >
                        <div class="flex items-center space-x-3.5">
                          <div class="w-14 h-14 bg-white rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-100 shadow-sm">
                            {simImg ? (
                              <img
                                src={simImg}
                                alt={b.titulo}
                                class="w-full h-full object-contain"
                                width={56}
                                height={56}
                              />
                            ) : (
                              <span class="text-brand-gold font-display font-extrabold text-xs">AMP</span>
                            )}
                          </div>
                          <div class="flex-grow space-y-1">
                            <span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-black bg-brand-green/5 text-brand-green border border-brand-green/10 uppercase tracking-wide">
                              {b.categorias[0]?.descripcion || "Beneficio"}
                            </span>
                            <h4 class="text-sm font-black text-slate-800 line-clamp-1 group-hover:text-brand-green-light transition-colors">
                              {b.titulo}
                            </h4>
                            <p class="text-xs font-extrabold text-brand-gold">
                              {b.resumen.trim()}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

        </div>
      </div>

      {showToast.value && (
        <div class="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider py-3 px-6 rounded-full shadow-2xl flex items-center space-x-2.5 animate-toast-up border border-white/10 print:hidden">
          <span class="text-brand-gold">✓</span>
          <span>¡Enlace copiado al portapapeles!</span>
        </div>
      )}

    </div>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const data = resolveValue(useBenefitData);
  if (!data) {
    return {
      title: "Beneficio No Encontrado - Portal de Beneficios AMP"
    };
  }
  const { benefit } = data;
  const desc = benefit.descripcion.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 160);
  return {
    title: `${benefit.titulo} - Club de Beneficios AMP`,
    meta: [
      {
        name: "description",
        content: `${benefit.resumen.trim()} en ${benefit.titulo}. ${desc}`
      },
      {
        property: "og:title",
        content: `${benefit.titulo} - Club de Beneficios AMP`
      },
      {
        property: "og:description",
        content: `${benefit.resumen.trim()} en ${benefit.titulo}. Presentá tu credencial digital AMP+ y ahorrá.`
      }
    ]
  };
};
