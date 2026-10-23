import { component$, useSignal, useStore, useComputed$, useTask$, $, type QRL, type Signal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuPlus, LuTicket, LuTrash2, LuPencil, LuSparkles, LuChevronLeft, LuChevronRight, LuSearch, LuImage, LuSmartphone, LuCopy, LuMapPinOff } from "@qwikest/icons/lucide";
import { eq } from "drizzle-orm";
import { putImage, putMedia } from "~/server/media";
import { getDB } from "~/db";
import { benefits as benefitsTable } from "~/db/schema";
import { getFilters, getCustomBenefitRows, type Benefit } from "~/server/cache";
import { BenefitCard } from "~/components/ui/BenefitCard";
import { createBenefitFilter, validateBenefitFilterSelection, BenefitFilterValidationError, type BenefitFilterType } from "~/server/benefit-filters";
import { deleteBenefit, getCouponCountsByBenefit } from "~/server/coupons";
import { ActionFeedback } from "~/components/admin/action-feedback";
import { isDraftBenefit, parseValidUntil } from "~/utils/benefit-status";
import {
  RESUMEN_MAX_LENGTH,
  benefitValuesFromForm,
  findDuplicateTitle,
  formatValidUntil,
  hasCoordinates,
  normalizeResumen,
  parseCoordinateFields,
  parseMapsLink,
  percentIn,
  resumenContradictsOffer,
  withPublishedState,
} from "~/utils/benefit-admin";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

const filterEditorLabels = {
  categorias: { title: "Nueva categoría", placeholder: "Ej: Veterinarias" },
  ubicaciones: { title: "Nueva ubicación", placeholder: "Ej: City Bell" },
  ofertas: { title: "Nuevo descuento", placeholder: "Ej: 25% o 2x1" },
};

const couponLabel = (count: number) => (count === 1 ? "1 cupón" : `${count} cupones`);

const FilterFieldLabel = component$<{ id: string; label: string; onAdd$: QRL<() => void> }>((props) => (
  <div class="flex items-center justify-between gap-2">
    <label for={props.id} class="text-xs font-bold text-slate-500 uppercase tracking-wider block">{props.label}</label>
    <button type="button" onClick$={props.onAdd$} aria-label={`Agregar ${props.label.toLowerCase()}`} class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-brand-navy hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-brand-navy cursor-pointer">
      <LuPlus class="h-3.5 w-3.5" /> Agregar
    </button>
  </div>
));

type AdminBenefitRow = typeof benefitsTable.$inferSelect & { couponCount: number };

const fieldClass = "w-full bg-slate-50 text-slate-800 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all";
const fieldLabelClass = "text-xs font-bold text-slate-500 uppercase tracking-wider block";

/** Date inputs only take YYYY-MM-DD; a stored ISO instant keeps its day. */
const dateInputValue = (raw: string | null | undefined) => parseValidUntil(raw).validUntil?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";

/** Legacy rows store bare file names served by the old site. */
const previewSrc = (url: string) =>
  /^(data:|blob:|https?:|\/)/.test(url) ? url : `https://beneficios.lprc.ar/files/${url}`;

/** Brings an opened form into view and focuses its first field (it renders above the list). */
const revealForm = (id: string) =>
  setTimeout(() => {
    const form = document.getElementById(id);
    if (!form) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    form.querySelector<HTMLInputElement>("input:not([type=hidden])")?.focus({ preventScroll: true });
  }, 60);

const ResumenField = component$<{ id: string; value: Signal<string>; offer?: string; listId: string }>((props) => {
  const length = props.value.value.length;
  const offerText = props.offer ? normalizeResumen(props.offer) : "";
  const badgePercent = percentIn(props.value.value);
  const offerPercent = percentIn(props.offer);
  return (
    <div class="space-y-1">
      <div class="flex items-center justify-between gap-2">
        <label for={props.id} class={fieldLabelClass}>Resumen (badge descuento)</label>
        <span class={`text-[11px] font-bold tabular-nums ${length > RESUMEN_MAX_LENGTH - 5 ? "text-amber-700" : "text-slate-500"}`}>
          {length}/{RESUMEN_MAX_LENGTH}
        </span>
      </div>
      <input
        id={props.id}
        type="text"
        name="resumen"
        required
        minLength={2}
        maxLength={RESUMEN_MAX_LENGTH}
        // Qwik's input typings lack `list`; it links the <datalist> of suggested badges.
        {...{ list: props.listId }}
        value={props.value.value}
        placeholder="Ej: 20% Off o 2x1"
        aria-describedby={`${props.id}-hint`}
        onInput$={(_, el) => { props.value.value = el.value; }}
        class={fieldClass}
      />
      <p id={`${props.id}-hint`} class="text-[11px] text-slate-500">Texto corto del badge. Se guarda sin espacios de más (“10 % Off” → “10% Off”).</p>
      {offerText && normalizeResumen(props.value.value) !== offerText && (
        <button type="button" onClick$={() => { props.value.value = offerText; }} class="text-[11px] font-bold text-brand-navy hover:underline cursor-pointer">
          Usar «{offerText}»
        </button>
      )}
      {resumenContradictsOffer(props.value.value, props.offer) && (
        <p class="text-[11px] font-bold text-amber-800">
          El badge dice {badgePercent}% pero la oferta elegida es {offerPercent}%. Revisá cuál corresponde.
        </p>
      )}
    </div>
  );
});

const CoordinateFields = component$<{ idPrefix: string; latitud: Signal<string>; longitud: Signal<string> }>((props) => {
  const mapsStatus = useSignal<"" | "ok" | "error">("");
  const result = parseCoordinateFields(props.latitud.value, props.longitud.value);
  const errors = result.ok ? {} : result.errors;
  return (
    <div class="space-y-4 border-t border-slate-100 pt-5">
      <div class="space-y-1">
        <label for={`${props.idPrefix}-maps-link`} class={fieldLabelClass}>Link de Google Maps (opcional)</label>
        <input
          id={`${props.idPrefix}-maps-link`}
          type="url"
          inputMode="url"
          placeholder="Pegá el link del lugar y completamos las coordenadas"
          onInput$={(_, el) => {
            if (!el.value.trim()) {
              mapsStatus.value = "";
              return;
            }
            const parsed = parseMapsLink(el.value);
            if (!parsed) {
              mapsStatus.value = "error";
              return;
            }
            props.latitud.value = parsed.latitud;
            props.longitud.value = parsed.longitud;
            mapsStatus.value = "ok";
          }}
          class={fieldClass}
        />
        {mapsStatus.value === "ok" && <p role="status" class="text-[11px] font-bold text-emerald-700">Coordenadas completadas desde el link.</p>}
        {mapsStatus.value === "error" && (
          <p role="alert" class="text-[11px] font-bold text-amber-800">
            No encontramos coordenadas en ese link. Abrí el lugar en Google Maps desde la computadora y copiá la dirección completa de la barra; los links cortos (maps.app.goo.gl) no las incluyen.
          </p>
        )}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-1">
          <label for={`${props.idPrefix}-latitud`} class={fieldLabelClass}>Latitud</label>
          <input
            id={`${props.idPrefix}-latitud`}
            type="text"
            name="latitud"
            inputMode="decimal"
            value={props.latitud.value}
            placeholder="Ej: -34.9205"
            aria-invalid={Boolean(errors.latitud)}
            aria-describedby={errors.latitud ? `${props.idPrefix}-latitud-error` : undefined}
            onInput$={(_, el) => { props.latitud.value = el.value; }}
            class={`${fieldClass} font-mono`}
          />
          {errors.latitud && <p id={`${props.idPrefix}-latitud-error`} class="text-[11px] font-bold text-red-700">{errors.latitud}</p>}
        </div>
        <div class="space-y-1">
          <label for={`${props.idPrefix}-longitud`} class={fieldLabelClass}>Longitud</label>
          <input
            id={`${props.idPrefix}-longitud`}
            type="text"
            name="longitud"
            inputMode="decimal"
            value={props.longitud.value}
            placeholder="Ej: -57.9536"
            aria-invalid={Boolean(errors.longitud)}
            aria-describedby={errors.longitud ? `${props.idPrefix}-longitud-error` : undefined}
            onInput$={(_, el) => { props.longitud.value = el.value; }}
            class={`${fieldClass} font-mono`}
          />
          {errors.longitud && <p id={`${props.idPrefix}-longitud-error`} class="text-[11px] font-bold text-red-700">{errors.longitud}</p>}
        </div>
      </div>
      <p class="text-[11px] text-slate-500">Si dejás las dos vacías, el beneficio no aparece en el mapa.</p>
    </div>
  );
});

