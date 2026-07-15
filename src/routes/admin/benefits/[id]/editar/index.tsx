import { component$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, Link, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuImage, LuSmartphone, LuSparkles, LuChevronLeft } from "@qwikest/icons/lucide";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { getDB } from "~/db";
import { customBenefits as customBenefitsTable } from "~/db/schema";
import { getFilters } from "~/server/cache";
import { mergeContacts, splitContacts } from "~/utils/benefit-contacts";
import { LocationPicker } from "~/components/location-picker/location-picker";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

export const useAdminFiltersLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  return await getFilters();
});

export const useBenefitLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  const db = getDB(event);
  const [benefit] = await db.select().from(customBenefitsTable).where(eq(customBenefitsTable.id, event.params.id));
  if (!benefit) {
    throw event.redirect(302, "/admin/benefits/");
  }
  return benefit;
});

export const useEditBenefitAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);

      const [existing] = await db.select().from(customBenefitsTable).where(eq(customBenefitsTable.id, data.id));
      if (!existing) return requestEvent.fail(404, { message: "Beneficio no encontrado." });

      let finalPdfUrl = existing.pdfUrl;

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
            finalPdfUrl = blob.url;
            uploaded = true;
            console.log("[Vercel Blob] Uploaded PDF during edit to:", blob.url);
          } catch (blobErr: any) {
            console.error("[Vercel Blob] Upload failed during edit, falling back to disk:", blobErr.message);
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
          finalPdfUrl = `/uploads/${fileName}`;
        }
      } else if (data.clearPdf === "true") {
        finalPdfUrl = null;
      }

      let finalImageUrl = existing.imagen;

      if (data.clearImage === "true") {
        finalImageUrl = null;
      }

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
            finalImageUrl = blob.url;
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
          finalImageUrl = `/uploads/${fileName}`;
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
            finalImageUrl = blob.url;
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
          finalImageUrl = `/uploads/${fileName}`;
        }
      }

      let finalImageMobileUrl = existing.imagenMobile;

      if (data.clearMobileImage === "true") {
        finalImageMobileUrl = null;
      }

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
            finalImageMobileUrl = blob.url;
            imageMobileUploaded = true;
            console.log("[Vercel Blob] Uploaded optimized mobile image during edit to:", blob.url);
          } catch (blobErr: any) {
            console.error("[Vercel Blob] Mobile upload failed during edit, falling back to disk:", blobErr.message);
          }
        }

        if (!imageMobileUploaded) {
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, bytes);
          finalImageMobileUrl = `/uploads/${fileName}`;
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
            finalImageMobileUrl = blob.url;
            imageMobileUploaded = true;
            console.log("[Vercel Blob] Uploaded mobile image file during edit to:", blob.url);
          } catch (blobErr: any) {
            console.error("[Vercel Blob] Mobile upload failed during edit, falling back to disk:", blobErr.message);
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
          finalImageMobileUrl = `/uploads/${fileName}`;
        }
      }

      let lat = data.latitud?.trim() || null;
      let lng = data.longitud?.trim() || null;
      if (!lat || !lng) {
        lat = existing.latitud || (-34.9205 + (Math.random() - 0.5) * 0.04).toFixed(6);
        lng = existing.longitud || (-57.9536 + (Math.random() - 0.5) * 0.04).toFixed(6);
      }

      // Usar la misma imagen de desktop para móvil.
      if (data.sameImageForMobile === "true" && finalImageUrl) {
        finalImageMobileUrl = finalImageUrl;
      }

      // Galería: la lista enviada refleja el estado final deseado (URLs ya
      // subidas se conservan; data URLs nuevos se suben). Máx. 9 imágenes.
      let finalGaleria: string | null = existing.galeria;
      if (typeof data.galeriaJson === "string") {
        try {
          const items = JSON.parse(data.galeriaJson);
          if (Array.isArray(items)) {
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
            finalGaleria = urls.length > 0 ? JSON.stringify(urls) : null;
          }
        } catch (galErr) {
          console.error("Error procesando la galería:", galErr);
        }
      }

      await db
        .update(customBenefitsTable)
        .set({
          titulo: data.titulo,
          resumen: data.resumen,
          descripcion: mergeContacts(data.descripcion, data.whatsapp || "", data.instagram || "", data.direccion || ""),
          imagen: finalImageUrl,
          imagenMobile: finalImageMobileUrl,
          galeria: finalGaleria,
          isFeatured: data.isFeatured === "on",
          isPremiumOnly: false,
          categoryId: Number(data.categoryId),
          locationId: Number(data.locationId),
          offerId: Number(data.offerId),
          couponCode: data.couponCode || null,
          validUntil: data.isActive !== "on" ? `draft|${data.validUntil || ""}` : (data.validUntil || null),
          terms: data.terms || null,
          pdfUrl: finalPdfUrl,
          latitud: lat,
          longitud: lng,
        })
        .where(eq(customBenefitsTable.id, data.id));
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al modificar el beneficio." });
    }

    throw requestEvent.redirect(302, "/admin/benefits/?ok=edited");
  },
  zod$({
    id: z.string(),
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
    clearImage: z.string().optional(),
    imageMobileFile: z.any().optional(),
    optimizedMobileImage: z.string().optional(),
    clearMobileImage: z.string().optional(),
    sameImageForMobile: z.string().optional(),
    galeriaJson: z.string().optional(),
    clearPdf: z.string().optional(),
    latitud: z.string().optional(),
    longitud: z.string().optional(),
  })
);

