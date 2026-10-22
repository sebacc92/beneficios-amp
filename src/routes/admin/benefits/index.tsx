import { component$, useSignal, useStore, useComputed$, useTask$, $, type QRL } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuPlus, LuTicket, LuTrash2, LuPencil, LuSparkles, LuChevronLeft, LuChevronRight, LuSearch, LuImage, LuSmartphone } from "@qwikest/icons/lucide";
import { eq } from "drizzle-orm";
import { putImage, putMedia } from "~/server/media";
import { getDB } from "~/db";
import { benefits as benefitsTable } from "~/db/schema";
import { getFilters, getCustomBenefitRows } from "~/server/cache";
import { createBenefitFilter, validateBenefitFilterSelection, BenefitFilterValidationError, type BenefitFilterType } from "~/server/benefit-filters";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

const filterEditorLabels = {
  categorias: { title: "Nueva categoría", placeholder: "Ej: Veterinarias" },
  ubicaciones: { title: "Nueva ubicación", placeholder: "Ej: City Bell" },
  ofertas: { title: "Nuevo descuento", placeholder: "Ej: 25% o 2x1" },
};

const FilterFieldLabel = component$<{ id: string; label: string; onAdd$: QRL<() => void> }>((props) => (
  <div class="flex items-center justify-between gap-2">
    <label for={props.id} class="text-xs font-bold text-slate-500 uppercase tracking-wider block">{props.label}</label>
    <button type="button" onClick$={props.onAdd$} aria-label={`Agregar ${props.label.toLowerCase()}`} class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand-green hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-brand-green cursor-pointer">
      <LuPlus class="h-3.5 w-3.5" /> Agregar
    </button>
  </div>
));

// --- SECURITY & LOADERS ---

export const useAdminCustomBenefitsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const rows = await getCustomBenefitRows(event);
    return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    console.error("Failed to load custom benefits:", err);
    return [];
  }
});

export const useAdminFiltersLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  return await getFilters(event);
});

// --- ACTIONS ---

export const useCreateBenefitFilterAction = routeAction$(
  async (data, event) => {
    const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return event.fail(403, { message: "No autorizado." });

    try {
      const option = await createBenefitFilter(event, data.type, data.descripcion);
      return { success: true, option };
    } catch (error) {
      if (error instanceof BenefitFilterValidationError) {
        return event.fail(400, { message: error.message });
      }
      console.error("Failed to create benefit filter:", error);
      return event.fail(500, { message: "No se pudo guardar la opción. Intentá de nuevo." });
    }
  },
  zod$({
    type: z.enum(["categorias", "ubicaciones", "ofertas"]),
    descripcion: z.string().trim().min(1, "Ingresá un nombre.").max(100, "Usá hasta 100 caracteres."),
  })
);

export const useCreateBenefitAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      await validateBenefitFilterSelection(requestEvent, data);
      const db = getDB(requestEvent);
      const uuid = "cb-" + Date.now().toString();
      const slug = uuid + "-" + data.titulo.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");

      let uploadedPdfUrl = null;
      if (data.pdfFile && typeof data.pdfFile === "object" && (data.pdfFile as Blob).size > 0) {
        const file = data.pdfFile as File;
        const extension = file.name.split(".").pop() || "pdf";
        uploadedPdfUrl = await putMedia(requestEvent, `benefit-pdf-${Date.now()}.${extension}`, file);
      }

      const uploadedImageUrl = await putImage(requestEvent, "benefit", data.optimizedImage, data.imageFile);
      const uploadedImageMobileUrl = await putImage(requestEvent, "benefit-mobile", data.optimizedMobileImage, data.imageMobileFile);

      let lat = data.latitud?.trim() || null;
      let lng = data.longitud?.trim() || null;
      if (!lat || !lng) {
        const randomOffsetLat = (Math.random() - 0.5) * 0.04;
        const randomOffsetLng = (Math.random() - 0.5) * 0.04;
        lat = (-34.9205 + randomOffsetLat).toFixed(6);
        lng = (-57.9536 + randomOffsetLng).toFixed(6);
      }

      await db.insert(benefitsTable).values({
        id: uuid,
        titulo: data.titulo,
        resumen: data.resumen,
        descripcion: data.descripcion,
        imagen: uploadedImageUrl,
        imagenMobile: uploadedImageMobileUrl,
        slug,
        isFeatured: data.isFeatured === "on",
        isPremiumOnly: false,
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

      return { success: true };
    } catch (err: any) {
      if (err instanceof BenefitFilterValidationError) return requestEvent.fail(400, { message: err.message });
      console.error(err);
      return requestEvent.fail(500, { message: "Error al crear el beneficio." });
    }
  },
  zod$({
    titulo: z.string().trim().min(3, "El título debe tener al menos 3 caracteres."),
    resumen: z.string().trim().min(5, "El resumen debe tener al menos 5 caracteres."),
    descripcion: z.string().trim().min(5, "La descripción debe tener al menos 5 caracteres."),
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
    imageMobileFile: z.any().optional(),
    optimizedMobileImage: z.string().optional(),
    latitud: z.string().optional(),
    longitud: z.string().optional(),
  })
);