const ValidityFields = component$<{ idPrefix: string; validUntil: string; terms: string; isPremiumOnly: boolean; couponCode: string }>((props) => (
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-5">
    <div class="space-y-1">
      <label for={`${props.idPrefix}-validUntil`} class={fieldLabelClass}>Válido hasta (opcional)</label>
      <input
        id={`${props.idPrefix}-validUntil`}
        type="date"
        name="validUntil"
        value={props.validUntil}
        aria-describedby={`${props.idPrefix}-validUntil-hint`}
        class={fieldClass}
      />
      <p id={`${props.idPrefix}-validUntil-hint`} class="text-[11px] text-slate-500">Después de esa fecha no se pueden generar ni canjear cupones. Vacío: sin vencimiento.</p>
    </div>
    <div class="flex items-start gap-3 sm:pt-6">
      <input
        type="checkbox"
        id={`${props.idPrefix}-isPremiumOnly`}
        name="isPremiumOnly"
        checked={props.isPremiumOnly}
        class="mt-0.5 rounded border-slate-300 text-brand-navy focus:ring-brand-navy h-4 w-4"
      />
      <label for={`${props.idPrefix}-isPremiumOnly`} class="text-xs font-bold text-slate-600 cursor-pointer">
        Solo socios Gold
        <span class="block text-[11px] font-medium text-slate-500">Solo los socios Gold pueden generar el cupón.</span>
      </label>
    </div>
    <div class="space-y-1 sm:col-span-2">
      <label for={`${props.idPrefix}-couponCode`} class={fieldLabelClass}>Código promocional del comercio (opcional)</label>
      <input
        id={`${props.idPrefix}-couponCode`}
        type="text"
        name="couponCode"
        maxLength={40}
        autocomplete="off"
        value={props.couponCode}
        aria-describedby={`${props.idPrefix}-couponCode-hint`}
        placeholder="Ej: LPRC15"
        class={fieldClass}
      />
      <p id={`${props.idPrefix}-couponCode-hint`} class="text-[11px] text-slate-500">Se muestra en la página del beneficio para usarlo online o por teléfono.</p>
    </div>
    <div class="space-y-1 sm:col-span-2">
      <label for={`${props.idPrefix}-terms`} class={fieldLabelClass}>Condiciones (opcional)</label>
      <textarea
        id={`${props.idPrefix}-terms`}
        name="terms"
        rows={3}
        maxLength={2000}
        value={props.terms}
        placeholder="Ej: Válido de lunes a jueves. No acumulable con otras promociones."
        class={fieldClass}
      />
    </div>
  </div>
));

interface BenefitPreviewProps {
  title: string;
  summary: string;
  description: string;
  image: string | null;
  mobileImage: string | null;
  category: string;
  location: string;
}

const BenefitPreview = component$<BenefitPreviewProps>((props) => {
  const benefit: Benefit = {
    id: 0,
    url: "vista-previa",
    titulo: props.title || "Título del beneficio",
    resumen: props.summary || "Exclusivo",
    descripcion: props.description || "Detalles del beneficio...",
    imagen: props.image,
    latitud: null,
    longitud: null,
    categorias: [{ id: 0, descripcion: props.category || "Categoría" }],
    ubicacion: [{ id: 0, descripcion: props.location || "La Plata" }],
    ofertas: [],
  };

  return (
    <div class="border-t border-slate-100 pt-6 space-y-4">
      <h4 class="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
        <LuSparkles class="w-4 h-4 text-brand-gold" /> Vista previa del beneficio
      </h4>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
        <div class="space-y-2.5">
          <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">En computadora</span>
          <div inert class="max-w-[340px] mx-auto lg:mx-0">
            <BenefitCard benefit={benefit} />
          </div>
        </div>
        <div class="space-y-2.5">
          <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">En celular</span>
          <div inert class="max-w-[280px] mx-auto lg:mx-0">
            <BenefitCard benefit={{ ...benefit, imagen: props.mobileImage || props.image }} />
          </div>
        </div>
      </div>
    </div>
  );
});

// --- SECURITY & LOADERS ---

