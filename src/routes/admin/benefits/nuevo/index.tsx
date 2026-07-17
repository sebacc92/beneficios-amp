import { component$, useSignal, useTask$, $ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, Link, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuImage, LuSmartphone, LuSparkles, LuChevronLeft } from "@qwikest/icons/lucide";
import { ImageFramePreview } from "~/components/image-frame-preview/image-frame-preview";
import { put } from "@vercel/blob";
import { getDB } from "~/db";
import { customBenefits as customBenefitsTable } from "~/db/schema";
import { getFilters } from "~/server/cache";
import { mergeContacts } from "~/utils/benefit-contacts";
import { deriveDiscountBadge, pctFromText } from "~/utils/discount";
import { sanitizeRichText } from "~/utils/sanitize-html";
import { RichTextEditor } from "~/components/rich-text-editor/rich-text-editor";
import { LocationPicker } from "~/components/location-picker/location-picker";
import { uploadImageDataUrl } from "~/utils/upload-image";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

// Etiquetas legibles para mostrar qué campo obligatorio falló la validación.
const FIELD_LABELS: Record<string, string> = {
  titulo: "Falta el título (mínimo 3 caracteres).",
  resumen: "Falta el resumen / descuento (mínimo 5 caracteres).",
  descripcion: "Falta la descripción (mínimo 5 caracteres).",
  categoryId: "Elegí una categoría.",
  locationId: "Elegí una ubicación.",
  offerId: "Elegí una oferta / descuento.",
};

export const useAdminFiltersLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  return await getFilters();
});