export const useEditBenefitAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      await validateBenefitFilterSelection(requestEvent, data);
      const db = getDB(requestEvent);
      
      const [existing] = await db.select().from(benefitsTable).where(eq(benefitsTable.id, data.id));
      if (!existing) return requestEvent.fail(404, { message: "Beneficio no encontrado." });

      let finalPdfUrl = existing.pdfUrl;
      if (data.pdfFile && typeof data.pdfFile === "object" && (data.pdfFile as Blob).size > 0) {
        const file = data.pdfFile as File;
        const extension = file.name.split(".").pop() || "pdf";
        finalPdfUrl = await putMedia(requestEvent, `benefit-pdf-${Date.now()}.${extension}`, file);
      } else if (data.clearPdf === "true") {
        finalPdfUrl = null;
      }

      const uploadedImageUrl = await putImage(requestEvent, "benefit", data.optimizedImage, data.imageFile);
      const finalImageUrl = uploadedImageUrl ?? (data.clearImage === "true" ? null : existing.imagen);
      const uploadedImageMobileUrl = await putImage(requestEvent, "benefit-mobile", data.optimizedMobileImage, data.imageMobileFile);
      const finalImageMobileUrl = uploadedImageMobileUrl ?? (data.clearMobileImage === "true" ? null : existing.imagenMobile);

      let lat = data.latitud?.trim() || null;
      let lng = data.longitud?.trim() || null;
      if (!lat || !lng) {
        lat = existing.latitud || (-34.9205 + (Math.random() - 0.5) * 0.04).toFixed(6);
        lng = existing.longitud || (-57.9536 + (Math.random() - 0.5) * 0.04).toFixed(6);
      }

      await db
        .update(benefitsTable)
        .set({
          titulo: data.titulo,
          resumen: data.resumen,
          descripcion: data.descripcion,
          imagen: finalImageUrl,
          imagenMobile: finalImageMobileUrl,
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
        .where(eq(benefitsTable.id, data.id));

      return { success: true };
    } catch (err: any) {
      if (err instanceof BenefitFilterValidationError) return requestEvent.fail(400, { message: err.message });
      console.error(err);
      return requestEvent.fail(500, { message: "Error al modificar el beneficio." });
    }
  },
  zod$({
    id: z.string(),
    titulo: z.string().trim().min(3, "El título debe tener al menos 3 caracteres."),
    resumen: z.string().trim().min(5, "El resumen debe tener al menos 5 caracteres."),
    descripcion: z.string().trim().min(5, "La descripción debe tener al menos 5 caracteres."),
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
    clearPdf: z.string().optional(),
    latitud: z.string().optional(),
    longitud: z.string().optional(),
  })
);

export const useToggleBenefitActiveAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const [existing] = await db.select().from(benefitsTable).where(eq(benefitsTable.id, data.id));
      if (!existing) return requestEvent.fail(404, { message: "Beneficio no encontrado." });

      const rawValidUntil = existing.validUntil;
      const isDraft = rawValidUntil?.startsWith("draft|") || rawValidUntil === "draft";
      let newValidUntil: string | null = null;
      if (isDraft) {
        newValidUntil = rawValidUntil === "draft" ? null : rawValidUntil!.substring(6);
      } else {
        newValidUntil = `draft|${rawValidUntil || ""}`;
      }

      await db.update(benefitsTable)
        .set({ validUntil: newValidUntil })
        .where(eq(benefitsTable.id, data.id));

      return { success: true };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al cambiar el estado." });
    }
  },
  zod$({
    id: z.string(),
  })
);

export const useDeleteBenefitAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      await db.delete(benefitsTable).where(eq(benefitsTable.id, data.id));
      return { success: true };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al eliminar el beneficio." });
    }
  },
  zod$({
    id: z.string(),
  })
);