export const useAdminCustomBenefitsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const [rows, couponCounts] = await Promise.all([
      getCustomBenefitRows(event),
      getCouponCountsByBenefit(event),
    ]);
    return rows
      .map((row) => ({ ...row, couponCount: couponCounts[row.id] ?? 0 }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

    const coordinates = parseCoordinateFields(data.latitud, data.longitud);
    if (!coordinates.ok) return requestEvent.fail(400, { message: Object.values(coordinates.errors).join(" ") });

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

      await db.insert(benefitsTable).values({
        id: uuid,
        ...benefitValuesFromForm(data),
        // "Duplicar" reuses the original's images unless new ones are uploaded.
        imagen: uploadedImageUrl ?? (data.copiedImage || null),
        imagenMobile: uploadedImageMobileUrl ?? (data.copiedMobileImage || null),
        slug,
        pdfUrl: uploadedPdfUrl,
        latitud: coordinates.latitud,
        longitud: coordinates.longitud,
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
    resumen: z.string().trim().min(2, "El resumen debe tener al menos 2 caracteres.").max(RESUMEN_MAX_LENGTH, `El resumen admite hasta ${RESUMEN_MAX_LENGTH} caracteres.`),
    descripcion: z.string().trim().min(5, "La descripción debe tener al menos 5 caracteres."),
    isFeatured: z.string().optional(),
    isPremiumOnly: z.string().optional(),
    categoryId: z.string(),
    locationId: z.string(),
    offerId: z.string(),
    validUntil: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Elegí una fecha válida.").optional(),
    isActive: z.string().optional(),
    terms: z.string().max(2000, "Las condiciones admiten hasta 2000 caracteres.").optional(),
    couponCode: z.string().max(40, "El código admite hasta 40 caracteres.").optional(),
    pdfFile: z.any().optional(),
    imageFile: z.any().optional(),
    optimizedImage: z.string().optional(),
    imageMobileFile: z.any().optional(),
    optimizedMobileImage: z.string().optional(),
    copiedImage: z.string().optional(),
    copiedMobileImage: z.string().optional(),
    latitud: z.string().optional(),
    longitud: z.string().optional(),
  })
);

export const useEditBenefitAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    const coordinates = parseCoordinateFields(data.latitud, data.longitud);
    if (!coordinates.ok) return requestEvent.fail(400, { message: Object.values(coordinates.errors).join(" ") });

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

      await db
        .update(benefitsTable)
        .set({
          ...benefitValuesFromForm(data),
          imagen: finalImageUrl,
          imagenMobile: finalImageMobileUrl,
          pdfUrl: finalPdfUrl,
          latitud: coordinates.latitud,
          longitud: coordinates.longitud,
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
    resumen: z.string().trim().min(2, "El resumen debe tener al menos 2 caracteres.").max(RESUMEN_MAX_LENGTH, `El resumen admite hasta ${RESUMEN_MAX_LENGTH} caracteres.`),
    descripcion: z.string().trim().min(5, "La descripción debe tener al menos 5 caracteres."),
    isFeatured: z.string().optional(),
    isPremiumOnly: z.string().optional(),
    categoryId: z.string(),
    locationId: z.string(),
    offerId: z.string(),
    validUntil: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Elegí una fecha válida.").optional(),
    isActive: z.string().optional(),
    terms: z.string().max(2000, "Las condiciones admiten hasta 2000 caracteres.").optional(),
    couponCode: z.string().max(40, "El código admite hasta 40 caracteres.").optional(),
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

      // The client sends the state it wants, so a double click cannot flip it back.
      const publish = data.publish === "true";
      await db.update(benefitsTable)
        .set({ validUntil: withPublishedState(existing.validUntil, publish) })
        .where(eq(benefitsTable.id, data.id));

      return { success: true, titulo: existing.titulo, published: publish };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al cambiar el estado." });
    }
  },
  zod$({
    id: z.string(),
    publish: z.enum(["true", "false"]),
  })
);