export const useCreateBenefitAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const uuid = "cb-" + Date.now().toString();
      const slug = uuid + "-" + data.titulo.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");

      let uploadedPdfUrl = null;

      if (data.pdfFile && typeof data.pdfFile === "object" && (data.pdfFile as Blob).size > 0) {
        const file = data.pdfFile as File;

        // Attempt Vercel Blob Upload
        let uploaded = false;
        if (process.env.BLOB_READ_WRITE_TOKEN || requestEvent.env.get("BLOB_READ_WRITE_TOKEN")) {
          try {
            const token = process.env.BLOB_READ_WRITE_TOKEN || requestEvent.env.get("BLOB_READ_WRITE_TOKEN");
            const blob = await put(`pdf-${Date.now()}-${file.name}`, file, {
              access: "public",
              token: token
            });
            uploadedPdfUrl = blob.url;
            uploaded = true;
            console.log("[Vercel Blob] Uploaded PDF to:", blob.url);
          } catch (blobErr: any) {
            console.error("[Vercel Blob] Upload failed, falling back to disk:", blobErr.message);
          }
        }

        if (!uploaded) {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });

          const extension = file.name.split(".").pop() || "pdf";
          const fileName = `benefit-pdf-${Date.now()}.${extension}`;
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, buffer);
          uploadedPdfUrl = `/uploads/${fileName}`;
        }
      }

      let uploadedImageUrl = null;
      let imageUploaded = false;
      const token = process.env.BLOB_READ_WRITE_TOKEN || requestEvent.env.get("BLOB_READ_WRITE_TOKEN");

      if (data.optimizedImage && typeof data.optimizedImage === "string" && data.optimizedImage.startsWith("data:image")) {
        const base64Data = data.optimizedImage.replace(/^data:image\/\w+;base64,/, "");
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const fileName = `benefit-${Date.now()}.webp`;

        if (token) {
          try {
            const blob = await put(fileName, Buffer.from(bytes), {
              access: "public",
              token: token
            });
            uploadedImageUrl = blob.url;
            imageUploaded = true;
            console.log("[Vercel Blob] Uploaded optimized image to:", blob.url);
          } catch (blobErr: any) {
            console.error("[Vercel Blob] Upload failed, falling back to disk:", blobErr.message);
          }
        }

        if (!imageUploaded) {
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, bytes);
          uploadedImageUrl = `/uploads/${fileName}`;
        }
      } else if (data.imageFile && typeof data.imageFile === "object" && (data.imageFile as Blob).size > 0) {
        const file = data.imageFile as File;
        const extension = file.name.split(".").pop() || "png";
        const fileName = `benefit-${Date.now()}.${extension}`;

        if (token) {
          try {
            const blob = await put(fileName, file, {
              access: "public",
              token: token
            });
            uploadedImageUrl = blob.url;
            imageUploaded = true;
            console.log("[Vercel Blob] Uploaded image file to:", blob.url);
          } catch (blobErr: any) {
            console.error("[Vercel Blob] Upload failed, falling back to disk:", blobErr.message);
          }
        }

        if (!imageUploaded) {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, buffer);
          uploadedImageUrl = `/uploads/${fileName}`;
        }
      } else if (
        data.principalUrl &&
        typeof data.principalUrl === "string" &&
        (data.principalUrl.startsWith("http") || data.principalUrl.startsWith("/"))
      ) {
        // La foto principal es una URL ya subida (no un data URL nuevo).
        uploadedImageUrl = data.principalUrl;
      }

      let uploadedImageMobileUrl = null;
      let imageMobileUploaded = false;

      if (data.optimizedMobileImage && typeof data.optimizedMobileImage === "string" && data.optimizedMobileImage.startsWith("data:image")) {
        const base64Data = data.optimizedMobileImage.replace(/^data:image\/\w+;base64,/, "");
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const fileName = `benefit-mobile-${Date.now()}.webp`;

        if (token) {
          try {
            const blob = await put(fileName, Buffer.from(bytes), {
              access: "public",
              token: token
            });
            uploadedImageMobileUrl = blob.url;
            imageMobileUploaded = true;
            console.log("[Vercel Blob] Uploaded optimized mobile image to:", blob.url);
          } catch (blobErr: any) {
            console.error("[Vercel Blob] Mobile upload failed, falling back to disk:", blobErr.message);
          }
        }

        if (!imageMobileUploaded) {
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, bytes);
          uploadedImageMobileUrl = `/uploads/${fileName}`;
        }
      } else if (data.imageMobileFile && typeof data.imageMobileFile === "object" && (data.imageMobileFile as Blob).size > 0) {
        const file = data.imageMobileFile as File;
        const extension = file.name.split(".").pop() || "png";
        const fileName = `benefit-mobile-${Date.now()}.${extension}`;

        if (token) {
          try {
            const blob = await put(fileName, file, {
              access: "public",
              token: token
            });
            uploadedImageMobileUrl = blob.url;
            imageMobileUploaded = true;
            console.log("[Vercel Blob] Uploaded mobile image file to:", blob.url);
          } catch (blobErr: any) {
            console.error("[Vercel Blob] Mobile upload failed, falling back to disk:", blobErr.message);
          }
        }

        if (!imageMobileUploaded) {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, buffer);
          uploadedImageMobileUrl = `/uploads/${fileName}`;
        }
      } else if (
        data.mobileUrl &&
        typeof data.mobileUrl === "string" &&
        (data.mobileUrl.startsWith("http") || data.mobileUrl.startsWith("/"))
      ) {
        // Imagen de mobile distinta que ya es una URL subida (elegida de la galería).
        uploadedImageMobileUrl = data.mobileUrl;
      }

      let lat = data.latitud?.trim() || null;
      let lng = data.longitud?.trim() || null;
      if (!lat || !lng) {
        const randomOffsetLat = (Math.random() - 0.5) * 0.04;
        const randomOffsetLng = (Math.random() - 0.5) * 0.04;
        lat = (-34.9205 + randomOffsetLat).toFixed(6);
        lng = (-57.9536 + randomOffsetLng).toFixed(6);
      }

      // Usar la misma imagen de desktop para móvil.
      if (data.sameImageForMobile === "true" && uploadedImageUrl) {
        uploadedImageMobileUrl = uploadedImageUrl;
      }

      // Galería de imágenes adicionales (hasta 9). Cada item es un data URL
      // optimizado (nuevo) o una URL ya subida (se conserva tal cual).
      let galeriaJson: string | null = null;
      if (data.galeriaJson && typeof data.galeriaJson === "string") {
        try {
          const items = JSON.parse(data.galeriaJson);
          if (Array.isArray(items) && items.length > 0) {
            const urls: string[] = [];
            for (const item of items.slice(0, 9)) {
              if (typeof item !== "string") continue;
              if (item.startsWith("data:image")) {
                const base64Data = item.replace(/^data:image\/\w+;base64,/, "");
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                const fileName = `benefit-gallery-${Date.now()}-${urls.length}.webp`;
                let galleryUploaded = false;
                if (token) {
                  try {
                    const blob = await put(fileName, Buffer.from(bytes), { access: "public", token });
                    urls.push(blob.url);
                    galleryUploaded = true;
                  } catch (blobErr: any) {
                    console.error("[Vercel Blob] Gallery upload failed, falling back to disk:", blobErr.message);
                  }
                }
                if (!galleryUploaded) {
                  const uploadsDir = `${process.cwd()}/public/uploads`;
                  const fsModule = await import("fs/promises");
                  await fsModule.mkdir(uploadsDir, { recursive: true });
                  await fsModule.writeFile(`${uploadsDir}/${fileName}`, bytes);
                  urls.push(`/uploads/${fileName}`);
                }
              } else if (item.startsWith("http") || item.startsWith("/")) {
                urls.push(item);
              }
            }
            if (urls.length > 0) galeriaJson = JSON.stringify(urls);
          }
        } catch (galErr) {
          console.error("Error procesando la galería:", galErr);
        }
      }

      await db.insert(customBenefitsTable).values({
        id: uuid,
        titulo: data.titulo,
        resumen: data.resumen,
        descripcion: mergeContacts(sanitizeRichText(data.descripcion), data.whatsapp || "", data.instagram || "", data.direccion || ""),
        imagen: uploadedImageUrl,
        imagenMobile: uploadedImageMobileUrl,
        galeria: galeriaJson,
        slug,
        isFeatured: data.isFeatured === "on",
        categoryId: Number(data.categoryId),
        locationId: Number(data.locationId),
        offerId: Number(data.offerId),
        couponCode: data.couponCode || null,
        validUntil: data.isActive !== "on" ? `draft|${data.validUntil || ""}` : (data.validUntil || null),
        terms: data.terms || null,
        pdfUrl: uploadedPdfUrl,
        latitud: lat,
        longitud: lng,
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al crear el beneficio." });
    }

    throw requestEvent.redirect(302, "/admin/benefits/?ok=created");
  },
  zod$({
    titulo: z.string().min(3),
    resumen: z.string().min(5),
    descripcion: z.string().min(5),
    whatsapp: z.string().optional(),
    instagram: z.string().optional(),
    direccion: z.string().optional(),
    imagen: z.string().optional(),
    imagenMobile: z.string().optional(),
    isFeatured: z.string().optional(),
    categoryId: z.string(),
    locationId: z.string(),
    offerId: z.string(),
    couponCode: z.string().optional(),
    validUntil: z.string().optional(),
    isActive: z.string().optional(),
    terms: z.string().optional(),
    pdfUrl: z.string().optional(),
    pdfFile: z.any().optional(),
    imageFile: z.any().optional(),
    optimizedImage: z.string().optional(),
    principalUrl: z.string().optional(),
    imageMobileFile: z.any().optional(),
    optimizedMobileImage: z.string().optional(),
    mobileUrl: z.string().optional(),
    sameImageForMobile: z.string().optional(),
    galeriaJson: z.string().optional(),
    latitud: z.string().optional(),
    longitud: z.string().optional(),
  })
);