export default component$(() => {
  const benefits = useAdminCustomBenefitsLoader();
  const adminFilters = useAdminFiltersLoader();
  const createBenefitAction = useCreateBenefitAction();
  const editBenefitAction = useEditBenefitAction();
  const deleteBenefitAction = useDeleteBenefitAction();
  const toggleBenefitActiveAction = useToggleBenefitActiveAction();
  const createBenefitFilterAction = useCreateBenefitFilterAction();

  const isCreateBenefitOpen = useSignal(false);
  const editingBenefit = useSignal<any | null>(null);
  const filterDialog = useSignal<HTMLDialogElement>();
  const filterTarget = useSignal<{ type: BenefitFilterType; context: "create" | "edit" } | null>(null);
  const filterDescription = useSignal("");
  const filterError = useSignal("");
  const filterNotice = useSignal("");
  const createFilterSelection = useStore({ categorias: "", ubicaciones: "", ofertas: "" });
  const editFilterSelection = useStore({ categorias: "", ubicaciones: "", ofertas: "" });

  const openFilterEditor$ = $((type: BenefitFilterType, context: "create" | "edit") => {
    filterTarget.value = { type, context };
    filterDescription.value = "";
    filterError.value = "";
    filterNotice.value = "";
    filterDialog.value?.showModal();
  });

  // Image Upload signals
  const createImagePreviewUrl = useSignal<string | null>(null);
  const createOptimizedImageBase64 = useSignal<string>("");
  const createImageMobilePreviewUrl = useSignal<string | null>(null);
  const createOptimizedMobileImageBase64 = useSignal<string>("");

  const editImagePreviewUrl = useSignal<string | null>(null);
  const editOptimizedImageBase64 = useSignal<string>("");
  const editIsImageDeleted = useSignal<boolean>(false);
  const editImageMobilePreviewUrl = useSignal<string | null>(null);
  const editOptimizedMobileImageBase64 = useSignal<string>("");
  const editIsMobileImageDeleted = useSignal<boolean>(false);
  const editIsPdfDeleted = useSignal<boolean>(false);

  // Pagination & Search state
  const currentPage = useSignal(1);
  const searchQuery = useSignal("");
  const goldFilterActive = useSignal(false);
  const statusFilter = useSignal<"all" | "active" | "inactive">("all");

  // Live preview signals for Create
  const createPreviewTitulo = useSignal("Nombre del Comercio");
  const createPreviewResumen = useSignal("20% de descuento");
  const createPreviewDescripcion = useSignal("Breve descripción de las condiciones del beneficio...");
  const createPreviewIsFeatured = useSignal(false);
  const createPreviewCategory = useSignal("");
  const createPreviewLocation = useSignal("");

  // Live preview signals for Edit
  const editPreviewTitulo = useSignal("");
  const editPreviewResumen = useSignal("");
  const editPreviewDescripcion = useSignal("");
  const editPreviewIsFeatured = useSignal(false);
  const editPreviewCategory = useSignal("");
  const editPreviewLocation = useSignal("");

  useTask$(({ track }) => {
    track(() => adminFilters.value);
    if (adminFilters.value) {
      if (!createPreviewCategory.value) createPreviewCategory.value = adminFilters.value.categorias[0]?.descripcion || "Categoría";
      if (!createPreviewLocation.value) createPreviewLocation.value = adminFilters.value.ubicaciones[0]?.descripcion || "La Plata";
    }
  });

  // Change handler with client-side canvas optimization (Create)
  const handleCreateImageChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const file = element.files[0];

    if (file.type === "image/svg+xml") {
      createOptimizedImageBase64.value = "";
      createImagePreviewUrl.value = URL.createObjectURL(file);
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
          createOptimizedImageBase64.value = dataUrl;
          createImagePreviewUrl.value = dataUrl;
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

  // Change handler with client-side canvas optimization (Create Mobile)
  const handleCreateMobileImageChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
    const file = element.files[0];

    if (file.type === "image/svg+xml") {
      createOptimizedMobileImageBase64.value = "";
      createImageMobilePreviewUrl.value = URL.createObjectURL(file);
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
          createOptimizedMobileImageBase64.value = dataUrl;
          createImageMobilePreviewUrl.value = dataUrl;
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

  // Change handler with client-side canvas optimization (Edit)
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

  // Change handler with client-side canvas optimization (Edit Mobile)
  const handleEditMobileImageChange = $((event: Event) => {
    const element = event.target as HTMLInputElement;
    if (!element.files || element.files.length === 0) return;
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

  useTask$(({ track }) => {
    track(() => editBenefitAction.value);
    if (editBenefitAction.value?.success) {
      editingBenefit.value = null;
      editImagePreviewUrl.value = null;
      editOptimizedImageBase64.value = "";
      editIsImageDeleted.value = false;
      editImageMobilePreviewUrl.value = null;
      editOptimizedMobileImageBase64.value = "";
      editIsMobileImageDeleted.value = false;
      editIsPdfDeleted.value = false;
    }
  });

  useTask$(({ track }) => {
    track(() => createBenefitAction.value);
    if (createBenefitAction.value?.success) {
      isCreateBenefitOpen.value = false;
      createImagePreviewUrl.value = null;
      createOptimizedImageBase64.value = "";
      createImageMobilePreviewUrl.value = null;
      createOptimizedMobileImageBase64.value = "";
    }
  });

  useTask$(({ track }) => {
    track(() => searchQuery.value);
    currentPage.value = 1;
  });

  useTask$(({ track }) => {
    track(() => goldFilterActive.value);
    currentPage.value = 1;
  });

  useTask$(({ track }) => {
    track(() => statusFilter.value);
    currentPage.value = 1;
  });

  const itemsPerPage = 25;

  const filteredBenefits = useComputed$(() => {
    let items = benefits.value;
    if (statusFilter.value === "active") {
      items = items.filter(b => !(b.validUntil?.startsWith("draft|") || b.validUntil === "draft"));
    } else if (statusFilter.value === "inactive") {
      items = items.filter(b => b.validUntil?.startsWith("draft|") || b.validUntil === "draft");
    }
    const query = searchQuery.value.toLowerCase().trim();
    if (!query) return items;
    return items.filter(
      (b) =>
        b.titulo.toLowerCase().includes(query) ||
        b.resumen?.toLowerCase().includes(query) ||
        b.descripcion?.toLowerCase().includes(query)
    );
  });

  const totalPages = useComputed$(() => {
    const count = filteredBenefits.value.length;
    return Math.max(1, Math.ceil(count / itemsPerPage));
  });

  const paginatedBenefits = useComputed$(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredBenefits.value.slice(start, end);
  });

  const changePage = $((page: number) => {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  });

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      <dialog
        ref={filterDialog}
        aria-labelledby="benefit-filter-title"
        class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-slate-800 shadow-xl backdrop:bg-slate-950/50"
        preventdefault:cancel
        onCancel$={() => { if (!createBenefitFilterAction.isRunning) filterDialog.value?.close(); }}
        onClose$={() => { filterTarget.value = null; }}
      >
        <Form
          action={createBenefitFilterAction}
          class="space-y-5"
          onSubmitCompleted$={() => {
            const result = createBenefitFilterAction.value;
            const target = filterTarget.value;
            if (!result?.success) {
              filterError.value = result?.message || result?.fieldErrors?.descripcion || "Revisá el nombre e intentá de nuevo.";
              return;
            }
            if (!target) return;
            const option = result.option;
            if (target.context === "create") {
              createFilterSelection[target.type] = String(option.id);
              if (target.type === "categorias") createPreviewCategory.value = option.descripcion;
              if (target.type === "ubicaciones") createPreviewLocation.value = option.descripcion;
            } else if (editingBenefit.value) {
              editFilterSelection[target.type] = String(option.id);
              if (target.type === "categorias") editPreviewCategory.value = option.descripcion;
              if (target.type === "ubicaciones") editPreviewLocation.value = option.descripcion;
            }
            filterNotice.value = `“${option.descripcion}” está disponible y quedó seleccionada en el beneficio.`;
            filterDialog.value?.close();
          }}
        >
          <h2 id="benefit-filter-title" class="text-lg font-bold text-brand-green-dark">
            {filterTarget.value ? filterEditorLabels[filterTarget.value.type].title : "Agregar opción"}
          </h2>
          <p class="text-sm text-slate-500">La opción quedará disponible para todos los beneficios.</p>
          <input type="hidden" name="type" value={filterTarget.value?.type || "categorias"} />
          <div class="space-y-2">
            <label for="benefit-filter-description" class="block text-xs font-bold uppercase tracking-wider text-slate-500">Nombre</label>
            <input
              id="benefit-filter-description"
              name="descripcion"
              type="text"
              value={filterDescription.value}
              onInput$={(_, el) => { filterDescription.value = el.value; filterError.value = ""; }}
              aria-invalid={Boolean(filterError.value)}
              aria-describedby={filterError.value ? "benefit-filter-error" : undefined}
              required
              maxLength={100}
              autoFocus
              placeholder={filterTarget.value ? filterEditorLabels[filterTarget.value.type].placeholder : ""}
              class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-brand-green focus:bg-white focus:outline-none"
            />
          </div>
          {filterError.value && <p id="benefit-filter-error" role="alert" class="text-sm text-red-600">{filterError.value}</p>}
          <div class="flex justify-end gap-3">
            <button type="button" disabled={createBenefitFilterAction.isRunning} onClick$={() => filterDialog.value?.close()} class="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold disabled:opacity-50 cursor-pointer">Cancelar</button>
            <button type="submit" disabled={createBenefitFilterAction.isRunning} class="rounded-2xl bg-brand-green px-4 py-3 text-sm font-bold text-white hover:bg-brand-green-light disabled:opacity-50 cursor-pointer">
              {createBenefitFilterAction.isRunning ? "Guardando..." : "Guardar y seleccionar"}
            </button>
          </div>
        </Form>
      </dialog>
      {/* Dynamic Header Area (No duplication) */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              Administración / Catálogo
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Gestión de Beneficios
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Creá y eliminá beneficios del portal local e integrá cupones de descuento.
          </p>
        </div>

        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search Input Box */}
          <div class="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar por título..."
              value={searchQuery.value}
              onInput$={(ev) => {
                searchQuery.value = (ev.target as HTMLInputElement).value;
              }}
              class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-3 pl-9 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
            />
            <LuSearch class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {searchQuery.value && (
              <button
                type="button"
                onClick$={() => {
                  searchQuery.value = "";
                }}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 font-bold text-sm"
              >
                &times;
              </button>
            )}
          </div>



          {/* Status Filter */}
          <div class="relative w-full sm:w-44">
            <select
              value={statusFilter.value}
              onChange$={(ev, el) => {
                statusFilter.value = el.value as any;
              }}
              class="w-full bg-white text-slate-700 text-xs px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:outline-none transition-all cursor-pointer font-bold shadow-sm"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Borradores</option>
            </select>
          </div>

          <button
            onClick$={() => {
              editingBenefit.value = null;
              isCreateBenefitOpen.value = !isCreateBenefitOpen.value;
              createImagePreviewUrl.value = null;
              createOptimizedImageBase64.value = "";
            }}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <LuPlus class="w-4 h-4" />
            <span>{isCreateBenefitOpen.value ? "Cerrar Formulario" : "Crear Beneficio"}</span>
          </button>
        </div>
      </div>

      <div class="space-y-6 animate-in fade-in duration-300 text-left">
        {/* Action Feedback alerts */}
        {filterNotice.value && (
          <div role="status" class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm">
            {filterNotice.value}
          </div>
        )}
        {createBenefitAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-fade-in">
            ✓ Beneficio creado exitosamente e integrado en el catálogo general.
          </div>
        )}

        {editBenefitAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-fade-in">
            ✓ Beneficio modificado exitosamente y actualizado en el catálogo.
          </div>
        )}

        {toggleBenefitActiveAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-fade-in">
            ✓ Estado de activación del beneficio modificado con éxito.
          </div>
        )}

        {/* Form Modal Panel */}
        {isCreateBenefitOpen.value && (
          <Form action={createBenefitAction} enctype="multipart/form-data" class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-5 animate-in slide-in-from-top-6 duration-300">
            <h4 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Nuevo Beneficio Propio</h4>
            {createBenefitAction.value?.failed && (
              <p role="alert" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {createBenefitAction.value.message || Object.values(createBenefitAction.value.fieldErrors || {}).join(" ") || "No se pudo crear el beneficio. Revisá los datos e intentá de nuevo."}
              </p>
            )}

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Título</label>
                <input
                  type="text"
                  name="titulo"
                  required
                  minLength={3}
                  placeholder="Ej: Spa Platense Masajes"
                  onInput$={(e) => { createPreviewTitulo.value = (e.target as HTMLInputElement).value; }}
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Resumen (badge descuento)</label>
                <input
                  type="text"
                  name="resumen"
                  required
                  minLength={5}
                  placeholder="Ej: 20% de descuento"
                  onInput$={(e) => { createPreviewResumen.value = (e.target as HTMLInputElement).value; }}
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Descripción Detallada</label>
              <textarea
                name="descripcion"
                required
                minLength={5}
                rows={3}
                placeholder="Escribí los detalles completos del descuento, dirección y condiciones..."
                onInput$={(e) => { createPreviewDescripcion.value = (e.target as HTMLTextAreaElement).value; }}
                class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="space-y-1">
                <FilterFieldLabel id="create-categoryId" label="Categoría" onAdd$={() => openFilterEditor$("categorias", "create")} />
                <select
                  id="create-categoryId"
                  name="categoryId"
                  required
                  value={createFilterSelection.categorias || String(adminFilters.value.categorias[0]?.id ?? "")}
                  onChange$={(e, el) => { createFilterSelection.categorias = el.value; createPreviewCategory.value = el.options[el.selectedIndex].text; }}
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
                <FilterFieldLabel id="create-locationId" label="Ubicación" onAdd$={() => openFilterEditor$("ubicaciones", "create")} />
                <select
                  id="create-locationId"
                  name="locationId"
                  required
                  value={createFilterSelection.ubicaciones || String(adminFilters.value.ubicaciones[0]?.id ?? "")}
                  onChange$={(e, el) => { createFilterSelection.ubicaciones = el.value; createPreviewLocation.value = el.options[el.selectedIndex].text; }}
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
                <FilterFieldLabel id="create-offerId" label="Oferta / Descuento" onAdd$={() => openFilterEditor$("ofertas", "create")} />
                <select
                  id="create-offerId"
                  name="offerId"
                  required
                  value={createFilterSelection.ofertas || String(adminFilters.value.ofertas[0]?.id ?? "")}
                  onChange$={(e, el) => { createFilterSelection.ofertas = el.value; }}
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

            {/* Coordenadas Geográficas (Mapa) */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-5">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Latitud (Coordenadas)</label>
                <input
                  type="text"
                  name="latitud"
                  placeholder="Ej: -34.9205 (Opcional, vacío para autocompletar alrededor de La Plata)"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-mono"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Longitud (Coordenadas)</label>
                <input
                  type="text"
                  name="longitud"
                  placeholder="Ej: -57.9536 (Opcional, vacío para autocompletar alrededor de La Plata)"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-mono"
                />
              </div>
            </div>

            {/* Imagen Destacada y Documentación PDF */}
            <div class="border-t border-slate-100 pt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Imagen Ilustrativa del Beneficio */}
              <div class="space-y-4">
                <h4 class="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
                  <LuImage class="w-4 h-4 text-brand-green" />
                  Imagen Desktop (16:9)
                </h4>
                <input type="hidden" name="optimizedImage" value={createOptimizedImageBase64.value} />
                <div class="space-y-2">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Subir Imagen Desktop</label>
                  <div class="flex items-center gap-4">
                    <div class="w-20 h-20 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                      {createImagePreviewUrl.value ? (
                        <img src={createImagePreviewUrl.value} alt="Vista previa" class="w-full h-full object-cover" width={80} height={80} />
                      ) : (
                        <LuImage class="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div class="flex flex-col gap-2">
                      <label class="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-extrabold rounded-2xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                        <LuImage class="w-4 h-4 text-brand-green" />
                        Seleccionar
                        <input
                          id="create-image-file-input"
                          type="file"
                          name="imageFile"
                          accept="image/*"
                          onChange$={handleCreateImageChange}
                          class="hidden"
                        />
                      </label>
                      {createImagePreviewUrl.value && (
                        <button
                          type="button"
                          onClick$={() => {
                            createImagePreviewUrl.value = null;
                            createOptimizedImageBase64.value = "";
                            const input = document.getElementById("create-image-file-input") as HTMLInputElement;
                            if (input) input.value = "";
                          }}
                          class="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-650 text-[10px] font-extrabold rounded-xl transition-all inline-flex items-center justify-center shadow-sm"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                  <p class="text-[10px] text-slate-400 font-medium">PNG, JPG o WebP. Auto-optimizado.</p>
                </div>
              </div>

              {/* Imagen Ilustrativa Mobile */}
              <div class="space-y-4">
                <h4 class="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
                  <LuSmartphone class="w-4 h-4 text-brand-green" />
                  Imagen Mobile (Vertical)
                </h4>
                <input type="hidden" name="optimizedMobileImage" value={createOptimizedMobileImageBase64.value} />
                <div class="space-y-2">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Subir Imagen Mobile</label>
                  <div class="flex items-center gap-4">
                    <div class="w-20 h-20 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                      {createImageMobilePreviewUrl.value ? (
                        <img src={createImageMobilePreviewUrl.value} alt="Vista previa móvil" class="w-full h-full object-cover" width={80} height={80} />
                      ) : (
                        <LuSmartphone class="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div class="flex flex-col gap-2">
                      <label class="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-extrabold rounded-2xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                        <LuSmartphone class="w-4 h-4 text-brand-green" />
                        Seleccionar
                        <input
                          id="create-image-mobile-file-input"
                          type="file"
                          name="imageMobileFile"
                          accept="image/*"
                          onChange$={handleCreateMobileImageChange}
                          class="hidden"
                        />
                      </label>
                      {createImageMobilePreviewUrl.value && (
                        <button
                          type="button"
                          onClick$={() => {
                            createImageMobilePreviewUrl.value = null;
                            createOptimizedMobileImageBase64.value = "";
                            const input = document.getElementById("create-image-mobile-file-input") as HTMLInputElement;
                            if (input) input.value = "";
                          }}
                          class="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-650 text-[10px] font-extrabold rounded-xl transition-all inline-flex items-center justify-center shadow-sm"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                  <p class="text-[10px] text-slate-400 font-medium">Relación vertical/cuadrada recomendada.</p>
                </div>
              </div>

              {/* Documentación PDF Widget */}
              <div class="space-y-4">
                <h4 class="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
                  <svg class="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9.5 6H10v1.5H8.5V9H7v5h1.5v-2H10v2h1.5V9H9.5zm5 2c0-.55-.45-1-1-1H12v5h1.5v-1.5h1c.55 0 1-.45 1-1V11zm-1.5 1.5V11h1v2h-1zm5-2.5h-2.5v5H17v-2h1.5v-1.5H17V11h2.5V9z"/>
                  </svg>
                  Documentación / Catálogo (PDF)
                </h4>
                <div class="space-y-2">
                  <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Subir Archivo PDF</label>
                  <input
                    type="file"
                    name="pdfFile"
                    accept="application/pdf"
                    class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all cursor-pointer font-medium"
                  />
                  <p class="text-[10px] text-slate-400 font-medium">Subí la lista de precios, menú o bases y condiciones.</p>
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
                      {createImagePreviewUrl.value ? (
                        <img src={createImagePreviewUrl.value} alt="Preview desktop" class="w-full h-full object-cover" />
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
                          {createPreviewDescripcion.value || "Detalles del beneficio..."}
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
                        {createImageMobilePreviewUrl.value ? (
                          <img src={createImageMobilePreviewUrl.value} alt="Preview mobile" class="w-full h-full object-cover" />
                        ) : createImagePreviewUrl.value ? (
                          <img src={createImagePreviewUrl.value} alt="Preview desktop as fallback" class="w-full h-full object-cover" />
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
                            {createPreviewDescripcion.value || "Breve descripción..."}
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

            <button
              type="submit"
              disabled={createBenefitAction.isRunning}
              class="py-3 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
            >
              {createBenefitAction.isRunning ? "Creando..." : "Crear Beneficio"}
            </button>
          </Form>
        )}

        {/* Form Modal Panel for Edit */}
        {editingBenefit.value && (
          <Form key={editingBenefit.value.id} action={editBenefitAction} enctype="multipart/form-data" class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-5 animate-in slide-in-from-top-6 duration-300">
            <h4 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Modificar Beneficio Propio</h4>
            {editBenefitAction.value?.failed && (
              <p role="alert" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editBenefitAction.value.message || Object.values(editBenefitAction.value.fieldErrors || {}).join(" ") || "No se pudieron guardar los cambios. Revisá los datos e intentá de nuevo."}
              </p>
            )}
            <input type="hidden" name="id" value={editingBenefit.value.id} />

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Título</label>
                <input
                  type="text"
                  name="titulo"
                  required
                  minLength={3}
                  value={editingBenefit.value.titulo}
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
                  minLength={5}
                  value={editingBenefit.value.resumen}
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
                minLength={5}
                rows={3}
                value={editingBenefit.value.descripcion}
                placeholder="Escribí los detalles completos del descuento, dirección y condiciones..."
                onInput$={(e) => { editPreviewDescripcion.value = (e.target as HTMLTextAreaElement).value; }}
                class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="space-y-1">
                <FilterFieldLabel id="edit-categoryId" label="Categoría" onAdd$={() => openFilterEditor$("categorias", "edit")} />
                <select
                  id="edit-categoryId"
                  name="categoryId"
                  required
                  value={editFilterSelection.categorias}
                  onChange$={(e, el) => { editFilterSelection.categorias = el.value; editPreviewCategory.value = el.options[el.selectedIndex].text; }}
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
                <FilterFieldLabel id="edit-locationId" label="Ubicación" onAdd$={() => openFilterEditor$("ubicaciones", "edit")} />
                <select
                  id="edit-locationId"
                  name="locationId"
                  required
                  value={editFilterSelection.ubicaciones}
                  onChange$={(e, el) => { editFilterSelection.ubicaciones = el.value; editPreviewLocation.value = el.options[el.selectedIndex].text; }}
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
                <FilterFieldLabel id="edit-offerId" label="Oferta / Descuento" onAdd$={() => openFilterEditor$("ofertas", "edit")} />
                <select
                  id="edit-offerId"
                  name="offerId"
                  required
                  value={editFilterSelection.ofertas}
                  onChange$={(e, el) => { editFilterSelection.ofertas = el.value; }}
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

            {/* Coordenadas Geográficas (Mapa) */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-5">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Latitud (Coordenadas)</label>
                <input
                  type="text"
                  name="latitud"
                  value={editingBenefit.value.latitud || ""}
                  placeholder="Ej: -34.9205"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-mono"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Longitud (Coordenadas)</label>
                <input
                  type="text"
                  name="longitud"
                  value={editingBenefit.value.longitud || ""}
                  placeholder="Ej: -57.9536"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-mono"
                />
              </div>
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
                              : `https://beneficios.lprc.ar/files/${editImagePreviewUrl.value}`
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
                              : `https://beneficios.lprc.ar/files/${editImageMobilePreviewUrl.value}`
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
                    
                    {editingBenefit.value.pdfUrl && !editIsPdfDeleted.value && (
                      <div class="flex items-center justify-between bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                        <span class="text-xs font-semibold text-slate-650 truncate max-w-[200px]" title={editingBenefit.value.pdfUrl.split('/').pop()}>
                          📄 {editingBenefit.value.pdfUrl.split('/').pop()}
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
                              : `https://beneficios.lprc.ar/files/${editImagePreviewUrl.value}`
                          }
                          alt="Preview desktop"
                          class="w-full h-full object-cover"
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
                          {editPreviewDescripcion.value || "Detalles del beneficio..."}
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
                                : `https://beneficios.lprc.ar/files/${editImageMobilePreviewUrl.value}`
                            }
                            alt="Preview mobile"
                            class="w-full h-full object-cover"
                          />
                        ) : editImagePreviewUrl.value && !editIsImageDeleted.value ? (
                          <img
                            src={
                              editImagePreviewUrl.value.startsWith("data:") ||
                              editImagePreviewUrl.value.startsWith("blob:") ||
                              editImagePreviewUrl.value.startsWith("http") ||
                              editImagePreviewUrl.value.startsWith("/")
                                ? editImagePreviewUrl.value
                                : `https://beneficios.lprc.ar/files/${editImagePreviewUrl.value}`
                            }
                            alt="Preview desktop as fallback"
                            class="w-full h-full object-cover"
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
                            {editPreviewDescripcion.value || "Breve descripción..."}
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
                  defaultChecked={!(editingBenefit.value.validUntil?.startsWith("draft|") || editingBenefit.value.validUntil === "draft")}
                  class="rounded border-slate-300 text-brand-green focus:ring-brand-green h-4 w-4"
                />
                <label for="edit_isActive" class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                  <span class="w-2.5 h-2.5 rounded-full bg-brand-green"></span>
                  <span>Publicar (Activo)</span>
                </label>
              </div>
            </div>

            <div class="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={editBenefitAction.isRunning}
                class="py-3 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
              >
                {editBenefitAction.isRunning ? "Guardando..." : "Guardar Cambios"}
              </button>
              <button
                type="button"
                onClick$={() => {
                  editingBenefit.value = null;
                  editImagePreviewUrl.value = null;
                  editOptimizedImageBase64.value = "";
                  editIsImageDeleted.value = false;
                }}
                class="py-3 px-6 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold shadow-sm transition-all duration-300 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </Form>
        )}

        {/* List Table of Custom benefits */}
        <div class="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col">
          <table class="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th class="px-6 py-4">Título</th>
                <th class="px-6 py-4">Resumen / Desc.</th>
                <th class="px-6 py-4">Filtros (Categoría/Ubicación)</th>
                <th class="px-6 py-4 text-center">Estado</th>
                <th class="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-medium">
              {paginatedBenefits.value.length === 0 ? (
                <tr>
                  <td colSpan={5} class="px-6 py-12 text-center text-slate-450">
                    <div class="flex items-center justify-center gap-2">
                      <LuTicket class="w-5 h-5 text-purple-400" />
                      <span>Aún no has creado beneficios propios. Hacé clic en "Crear Beneficio" para registrar el primero.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedBenefits.value.map((benefit) => {
                  const catDesc = adminFilters.value.categorias.find(c => c.id === benefit.categoryId)?.descripcion || `Cat #${benefit.categoryId}`;
                  const locDesc = adminFilters.value.ubicaciones.find(l => l.id === benefit.locationId)?.descripcion || `Loc #${benefit.locationId}`;
                  const isActive = !(benefit.validUntil?.startsWith("draft|") || benefit.validUntil === "draft");

                  return (
                    <tr key={benefit.id} class="hover:bg-slate-50 transition-colors">
                      <td class="px-6 py-4 font-bold text-slate-800">
                        <div class="flex items-center gap-2">
                          <span>{benefit.titulo}</span>
                          {benefit.pdfUrl && (
                            <span
                              class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-red-50 text-red-600 border border-red-200 uppercase tracking-wider"
                              title="Contiene documento PDF adjunto"
                            >
                              PDF
                            </span>
                          )}
                        </div>
                      </td>
                      <td class="px-6 py-4 text-slate-500">{benefit.resumen}</td>
                      <td class="px-6 py-4 text-slate-500 font-bold">
                        {catDesc} <span class="text-slate-300 mx-1">|</span> <span class="font-normal text-slate-400">{locDesc}</span>
                      </td>
                      {/* Estado Toggle Column */}
                      <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center">
                          <label class="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isActive}
                              onChange$={$(async () => {
                                await toggleBenefitActiveAction.submit({ id: benefit.id });
                              })}
                              class="sr-only peer"
                            />
                            <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-green"></div>
                            <span class="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 min-w-[50px] text-left">
                              {isActive ? "Activo" : "Borrador"}
                            </span>
                          </label>
                        </div>
                      </td>
                      <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center gap-1.5">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick$={() => {
                              editingBenefit.value = benefit;
                              editFilterSelection.categorias = String(benefit.categoryId);
                              editFilterSelection.ubicaciones = String(benefit.locationId);
                              editFilterSelection.ofertas = String(benefit.offerId);
                              isCreateBenefitOpen.value = false;
                              editImagePreviewUrl.value = benefit.imagen || null;
                              editOptimizedImageBase64.value = "";
                              editIsImageDeleted.value = false;
                              editImageMobilePreviewUrl.value = benefit.imagenMobile || null;
                              editOptimizedMobileImageBase64.value = "";
                              editIsMobileImageDeleted.value = false;

                              // Initialize preview values
                              editPreviewTitulo.value = benefit.titulo;
                              editPreviewResumen.value = benefit.resumen || "";
                              editPreviewDescripcion.value = benefit.descripcion || "";
                              editPreviewIsFeatured.value = benefit.isFeatured;
                              
                              const cat = adminFilters.value.categorias.find(c => c.id === benefit.categoryId)?.descripcion || "Categoría";
                              editPreviewCategory.value = cat;
                              
                              const loc = adminFilters.value.ubicaciones.find(l => l.id === benefit.locationId)?.descripcion || "La Plata";
                              editPreviewLocation.value = loc;
                            }}
                            class="p-2 text-brand-green hover:text-brand-green-light hover:bg-emerald-50 rounded-full transition-all cursor-pointer"
                            title="Editar Beneficio"
                          >
                            <LuPencil class="w-4 h-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick$={$(async () => {
                              if (confirm(`¿Está seguro de que desea eliminar el beneficio "${benefit.titulo}" de forma permanente?`)) {
                                await deleteBenefitAction.submit({ id: benefit.id });
                              }
                            })}
                            class="p-2 text-red-500 hover:text-red-705 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                            title="Eliminar Beneficio"
                          >
                            <LuTrash2 class="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages.value > 1 && (
            <div class="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50">
              <span class="text-xs text-slate-500">
                Página <span class="font-bold text-slate-800">{currentPage.value}</span> de <span class="font-bold text-slate-800">{totalPages.value}</span> ({filteredBenefits.value.length} beneficios)
              </span>
              <div class="flex items-center gap-1">
                <button
                  onClick$={() => changePage(currentPage.value - 1)}
                  disabled={currentPage.value === 1}
                  class="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-slate-650"
                  title="Página Anterior"
                >
                  <LuChevronLeft class="w-4 h-4" />
                </button>
                <button
                  onClick$={() => changePage(currentPage.value + 1)}
                  disabled={currentPage.value === totalPages.value}
                  class="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-slate-650"
                  title="Página Siguiente"
                >
                  <LuChevronRight class="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "LPRC Club - Gestión de Beneficios",
  meta: [
    {
      name: "description",
      content: "Administrar catálogo de beneficios propios del club.",
    },
  ],
};