export const useDeleteBenefitAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const result = await deleteBenefit(requestEvent, data.id, {
        includeCoupons: data.includeCoupons === "true",
        expectedCouponCount: data.expectedCouponCount,
      });
      if (!result.ok) {
        return requestEvent.fail(409, { message: result.message, couponCount: result.couponCount });
      }
      return { success: true, deletedCoupons: result.deletedCoupons };
    } catch (err: any) {
      console.error(err);
      return requestEvent.fail(500, { message: "Error al eliminar el beneficio." });
    }
  },
  zod$({
    id: z.string(),
    includeCoupons: z.string().optional(),
    expectedCouponCount: z.coerce.number().int().nonnegative(),
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
  const editingBenefit = useSignal<AdminBenefitRow | null>(null);
  const filterDialog = useSignal<HTMLDialogElement>();
  const filterTarget = useSignal<{ type: BenefitFilterType; context: "create" | "edit" } | null>(null);
  const filterDescription = useSignal("");
  const filterError = useSignal("");
  const filterNotice = useSignal("");
  const deleteDialog = useSignal<HTMLDialogElement>();
  const deleteTarget = useSignal<{ id: string; titulo: string; couponCount: number } | null>(null);
  const deleteError = useSignal("");
  const deleteNotice = useSignal("");
  const createFilterSelection = useStore({ categorias: "", ubicaciones: "", ofertas: "" });
  const editFilterSelection = useStore({ categorias: "", ubicaciones: "", ofertas: "" });

  const openFilterEditor$ = $((type: BenefitFilterType, context: "create" | "edit") => {
    filterTarget.value = { type, context };
    filterDescription.value = "";
    filterError.value = "";
    filterNotice.value = "";
    filterDialog.value?.showModal();
  });

  const openDeleteDialog$ = $((target: { id: string; titulo: string; couponCount: number }) => {
    deleteTarget.value = target;
    deleteError.value = "";
    deleteNotice.value = "";
    deleteDialog.value?.showModal();
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
  const editLatitud = useSignal("");
  const editLongitud = useSignal("");

  // Create form state; the form remounts (new key) whenever it is reset or prefilled.
  const createFormKey = useSignal(0);
  const createLatitud = useSignal("");
  const createLongitud = useSignal("");
  const createValidity = useSignal({ validUntil: "", terms: "", isPremiumOnly: false, couponCode: "" });
  const createIsActive = useSignal(true);
  const createCopiedImage = useSignal("");
  const createCopiedMobileImage = useSignal("");
  const createSourceTitle = useSignal("");

  // Pagination & Search state
  const currentPage = useSignal(1);
  const searchQuery = useSignal("");
  const goldFilterActive = useSignal(false);
  const statusFilter = useSignal<"all" | "active" | "inactive">("all");

  // Create form values, also used by the live preview
  const createPreviewTitulo = useSignal("");
  const createPreviewResumen = useSignal("");
  const createPreviewDescripcion = useSignal("");
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
    createCopiedImage.value = "";

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
    createCopiedMobileImage.value = "";

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

  /** Every per-benefit edit flag lives here, so no flag leaks into the next benefit. */
  const resetEditState$ = $(() => {
    editImagePreviewUrl.value = null;
    editOptimizedImageBase64.value = "";
    editIsImageDeleted.value = false;
    editImageMobilePreviewUrl.value = null;
    editOptimizedMobileImageBase64.value = "";
    editIsMobileImageDeleted.value = false;
    editIsPdfDeleted.value = false;
    editLatitud.value = "";
    editLongitud.value = "";
  });

  const resetCreateState$ = $(() => {
    createPreviewTitulo.value = "";
    createPreviewResumen.value = "";
    createPreviewDescripcion.value = "";
    createPreviewIsFeatured.value = false;
    createLatitud.value = "";
    createLongitud.value = "";
    createValidity.value = { validUntil: "", terms: "", isPremiumOnly: false, couponCode: "" };
    createIsActive.value = true;
    createImagePreviewUrl.value = null;
    createOptimizedImageBase64.value = "";
    createImageMobilePreviewUrl.value = null;
    createOptimizedMobileImageBase64.value = "";
    createCopiedImage.value = "";
    createCopiedMobileImage.value = "";
    createSourceTitle.value = "";
    createFilterSelection.categorias = "";
    createFilterSelection.ubicaciones = "";
    createFilterSelection.ofertas = "";
    createPreviewCategory.value = adminFilters.value.categorias[0]?.descripcion || "Categoría";
    createPreviewLocation.value = adminFilters.value.ubicaciones[0]?.descripcion || "La Plata";
    createFormKey.value++;
  });

  const describeFilters = (benefit: AdminBenefitRow) => ({
    category: adminFilters.value.categorias.find((c) => c.id === benefit.categoryId)?.descripcion || `Cat #${benefit.categoryId}`,
    location: adminFilters.value.ubicaciones.find((l) => l.id === benefit.locationId)?.descripcion || `Loc #${benefit.locationId}`,
  });

  const openEditBenefit$ = $(async (benefit: AdminBenefitRow) => {
    await resetEditState$();
    isCreateBenefitOpen.value = false;
    editingBenefit.value = benefit;
    editFilterSelection.categorias = String(benefit.categoryId);
    editFilterSelection.ubicaciones = String(benefit.locationId);
    editFilterSelection.ofertas = String(benefit.offerId);
    editImagePreviewUrl.value = benefit.imagen || null;
    editImageMobilePreviewUrl.value = benefit.imagenMobile || null;
    editLatitud.value = benefit.latitud || "";
    editLongitud.value = benefit.longitud || "";
    editPreviewTitulo.value = benefit.titulo;
    editPreviewResumen.value = benefit.resumen || "";
    editPreviewDescripcion.value = benefit.descripcion || "";
    editPreviewIsFeatured.value = benefit.isFeatured;
    editPreviewCategory.value = adminFilters.value.categorias.find((c) => c.id === benefit.categoryId)?.descripcion || "Categoría";
    editPreviewLocation.value = adminFilters.value.ubicaciones.find((l) => l.id === benefit.locationId)?.descripcion || "La Plata";
    revealForm("benefit-edit-form");
  });

  const closeEditBenefit$ = $(async () => {
    editingBenefit.value = null;
    await resetEditState$();
  });

  /** Opens the create form prefilled from a row, as a draft, so near-copies are explicit. */
  const duplicateBenefit$ = $(async (benefit: AdminBenefitRow) => {
    await closeEditBenefit$();
    await resetCreateState$();
    createPreviewTitulo.value = `${benefit.titulo} (copia)`;
    createPreviewResumen.value = benefit.resumen;
    createPreviewDescripcion.value = benefit.descripcion;
    createFilterSelection.categorias = String(benefit.categoryId);
    createFilterSelection.ubicaciones = String(benefit.locationId);
    createFilterSelection.ofertas = String(benefit.offerId);
    createPreviewCategory.value = adminFilters.value.categorias.find((c) => c.id === benefit.categoryId)?.descripcion || "Categoría";
    createPreviewLocation.value = adminFilters.value.ubicaciones.find((l) => l.id === benefit.locationId)?.descripcion || "La Plata";
    createLatitud.value = benefit.latitud || "";
    createLongitud.value = benefit.longitud || "";
    createValidity.value = {
      validUntil: dateInputValue(benefit.validUntil),
      terms: benefit.terms || "",
      isPremiumOnly: benefit.isPremiumOnly,
      couponCode: benefit.couponCode || "",
    };
    createIsActive.value = false;
    createCopiedImage.value = benefit.imagen || "";
    createImagePreviewUrl.value = benefit.imagen || null;
    createCopiedMobileImage.value = benefit.imagenMobile || "";
    createImageMobilePreviewUrl.value = benefit.imagenMobile || null;
    createSourceTitle.value = benefit.titulo;
    isCreateBenefitOpen.value = true;
    revealForm("benefit-create-form");
  });

  useTask$(async ({ track }) => {
    track(() => editBenefitAction.value);
    if (editBenefitAction.value?.success) await closeEditBenefit$();
  });

  useTask$(async ({ track }) => {
    track(() => createBenefitAction.value);
    if (createBenefitAction.value?.success) {
      isCreateBenefitOpen.value = false;
      await resetCreateState$();
    }
  });

  const createDuplicate = useComputed$(() => findDuplicateTitle(benefits.value, createPreviewTitulo.value));
  const editDuplicate = useComputed$(() =>
    editingBenefit.value ? findDuplicateTitle(benefits.value, editPreviewTitulo.value, editingBenefit.value.id) : null,
  );

  const createOfferDescription = useComputed$(() => {
    const id = createFilterSelection.ofertas || String(adminFilters.value.ofertas[0]?.id ?? "");
    return adminFilters.value.ofertas.find((offer) => String(offer.id) === id)?.descripcion;
  });
  const editOfferDescription = useComputed$(() =>
    adminFilters.value.ofertas.find((offer) => String(offer.id) === editFilterSelection.ofertas)?.descripcion,
  );

  const resumenSuggestions = useComputed$(() => {
    const values = [...adminFilters.value.ofertas.map((offer) => offer.descripcion), ...benefits.value.map((benefit) => benefit.resumen)];
    return [...new Set(values.map(normalizeResumen).filter(Boolean))].slice(0, 30);
  });

  const toggleNotice = useComputed$(() => {
    const result = toggleBenefitActiveAction.value as { success?: boolean; titulo?: string; published?: boolean } | undefined;
    if (!result?.success) return undefined;
    return `«${result.titulo}» ${result.published ? "quedó publicado." : "pasó a borrador."}`;
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
    if (goldFilterActive.value) items = items.filter((benefit) => benefit.isFeatured);
    if (statusFilter.value === "active") {
      items = items.filter((b) => !isDraftBenefit(b.validUntil));
    } else if (statusFilter.value === "inactive") {
      items = items.filter((b) => isDraftBenefit(b.validUntil));
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

  const renderBadges = (benefit: AdminBenefitRow) => {
    const isActive = !isDraftBenefit(benefit.validUntil);
    const expires = formatValidUntil(benefit.validUntil);
    return (
      <>
        {benefit.isFeatured && (
          <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900" title={isActive ? "Seleccionado para Beneficios destacados" : "Marcado como destacado; publicalo para incluirlo en la selección"}>
            <LuSparkles class="w-3 h-3" /> Destacado
          </span>
        )}
        {benefit.isPremiumOnly && (
          <span class="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-amber-200" title="Solo los socios Gold pueden generar el cupón">
            Solo Gold
          </span>
        )}
        {benefit.pdfUrl && (
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-extrabold bg-red-50 text-red-600 border border-red-200 uppercase tracking-wider" title="Contiene documento PDF adjunto">
            PDF
          </span>
        )}
        {!hasCoordinates(benefit) && (
          <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600" title="No aparece en el mapa hasta que cargues sus coordenadas">
            <LuMapPinOff class="w-3 h-3" /> Sin ubicación
          </span>
        )}
        {expires && (
          <span class="inline-flex items-center rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-bold text-sky-900">
            Vence {expires}
          </span>
        )}
      </>
    );
  };

  const renderStatusToggle = (benefit: AdminBenefitRow) => {
    const isActive = !isDraftBenefit(benefit.validUntil);
    return (
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          role="switch"
          checked={isActive}
          disabled={toggleBenefitActiveAction.isRunning}
          aria-label={`Publicar ${benefit.titulo}`}
          onChange$={async (_, el) => {
            const result = await toggleBenefitActiveAction.submit({ id: benefit.id, publish: el.checked ? "true" : "false" });
            // The row only reflects the server; undo the visual flip if the change failed.
            if ((result.value as { failed?: boolean } | undefined)?.failed) el.checked = !el.checked;
          }}
          class="sr-only peer"
        />
        <div class="w-9 h-5 bg-slate-200 rounded-full peer peer-focus-visible:ring-2 peer-focus-visible:ring-brand-navy peer-focus-visible:ring-offset-2 peer-disabled:opacity-50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-navy"></div>
        <span class="ml-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 min-w-[50px] text-left">
          {isActive ? "Activo" : "Borrador"}
        </span>
      </label>
    );
  };

  const renderRowActions = (benefit: AdminBenefitRow) => (
    <div class="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick$={() => openEditBenefit$(benefit)}
        class="p-2.5 text-brand-navy hover:text-brand-navy-light hover:bg-emerald-50 rounded-full transition-all cursor-pointer"
        title="Editar Beneficio"
        aria-label={`Editar beneficio ${benefit.titulo}`}
      >
        <LuPencil class="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick$={() => duplicateBenefit$(benefit)}
        class="p-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
        title="Duplicar como borrador"
        aria-label={`Duplicar beneficio ${benefit.titulo}`}
      >
        <LuCopy class="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick$={() => openDeleteDialog$({ id: benefit.id, titulo: benefit.titulo, couponCount: benefit.couponCount })}
        class="p-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-all cursor-pointer"
        title="Eliminar Beneficio"
        aria-label={`Eliminar beneficio ${benefit.titulo}`}
      >
        <LuTrash2 class="w-4 h-4" />
      </button>
    </div>
  );

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
          <h2 id="benefit-filter-title" class="text-lg font-bold text-brand-navy-dark">
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
              class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm focus:border-brand-navy focus:bg-white focus:outline-none"
            />
          </div>
          {filterError.value && <p id="benefit-filter-error" role="alert" class="text-sm text-red-600">{filterError.value}</p>}
          <div class="flex justify-end gap-3">
            <button type="button" disabled={createBenefitFilterAction.isRunning} onClick$={() => filterDialog.value?.close()} class="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold disabled:opacity-50 cursor-pointer">Cancelar</button>
            <button type="submit" disabled={createBenefitFilterAction.isRunning} class="rounded-2xl bg-brand-navy px-4 py-3 text-sm font-bold text-white hover:bg-brand-navy-light disabled:opacity-50 cursor-pointer">
              {createBenefitFilterAction.isRunning ? "Guardando..." : "Guardar y seleccionar"}
            </button>
          </div>
        </Form>
      </dialog>
      <dialog
        ref={deleteDialog}
        aria-labelledby="benefit-delete-title"
        aria-describedby="benefit-delete-description"
        class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-slate-800 shadow-xl backdrop:bg-slate-950/50"
        preventdefault:cancel
        onCancel$={() => { if (!deleteBenefitAction.isRunning) deleteDialog.value?.close(); }}
        onClose$={() => { deleteTarget.value = null; }}
      >
        <Form
          action={deleteBenefitAction}
          class="space-y-5"
          onSubmitCompleted$={() => {
            const result = deleteBenefitAction.value;
            const target = deleteTarget.value;
            if (!result?.success) {
              // A coupon issued after the list loaded: show the new count and ask again.
              const latestCount = result && "couponCount" in result ? Number(result.couponCount) : 0;
              if (target && result && "couponCount" in result) deleteTarget.value = { ...target, couponCount: latestCount };
              deleteError.value = result?.message || "No se pudo eliminar el beneficio. Intentá de nuevo.";
              return;
            }
            if (target) {
              deleteNotice.value = result.deletedCoupons
                ? `“${target.titulo}” se eliminó junto con ${couponLabel(result.deletedCoupons)}.`
                : `“${target.titulo}” se eliminó.`;
            }
            deleteDialog.value?.close();
          }}
        >
          <h2 id="benefit-delete-title" class="text-lg font-bold text-brand-navy-dark">Eliminar beneficio</h2>
          <p id="benefit-delete-description" class="text-sm text-slate-600">
            “{deleteTarget.value?.titulo}” se eliminará de forma permanente.
          </p>
          {!!deleteTarget.value?.couponCount && (
            <p class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Tiene <strong>{deleteTarget.value.couponCount === 1 ? "1 cupón emitido" : `${deleteTarget.value.couponCount} cupones emitidos`}</strong>. También se borrarán y los socios dejarán de verlos en su historial.
            </p>
          )}
          <input type="hidden" name="id" value={deleteTarget.value?.id ?? ""} />
          <input type="hidden" name="includeCoupons" value={deleteTarget.value?.couponCount ? "true" : "false"} />
          <input type="hidden" name="expectedCouponCount" value={String(deleteTarget.value?.couponCount ?? 0)} />
          {deleteError.value && <p role="alert" class="text-sm text-red-600">{deleteError.value}</p>}
          <div class="flex justify-end gap-3">
            <button type="button" disabled={deleteBenefitAction.isRunning} onClick$={() => deleteDialog.value?.close()} class="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold disabled:opacity-50 cursor-pointer">Cancelar</button>
            <button type="submit" disabled={deleteBenefitAction.isRunning} class="rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer">
              {deleteBenefitAction.isRunning
                ? "Eliminando..."
                : deleteTarget.value?.couponCount
                  ? `Eliminar beneficio y ${couponLabel(deleteTarget.value.couponCount)}`
                  : "Eliminar"}
            </button>
          </div>
        </Form>
      </dialog>
      {/* Dynamic Header Area (No duplication) */}
      <div class="flex flex-col border-b border-slate-200 pb-7 gap-5">
        <div class="w-full min-w-0 space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-navy"></span>
            <span class="text-[11px] font-extrabold tracking-widest text-slate-500 uppercase">
              Administración / Catálogo
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-navy-dark tracking-tight leading-none">
            Gestión de Beneficios
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Creá, editá y elegí los beneficios que se muestran en la portada.
          </p>
        </div>

        <div class="flex w-full min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          {/* Search Input Box */}
          <div class="relative w-full sm:w-64 sm:flex-1 sm:min-w-56">
            <input
              type="search"
              aria-label="Buscar beneficios"
              placeholder="Buscar por título, resumen o descripción..."
              value={searchQuery.value}
              onInput$={(ev) => {
                searchQuery.value = (ev.target as HTMLInputElement).value;
              }}
              class="w-full bg-slate-50 text-slate-800 text-base sm:text-xs px-4 py-3 pl-9 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all"
            />
            <LuSearch class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {searchQuery.value && (
              <button
                type="button"
                onClick$={() => {
                  searchQuery.value = "";
                }}
                aria-label="Limpiar búsqueda"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                &times;
              </button>
            )}
          </div>



          <button
            type="button"
            aria-pressed={goldFilterActive.value}
            onClick$={() => { goldFilterActive.value = !goldFilterActive.value; }}
            class={`inline-flex shrink-0 items-center justify-center gap-2 px-4 py-3 rounded-2xl border text-xs font-bold whitespace-nowrap cursor-pointer ${goldFilterActive.value ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            <LuSparkles class="w-4 h-4" /> Solo destacados
          </button>

          {/* Status Filter */}
          <div class="relative w-full sm:w-44 sm:shrink-0">
            <select
              value={statusFilter.value}
              onChange$={(ev, el) => {
                statusFilter.value = el.value as any;
              }}
              class="w-full bg-white text-slate-700 text-base sm:text-xs px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:outline-none transition-all cursor-pointer font-bold shadow-sm"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Borradores</option>
            </select>
          </div>

          <button
            type="button"
            aria-expanded={isCreateBenefitOpen.value}
            onClick$={async () => {
              const opening = !isCreateBenefitOpen.value;
              await closeEditBenefit$();
              await resetCreateState$();
              isCreateBenefitOpen.value = opening;
              if (opening) revealForm("benefit-create-form");
            }}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
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
        {deleteNotice.value && (
          <div role="status" class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm">
            {deleteNotice.value}
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

        <ActionFeedback value={toggleBenefitActiveAction.value} success={toggleNotice.value} />
        <datalist id="benefit-resumen-suggestions">
          {resumenSuggestions.value.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>

        {/* Form Modal Panel */}
        {isCreateBenefitOpen.value && (
          <Form id="benefit-create-form" key={`create-${createFormKey.value}`} action={createBenefitAction} enctype="multipart/form-data" class="scroll-mt-6 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-5 animate-in slide-in-from-top-6 duration-300">
            <h4 class="text-sm font-bold text-slate-800 uppercase tracking-wider">
              {createSourceTitle.value ? "Duplicar beneficio" : "Nuevo Beneficio Propio"}
            </h4>
            {createSourceTitle.value && (
              <p class="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                Copia de «{createSourceTitle.value}». Se guarda como borrador: revisá los datos antes de publicarla.
              </p>
            )}
            {createBenefitAction.value?.failed && (
              <p role="alert" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {createBenefitAction.value.message || Object.values(createBenefitAction.value.fieldErrors || {}).join(" ") || "No se pudo crear el beneficio. Revisá los datos e intentá de nuevo."}
              </p>
            )}
            <input type="hidden" name="copiedImage" value={createCopiedImage.value} />
            <input type="hidden" name="copiedMobileImage" value={createCopiedMobileImage.value} />

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label for="create-titulo" class={fieldLabelClass}>Título</label>
                <input
                  id="create-titulo"
                  type="text"
                  name="titulo"
                  required
                  minLength={3}
                  value={createPreviewTitulo.value}
                  placeholder="Ej: Spa Platense Masajes"
                  onInput$={(_, el) => { createPreviewTitulo.value = el.value; }}
                  class={fieldClass}
                />
                {createDuplicate.value && (
                  <p role="status" class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Ya existe «{createDuplicate.value.titulo}» ({isDraftBenefit(createDuplicate.value.validUntil) ? "Borrador" : "Activo"}).{" "}
                    <button type="button" onClick$={() => createDuplicate.value && openEditBenefit$(createDuplicate.value)} class="font-bold underline cursor-pointer">
                      Editar ese beneficio
                    </button>
                  </p>
                )}
              </div>

              <ResumenField id="create-resumen" value={createPreviewResumen} offer={createOfferDescription.value} listId="benefit-resumen-suggestions" />
            </div>

            <div class="space-y-1">
              <label for="create-descripcion" class={fieldLabelClass}>Descripción Detallada</label>
              <textarea
                id="create-descripcion"
                name="descripcion"
                required
                minLength={5}
                rows={3}
                value={createPreviewDescripcion.value}
                placeholder="Escribí los detalles completos del descuento, dirección y condiciones..."
                onInput$={(_, el) => { createPreviewDescripcion.value = el.value; }}
                class={fieldClass}
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
                  class={`${fieldClass} cursor-pointer`}
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
                  class={`${fieldClass} cursor-pointer`}
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
                  class={`${fieldClass} cursor-pointer`}
                >
                  {adminFilters.value.ofertas.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.descripcion}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ValidityFields
              idPrefix="create"
              validUntil={createValidity.value.validUntil}
              terms={createValidity.value.terms}
              isPremiumOnly={createValidity.value.isPremiumOnly}
              couponCode={createValidity.value.couponCode}
            />

            <CoordinateFields idPrefix="create" latitud={createLatitud} longitud={createLongitud} />

            {/* Imagen Destacada y Documentación PDF */}
            <div class="border-t border-slate-100 pt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Imagen Ilustrativa del Beneficio */}
              <div class="space-y-4">
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <LuImage class="w-4 h-4 text-brand-navy" />
                  Imagen Desktop (16:9)
                </h4>
                <input type="hidden" name="optimizedImage" value={createOptimizedImageBase64.value} />
                <div class="space-y-2">
                  <span class={fieldLabelClass}>Subir Imagen Desktop</span>
                  <div class="flex items-center gap-4">
                    <div class="w-20 h-20 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                      {createImagePreviewUrl.value ? (
                        <img src={previewSrc(createImagePreviewUrl.value)} alt="Vista previa" class="w-full h-full object-cover" width={80} height={80} />
                      ) : (
                        <LuImage class="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div class="flex flex-col gap-2">
                      <label class="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-extrabold rounded-2xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                        <LuImage class="w-4 h-4 text-brand-navy" />
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
                            createCopiedImage.value = "";
                            const input = document.getElementById("create-image-file-input") as HTMLInputElement;
                            if (input) input.value = "";
                          }}
                          class="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 text-[11px] font-extrabold rounded-xl transition-all inline-flex items-center justify-center shadow-sm"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                  <p class="text-[11px] text-slate-500 font-medium">PNG, JPG o WebP. Auto-optimizado.</p>
                </div>
              </div>

              {/* Imagen Ilustrativa Mobile */}
              <div class="space-y-4">
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <LuSmartphone class="w-4 h-4 text-brand-navy" />
                  Imagen Mobile (Vertical)
                </h4>
                <input type="hidden" name="optimizedMobileImage" value={createOptimizedMobileImageBase64.value} />
                <div class="space-y-2">
                  <span class={fieldLabelClass}>Subir Imagen Mobile</span>
                  <div class="flex items-center gap-4">
                    <div class="w-20 h-20 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                      {createImageMobilePreviewUrl.value ? (
                        <img src={previewSrc(createImageMobilePreviewUrl.value)} alt="Vista previa móvil" class="w-full h-full object-cover" width={80} height={80} />
                      ) : (
                        <LuSmartphone class="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div class="flex flex-col gap-2">
                      <label class="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-extrabold rounded-2xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                        <LuSmartphone class="w-4 h-4 text-brand-navy" />
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
                            createCopiedMobileImage.value = "";
                            const input = document.getElementById("create-image-mobile-file-input") as HTMLInputElement;
                            if (input) input.value = "";
                          }}
                          class="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 text-[11px] font-extrabold rounded-xl transition-all inline-flex items-center justify-center shadow-sm"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                  <p class="text-[11px] text-slate-500 font-medium">Relación vertical/cuadrada recomendada.</p>
                </div>
              </div>

              {/* Documentación PDF Widget */}
              <div class="space-y-4">
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <svg class="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9.5 6H10v1.5H8.5V9H7v5h1.5v-2H10v2h1.5V9H9.5zm5 2c0-.55-.45-1-1-1H12v5h1.5v-1.5h1c.55 0 1-.45 1-1V11zm-1.5 1.5V11h1v2h-1zm5-2.5h-2.5v5H17v-2h1.5v-1.5H17V11h2.5V9z"/>
                  </svg>
                  Documentación / Catálogo (PDF)
                </h4>
                <div class="space-y-2">
                  <label for="create-pdf-file-input" class={fieldLabelClass}>Subir Archivo PDF</label>
                  <input
                    id="create-pdf-file-input"
                    type="file"
                    name="pdfFile"
                    accept="application/pdf"
                    class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all cursor-pointer font-medium"
                  />
                  <p class="text-[11px] text-slate-500 font-medium">Subí la lista de precios, menú o bases y condiciones.</p>
                </div>
              </div>
            </div>

            <BenefitPreview
              title={createPreviewTitulo.value || "Nombre del Comercio"}
              summary={createPreviewResumen.value || "20% de descuento"}
              description={createPreviewDescripcion.value || "Breve descripción de las condiciones del beneficio..."}
              image={createImagePreviewUrl.value ? previewSrc(createImagePreviewUrl.value) : null}
              mobileImage={createImageMobilePreviewUrl.value ? previewSrc(createImageMobilePreviewUrl.value) : null}
              category={createPreviewCategory.value}
              location={createPreviewLocation.value}
            />
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
              <p><strong>Beneficios destacados:</strong> la portada muestra hasta 6 beneficios activos marcados, empezando por los más recientes.</p>
              <p><strong>Nuevos beneficios:</strong> muestra los 6 activos más recientes por fecha de creación. Un beneficio puede aparecer en ambas secciones.</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isFeatured"
                  name="isFeatured"
                  checked={createPreviewIsFeatured.value}
                  onChange$={(e, el) => { createPreviewIsFeatured.value = el.checked; }}
                  class="rounded border-slate-300 text-brand-navy focus:ring-brand-navy h-4 w-4"
                />
                <label for="isFeatured" class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                  <LuSparkles class="w-4 h-4 text-brand-gold fill-brand-gold animate-pulse" />
                  <span>Mostrar en Beneficios destacados</span>
                </label>
              </div>

              <div class="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={createIsActive.value}
                  class="rounded border-slate-300 text-brand-navy focus:ring-brand-navy h-4 w-4"
                />
                <label for="isActive" class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                  <span class="w-2.5 h-2.5 rounded-full bg-brand-navy"></span>
                  <span>Publicar (Activo)</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={createBenefitAction.isRunning}
              class="py-3 px-6 rounded-2xl bg-brand-navy hover:bg-brand-navy-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
            >
              {createBenefitAction.isRunning ? "Creando..." : "Crear Beneficio"}
            </button>
          </Form>
        )}

        {/* Form Modal Panel for Edit */}
        {editingBenefit.value && (
          <Form id="benefit-edit-form" key={editingBenefit.value.id} action={editBenefitAction} enctype="multipart/form-data" class="scroll-mt-6 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-5 animate-in slide-in-from-top-6 duration-300">
            <h4 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Modificar Beneficio Propio</h4>
            {editBenefitAction.value?.failed && (
              <p role="alert" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editBenefitAction.value.message || Object.values(editBenefitAction.value.fieldErrors || {}).join(" ") || "No se pudieron guardar los cambios. Revisá los datos e intentá de nuevo."}
              </p>
            )}
            <input type="hidden" name="id" value={editingBenefit.value.id} />

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label for="edit-titulo" class={fieldLabelClass}>Título</label>
                <input
                  id="edit-titulo"
                  type="text"
                  name="titulo"
                  required
                  minLength={3}
                  value={editingBenefit.value.titulo}
                  placeholder="Ej: Spa Platense Masajes"
                  onInput$={(_, el) => { editPreviewTitulo.value = el.value; }}
                  class={fieldClass}
                />
                {editDuplicate.value && (
                  <p role="status" class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Ya existe otro «{editDuplicate.value.titulo}» ({isDraftBenefit(editDuplicate.value.validUntil) ? "Borrador" : "Activo"}).
                  </p>
                )}
              </div>

              <ResumenField id="edit-resumen" value={editPreviewResumen} offer={editOfferDescription.value} listId="benefit-resumen-suggestions" />
            </div>

            <div class="space-y-1">
              <label for="edit-descripcion" class={fieldLabelClass}>Descripción Detallada</label>
              <textarea
                id="edit-descripcion"
                name="descripcion"
                required
                minLength={5}
                rows={3}
                value={editingBenefit.value.descripcion}
                placeholder="Escribí los detalles completos del descuento, dirección y condiciones..."
                onInput$={(_, el) => { editPreviewDescripcion.value = el.value; }}
                class={fieldClass}
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
                  class={`${fieldClass} cursor-pointer`}
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
                  class={`${fieldClass} cursor-pointer`}
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
                  class={`${fieldClass} cursor-pointer`}
                >
                  {adminFilters.value.ofertas.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.descripcion}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ValidityFields
              idPrefix="edit"
              validUntil={dateInputValue(editingBenefit.value.validUntil)}
              terms={editingBenefit.value.terms || ""}
              isPremiumOnly={editingBenefit.value.isPremiumOnly}
              couponCode={editingBenefit.value.couponCode || ""}
            />

            <CoordinateFields idPrefix="edit" latitud={editLatitud} longitud={editLongitud} />

            {/* Imagen Destacada y Documentación PDF */}
            <div class="border-t border-slate-100 pt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Imagen Ilustrativa Desktop */}
              <div class="space-y-4">
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <LuImage class="w-4 h-4 text-brand-navy" />
                  Imagen Desktop (16:9)
                </h4>
                <input type="hidden" name="optimizedImage" value={editOptimizedImageBase64.value} />
                <input type="hidden" name="clearImage" value={editIsImageDeleted.value ? "true" : "false"} />
                <div class="space-y-2">
                  <span class={fieldLabelClass}>Subir Nueva Imagen</span>
                  <div class="flex items-center gap-4">
                    <div class="w-20 h-20 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                      {editImagePreviewUrl.value && !editIsImageDeleted.value ? (
                        <img src={previewSrc(editImagePreviewUrl.value)} alt="Vista previa" class="w-full h-full object-cover" width={80} height={80} />
                      ) : (
                        <LuImage class="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div class="flex flex-col gap-2">
                      <label class="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-extrabold rounded-2xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                        <LuImage class="w-4 h-4 text-brand-navy" />
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
                          class="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 text-[11px] font-extrabold rounded-xl transition-all inline-flex items-center justify-center shadow-sm"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                  <p class="text-[11px] text-slate-500 font-medium">Recomendado horizontal (800x450 px).</p>
                </div>
              </div>

              {/* Imagen Ilustrativa Mobile */}
              <div class="space-y-4">
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <LuSmartphone class="w-4 h-4 text-brand-navy" />
                  Imagen Mobile (Vertical)
                </h4>
                <input type="hidden" name="optimizedMobileImage" value={editOptimizedMobileImageBase64.value} />
                <input type="hidden" name="clearMobileImage" value={editIsMobileImageDeleted.value ? "true" : "false"} />
                <div class="space-y-2">
                  <span class={fieldLabelClass}>Subir Imagen Mobile</span>
                  <div class="flex items-center gap-4">
                    <div class="w-20 h-20 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                      {editImageMobilePreviewUrl.value && !editIsMobileImageDeleted.value ? (
                        <img src={previewSrc(editImageMobilePreviewUrl.value)} alt="Vista previa móvil" class="w-full h-full object-cover" width={80} height={80} />
                      ) : (
                        <LuSmartphone class="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div class="flex flex-col gap-2">
                      <label class="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-extrabold rounded-2xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                        <LuSmartphone class="w-4 h-4 text-brand-navy" />
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
                          class="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 text-[11px] font-extrabold rounded-xl transition-all inline-flex items-center justify-center shadow-sm"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                  <p class="text-[11px] text-slate-500 font-medium">Recomendado vertical/cuadrada (600x600 px).</p>
                </div>
              </div>

              {/* Documentación PDF Widget */}
              <div class="space-y-4">
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <svg class="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9.5 6H10v1.5H8.5V9H7v5h1.5v-2H10v2h1.5V9H9.5zm5 2c0-.55-.45-1-1-1H12v5h1.5v-1.5h1c.55 0 1-.45 1-1V11zm-1.5 1.5V11h1v2h-1zm5-2.5h-2.5v5H17v-2h1.5v-1.5H17V11h2.5V9z"/>
                  </svg>
                  Documentación / Catálogo (PDF)
                </h4>
                <input type="hidden" name="clearPdf" value={editIsPdfDeleted.value ? "true" : "false"} />
                <div class="space-y-2">
                  <label for="edit-pdf-file-input" class={fieldLabelClass}>Subir Nuevo PDF</label>
                  <div class="flex flex-col gap-2">
                    <input
                      id="edit-pdf-file-input"
                      type="file"
                      name="pdfFile"
                      accept="application/pdf"
                      onChange$={() => {
                        editIsPdfDeleted.value = false;
                      }}
                      class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none transition-all cursor-pointer font-medium"
                    />

                    {editingBenefit.value.pdfUrl && !editIsPdfDeleted.value && (
                      <div class="flex items-center justify-between bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
                        <span class="text-xs font-semibold text-slate-600 truncate max-w-[200px]" title={editingBenefit.value.pdfUrl.split('/').pop()}>
                          📄 {editingBenefit.value.pdfUrl.split('/').pop()}
                        </span>
                        <button
                          type="button"
                          onClick$={() => {
                            editIsPdfDeleted.value = true;
                            const input = document.getElementById("edit-pdf-file-input") as HTMLInputElement;
                            if (input) input.value = "";
                          }}
                          class="text-[11px] text-red-600 hover:underline font-bold"
                        >
                          Eliminar PDF
                        </button>
                      </div>
                    )}
                    {editingBenefit.value.pdfUrl && editIsPdfDeleted.value && (
                      <p class="text-[11px] font-bold text-amber-800">El PDF se va a quitar al guardar.</p>
                    )}
                  </div>
                  <p class="text-[11px] text-slate-500 font-medium">Subí la lista de precios o menú.</p>
                </div>
              </div>
            </div>

            <BenefitPreview
              title={editPreviewTitulo.value}
              summary={editPreviewResumen.value}
              description={editPreviewDescripcion.value}
              image={editIsImageDeleted.value || !editImagePreviewUrl.value ? null : previewSrc(editImagePreviewUrl.value)}
              mobileImage={editIsMobileImageDeleted.value || !editImageMobilePreviewUrl.value ? null : previewSrc(editImageMobilePreviewUrl.value)}
              category={editPreviewCategory.value}
              location={editPreviewLocation.value}
            />
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
              <p><strong>Beneficios destacados:</strong> la portada muestra hasta 6 beneficios activos marcados, empezando por los más recientes.</p>
              <p><strong>Nuevos beneficios:</strong> muestra los 6 activos más recientes por fecha de creación. Un beneficio puede aparecer en ambas secciones.</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="edit_isFeatured"
                  name="isFeatured"
                  checked={editPreviewIsFeatured.value}
                  onChange$={(e, el) => { editPreviewIsFeatured.value = el.checked; }}
                  class="rounded border-slate-300 text-brand-navy focus:ring-brand-navy h-4 w-4"
                />
                <label for="edit_isFeatured" class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                  <LuSparkles class="w-4 h-4 text-brand-gold fill-brand-gold animate-pulse" />
                  <span>Mostrar en Beneficios destacados</span>
                </label>
              </div>

              <div class="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="edit_isActive"
                  name="isActive"
                  defaultChecked={!isDraftBenefit(editingBenefit.value.validUntil)}
                  class="rounded border-slate-300 text-brand-navy focus:ring-brand-navy h-4 w-4"
                />
                <label for="edit_isActive" class="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                  <span class="w-2.5 h-2.5 rounded-full bg-brand-navy"></span>
                  <span>Publicar (Activo)</span>
                </label>
              </div>
            </div>

            <div class="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={editBenefitAction.isRunning}
                class="py-3 px-6 rounded-2xl bg-brand-navy hover:bg-brand-navy-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
              >
                {editBenefitAction.isRunning ? "Guardando..." : "Guardar Cambios"}
              </button>
              <button
                type="button"
                onClick$={closeEditBenefit$}
                class="py-3 px-6 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold shadow-sm transition-all duration-300 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </Form>
        )}

        {/* List of custom benefits: cards on phones, table from `sm` up */}
        <div class="rounded-3xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden">
          {paginatedBenefits.value.length === 0 ? (
            <div class="px-6 py-12 text-center text-sm text-slate-500">
              <div class="flex items-center justify-center gap-2">
                <LuTicket class="w-5 h-5 text-purple-400" />
                <span>{benefits.value.length ? "No hay beneficios que coincidan con los filtros." : 'Aún no has creado beneficios propios. Hacé clic en "Crear Beneficio" para registrar el primero.'}</span>
              </div>
            </div>
          ) : (
            <>
              <ul class="divide-y divide-slate-100 sm:hidden">
                {paginatedBenefits.value.map((benefit) => {
                  const filters = describeFilters(benefit);
                  return (
                    <li key={benefit.id} class="space-y-3 p-4">
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0 space-y-1.5">
                          <p class="font-bold text-slate-800 break-words">{benefit.titulo}</p>
                          <div class="flex flex-wrap gap-1.5">{renderBadges(benefit)}</div>
                        </div>
                        {renderRowActions(benefit)}
                      </div>
                      <p class="text-sm text-slate-600">{benefit.resumen}</p>
                      <p class="text-xs text-slate-500">
                        <span class="font-bold">{filters.category}</span> · {filters.location}
                      </p>
                      {renderStatusToggle(benefit)}
                    </li>
                  );
                })}
              </ul>

              <div class="hidden sm:block overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr class="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                      <th class="px-6 py-4">Título</th>
                      <th class="px-6 py-4">Resumen / Desc.</th>
                      <th class="px-6 py-4">Filtros (Categoría/Ubicación)</th>
                      <th class="px-6 py-4 text-center">Estado</th>
                      <th class="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 font-medium">
                    {paginatedBenefits.value.map((benefit) => {
                      const filters = describeFilters(benefit);
                      return (
                        <tr key={benefit.id} class="hover:bg-slate-50 transition-colors">
                          <td class="px-6 py-4 font-bold text-slate-800">
                            <div class="flex flex-wrap items-center gap-2">
                              <span>{benefit.titulo}</span>
                              {renderBadges(benefit)}
                            </div>
                          </td>
                          <td class="px-6 py-4 text-slate-500">{benefit.resumen}</td>
                          <td class="px-6 py-4 text-slate-500 font-bold">
                            {filters.category} <span class="text-slate-300 mx-1">|</span> <span class="font-normal text-slate-500">{filters.location}</span>
                          </td>
                          <td class="px-6 py-4 text-center">
                            <div class="flex items-center justify-center">{renderStatusToggle(benefit)}</div>
                          </td>
                          <td class="px-6 py-4 text-center">{renderRowActions(benefit)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

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
                  class="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-slate-600"
                  title="Página Anterior"
                >
                  <LuChevronLeft class="w-4 h-4" />
                </button>
                <button
                  onClick$={() => changePage(currentPage.value + 1)}
                  disabled={currentPage.value === totalPages.value}
                  class="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-slate-600"
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