export default component$(() => {
  const adminFilters = useAdminFiltersLoader();
  const benefit = useBenefitLoader();
  const editBenefitAction = useEditBenefitAction();

  // Contactos separados de la descripción HTML
  const split = splitContacts(benefit.value.descripcion || "");

  // Image Upload signals
  const editImagePreviewUrl = useSignal<string | null>(benefit.value.imagen || null);
  const editOptimizedImageBase64 = useSignal<string>("");
  const editIsImageDeleted = useSignal<boolean>(false);
  const editImageMobilePreviewUrl = useSignal<string | null>(benefit.value.imagenMobile || null);
  const editOptimizedMobileImageBase64 = useSignal<string>("");
  const editIsMobileImageDeleted = useSignal<boolean>(false);
  const editIsPdfDeleted = useSignal<boolean>(false);

  // Galería de imágenes adicionales (mezcla de URLs existentes y data URLs nuevos)
  const editGaleria = useSignal<string[]>(
    (() => {
      try {
        const parsed = JSON.parse(benefit.value.galeria || "[]");
        return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
      } catch {
        return [];
      }
    })()
  );

  // Ubicación (mapa) y contactos
  const editLat = useSignal<string>(benefit.value.latitud || "");
  const editLng = useSignal<string>(benefit.value.longitud || "");
  const editWhatsapp = useSignal<string>(split.whatsapp);
  const editInstagram = useSignal<string>(split.instagram);
  const editDireccion = useSignal<string>(split.direccion);

  // "Usar la misma imagen de desktop para móvil"
  const editSameImage = useSignal<boolean>(false);

  // Live preview signals
  const editPreviewTitulo = useSignal(benefit.value.titulo);
  const editPreviewResumen = useSignal(benefit.value.resumen || "");
  const editPreviewDescripcion = useSignal(split.body);
  const editPreviewIsFeatured = useSignal(benefit.value.isFeatured);
  const editPreviewCategory = useSignal(
    adminFilters.value.categorias.find((c) => c.id === benefit.value.categoryId)?.descripcion || "Categoría"
  );
  const editPreviewLocation = useSignal(
    adminFilters.value.ubicaciones.find((l) => l.id === benefit.value.locationId)?.descripcion || "La Plata"
  );

  // Change handler with client-side canvas optimization (Desktop)
  const handleEditImageChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const file = element.files[0];
    editIsImageDeleted.value = false;

    if (file.type === "image/svg+xml") {
      editOptimizedImageBase64.value = "";
      editImagePreviewUrl.value = URL.createObjectURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 800;
        const maxH = 450;
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
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/webp", 0.85);
          editOptimizedImageBase64.value = dataUrl;
          editImagePreviewUrl.value = dataUrl;
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

  // Change handler with client-side canvas optimization (Mobile)
  const handleEditMobileImageChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    editSameImage.value = false;
    const file = element.files[0];
    editIsMobileImageDeleted.value = false;

    if (file.type === "image/svg+xml") {
      editOptimizedMobileImageBase64.value = "";
      editImageMobilePreviewUrl.value = URL.createObjectURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 600;
        const maxH = 600;
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
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/webp", 0.85);
          editOptimizedMobileImageBase64.value = dataUrl;
          editImageMobilePreviewUrl.value = dataUrl;
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

  // Galería: optimiza y agrega múltiples imágenes (máx. 9)
  const handleEditGalleryChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const files = Array.from(element.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
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
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/webp", 0.82);
            if (editGaleria.value.length < 9) {
              editGaleria.value = [...editGaleria.value, dataUrl];
            }
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
    element.value = "";
  });

  const removeEditGalleryImage = $((index: number) => {
    editGaleria.value = editGaleria.value.filter((_, i) => i !== index);
  });

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
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
            Editar Beneficio
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Modificá los datos del beneficio "{benefit.value.titulo}".
          </p>
        </div>
      </div>

      <Form key={benefit.value.id} action={editBenefitAction} enctype="multipart/form-data" class="relative bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5 w-full max-w-3xl mx-auto">
        <input type="hidden" name="id" value={benefit.value.id} />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Título</label>
            <input
              type="text"
              name="titulo"
              required
              value={benefit.value.titulo}
              placeholder="Ej: Spa Platense Masajes"
              onInput$={(e) => { editPreviewTitulo.value = (e.target as HTMLInputElement).value; }}
              class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Resumen (badge descuento)</label>
            <input
              type="text"
              name="resumen"
              required
              value={benefit.value.resumen}
              placeholder="Ej: 20% de descuento"
              onInput$={(e) => { editPreviewResumen.value = (e.target as HTMLInputElement).value; }}
              class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
            />
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Descripción Detallada</label>
          <textarea
            name="descripcion"
            required
            rows={3}
            value={split.body}
            placeholder="Escribí los detalles completos del descuento, dirección y condiciones..."
            onInput$={(e) => { editPreviewDescripcion.value = (e.target as HTMLTextAreaElement).value; }}
            class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
          />
        </div>

        {/* Contacto del local (se muestra en la ficha pública) */}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">WhatsApp / Teléfono</label>
            <input
              type="text"
              name="whatsapp"
              value={editWhatsapp.value}
              placeholder="Ej: 549 221 555 1234"
              class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
            />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Instagram (usuario o link)</label>
            <input
              type="text"
              name="instagram"
              value={editInstagram.value}
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
              onChange$={(e, el) => { editPreviewCategory.value = el.options[el.selectedIndex].text; }}
              class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all cursor-pointer"
            >
              {adminFilters.value.categorias.map((cat) => (
                <option key={cat.id} value={cat.id} selected={cat.id === benefit.value.categoryId}>
                  {cat.descripcion}
                </option>
              ))}
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Ubicación</label>
            <select
              name="locationId"
              onChange$={(e, el) => { editPreviewLocation.value = el.options[el.selectedIndex].text; }}
              class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all cursor-pointer"
            >
              {adminFilters.value.ubicaciones.map((loc) => (
                <option key={loc.id} value={loc.id} selected={loc.id === benefit.value.locationId}>
                  {loc.descripcion}
                </option>
              ))}
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Oferta / Descuento</label>
            <select
              name="offerId"
              class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all cursor-pointer"
            >
              {adminFilters.value.ofertas.map((off) => (
                <option key={off.id} value={off.id} selected={off.id === benefit.value.offerId}>
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
          <input type="hidden" name="latitud" value={editLat.value} />
          <input type="hidden" name="longitud" value={editLng.value} />
          <input type="hidden" name="direccion" value={editDireccion.value} />
          <LocationPicker
            key={benefit.value.id}
            lat={editLat}
            lng={editLng}
            address={editDireccion}
            mapId="edit-benefit-map"
          />
        </div>

        {/* Imagen Destacada y Documentación PDF */}
        <div class="border-t border-slate-100 pt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Imagen Ilustrativa Desktop */}
          <div class="space-y-4">
            <h4 class="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
              <LuImage class="w-4 h-4 text-brand-green" />
              Imagen Desktop (16:9)
            </h4>
            <input type="hidden" name="optimizedImage" value={editOptimizedImageBase64.value} />
            <input type="hidden" name="clearImage" value={editIsImageDeleted.value ? "true" : "false"} />
            <div class="space-y-2">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Subir Nueva Imagen</label>
              <div class="flex items-center gap-4">
                <div class="w-20 h-20 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                  {editImagePreviewUrl.value && !editIsImageDeleted.value ? (
                    <img
                      src={
                        editImagePreviewUrl.value.startsWith("data:") ||
                        editImagePreviewUrl.value.startsWith("blob:") ||
                        editImagePreviewUrl.value.startsWith("http") ||
                        editImagePreviewUrl.value.startsWith("/")
                          ? editImagePreviewUrl.value
                          : `https://beneficios.amepla.org.ar/files/${editImagePreviewUrl.value}`
                      }
                      alt="Vista previa"
                      class="w-full h-full object-cover"
                      width={80}
                      height={80}
                    />
                  ) : (
                    <LuImage class="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div class="flex flex-col gap-2">
                  <label class="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-extrabold rounded-2xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                    <LuImage class="w-4 h-4 text-brand-green" />
                    Seleccionar
                    <input
                      id="edit-image-file-input"
                      type="file"
                      name="imageFile"
                      accept="image/*"
                      onChange$={handleEditImageChange}
                      class="hidden"
                    />
                  </label>
                  {editImagePreviewUrl.value && !editIsImageDeleted.value && (
                    <button
                      type="button"
                      onClick$={() => {
                        editIsImageDeleted.value = true;
                        editOptimizedImageBase64.value = "";
                        const input = document.getElementById("edit-image-file-input") as HTMLInputElement;
                        if (input) input.value = "";
                      }}
                      class="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-650 text-[10px] font-extrabold rounded-xl transition-all inline-flex items-center justify-center shadow-sm"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
              <p class="text-[10px] text-slate-400 font-medium">Recomendado horizontal (800x450 px).</p>
            </div>
          </div>

          {/* Imagen Ilustrativa Mobile */}
          <div class="space-y-4">
            <h4 class="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
              <LuSmartphone class="w-4 h-4 text-brand-green" />
              Imagen Mobile (Vertical)
            </h4>
            <input type="hidden" name="optimizedMobileImage" value={editOptimizedMobileImageBase64.value} />
            <input type="hidden" name="clearMobileImage" value={editIsMobileImageDeleted.value ? "true" : "false"} />
            <input type="hidden" name="sameImageForMobile" value={editSameImage.value ? "true" : "false"} />
            <div class="space-y-2">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Subir Imagen Mobile</label>
              <div class="flex items-center gap-4">
                <div class="w-20 h-20 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                  {editImageMobilePreviewUrl.value && !editIsMobileImageDeleted.value ? (
                    <img
                      src={
                        editImageMobilePreviewUrl.value.startsWith("data:") ||
                        editImageMobilePreviewUrl.value.startsWith("blob:") ||
                        editImageMobilePreviewUrl.value.startsWith("http") ||
                        editImageMobilePreviewUrl.value.startsWith("/")
                          ? editImageMobilePreviewUrl.value
                          : `https://beneficios.amepla.org.ar/files/${editImageMobilePreviewUrl.value}`
                      }
                      alt="Vista previa móvil"
                      class="w-full h-full object-cover"
                      width={80}
                      height={80}
                    />
                  ) : (
                    <LuSmartphone class="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div class="flex flex-col gap-2">
                  <label class="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-extrabold rounded-2xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                    <LuSmartphone class="w-4 h-4 text-brand-green" />
                    Seleccionar
                    <input
                      id="edit-image-mobile-file-input"
                      type="file"
                      name="imageMobileFile"
                      accept="image/*"
                      onChange$={handleEditMobileImageChange}
                      class="hidden"
                    />
                  </label>
                  {editImageMobilePreviewUrl.value && !editIsMobileImageDeleted.value && (
                    <button
                      type="button"
                      onClick$={() => {
                        editIsMobileImageDeleted.value = true;
                        editOptimizedMobileImageBase64.value = "";
                        const input = document.getElementById("edit-image-mobile-file-input") as HTMLInputElement;
                        if (input) input.value = "";
                      }}
                      class="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-650 text-[10px] font-extrabold rounded-xl transition-all inline-flex items-center justify-center shadow-sm"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
              <p class="text-[10px] text-slate-400 font-medium">Recomendado vertical/cuadrada (600x600 px).</p>
            </div>
            <button
              type="button"
              onClick$={() => {
                editSameImage.value = !editSameImage.value;
                if (editSameImage.value) {
                  editImageMobilePreviewUrl.value = editOptimizedImageBase64.value || editImagePreviewUrl.value;
                  editIsMobileImageDeleted.value = false;
                }
              }}
              class={[
                "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all border",
                editSameImage.value
                  ? "bg-brand-green/10 text-brand-green border-brand-green/30"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
              ]}
            >
              {editSameImage.value ? "✓ Usando la misma de desktop" : "Usar la misma imagen que desktop"}
            </button>
          </div>

          {/* Documentación PDF Widget */}
          <div class="space-y-4">
            <h4 class="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
              <svg class="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9.5 6H10v1.5H8.5V9H7v5h1.5v-2H10v2h1.5V9H9.5zm5 2c0-.55-.45-1-1-1H12v5h1.5v-1.5h1c.55 0 1-.45 1-1V11zm-1.5 1.5V11h1v2h-1zm5-2.5h-2.5v5H17v-2h1.5v-1.5H17V11h2.5V9z"/>
              </svg>
              Documentación / Catálogo (PDF)
            </h4>
            <input type="hidden" name="clearPdf" value={editIsPdfDeleted.value ? "true" : "false"} />
            <div class="space-y-2">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Subir Nuevo PDF</label>
              <div class="flex flex-col gap-2">
                <input
                  id="edit-pdf-file-input"
                  type="file"
                  name="pdfFile"
                  accept="application/pdf"
                  onChange$={() => {
                    editIsPdfDeleted.value = false;
                  }}
                  class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all cursor-pointer font-medium"
                />

                {benefit.value.pdfUrl && !editIsPdfDeleted.value && (
                  <div class="flex items-center justify-between bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                    <span class="text-xs font-semibold text-slate-650 truncate max-w-[200px]" title={benefit.value.pdfUrl.split('/').pop()}>
                      📄 {benefit.value.pdfUrl.split('/').pop()}
                    </span>
                    <button
                      type="button"
                      onClick$={() => {
                        editIsPdfDeleted.value = true;
                        const input = document.getElementById("edit-pdf-file-input") as HTMLInputElement;
                        if (input) input.value = "";
                      }}
                      class="text-[10px] text-red-650 hover:underline font-bold"
                    >
                      Eliminar PDF
                    </button>
                  </div>
                )}
              </div>
              <p class="text-[10px] text-slate-400 font-medium">Subí la lista de precios o menú.</p>
            </div>
          </div>
        </div>

        {/* Galería de imágenes adicionales */}
        <div class="border-t border-slate-100 pt-5 space-y-3">
          <h4 class="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
            <LuImage class="w-4 h-4 text-brand-green" />
            Galería de Fotos (opcional)
          </h4>
          <input type="hidden" name="galeriaJson" value={JSON.stringify(editGaleria.value)} />
          <p class="text-[10px] text-slate-400 font-medium">
            Sumá hasta 9 fotos adicionales que se mostrarán en un carrusel en la página del beneficio.
          </p>
          <div class="flex flex-wrap gap-3">
            {editGaleria.value.map((src, i) => (
              <div key={i} class="relative w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                <img src={src} alt={`Foto ${i + 1}`} class="w-full h-full object-cover" width={96} height={96} />
                <button
                  type="button"
                  onClick$={() => removeEditGalleryImage(i)}
                  class="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-black shadow hover:bg-red-700 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
            {editGaleria.value.length < 9 && (
              <label class="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 hover:border-brand-green hover:bg-slate-50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all text-slate-400 hover:text-brand-green">
                <LuImage class="w-6 h-6" />
                <span class="text-[9px] font-bold uppercase tracking-wider">Agregar</span>
                <input type="file" accept="image/*" multiple onChange$={handleEditGalleryChange} class="hidden" />
              </label>
            )}
          </div>
          <span class="text-[10px] text-slate-400 font-bold">{editGaleria.value.length} / 9 fotos</span>
        </div>

        {/* Live Preview Widget */}
        <div class="border-t border-slate-100 pt-6 space-y-4">
          <h4 class="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <LuSparkles class="w-4 h-4 text-brand-gold animate-bounce" />
            Previsualización en Tiempo Real (Cambios)
          </h4>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
            {/* Desktop Mockup Preview */}
            <div class="space-y-2.5">
              <span class="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Vista de Escritorio (Desktop Card)</span>
              <div class="bg-white border border-slate-100 rounded-[2.2rem] overflow-hidden shadow-sm flex flex-col justify-between max-w-[340px] mx-auto lg:mx-0">
                <div class="relative h-44 bg-slate-100 overflow-hidden flex items-center justify-center">
                  {editImagePreviewUrl.value && !editIsImageDeleted.value ? (
                    <img
                      src={
                        editImagePreviewUrl.value.startsWith("data:") ||
                        editImagePreviewUrl.value.startsWith("blob:") ||
                        editImagePreviewUrl.value.startsWith("http") ||
                        editImagePreviewUrl.value.startsWith("/")
                          ? editImagePreviewUrl.value
                          : `https://beneficios.amepla.org.ar/files/${editImagePreviewUrl.value}`
                      }
                      alt="Preview desktop"
                      class="w-full h-full object-cover"
                      width={400}
                      height={300}
                    />
                  ) : (
                    <div class="flex flex-col items-center justify-center text-center p-4">
                      <LuImage class="w-8 h-8 text-slate-350 mb-1" />
                      <span class="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Sin imagen desktop</span>
                    </div>
                  )}

                  <div class="absolute top-3 right-3 z-10">
                    <span class="inline-flex items-center px-3 py-1 rounded-xl text-[12px] font-black bg-brand-gold text-slate-900 shadow-md uppercase tracking-wider">
                      {editPreviewResumen.value || "Exclusivo"}
                    </span>
                  </div>

                  <div class="absolute bottom-3 left-3 z-10">
                    <span class="inline-flex items-center px-3 py-0.5 rounded-full text-[10px] font-bold bg-black/55 backdrop-blur-sm uppercase tracking-wide text-white">
                      {editPreviewCategory.value || "Categoría"}
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
                        {editPreviewLocation.value || "La Plata"}
                      </span>
                    </div>

                    <h3 class="text-[16px] font-display font-black text-slate-900 leading-snug line-clamp-2">
                      {editPreviewTitulo.value || "Título del Beneficio"}
                    </h3>

                    <p class="text-[12px] text-slate-450 leading-relaxed line-clamp-2">
                      {editPreviewDescripcion.value.replace(/<[^>]+>/g, "").trim() || "Detalles del beneficio..."}
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
                    {editImageMobilePreviewUrl.value && !editIsMobileImageDeleted.value ? (
                      <img
                        src={
                          editImageMobilePreviewUrl.value.startsWith("data:") ||
                          editImageMobilePreviewUrl.value.startsWith("blob:") ||
                          editImageMobilePreviewUrl.value.startsWith("http") ||
                          editImageMobilePreviewUrl.value.startsWith("/")
                            ? editImageMobilePreviewUrl.value
                            : `https://beneficios.amepla.org.ar/files/${editImageMobilePreviewUrl.value}`
                        }
                        alt="Preview mobile"
                        class="w-full h-full object-cover"
                        width={300}
                        height={400}
                      />
                    ) : editImagePreviewUrl.value && !editIsImageDeleted.value ? (
                      <img
                        src={
                          editImagePreviewUrl.value.startsWith("data:") ||
                          editImagePreviewUrl.value.startsWith("blob:") ||
                          editImagePreviewUrl.value.startsWith("http") ||
                          editImagePreviewUrl.value.startsWith("/")
                            ? editImagePreviewUrl.value
                            : `https://beneficios.amepla.org.ar/files/${editImagePreviewUrl.value}`
                        }
                        alt="Preview desktop as fallback"
                        class="w-full h-full object-cover"
                        width={300}
                        height={400}
                      />
                    ) : (
                      <div class="flex flex-col items-center justify-center text-center p-2">
                        <LuSmartphone class="w-8 h-8 text-slate-650 mb-1" />
                        <span class="text-slate-500 text-[8px] font-bold uppercase tracking-wider">Sin imagen móvil</span>
                      </div>
                    )}

                    <div class="absolute top-2 right-2 z-10">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black bg-brand-gold text-slate-900 shadow-sm uppercase tracking-wide">
                        {editPreviewResumen.value || "Exclusivo"}
                      </span>
                    </div>
                  </div>

                  <div class="p-3 flex-grow flex flex-col justify-between">
                    <div class="space-y-1 text-left">
                      <span class="text-[8px] font-bold text-slate-450 uppercase tracking-widest block">
                        {editPreviewCategory.value || "Categoría"} • {editPreviewLocation.value || "La Plata"}
                      </span>

                      <h3 class="text-[12px] font-display font-black text-slate-900 leading-tight line-clamp-2">
                        {editPreviewTitulo.value || "Título del Beneficio"}
                      </h3>

                      <p class="text-[9px] text-slate-450 leading-snug line-clamp-3">
                        {editPreviewDescripcion.value.replace(/<[^>]+>/g, "").trim() || "Breve descripción..."}
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
              id="edit_isFeatured"
              name="isFeatured"
              checked={editPreviewIsFeatured.value}
              onChange$={(e, el) => { editPreviewIsFeatured.value = el.checked; }}
              class="rounded border-slate-300 text-brand-green focus:ring-brand-green h-4 w-4"
            />
            <label for="edit_isFeatured" class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
              <LuSparkles class="w-4 h-4 text-brand-gold fill-brand-gold animate-pulse" />
              <span>Destacado de la Semana</span>
            </label>
          </div>

          <div class="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="edit_isActive"
              name="isActive"
              defaultChecked={!(benefit.value.validUntil?.startsWith("draft|") || benefit.value.validUntil === "draft")}
              class="rounded border-slate-300 text-brand-green focus:ring-brand-green h-4 w-4"
            />
            <label for="edit_isActive" class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
              <span class="w-2.5 h-2.5 rounded-full bg-brand-green"></span>
              <span>Publicar (Activo)</span>
            </label>
          </div>
        </div>

        {editBenefitAction.value?.failed && (
          <div class="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-xs font-bold text-red-700 shadow-sm">
            {editBenefitAction.value.message || "Error al modificar el beneficio."}
          </div>
        )}

        {/* Acciones al final del formulario */}
        <div class="flex items-center gap-2 pt-5 mt-2 border-t border-slate-100">
          <button
            type="submit"
            disabled={editBenefitAction.isRunning}
            class="py-3 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
          >
            {editBenefitAction.isRunning ? "Guardando..." : "Guardar Cambios"}
          </button>
          <Link
            href="/admin/benefits/"
            class="py-3 px-6 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold shadow-sm transition-all duration-300 cursor-pointer"
          >
            Cancelar
          </Link>
        </div>
      </Form>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Editar Beneficio — Administración",
};