export default component$(() => {
  const adminFilters = useAdminFiltersLoader();
  const createBenefitAction = useCreateBenefitAction();
  // Indicador de "cambios sin guardar" para la barra sticky.
  const createDirty = useSignal(false);

  // Imágenes del beneficio: una sola galería con TODAS las fotos (data URLs webp
  // optimizados). Una es la "principal" y alimenta desktop + mobile por defecto.
  // createGaleria guarda URLs de Vercel Blob (las imágenes se suben al
  // seleccionarlas, no en el submit, para que el formulario viaje liviano).
  const createGaleria = useSignal<string[]>([]);
  const createPrincipalIndex = useSignal<number>(0);
  // Subidas en curso (>0 = deshabilitar guardar) y último error de subida.
  const createUploading = useSignal<number>(0);
  const createUploadError = useSignal<string>("");
  // Overrides por formato (null = usar la principal). Permiten desktop y mobile
  // distintos (ej. horizontal en desktop, vertical en mobile).
  const createDesktopIdx = useSignal<number | null>(null);
  const createMobileIdx = useSignal<number | null>(null);

  // Ubicación (mapa) y dirección
  const createLat = useSignal<string>("");
  const createLng = useSignal<string>("");
  const createDireccion = useSignal<string>("");

  // Live preview signals
  const createPreviewTitulo = useSignal("Nombre del Comercio");
  const createPreviewResumen = useSignal("20% de descuento");
  const createPreviewDescripcion = useSignal("");
  const createPreviewIsFeatured = useSignal(false);
  const createPreviewCategory = useSignal("");
  const createPreviewLocation = useSignal("");

  // Descuento: el badge (resumen) se autogenera desde la oferta seleccionada,
  // salvo que se active "personalizar texto".
  const createOfferDesc = useSignal("");
  const createResumen = useSignal("");
  const createOverrideResumen = useSignal(false);

  useTask$(({ track }) => {
    track(() => adminFilters.value);
    if (adminFilters.value) {
      if (!createPreviewCategory.value) createPreviewCategory.value = adminFilters.value.categorias[0]?.descripcion || "Categoría";
      if (!createPreviewLocation.value) createPreviewLocation.value = adminFilters.value.ubicaciones[0]?.descripcion || "La Plata";
      if (!createOfferDesc.value) createOfferDesc.value = adminFilters.value.ofertas[0]?.descripcion || "";
    }
  });

  // Sincroniza el badge con la oferta cuando NO hay override manual.
  useTask$(({ track }) => {
    track(() => createOfferDesc.value);
    track(() => createOverrideResumen.value);
    if (!createOverrideResumen.value) {
      const badge = deriveDiscountBadge(createOfferDesc.value);
      createResumen.value = badge;
      createPreviewResumen.value = badge;
    }
  });

  // Galería: optimiza y agrega múltiples imágenes (máx. 9 adicionales)
  const handleCreateGalleryChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const files = Array.from(element.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          if (createGaleria.value.length >= 10) return;
          const canvas = document.createElement("canvas");
          const maxW = 1000;
          const maxH = 1000;
          let w = img.width;
          let h = img.height;
          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/webp", 0.82);
          // Subir a Blob al instante y guardar la URL (no el base64).
          createUploading.value++;
          try {
            const res = await uploadImageDataUrl(dataUrl, "benefit-gallery");
            if ("url" in res) {
              if (createGaleria.value.length < 10) {
                createGaleria.value = [...createGaleria.value, res.url];
                createDirty.value = true;
              }
            } else {
              createUploadError.value = res.error;
            }
          } finally {
            createUploading.value--;
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
    element.value = "";
  });

  const removeCreateGalleryImage = $((index: number) => {
    createGaleria.value = createGaleria.value.filter((_, i) => i !== index);
    // Mantener la principal apuntando a una foto válida.
    if (createPrincipalIndex.value === index) {
      createPrincipalIndex.value = 0;
    } else if (createPrincipalIndex.value > index) {
      createPrincipalIndex.value = createPrincipalIndex.value - 1;
    }
    // Ajustar los overrides por formato (o volver a "usar principal").
    const fixOverride = (v: number | null) =>
      v === null ? null : v === index ? null : v > index ? v - 1 : v;
    createDesktopIdx.value = fixOverride(createDesktopIdx.value);
    createMobileIdx.value = fixOverride(createMobileIdx.value);
  });

  const setCreatePrincipal = $((index: number) => {
    createPrincipalIndex.value = index;
  });

  // Sube UNA imagen y la asigna directamente a un formato (desktop/mobile).
  const addPhotoForFormat = $((event: Event, target: "desktop" | "mobile") => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const file = element.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        if (createGaleria.value.length >= 10) return;
        const canvas = document.createElement("canvas");
        const maxW = 1000;
        const maxH = 1000;
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/webp", 0.82);
        createUploading.value++;
        try {
          const res = await uploadImageDataUrl(dataUrl, `benefit-${target}`);
          if ("url" in res) {
            if (createGaleria.value.length < 10) {
              const idx = createGaleria.value.length;
              createGaleria.value = [...createGaleria.value, res.url];
              if (target === "desktop") createDesktopIdx.value = idx;
              else createMobileIdx.value = idx;
              createDirty.value = true;
            }
          } else {
            createUploadError.value = res.error;
          }
        } finally {
          createUploading.value--;
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    element.value = "";
  });

  // Fotos resueltas por formato (con override o, si no, la principal).
  const createDesktopResolvedIdx = createDesktopIdx.value ?? createPrincipalIndex.value;
  const createMobileResolvedIdx = createMobileIdx.value ?? createPrincipalIndex.value;
  const createPrincipalPhoto = createGaleria.value[createPrincipalIndex.value] ?? null;
  const createDesktopPhoto = createGaleria.value[createDesktopResolvedIdx] ?? null;
  const createMobilePhoto = createGaleria.value[createMobileResolvedIdx] ?? null;
  const createMobileDiffers = createMobilePhoto !== null && createMobilePhoto !== createDesktopPhoto;
  // La galería pública excluye las imágenes usadas como desktop y mobile.
  const createUsedIdx = new Set([createDesktopResolvedIdx, createMobileResolvedIdx]);
  const createExtraPhotos = createGaleria.value.filter((_, i) => !createUsedIdx.has(i));

  return (
    <div class="w-full px-6 sm:px-10 pt-10 space-y-8 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      {/* Header */}
      <div class="flex flex-col gap-3 border-b border-slate-200 pb-7 w-full max-w-3xl mx-auto">
        <Link
          href="/admin/benefits/"
          class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-green transition-colors w-fit"
        >
          <LuChevronLeft class="w-4 h-4" />
          Volver al listado
        </Link>
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              Administración / Catálogo
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Crear Beneficio
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Registrá un nuevo beneficio propio en el portal local.
          </p>
        </div>
      </div>

      <Form
        action={createBenefitAction}
        enctype="multipart/form-data"
        onInput$={() => { createDirty.value = true; }}
        onChange$={() => { createDirty.value = true; }}
        class="relative bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 pb-0 shadow-sm space-y-5 w-full max-w-3xl mx-auto">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Título</label>
            <input
              type="text"
              name="titulo"
              required
              placeholder="Ej: Spa Platense Masajes"
              onInput$={(e) => { createPreviewTitulo.value = (e.target as HTMLInputElement).value; }}
              class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between gap-2">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Resumen (badge descuento)</label>
              <label class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createOverrideResumen.value}
                  onChange$={(e) => { createOverrideResumen.value = (e.target as HTMLInputElement).checked; }}
                  class="accent-brand-green w-3.5 h-3.5"
                />
                Personalizar texto
              </label>
            </div>
            <input
              type="text"
              name="resumen"
              required
              readOnly={!createOverrideResumen.value}
              placeholder="Ej: 20% de descuento"
              value={createResumen.value}
              onInput$={(e) => {
                createResumen.value = (e.target as HTMLInputElement).value;
                createPreviewResumen.value = (e.target as HTMLInputElement).value;
              }}
              class={[
                "w-full text-slate-800 text-sm px-4 py-3 rounded-2xl border transition-all focus:outline-none",
                createOverrideResumen.value
                  ? "bg-white border-slate-200 focus:border-brand-green"
                  : "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed",
              ]}
            />
            {!createOverrideResumen.value ? (
              <p class="text-[10px] text-slate-400 font-medium">Se genera automáticamente desde la oferta seleccionada.</p>
            ) : (
              (() => {
                const textPct = pctFromText(createResumen.value);
                const offerPct = pctFromText(deriveDiscountBadge(createOfferDesc.value));
                if (textPct && offerPct && textPct !== offerPct) {
                  return (
                    <p class="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                      <span>⚠</span>
                      El texto dice {textPct}% pero la oferta seleccionada es {offerPct}%.
                    </p>
                  );
                }
                return <p class="text-[10px] text-slate-400 font-medium">Texto personalizado.</p>;
              })()
            )}
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Descripción Detallada</label>
          <RichTextEditor value={createPreviewDescripcion} placeholder="Escribí los detalles del descuento y las condiciones…" />
          <input type="hidden" name="descripcion" value={createPreviewDescripcion.value} />
          <p class="text-[10px] text-slate-400 font-medium">Formato disponible: negrita, itálica, listas y enlaces.</p>
        </div>

        {/* Contacto del local (se muestra en la ficha pública) */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">WhatsApp / Teléfono</label>
            <input
              type="text"
              name="whatsapp"
              placeholder="Ej: 549 221 555 1234"
              class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
            />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Instagram (usuario o link)</label>
            <input
              type="text"
              name="instagram"
              placeholder="Ej: @milocal o instagram.com/milocal"
              class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Categoría</label>
            <select
              name="categoryId"
              onChange$={(e, el) => { createPreviewCategory.value = el.options[el.selectedIndex].text; }}
              class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all cursor-pointer"
            >
              {adminFilters.value.categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.descripcion}
                </option>
              ))}
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Ubicación</label>
            <select
              name="locationId"
              onChange$={(e, el) => { createPreviewLocation.value = el.options[el.selectedIndex].text; }}
              class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all cursor-pointer"
            >
              {adminFilters.value.ubicaciones.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.descripcion}
                </option>
              ))}
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Oferta / Descuento</label>
            <select
              name="offerId"
              onChange$={(e, el) => { createOfferDesc.value = el.options[el.selectedIndex].text; }}
              class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all cursor-pointer"
            >
              {adminFilters.value.ofertas.map((off) => (
                <option key={off.id} value={off.id}>
                  {off.descripcion}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dirección y ubicación en el mapa */}
        <div class="space-y-2 border-t border-slate-100 pt-5">
          <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Dirección y ubicación en el mapa</label>
          <p class="text-[11px] text-slate-400 font-medium">La dirección se muestra tal cual en la ficha del beneficio.</p>
          <input type="hidden" name="latitud" value={createLat.value} />
          <input type="hidden" name="longitud" value={createLng.value} />
          <input type="hidden" name="direccion" value={createDireccion.value} />
          <LocationPicker lat={createLat} lng={createLng} address={createDireccion} mapId="create-benefit-map" />
        </div>

        {/* Imágenes del beneficio (galería unificada con foto principal) */}
        <div class="border-t border-slate-100 pt-5 space-y-4">
          <div>
            <h4 class="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
              <LuImage class="w-4 h-4 text-brand-green" />
              Imágenes del Beneficio
            </h4>
            <p class="text-[10px] text-slate-400 font-medium mt-1">
              Sumá las fotos y marcá una como <b>Principal</b> (★): esa alimenta la imagen de desktop y mobile.
              El resto se muestran en el carrusel del beneficio. Podés usar otra imagen para desktop o mobile en la vista previa.
            </p>
            <p class="text-[10px] text-slate-400 font-medium mt-1">
              Hasta 10 fotos · <b>Desktop 1200×900px (4:3)</b> · <b>Mobile 1080×1350px (4:5)</b> · PNG, JPG o WebP · hasta ~3 MB c/u (se reescalan a 1000px y se optimizan solas).
            </p>
            {createUploadError.value && (
              <p class="text-[11px] text-red-600 font-bold mt-1">{createUploadError.value}</p>
            )}
          </div>

          {/* Campos derivados enviados al servidor. */}
          <input
            type="hidden"
            name="optimizedImage"
            value={createDesktopPhoto && createDesktopPhoto.startsWith("data:image") ? createDesktopPhoto : ""}
          />
          <input
            type="hidden"
            name="principalUrl"
            value={createDesktopPhoto && !createDesktopPhoto.startsWith("data:image") ? createDesktopPhoto : ""}
          />
          <input
            type="hidden"
            name="optimizedMobileImage"
            value={createMobileDiffers && createMobilePhoto!.startsWith("data:image") ? createMobilePhoto! : ""}
          />
          <input
            type="hidden"
            name="mobileUrl"
            value={createMobileDiffers && !createMobilePhoto!.startsWith("data:image") ? createMobilePhoto! : ""}
          />
          <input type="hidden" name="sameImageForMobile" value={createMobileDiffers ? "false" : "true"} />
          <input type="hidden" name="galeriaJson" value={JSON.stringify(createExtraPhotos)} />

          <div class="flex flex-wrap gap-3">
            {createGaleria.value.map((src, i) => {
              const isPrincipal = i === createPrincipalIndex.value;
              return (
                <div
                  key={i}
                  class={[
                    "relative w-28 h-28 rounded-2xl overflow-hidden border-2 shadow-sm group",
                    isPrincipal ? "border-brand-green ring-2 ring-brand-green/25" : "border-slate-200",
                  ]}
                >
                  <img src={src} alt={`Foto ${i + 1}`} class="w-full h-full object-cover" width={112} height={112} />
                  {/* Marcar como principal */}
                  <button
                    type="button"
                    onClick$={() => setCreatePrincipal(i)}
                    title={isPrincipal ? "Foto principal" : "Marcar como principal"}
                    class={[
                      "absolute top-1 left-1 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black shadow transition-colors",
                      isPrincipal
                        ? "bg-brand-green text-white"
                        : "bg-black/45 text-white/90 opacity-0 group-hover:opacity-100 hover:bg-black/70",
                    ]}
                  >
                    ★
                  </button>
                  {/* Eliminar */}
                  <button
                    type="button"
                    onClick$={() => removeCreateGalleryImage(i)}
                    class="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-black shadow hover:bg-red-700 transition-colors"
                  >
                    ×
                  </button>
                  {isPrincipal && (
                    <span class="absolute bottom-0 inset-x-0 bg-brand-green text-white text-[9px] font-black uppercase tracking-wider text-center py-0.5">
                      Principal
                    </span>
                  )}
                </div>
              );
            })}
            {createGaleria.value.length < 10 && (
              <label class="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 hover:border-brand-green hover:bg-slate-50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all text-slate-400 hover:text-brand-green">
                <LuImage class="w-6 h-6" />
                <span class="text-[9px] font-bold uppercase tracking-wider">Agregar</span>
                <input type="file" accept="image/*" multiple onChange$={handleCreateGalleryChange} class="hidden" />
              </label>
            )}
          </div>
          <span class="text-[10px] text-slate-400 font-bold">{createGaleria.value.length} / 10 fotos</span>

          {/* Vista previa con marco real + override por formato (desktop / mobile) */}
          {createPrincipalPhoto && (
            <div class="flex flex-wrap gap-8 pt-2">
              {/* Desktop */}
              <div class="space-y-2">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Desktop (16:9)</span>
                <div class="relative w-64 aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                  {createDesktopPhoto && <ImageFramePreview src={createDesktopPhoto} targetRatio={16 / 9} />}
                </div>
                <label class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createDesktopIdx.value !== null}
                    onChange$={(e) => {
                      createDesktopIdx.value = (e.target as HTMLInputElement).checked ? createPrincipalIndex.value : null;
                    }}
                    class="accent-brand-green w-3.5 h-3.5"
                  />
                  Usar otra imagen para desktop
                </label>
                {createDesktopIdx.value !== null && (
                  <div class="flex flex-wrap gap-1.5">
                    {createGaleria.value.map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick$={() => { createDesktopIdx.value = i; }}
                        class={[
                          "w-10 h-10 rounded-lg overflow-hidden border-2 transition-all",
                          i === createDesktopResolvedIdx ? "border-brand-green ring-2 ring-brand-green/25" : "border-slate-200 opacity-70 hover:opacity-100",
                        ]}
                      >
                        <img src={src} alt={`Opción ${i + 1}`} class="w-full h-full object-cover" width={40} height={40} />
                      </button>
                    ))}
                    {createGaleria.value.length < 10 && (
                      <label class="w-10 h-10 rounded-lg border-2 border-dashed border-slate-300 hover:border-brand-green flex items-center justify-center cursor-pointer text-slate-400 hover:text-brand-green">
                        <LuImage class="w-4 h-4" />
                        <input type="file" accept="image/*" onChange$={(e) => addPhotoForFormat(e, "desktop")} class="hidden" />
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Mobile */}
              <div class="space-y-2">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mobile (vertical)</span>
                <div class="relative w-36 aspect-[4/5] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                  {createMobilePhoto && <ImageFramePreview src={createMobilePhoto} targetRatio={4 / 5} />}
                </div>
                <label class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createMobileIdx.value !== null}
                    onChange$={(e) => {
                      createMobileIdx.value = (e.target as HTMLInputElement).checked ? createPrincipalIndex.value : null;
                    }}
                    class="accent-brand-green w-3.5 h-3.5"
                  />
                  Usar otra imagen para mobile
                </label>
                {createMobileIdx.value !== null && (
                  <div class="flex flex-wrap gap-1.5">
                    {createGaleria.value.map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick$={() => { createMobileIdx.value = i; }}
                        class={[
                          "w-10 h-10 rounded-lg overflow-hidden border-2 transition-all",
                          i === createMobileResolvedIdx ? "border-brand-green ring-2 ring-brand-green/25" : "border-slate-200 opacity-70 hover:opacity-100",
                        ]}
                      >
                        <img src={src} alt={`Opción ${i + 1}`} class="w-full h-full object-cover" width={40} height={40} />
                      </button>
                    ))}
                    {createGaleria.value.length < 10 && (
                      <label class="w-10 h-10 rounded-lg border-2 border-dashed border-slate-300 hover:border-brand-green flex items-center justify-center cursor-pointer text-slate-400 hover:text-brand-green">
                        <LuImage class="w-4 h-4" />
                        <input type="file" accept="image/*" onChange$={(e) => addPhotoForFormat(e, "mobile")} class="hidden" />
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Documentación adicional (PDF) — sección propia, separada de las imágenes */}
        <div class="border-t border-slate-100 pt-5 space-y-3">
          <h4 class="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
            <svg class="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9.5 6H10v1.5H8.5V9H7v5h1.5v-2H10v2h1.5V9H9.5zm5 2c0-.55-.45-1-1-1H12v5h1.5v-1.5h1c.55 0 1-.45 1-1V11zm-1.5 1.5V11h1v2h-1zm5-2.5h-2.5v5H17v-2h1.5v-1.5H17V11h2.5V9z"/>
            </svg>
            Documentación adicional
          </h4>
          <div class="space-y-2 max-w-md">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Catálogo / Lista de precios (PDF)</label>
            <input
              type="file"
              name="pdfFile"
              accept="application/pdf"
              class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all cursor-pointer font-medium"
            />
            <p class="text-[10px] text-slate-400 font-medium">Opcional. Subí la lista de precios, menú o bases y condiciones.</p>
          </div>
        </div>

        {/* Vigencia y condiciones (opcionales) */}
        <div class="border-t border-slate-100 pt-5 space-y-4">
          <div>
            <h4 class="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
              <svg class="w-4 h-4 text-brand-green fill-none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Vigencia y condiciones
            </h4>
            <p class="text-[10px] text-slate-400 font-medium mt-1">
              Ambos son <b>opcionales</b>. Si los dejás vacíos, no se muestran en la ficha ni en el PDF.
            </p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Vigencia (fecha de vencimiento)</label>
              <input
                type="date"
                name="validUntil"
                class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
              />
              <p class="text-[10px] text-slate-400 font-medium">Dejalo vacío si el beneficio no vence.</p>
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Condiciones</label>
              <textarea
                name="terms"
                rows={3}
                placeholder="Ej: Válido de lunes a viernes. No acumulable con otras promociones."
                class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all resize-y"
              />
            </div>
          </div>
        </div>

        {/* Live Preview Widget */}
        <div class="border-t border-slate-100 pt-6 space-y-4">
          <h4 class="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <LuSparkles class="w-4 h-4 text-brand-gold animate-bounce" />
            Previsualización en Tiempo Real
          </h4>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
            {/* Desktop Mockup Preview */}
            <div class="space-y-2.5">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vista de Escritorio (Desktop Card)</span>
              <div class="bg-white border border-slate-100 rounded-[2.2rem] overflow-hidden shadow-sm flex flex-col justify-between max-w-[340px] mx-auto lg:mx-0">
                <div class="relative h-44 bg-slate-100 overflow-hidden flex items-center justify-center">
                  {createDesktopPhoto ? (
                    <img src={createDesktopPhoto} alt="Preview desktop" class="w-full h-full object-cover" width={400} height={300} />
                  ) : (
                    <div class="flex flex-col items-center justify-center text-center p-4">
                      <LuImage class="w-8 h-8 text-slate-350 mb-1" />
                      <span class="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Sin imagen desktop</span>
                    </div>
                  )}

                  <div class="absolute top-3 right-3 z-10">
                    <span class="inline-flex items-center px-3 py-1 rounded-xl text-[12px] font-black bg-brand-gold text-slate-900 shadow-md uppercase tracking-wider">
                      {createPreviewResumen.value || "Exclusivo"}
                    </span>
                  </div>

                  <div class="absolute bottom-3 left-3 z-10">
                    <span class="inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-bold bg-black/55 backdrop-blur-sm uppercase tracking-wide text-white">
                      {createPreviewCategory.value || "Categoría"}
                    </span>
                  </div>
                </div>

                <div class="p-5 flex-grow flex flex-col justify-between">
                  <div class="space-y-1.5 text-left mb-4">
                    <div class="flex items-center text-brand-gold gap-1">
                      <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                      </svg>
                      <span class="text-[11px] font-black uppercase tracking-wider text-slate-450">
                        {createPreviewLocation.value || "La Plata"}
                      </span>
                    </div>

                    <h3 class="text-[16px] font-display font-black text-slate-900 leading-snug line-clamp-2">
                      {createPreviewTitulo.value || "Título del Beneficio"}
                    </h3>

                    <p class="text-[12px] text-slate-450 leading-relaxed line-clamp-2">
                      {createPreviewDescripcion.value.replace(/<[^>]+>/g, "").trim() || "Detalles del beneficio..."}
                    </p>
                  </div>

                  <div class="pt-3 border-t border-slate-100">
                    <div class="w-full text-center text-[10px] font-black uppercase tracking-wider py-2.5 rounded-xl bg-brand-green text-white">
                      Ver Beneficio
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Mockup Preview */}
            <div class="space-y-2.5">
              <span class="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Vista de Celular (Mobile responsive)</span>
              <div class="relative mx-auto lg:mx-0 w-[240px] h-[400px] bg-slate-900 rounded-[2.5rem] p-3 border-4 border-slate-800 shadow-lg flex flex-col overflow-hidden">
                {/* Simulated Notch */}
                <div class="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-800 rounded-full z-30 flex items-center justify-center">
                  <div class="w-2 h-2 bg-slate-900 rounded-full"></div>
                </div>

                {/* App Container */}
                <div class="w-full h-full bg-slate-50 rounded-[1.8rem] overflow-hidden flex flex-col justify-between relative border border-slate-100 z-10 text-left">
                  {/* Responsive image tag simulated */}
                  <div class="relative h-[180px] bg-slate-900 flex items-center justify-center overflow-hidden">
                    {createMobilePhoto ? (
                      <img src={createMobilePhoto} alt="Preview mobile" class="w-full h-full object-cover" width={300} height={400} />
                    ) : (
                      <div class="flex flex-col items-center justify-center text-center p-2">
                        <LuSmartphone class="w-8 h-8 text-slate-650 mb-1" />
                        <span class="text-slate-500 text-[8px] font-bold uppercase tracking-wider">Sin imagen móvil</span>
                      </div>
                    )}

                    <div class="absolute top-2 right-2 z-10">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black bg-brand-gold text-slate-900 shadow-sm uppercase tracking-wide">
                        {createPreviewResumen.value || "Exclusivo"}
                      </span>
                    </div>
                  </div>

                  <div class="p-3 flex-grow flex flex-col justify-between">
                    <div class="space-y-1 text-left">
                      <span class="text-[8px] font-bold text-slate-450 uppercase tracking-widest block">
                        {createPreviewCategory.value || "Categoría"} • {createPreviewLocation.value || "La Plata"}
                      </span>

                      <h3 class="text-[12px] font-display font-black text-slate-900 leading-tight line-clamp-2">
                        {createPreviewTitulo.value || "Título del Beneficio"}
                      </h3>

                      <p class="text-[9px] text-slate-450 leading-snug line-clamp-3">
                        {createPreviewDescripcion.value.replace(/<[^>]+>/g, "").trim() || "Breve descripción..."}
                      </p>
                    </div>

                    <div class="pt-2 border-t border-slate-100 mt-2">
                      <div class="w-full text-center text-[8px] font-black uppercase tracking-wider py-1.5 rounded-lg bg-brand-green text-white">
                        Obtener
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isFeatured"
              name="isFeatured"
              onChange$={(e, el) => { createPreviewIsFeatured.value = el.checked; }}
              class="rounded border-slate-300 text-brand-green focus:ring-brand-green h-4 w-4"
            />
            <label for="isFeatured" class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
              <LuSparkles class="w-4 h-4 text-brand-gold fill-brand-gold animate-pulse" />
              <span>Destacado de la Semana</span>
            </label>
          </div>

          <div class="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              defaultChecked={true}
              class="rounded border-slate-300 text-brand-green focus:ring-brand-green h-4 w-4"
            />
            <label for="isActive" class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
              <span class="w-2.5 h-2.5 rounded-full bg-brand-green"></span>
              <span>Publicar (Activo)</span>
            </label>
          </div>
        </div>

        {createBenefitAction.value?.failed && (
          <div class="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-xs font-bold text-red-700 shadow-sm space-y-1">
            <p>{createBenefitAction.value.message || "No se pudo crear el beneficio. Revisá los campos marcados."}</p>
            {createBenefitAction.value.fieldErrors && (
              <ul class="list-disc pl-4 font-semibold text-red-600">
                {Object.entries(createBenefitAction.value.fieldErrors)
                  .filter(([, msgs]) => Array.isArray(msgs) && msgs.length > 0)
                  .map(([field]) => (
                    <li key={field}>{FIELD_LABELS[field] || field}</li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {/* Barra de acciones sticky (siempre visible al pie del viewport) */}
        <div class="sticky bottom-0 z-30 -mx-6 sm:-mx-8 mt-2 px-5 sm:px-8 py-3.5 bg-white border-t border-slate-200 rounded-b-3xl flex items-center justify-between gap-3 shadow-[0_-8px_24px_rgba(15,23,42,0.10)]">
          <span class="text-[11px] sm:text-xs font-bold min-w-0 truncate">
            {createUploading.value > 0 ? (
              <span class="text-brand-green">↑ Subiendo imágenes…</span>
            ) : createDirty.value ? (
              <span class="text-amber-600">• Cambios sin guardar</span>
            ) : (
              <span class="text-slate-400">Sin cambios pendientes</span>
            )}
          </span>
          <div class="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/admin/benefits/"
              class="py-2.5 px-5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={createBenefitAction.isRunning || createUploading.value > 0}
              class="py-2.5 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95"
            >
              {createBenefitAction.isRunning ? "Creando..." : createUploading.value > 0 ? "Subiendo…" : "Crear Beneficio"}
            </button>
          </div>
        </div>
      </Form>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Crear Beneficio — Administración",
};
