import { component$, Slot, useSignal, useStore, useComputed$, useTask$, $, type QRL, type Signal } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, useLocation, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import {
  LuCalendarClock,
  LuChevronLeft,
  LuChevronRight,
  LuClock,
  LuCopy,
  LuExternalLink,
  LuFileText,
  LuGlobe,
  LuImage,
  LuInstagram,
  LuMapPin,
  LuMapPinOff,
  LuMessageCircle,
  LuPencil,
  LuPhone,
  LuPlus,
  LuSearch,
  LuSmartphone,
  LuSparkles,
  LuTicket,
  LuTrash2,
  LuX,
} from "@qwikest/icons/lucide";
import { eq } from "drizzle-orm";
import { putImage, putMedia } from "~/server/media";
import { getDB } from "~/db";
import { benefits as benefitsTable } from "~/db/schema";
import { getFilters, type Benefit } from "~/server/cache";
import { loadAdminBenefits, type AdminBenefitRow, type FeaturedPlacement } from "~/server/admin-benefits";
import { BenefitCard } from "~/components/ui/BenefitCard";
import { createBenefitFilter, validateBenefitFilterSelection, BenefitFilterValidationError, type BenefitFilterType } from "~/server/benefit-filters";
import { deleteBenefit } from "~/server/coupons";
import { ActionFeedback, Notice } from "~/components/admin/action-feedback";
import { AdminPageHeader } from "~/components/admin/page-header";
import { isDraftBenefit, parseValidUntil } from "~/utils/benefit-status";
import {
  EXPIRING_SOON_DAYS,
  RESUMEN_MAX_LENGTH,
  argentinaDay,
  benefitValidity,
  benefitValuesFromForm,
  findDuplicateTitle,
  formatValidUntil,
  hasCoordinates,
  merchantFieldError,
  normalizeResumen,
  normalizeTitle,
  parseCoordinateFields,
  parseMapsLink,
  parseMerchantFields,
  percentIn,
  resumenContradictsOffer,
  withPublishedState,
  type MerchantField,
} from "~/utils/benefit-admin";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

const filterEditorLabels = {
  categorias: { title: "Nueva categoría", placeholder: "Ej: Veterinarias" },
  ubicaciones: { title: "Nueva ubicación", placeholder: "Ej: City Bell" },
  ofertas: { title: "Nuevo descuento", placeholder: "Ej: 25% o 2x1" },
};

const couponLabel = (count: number) => (count === 1 ? "1 cupón" : `${count} cupones`);

type FieldErrors = Record<string, string | undefined>;
type StatusFilter = "all" | "published" | "draft";
type ValidityFilter = "all" | "vencido" | "vence-pronto";

const fieldLabelClass = "field-label";
const hintClass = "mt-1 text-xs text-slate-600";
const iconButtonClass =
  "inline-flex h-10 w-10 items-center justify-center text-slate-600 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary cursor-pointer";

const featuredLabels: Record<FeaturedPlacement, { label: string; detail: string }> = {
  home: { label: "En portada", detail: "Está entre los 6 beneficios destacados de la portada." },
  overflow: { label: "Fuera de los 6", detail: "Marcado como destacado. Otros 6 publicados y vigentes tienen prioridad por fecha de creación. Sigue en el catálogo." },
  draft: { label: "Destacado · Borrador", detail: "Marcado como destacado. Publicalo para que participe de la selección de portada." },
  expired: { label: "Destacado · Vencido", detail: "Marcado como destacado. No aparece en portada ni en el catálogo porque venció." },
};

/** Date inputs only take YYYY-MM-DD; a stored ISO instant keeps its day. */
const dateInputValue = (raw: string | null | undefined) => parseValidUntil(raw).validUntil?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";

/** Legacy rows store bare file names served by the old site. */
const previewSrc = (url: string) =>
  /^(data:|blob:|https?:|\/)/.test(url) ? url : `https://beneficios.lprc.ar/files/${url}`;

const describeError = (id: string, error?: string, hint?: string) =>
  [error ? `${id}-error` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;

/** Brings an opened form into view and focuses its first field, once it has rendered. */
const revealForm = (id: string, attempt = 0): void => {
  setTimeout(() => {
    const form = document.getElementById(id);
    if (!form) {
      if (attempt < 20) revealForm(id, attempt + 1);
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    form.querySelector<HTMLInputElement>("input:not([type=hidden])")?.focus({ preventScroll: true });
  }, 60);
};

/** After a failed save, take the admin to the first field that needs attention (once it renders). */
const focusFirstInvalid = (formId: string, attempt = 0): void => {
  setTimeout(() => {
    const form = document.getElementById(formId);
    const target = form?.querySelector<HTMLElement>("[aria-invalid='true']") ?? form?.querySelector<HTMLElement>("[data-form-error]");
    if (!target) {
      if (attempt < 20) focusFirstInvalid(formId, attempt + 1);
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    target.focus({ preventScroll: true });
  }, 50);
};

/** Shrinks uploads in the browser to WebP so the server stores light images; SVG stays as is. */
const optimizeImage = (file: File, maxW: number, maxH: number) =>
  new Promise<{ preview: string; optimized: string }>((resolve, reject) => {
    if (file.type === "image/svg+xml") {
      resolve({ preview: URL.createObjectURL(file), optimized: "" });
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo leer la imagen."));
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width, maxH / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No se pudo procesar la imagen."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/webp", 0.85);
        resolve({ preview: dataUrl, optimized: dataUrl });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

/** Message under a field; plain JSX so it always follows the latest action result. */
const fieldError = (id: string, message?: string) =>
  message ? (
    <p id={`${id}-error`} class="mt-1 text-xs font-semibold text-red-700">
      {message}
    </p>
  ) : null;

const FormSection = component$<{ title: string; description?: string; first?: boolean }>((props) => (
  <div class={props.first ? "" : "border-t border-line pt-6"}>
    <fieldset class="min-w-0">
      <legend class="heading-display text-lg text-primary">{props.title}</legend>
      {props.description && <p class="mt-0.5 text-sm text-slate-600">{props.description}</p>}
      <div class="mt-4 space-y-4">
        <Slot />
      </div>
    </fieldset>
  </div>
));

const FilterFieldLabel = component$<{ id: string; label: string; onAdd$: QRL<() => void> }>((props) => (
  <div class="flex items-end justify-between gap-2">
    <label for={props.id} class={fieldLabelClass}>{props.label}</label>
    <button
      type="button"
      onClick$={props.onAdd$}
      aria-label={`Agregar ${props.label.toLowerCase()}`}
      class="mb-1 inline-flex min-h-8 items-center gap-1 px-2 text-xs font-bold text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
    >
      <LuPlus class="h-3.5 w-3.5" /> Agregar
    </button>
  </div>
));

const ResumenField = component$<{ id: string; value: Signal<string>; offer?: string; listId: string; error?: string }>((props) => {
  const length = props.value.value.length;
  const offerText = props.offer ? normalizeResumen(props.offer) : "";
  const badgePercent = percentIn(props.value.value);
  const offerPercent = percentIn(props.offer);
  return (
    <div>
      <div class="flex items-end justify-between gap-2">
        <label for={props.id} class={fieldLabelClass}>Texto del badge</label>
        <span class={`mb-1.5 text-xs font-bold tabular-nums ${length > RESUMEN_MAX_LENGTH - 5 ? "text-amber-900" : "text-slate-500"}`}>
          {length}/{RESUMEN_MAX_LENGTH}
        </span>
      </div>
      <input
        id={props.id}
        type="text"
        name="resumen"
        maxLength={RESUMEN_MAX_LENGTH}
        // Qwik's input typings lack `list`; it links the <datalist> of suggested badges.
        {...{ list: props.listId }}
        value={props.value.value}
        placeholder="Ej: 20% Off o 2x1"
        aria-invalid={props.error ? "true" : undefined}
        aria-describedby={describeError(props.id, props.error, "hint")}
        onInput$={(_, el) => { props.value.value = el.value; }}
        class="field"
      />
      {fieldError(props.id, props.error)}
      <p id={`${props.id}-hint`} class={hintClass}>Texto corto que se ve sobre la foto. Se guarda sin espacios de más (“10 % Off” → “10% Off”).</p>
      {offerText && normalizeResumen(props.value.value) !== offerText && (
        <button type="button" onClick$={() => { props.value.value = offerText; }} class="mt-1 text-xs font-bold text-primary underline cursor-pointer">
          Usar «{offerText}»
        </button>
      )}
      {resumenContradictsOffer(props.value.value, props.offer) && (
        <p class="mt-1 text-xs font-bold text-amber-900">
          El badge dice {badgePercent}% pero el descuento elegido es {offerPercent}%. Revisá cuál corresponde.
        </p>
      )}
    </div>
  );
});

const CoordinateFields = component$<{ idPrefix: string; latitud: Signal<string>; longitud: Signal<string>; errors: FieldErrors }>((props) => {
  const mapsStatus = useSignal<"" | "ok" | "error">("");
  const result = parseCoordinateFields(props.latitud.value, props.longitud.value);
  const live = result.ok ? {} : result.errors;
  const errors = { latitud: live.latitud ?? props.errors.latitud, longitud: live.longitud ?? props.errors.longitud };
  return (
    <div class="space-y-4">
      <div>
        <label for={`${props.idPrefix}-maps-link`} class={fieldLabelClass}>Link de Google Maps (opcional)</label>
        <input
          id={`${props.idPrefix}-maps-link`}
          type="url"
          inputMode="url"
          placeholder="Pegá el link del lugar y completamos las coordenadas"
          aria-describedby={`${props.idPrefix}-maps-link-status`}
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
          class="field"
        />
        <div id={`${props.idPrefix}-maps-link-status`} aria-live="polite">
          {mapsStatus.value === "ok" && <p class="mt-1 text-xs font-bold text-green-800">Coordenadas completadas desde el link.</p>}
          {mapsStatus.value === "error" && (
            <p class="mt-1 text-xs font-bold text-amber-900">
              No encontramos coordenadas en ese link. Abrí el lugar en Google Maps desde la computadora y copiá la dirección completa de la barra; los links cortos (maps.app.goo.gl) no las incluyen.
            </p>
          )}
        </div>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(["latitud", "longitud"] as const).map((field) => (
          <div key={field}>
            <label for={`${props.idPrefix}-${field}`} class={fieldLabelClass}>{field === "latitud" ? "Latitud" : "Longitud"}</label>
            <input
              id={`${props.idPrefix}-${field}`}
              type="text"
              name={field}
              inputMode="decimal"
              value={props[field].value}
              placeholder={field === "latitud" ? "Ej: -34.9205" : "Ej: -57.9536"}
              aria-invalid={errors[field] ? "true" : undefined}
              aria-describedby={describeError(`${props.idPrefix}-${field}`, errors[field])}
              onInput$={(_, el) => { props[field].value = el.value; }}
              class="field font-mono"
            />
            {fieldError(`${props.idPrefix}-${field}`, errors[field])}
          </div>
        ))}
      </div>
      <p class="text-xs text-slate-600">Si dejás las dos vacías, el beneficio no aparece en el mapa “Cerca mío”.</p>
    </div>
  );
});

interface ImageUploadProps {
  id: string;
  name: string;
  label: string;
  hint: string;
  preview: string | null;
  vertical?: boolean;
  onPick$: QRL<(file: File) => void>;
  onRemove$: QRL<() => void>;
}

const ImageUpload = component$<ImageUploadProps>((props) => (
  <div class="space-y-2">
    <span class={fieldLabelClass} id={`${props.id}-label`}>{props.label}</span>
    <div class="flex items-center gap-4">
      <div class={["flex shrink-0 items-center justify-center overflow-hidden border border-line bg-slate-100", props.vertical ? "h-24 w-20" : "h-20 w-32"]}>
        {props.preview ? (
          <img src={previewSrc(props.preview)} alt="" class="h-full w-full object-cover" width={128} height={80} />
        ) : props.vertical ? (
          <LuSmartphone class="h-6 w-6 text-slate-400" />
        ) : (
          <LuImage class="h-6 w-6 text-slate-400" />
        )}
      </div>
      <div class="flex flex-col gap-2">
        <input
          id={props.id}
          type="file"
          name={props.name}
          accept="image/*"
          aria-describedby={`${props.id}-hint`}
          onChange$={(_, el) => { if (el.files?.[0]) props.onPick$(el.files[0]); }}
          class="peer sr-only"
        />
        <label for={props.id} class="btn btn-outline btn-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
          {props.preview ? "Cambiar" : "Elegir imagen"}
        </label>
        {props.preview && (
          <button type="button" onClick$={props.onRemove$} class="text-left text-xs font-bold text-red-700 underline cursor-pointer">
            Quitar imagen
          </button>
        )}
      </div>
    </div>
    <p id={`${props.id}-hint`} class={hintClass}>{props.hint}</p>
  </div>
));

const CONTACT_ICONS = {
  phone: () => <LuPhone class="h-4 w-4" />,
  whatsapp: () => <LuMessageCircle class="h-4 w-4" />,
  instagram: () => <LuInstagram class="h-4 w-4" />,
  website: () => <LuGlobe class="h-4 w-4" />,
};

interface PreviewData {
  title: string;
  summary: string;
  description: string;
  image: string | null;
  mobileImage: string | null;
  category: string;
  location: string;
  isPremiumOnly: boolean;
  validUntil: string;
  terms: string;
  couponCode: string;
  address: string;
  hours: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  website: string;
}

const BenefitPreview = component$<{ data: PreviewData; slug: string | null; isDraft: boolean }>(({ data, slug, isDraft }) => {
  const benefit: Benefit = {
    id: 0,
    url: "vista-previa",
    titulo: data.title || "Nombre del comercio",
    resumen: data.summary || "20% Off",
    descripcion: data.description || "Detalles del beneficio...",
    imagen: data.image,
    imagenMobile: data.mobileImage,
    latitud: null,
    longitud: null,
    categorias: [{ id: 0, descripcion: data.category || "Categoría" }],
    ubicacion: [{ id: 0, descripcion: data.location || "La Plata" }],
    ofertas: [],
    isPremiumOnly: data.isPremiumOnly,
    address: data.address || null,
  };
  const expires = formatValidUntil(data.validUntil);
  const instagramHandle = data.instagram.match(/instagram\.com\/([^/?#]+)/i)?.[1] ?? data.instagram.replace(/^@/, "");
  const contacts = [
    { kind: "phone" as const, label: data.phone },
    { kind: "whatsapp" as const, label: data.whatsapp && `WhatsApp ${data.whatsapp}` },
    { kind: "instagram" as const, label: data.instagram && `@${instagramHandle}` },
    { kind: "website" as const, label: data.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") },
  ].filter((contact) => contact.label);

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between gap-3">
        <h3 class="heading-display text-lg text-primary">Vista previa</h3>
        {slug ? (
          <a href={`/beneficio/${slug}/`} target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-sm font-bold text-primary underline">
            {isDraft ? "Ver ficha (borrador)" : "Ver ficha publicada"}
            <LuExternalLink class="h-4 w-4" />
            <span class="sr-only"> (se abre en otra pestaña)</span>
          </a>
        ) : (
          <span class="text-xs text-slate-600">La ficha se crea al guardar.</span>
        )}
      </div>

      <div class="space-y-2">
        <p class="eyebrow text-[11px] text-slate-600">Tarjeta en el listado</p>
        <div inert class="max-w-[320px]">
          <BenefitCard benefit={benefit} />
        </div>
      </div>

      <div class="space-y-2">
        <p class="eyebrow text-[11px] text-slate-600">Ficha del beneficio</p>
        <article inert class="border border-line bg-white">
          {data.image ? (
            <img src={data.image} alt="" width={640} height={360} class="aspect-video w-full object-cover" />
          ) : (
            <div class="flex aspect-video w-full items-center justify-center bg-slate-100 text-xs text-slate-500">Sin imagen</div>
          )}
          <div class="space-y-3 p-4">
            <p class="eyebrow text-[10px] text-amber-900">{benefit.categorias[0].descripcion} · {benefit.ubicacion[0].descripcion}</p>
            <h4 class="heading-display text-2xl text-primary break-words">{benefit.titulo}</h4>
            <div class="flex flex-wrap gap-1.5">
              <span class="badge badge-accent">{normalizeResumen(benefit.resumen)}</span>
              {data.isPremiumOnly && <span class="badge badge-dark">Solo Gold</span>}
            </div>
            <p class="flex items-center gap-1.5 text-sm text-slate-700">
              <LuCalendarClock class="h-4 w-4 shrink-0 text-slate-500" />
              {expires ? `Válido hasta el ${expires}` : "Sin fecha de vencimiento"}
            </p>
            {data.terms && (
              <div class="border-l-4 border-accent bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <p class="font-bold text-primary">Condiciones</p>
                <p class="whitespace-pre-line">{data.terms}</p>
              </div>
            )}
            {data.couponCode && (
              <p class="text-xs text-slate-700">Código para usar online: <strong class="font-mono text-primary">{data.couponCode}</strong></p>
            )}
            {(data.address || data.hours) && (
              <ul class="space-y-1.5 border-t border-line pt-3 text-sm text-slate-700">
                {data.address && <li class="flex gap-1.5"><LuMapPin class="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />{data.address}</li>}
                {data.hours && <li class="flex gap-1.5 whitespace-pre-line"><LuClock class="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />{data.hours}</li>}
              </ul>
            )}
            {contacts.length > 0 && (
              <ul class="flex flex-wrap gap-1.5">
                {contacts.map((contact) => (
                  <li key={contact.label} class="inline-flex max-w-full items-center gap-1.5 border border-line px-2 py-1 text-xs text-primary">
                    {CONTACT_ICONS[contact.kind]()}
                    <span class="truncate">{contact.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
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
  return loadAdminBenefits(event);
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

/** Checked per field, so a bad phone is reported together with any other mistake. */
const merchantField = (field: MerchantField) =>
  z.string().optional().superRefine((value, ctx) => {
    const error = merchantFieldError(field, value);
    if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
  });

/** One action for both forms: with `id` it updates that benefit, without it creates one. */
export const useSaveBenefitAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    const coordinates = parseCoordinateFields(data.latitud, data.longitud);
    const merchant = parseMerchantFields(data);
    if (!coordinates.ok || !merchant.ok) {
      return requestEvent.fail(400, {
        message: "Revisá los campos marcados.",
        fieldErrors: { ...(coordinates.ok ? {} : coordinates.errors), ...(merchant.ok ? {} : merchant.errors) } as FieldErrors,
      });
    }

    try {
      await validateBenefitFilterSelection(requestEvent, data);
      const db = getDB(requestEvent);
      const existing = data.id
        ? (await db.select().from(benefitsTable).where(eq(benefitsTable.id, data.id)))[0]
        : undefined;
      if (data.id && !existing) return requestEvent.fail(404, { message: "Ese beneficio ya no existe. Recargá la página." });

      let pdfUrl = existing?.pdfUrl ?? null;
      if (data.pdfFile && typeof data.pdfFile === "object" && (data.pdfFile as Blob).size > 0) {
        const file = data.pdfFile as File;
        const extension = file.name.split(".").pop() || "pdf";
        pdfUrl = await putMedia(requestEvent, `benefit-pdf-${Date.now()}.${extension}`, file);
      } else if (data.clearPdf === "true") {
        pdfUrl = null;
      }

      const uploadedImage = await putImage(requestEvent, "benefit", data.optimizedImage, data.imageFile);
      const uploadedMobileImage = await putImage(requestEvent, "benefit-mobile", data.optimizedMobileImage, data.imageMobileFile);
      // An edit keeps the stored images unless removed; "Duplicar" reuses the original's.
      const imagen = uploadedImage ?? (existing ? (data.clearImage === "true" ? null : existing.imagen) : data.copiedImage || null);
      const imagenMobile = uploadedMobileImage ?? (existing ? (data.clearMobileImage === "true" ? null : existing.imagenMobile) : data.copiedMobileImage || null);

      const values = {
        ...benefitValuesFromForm(data),
        ...merchant.values,
        imagen,
        imagenMobile,
        pdfUrl,
        latitud: coordinates.latitud,
        longitud: coordinates.longitud,
      };

      if (existing) {
        await db.update(benefitsTable).set(values).where(eq(benefitsTable.id, existing.id));
        return { success: true, created: false, id: existing.id, slug: existing.slug, titulo: values.titulo };
      }

      const id = "cb-" + Date.now().toString();
      const slug = `${id}-${normalizeTitle(data.titulo).replace(/\s+/g, "-") || "beneficio"}`;
      await db.insert(benefitsTable).values({ id, slug, createdAt: new Date().toISOString(), ...values });
      return { success: true, created: true, id, slug, titulo: values.titulo };
    } catch (err: any) {
      if (err instanceof BenefitFilterValidationError) {
        return requestEvent.fail(400, {
          message: err.message,
          fieldErrors: (err.field ? { [err.field]: err.message } : {}) as FieldErrors,
        });
      }
      console.error(err);
      return requestEvent.fail(500, { message: data.id ? "No se pudieron guardar los cambios. Intentá de nuevo." : "No se pudo crear el beneficio. Intentá de nuevo." });
    }
  },
  zod$({
    id: z.string().optional(),
    titulo: z.string().trim().min(3, "Escribí un título de al menos 3 caracteres."),
    resumen: z.string().trim().min(2, "Escribí el texto del badge (al menos 2 caracteres).").max(RESUMEN_MAX_LENGTH, `El badge admite hasta ${RESUMEN_MAX_LENGTH} caracteres.`),
    descripcion: z.string().trim().min(5, "Contá en qué consiste el beneficio (al menos 5 caracteres)."),
    isFeatured: z.string().optional(),
    isPremiumOnly: z.string().optional(),
    categoryId: z.string(),
    locationId: z.string(),
    offerId: z.string(),
    validUntil: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Elegí una fecha válida.").optional(),
    isActive: z.string().optional(),
    terms: z.string().max(2000, "Las condiciones admiten hasta 2000 caracteres.").optional(),
    couponCode: z.string().max(40, "El código admite hasta 40 caracteres.").optional(),
    address: merchantField("address"),
    hours: merchantField("hours"),
    phone: merchantField("phone"),
    whatsapp: merchantField("whatsapp"),
    instagram: merchantField("instagram"),
    website: merchantField("website"),
    pdfFile: z.any().optional(),
    imageFile: z.any().optional(),
    optimizedImage: z.string().optional(),
    imageMobileFile: z.any().optional(),
    optimizedMobileImage: z.string().optional(),
    copiedImage: z.string().optional(),
    copiedMobileImage: z.string().optional(),
    clearImage: z.string().optional(),
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

// --- FORM ---

interface BenefitFormProps {
  mode: "create" | "edit";
  /** The benefit being edited, or the one "Duplicar" copies into a new draft. */
  source: AdminBenefitRow | null;
  /** Values a merchant request sends to a new benefit (/admin/solicitudes → ?nuevo=1). */
  prefill?: { titulo: string; phone: string } | null;
  onClose$: QRL<() => void>;
  /** Action state lives in the hook instance that submitted, so the form reports success up. */
  onSaved$: QRL<(notice: { text: string; slug: string }) => void>;
  onEditOther$: QRL<(row: AdminBenefitRow) => void>;
}

const BenefitForm = component$<BenefitFormProps>((props) => {
  const benefits = useAdminCustomBenefitsLoader();
  const adminFilters = useAdminFiltersLoader();
  const saveAction = useSaveBenefitAction();
  const createFilterAction = useCreateBenefitFilterAction();
  const source = props.source;
  const isEdit = props.mode === "edit" && !!source;
  const isDuplicate = props.mode === "create" && !!source;
  const formId = isEdit ? "benefit-edit-form" : "benefit-create-form";
  const p = isEdit ? "edit" : "create";

  const prefill = !source ? props.prefill ?? null : null;
  const titulo = useSignal(isDuplicate ? `${source.titulo} (copia)` : source?.titulo ?? prefill?.titulo ?? "");
  const resumen = useSignal(source?.resumen ?? "");
  const descripcion = useSignal(source?.descripcion ?? "");
  const selection = useStore({
    categorias: source ? String(source.categoryId) : String(adminFilters.value.categorias[0]?.id ?? ""),
    ubicaciones: source ? String(source.locationId) : String(adminFilters.value.ubicaciones[0]?.id ?? ""),
    ofertas: source ? String(source.offerId) : String(adminFilters.value.ofertas[0]?.id ?? ""),
  });
  const validUntil = useSignal(dateInputValue(source?.validUntil));
  const terms = useSignal(source?.terms ?? "");
  const couponCode = useSignal(source?.couponCode ?? "");
  const isPremiumOnly = useSignal(source?.isPremiumOnly ?? false);
  const isFeatured = useSignal(isDuplicate ? false : source?.isFeatured ?? false);
  // New benefits start published; a duplicate starts as a draft so near-copies are explicit.
  const isActive = useSignal(isEdit ? !isDraftBenefit(source.validUntil) : !isDuplicate);
  const latitud = useSignal(source?.latitud ?? "");
  const longitud = useSignal(source?.longitud ?? "");
  const merchant = useStore({
    address: source?.address ?? "",
    hours: source?.hours ?? "",
    phone: source?.phone ?? prefill?.phone ?? "",
    whatsapp: source?.whatsapp ?? "",
    instagram: source?.instagram ?? "",
    website: source?.website ?? "",
  });
  const image = useStore({
    preview: source?.imagen || null as string | null,
    optimized: "",
    cleared: false,
    mobilePreview: source?.imagenMobile || null as string | null,
    mobileOptimized: "",
    mobileCleared: false,
    pdfCleared: false,
  });
  const filterDialog = useSignal<HTMLDialogElement>();
  const filterTarget = useSignal<BenefitFilterType | null>(null);
  const filterError = useSignal("");
  const filterNotice = useSignal("");
  const imageError = useSignal("");

  const duplicate = useComputed$(() => findDuplicateTitle(benefits.value.rows, titulo.value, isEdit ? source.id : undefined));
  const offerDescription = useComputed$(() => adminFilters.value.ofertas.find((offer) => String(offer.id) === selection.ofertas)?.descripcion);
  const resumenSuggestions = useComputed$(() => {
    const values = [...adminFilters.value.ofertas.map((offer) => offer.descripcion), ...benefits.value.rows.map((benefit) => benefit.resumen)];
    return [...new Set(values.map(normalizeResumen).filter(Boolean))].slice(0, 30);
  });

  const result = saveAction.value as { failed?: boolean; message?: string; fieldErrors?: FieldErrors } | undefined;
  const errors: FieldErrors = result?.failed ? result.fieldErrors ?? {} : {};
  const errorCount = Object.values(errors).filter(Boolean).length;
  const validity = validUntil.value ? benefitValidity(validUntil.value) : "sin-vencimiento";

  const openFilterEditor$ = $((type: BenefitFilterType) => {
    filterTarget.value = type;
    filterError.value = "";
    filterNotice.value = "";
    filterDialog.value?.showModal();
  });

  const pickImage$ = $(async (file: File, target: "desktop" | "mobile") => {
    imageError.value = "";
    try {
      const { preview, optimized } = target === "desktop" ? await optimizeImage(file, 800, 450) : await optimizeImage(file, 600, 600);
      if (target === "desktop") {
        image.preview = preview;
        image.optimized = optimized;
        image.cleared = false;
      } else {
        image.mobilePreview = preview;
        image.mobileOptimized = optimized;
        image.mobileCleared = false;
      }
    } catch {
      imageError.value = "No pudimos leer esa imagen. Probá con un JPG, PNG o WebP.";
    }
  });

  const removeImage$ = $((target: "desktop" | "mobile") => {
    const input = document.getElementById(`${p}-${target === "desktop" ? "image" : "image-mobile"}-file`) as HTMLInputElement | null;
    if (input) input.value = "";
    if (target === "desktop") {
      image.preview = null;
      image.optimized = "";
      image.cleared = true;
    } else {
      image.mobilePreview = null;
      image.mobileOptimized = "";
      image.mobileCleared = true;
    }
  });

  const categoryName = adminFilters.value.categorias.find((c) => String(c.id) === selection.categorias)?.descripcion ?? "";
  const locationName = adminFilters.value.ubicaciones.find((l) => String(l.id) === selection.ubicaciones)?.descripcion ?? "";

  const selectField = (key: BenefitFilterType, name: "categoryId" | "locationId" | "offerId", label: string) => {
    const id = `${p}-${name}`;
    return (
      <div>
        <FilterFieldLabel id={id} label={label} onAdd$={() => openFilterEditor$(key)} />
        <select
          id={id}
          name={name}
          value={selection[key]}
          aria-invalid={errors[name] ? "true" : undefined}
          aria-describedby={describeError(id, errors[name])}
          onChange$={(_, el) => { selection[key] = el.value; }}
          class="field cursor-pointer"
        >
          {adminFilters.value[key].map((option) => (
            // `selected` too: a form opened from a deep link is rendered on the server, where `value` does nothing.
            <option key={option.id} value={option.id} selected={String(option.id) === selection[key]}>{option.descripcion}</option>
          ))}
        </select>
        {fieldError(id, errors[name])}
      </div>
    );
  };

  const textField = (
    name: "address" | "hours" | "phone" | "whatsapp" | "instagram" | "website",
    label: string,
    options: { placeholder: string; hint?: string; type?: string; inputMode?: "tel" | "url" | "text"; autocomplete?: "street-address" },
  ) => {
    const id = `${p}-${name}`;
    return (
      <div>
        <label for={id} class={fieldLabelClass}>{label}</label>
        <input
          id={id}
          type={options.type ?? "text"}
          name={name}
          value={merchant[name]}
          inputMode={options.inputMode}
          autocomplete={options.autocomplete ?? "off"}
          placeholder={options.placeholder}
          aria-invalid={errors[name] ? "true" : undefined}
          aria-describedby={describeError(id, errors[name], options.hint)}
          onInput$={(_, el) => { merchant[name] = el.value; }}
          class="field"
        />
        {fieldError(id, errors[name])}
        {options.hint && <p id={`${id}-hint`} class={hintClass}>{options.hint}</p>}
      </div>
    );
  };

  return (
    <>
      <dialog
        ref={filterDialog}
        aria-labelledby={`${p}-filter-title`}
        class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md border-t-4 border-accent bg-white p-6 text-slate-800 shadow-xl backdrop:bg-brand-ink/60"
        preventdefault:cancel
        onCancel$={() => { if (!createFilterAction.isRunning) filterDialog.value?.close(); }}
        onClose$={() => { filterTarget.value = null; }}
      >
        <Form
          action={createFilterAction}
          class="space-y-5"
          onSubmitCompleted$={() => {
            const outcome = createFilterAction.value;
            const target = filterTarget.value;
            if (!outcome?.success) {
              filterError.value = outcome?.message || outcome?.fieldErrors?.descripcion || "Revisá el nombre e intentá de nuevo.";
              return;
            }
            if (!target) return;
            selection[target] = String(outcome.option.id);
            filterNotice.value = `“${outcome.option.descripcion}” está disponible y quedó seleccionada en el beneficio.`;
            filterDialog.value?.close();
          }}
        >
          <h2 id={`${p}-filter-title`} class="heading-display text-xl text-primary">
            {filterTarget.value ? filterEditorLabels[filterTarget.value].title : "Agregar opción"}
          </h2>
          <p class="text-sm text-slate-600">La opción quedará disponible para todos los beneficios.</p>
          <input type="hidden" name="type" value={filterTarget.value || "categorias"} />
          <div>
            <label for={`${p}-filter-description`} class={fieldLabelClass}>Nombre</label>
            <input
              id={`${p}-filter-description`}
              name="descripcion"
              type="text"
              onInput$={() => { filterError.value = ""; }}
              aria-invalid={filterError.value ? "true" : undefined}
              aria-describedby={filterError.value ? `${p}-filter-description-error` : undefined}
              required
              maxLength={100}
              autoFocus
              placeholder={filterTarget.value ? filterEditorLabels[filterTarget.value].placeholder : ""}
              class="field"
            />
            {filterError.value && <p id={`${p}-filter-description-error`} role="alert" class="mt-1 text-sm font-semibold text-red-700">{filterError.value}</p>}
          </div>
          <div class="flex justify-end gap-3">
            <button type="button" disabled={createFilterAction.isRunning} onClick$={() => filterDialog.value?.close()} class="btn btn-outline btn-sm">Cancelar</button>
            <button type="submit" disabled={createFilterAction.isRunning} class="btn btn-dark btn-sm">
              {createFilterAction.isRunning ? "Guardando..." : "Guardar y seleccionar"}
            </button>
          </div>
        </Form>
      </dialog>

      <Form
        id={formId}
        action={saveAction}
        enctype="multipart/form-data"
        noValidate
        onSubmitCompleted$={async () => {
          const outcome = saveAction.value;
          if (outcome?.success) {
            await props.onSaved$({ text: `«${outcome.titulo}» ${outcome.created ? "se creó" : "se guardó"} correctamente.`, slug: outcome.slug });
            await props.onClose$();
          } else {
            focusFirstInvalid(formId);
          }
        }}
        class="scroll-mt-20 border border-line border-t-4 border-t-primary bg-white"
        aria-labelledby={`${formId}-title`}
      >
        <div class="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-8">
          <div>
            <p class="eyebrow text-[11px] text-amber-900">{isEdit ? "Editar beneficio" : isDuplicate ? "Duplicar beneficio" : "Nuevo beneficio"}</p>
            <h2 id={`${formId}-title`} class="heading-display text-2xl text-primary break-words">
              {isEdit ? source.titulo : titulo.value || "Beneficio sin título"}
            </h2>
          </div>
          <button type="button" onClick$={props.onClose$} aria-label="Cerrar formulario" class={iconButtonClass}>
            <LuX class="h-5 w-5" />
          </button>
        </div>

        <div class="grid grid-cols-1 gap-8 px-5 py-6 sm:px-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div class="min-w-0 space-y-6">
            {prefill && (prefill.titulo || prefill.phone) && (
              <p class="border-l-4 border-secondary bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Completamos {prefill.titulo && prefill.phone ? "el nombre y el teléfono" : prefill.titulo ? "el nombre" : "el teléfono"} con los datos de la solicitud del comercio. Revisalos y completá el resto: no se guarda nada hasta que toques “Crear beneficio”.
              </p>
            )}
            {isDuplicate && (
              <p class="border-l-4 border-secondary bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Copia de «{source.titulo}». Se guarda como borrador: revisá los datos antes de publicarla.
              </p>
            )}
            {result?.failed && (
              <div role="alert" tabIndex={-1} data-form-error class="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800 focus:outline-none">
                <p class="font-bold">{result.message || "No se pudo guardar. Revisá los datos e intentá de nuevo."}</p>
                {errorCount > 0 && <p>{errorCount === 1 ? "Hay 1 campo para revisar." : `Hay ${errorCount} campos para revisar.`} Te llevamos al primero.</p>}
              </div>
            )}
            {filterNotice.value && <Notice>{filterNotice.value}</Notice>}
            <datalist id={`${p}-resumen-suggestions`}>
              {resumenSuggestions.value.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
            {isEdit && <input type="hidden" name="id" value={source.id} />}
            {!isEdit && <input type="hidden" name="copiedImage" value={image.cleared ? "" : source?.imagen ?? ""} />}
            {!isEdit && <input type="hidden" name="copiedMobileImage" value={image.mobileCleared ? "" : source?.imagenMobile ?? ""} />}

            <FormSection first title="Datos" description="Lo que identifica al beneficio en el listado y en la búsqueda.">
              <div>
                <label for={`${p}-titulo`} class={fieldLabelClass}>Título</label>
                <input
                  id={`${p}-titulo`}
                  type="text"
                  name="titulo"
                  value={titulo.value}
                  placeholder="Ej: Spa Platense Masajes"
                  aria-invalid={errors.titulo ? "true" : undefined}
                  aria-describedby={describeError(`${p}-titulo`, errors.titulo)}
                  onInput$={(_, el) => { titulo.value = el.value; }}
                  class="field"
                />
                {fieldError(`${p}-titulo`, errors.titulo)}
                {duplicate.value && (
                  <p role="status" class="mt-2 border-l-4 border-accent bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Ya existe «{duplicate.value.titulo}» ({isDraftBenefit(duplicate.value.validUntil) ? "borrador" : "publicado"}).{" "}
                    <button type="button" onClick$={() => duplicate.value && props.onEditOther$(duplicate.value)} class="font-bold underline cursor-pointer">
                      Editar ese beneficio
                    </button>
                  </p>
                )}
              </div>
              <div>
                <label for={`${p}-descripcion`} class={fieldLabelClass}>Descripción</label>
                <textarea
                  id={`${p}-descripcion`}
                  name="descripcion"
                  rows={4}
                  value={descripcion.value}
                  placeholder="Contá en qué consiste el beneficio y cómo se usa."
                  aria-invalid={errors.descripcion ? "true" : undefined}
                  aria-describedby={describeError(`${p}-descripcion`, errors.descripcion)}
                  onInput$={(_, el) => { descripcion.value = el.value; }}
                  class="field"
                />
                {fieldError(`${p}-descripcion`, errors.descripcion)}
              </div>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {selectField("categorias", "categoryId", "Categoría")}
                {selectField("ubicaciones", "locationId", "Zona")}
              </div>
            </FormSection>

            <FormSection title="Oferta" description="El descuento, cómo se ve y quién puede usarlo.">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {selectField("ofertas", "offerId", "Descuento")}
                <ResumenField id={`${p}-resumen`} value={resumen} offer={offerDescription.value} listId={`${p}-resumen-suggestions`} error={errors.resumen} />
              </div>
              <div>
                <label for={`${p}-terms`} class={fieldLabelClass}>Condiciones (opcional)</label>
                <textarea
                  id={`${p}-terms`}
                  name="terms"
                  rows={3}
                  maxLength={2000}
                  value={terms.value}
                  placeholder="Ej: Válido de lunes a jueves. No acumulable con otras promociones."
                  aria-invalid={errors.terms ? "true" : undefined}
                  aria-describedby={describeError(`${p}-terms`, errors.terms)}
                  onInput$={(_, el) => { terms.value = el.value; }}
                  class="field"
                />
                {fieldError(`${p}-terms`, errors.terms)}
              </div>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label for={`${p}-couponCode`} class={fieldLabelClass}>Código del comercio (opcional)</label>
                  <input
                    id={`${p}-couponCode`}
                    type="text"
                    name="couponCode"
                    maxLength={40}
                    autocomplete="off"
                    value={couponCode.value}
                    placeholder="Ej: LPRC15"
                    aria-invalid={errors.couponCode ? "true" : undefined}
                    aria-describedby={describeError(`${p}-couponCode`, errors.couponCode, "hint")}
                    onInput$={(_, el) => { couponCode.value = el.value; }}
                    class="field font-mono"
                  />
                  {fieldError(`${p}-couponCode`, errors.couponCode)}
                  <p id={`${p}-couponCode-hint`} class={hintClass}>Para comprar online o por teléfono; se muestra en la ficha.</p>
                </div>
                <div class="flex items-start gap-3 sm:pt-7">
                  <input
                    type="checkbox"
                    id={`${p}-isPremiumOnly`}
                    name="isPremiumOnly"
                    checked={isPremiumOnly.value}
                    onChange$={(_, el) => { isPremiumOnly.value = el.checked; }}
                    class="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                  />
                  <label for={`${p}-isPremiumOnly`} class="text-sm font-bold text-primary cursor-pointer">
                    Solo socios Gold
                    <span class="block text-xs font-normal text-slate-600">Solo los socios Gold pueden generar el cupón.</span>
                  </label>
                </div>
              </div>
            </FormSection>

            <FormSection title="Vigencia">
              <div class="max-w-xs">
                <label for={`${p}-validUntil`} class={fieldLabelClass}>Válido hasta (opcional)</label>
                <input
                  id={`${p}-validUntil`}
                  type="date"
                  name="validUntil"
                  value={validUntil.value}
                  aria-invalid={errors.validUntil ? "true" : undefined}
                  aria-describedby={describeError(`${p}-validUntil`, errors.validUntil, "hint")}
                  onInput$={(_, el) => { validUntil.value = el.value; }}
                  class="field"
                />
                {fieldError(`${p}-validUntil`, errors.validUntil)}
              </div>
              <p id={`${p}-validUntil-hint`} class={[
                "text-sm",
                validity === "vencido" ? "border-l-4 border-red-600 bg-red-50 px-3 py-2 font-semibold text-red-800" : validity === "vence-pronto" ? "border-l-4 border-accent bg-amber-50 px-3 py-2 text-amber-900" : "text-slate-600",
              ]}>
                {validity === "vencido"
                  ? "Esa fecha ya pasó: el beneficio figura vencido y los socios no pueden generar ni canjear cupones."
                  : validity === "vence-pronto"
                    ? `Vence dentro de los próximos ${EXPIRING_SOON_DAYS} días. Los cupones dejan de servir el día siguiente.`
                    : "Después de esa fecha no se pueden generar ni canjear cupones. Vacío: sin vencimiento."}
              </p>
            </FormSection>

            <FormSection title="Ubicación y comercio" description="Datos que se muestran en la ficha para llegar y contactar al comercio.">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {textField("address", "Dirección", { placeholder: "Ej: Calle 7 N° 1234, La Plata", autocomplete: "street-address" })}
                {textField("hours", "Horarios", { placeholder: "Ej: Lun a sáb de 9 a 20" })}
                {textField("phone", "Teléfono", { placeholder: "Ej: 221 456-7890", type: "tel", inputMode: "tel", hint: "Con código de área." })}
                {textField("whatsapp", "WhatsApp", { placeholder: "Ej: 221 555-1234", type: "tel", inputMode: "tel", hint: "El número al que escriben los socios." })}
                {textField("instagram", "Instagram", { placeholder: "Ej: @comercio", hint: "Usuario o link del perfil." })}
                {textField("website", "Sitio web", { placeholder: "Ej: comercio.com.ar", inputMode: "url" })}
              </div>
              <CoordinateFields idPrefix={p} latitud={latitud} longitud={longitud} errors={errors} />
            </FormSection>

            <FormSection title="Imágenes y archivos">
              <input type="hidden" name="optimizedImage" value={image.optimized} />
              <input type="hidden" name="optimizedMobileImage" value={image.mobileOptimized} />
              {isEdit && <input type="hidden" name="clearImage" value={image.cleared ? "true" : "false"} />}
              {isEdit && <input type="hidden" name="clearMobileImage" value={image.mobileCleared ? "true" : "false"} />}
              {isEdit && <input type="hidden" name="clearPdf" value={image.pdfCleared ? "true" : "false"} />}
              {imageError.value && <p role="alert" class="text-sm font-semibold text-red-700">{imageError.value}</p>}
              <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ImageUpload
                  id={`${p}-image-file`}
                  name="imageFile"
                  label="Imagen principal (horizontal)"
                  hint="16:9, por ejemplo 1600×900. Se optimiza sola al subirla."
                  preview={image.preview}
                  onPick$={(file) => pickImage$(file, "desktop")}
                  onRemove$={() => removeImage$("desktop")}
                />
                <ImageUpload
                  id={`${p}-image-mobile-file`}
                  name="imageMobileFile"
                  label="Imagen para celular (opcional)"
                  hint="Vertical o cuadrada (600×600). Si falta, se usa la principal."
                  preview={image.mobilePreview}
                  vertical
                  onPick$={(file) => pickImage$(file, "mobile")}
                  onRemove$={() => removeImage$("mobile")}
                />
              </div>
              <div>
                <label for={`${p}-pdf-file`} class={fieldLabelClass}>PDF (opcional)</label>
                <input
                  id={`${p}-pdf-file`}
                  type="file"
                  name="pdfFile"
                  accept="application/pdf"
                  aria-describedby={`${p}-pdf-file-hint`}
                  onChange$={() => { image.pdfCleared = false; }}
                  class="field cursor-pointer text-sm"
                />
                <p id={`${p}-pdf-file-hint`} class={hintClass}>Lista de precios, menú o bases y condiciones.</p>
                {isEdit && source.pdfUrl && !image.pdfCleared && (
                  <div class="mt-2 flex items-center justify-between gap-3 border border-line bg-slate-50 px-3 py-2">
                    <span class="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700">
                      <LuFileText class="h-4 w-4 shrink-0" />
                      <span class="truncate">{source.pdfUrl.split("/").pop()}</span>
                    </span>
                    <button
                      type="button"
                      onClick$={() => {
                        image.pdfCleared = true;
                        const input = document.getElementById(`${p}-pdf-file`) as HTMLInputElement | null;
                        if (input) input.value = "";
                      }}
                      class="shrink-0 text-xs font-bold text-red-700 underline cursor-pointer"
                    >
                      Quitar PDF
                    </button>
                  </div>
                )}
                {isEdit && source.pdfUrl && image.pdfCleared && <p class="mt-2 text-xs font-bold text-amber-900">El PDF se va a quitar al guardar.</p>}
              </div>
            </FormSection>

            <FormSection title="Publicación">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={`${p}-isActive`}
                    name="isActive"
                    checked={isActive.value}
                    onChange$={(_, el) => { isActive.value = el.checked; }}
                    class="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                  />
                  <label for={`${p}-isActive`} class="text-sm font-bold text-primary cursor-pointer">
                    Publicado
                    <span class="block text-xs font-normal text-slate-600">Si lo destildás queda como borrador: solo lo ven los admins.</span>
                  </label>
                </div>
                <div class="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={`${p}-isFeatured`}
                    name="isFeatured"
                    checked={isFeatured.value}
                    onChange$={(_, el) => { isFeatured.value = el.checked; }}
                    class="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                  />
                  <label for={`${p}-isFeatured`} class="text-sm font-bold text-primary cursor-pointer">
                    Mostrar en “Beneficios destacados”
                    <span class="block text-xs font-normal text-slate-600">La portada muestra hasta 6 destacados publicados y vigentes, de los más nuevos a los más viejos. El listado indica cuáles están en portada.</span>
                  </label>
                </div>
              </div>
            </FormSection>
          </div>

          <aside class="min-w-0 xl:sticky xl:top-20 xl:self-start" aria-label="Vista previa">
            <BenefitPreview
              slug={isEdit ? source.slug : null}
              isDraft={!isActive.value}
              data={{
                title: titulo.value,
                summary: resumen.value || offerDescription.value || "",
                description: descripcion.value,
                image: image.preview ? previewSrc(image.preview) : null,
                mobileImage: image.mobilePreview ? previewSrc(image.mobilePreview) : null,
                category: categoryName,
                location: locationName,
                isPremiumOnly: isPremiumOnly.value,
                validUntil: validUntil.value,
                terms: terms.value,
                couponCode: couponCode.value,
                address: merchant.address,
                hours: merchant.hours,
                phone: merchant.phone,
                whatsapp: merchant.whatsapp,
                instagram: merchant.instagram,
                website: merchant.website,
              }}
            />
          </aside>
        </div>

        {/* Kept in view while scrolling a long form. */}
        <div class="sticky bottom-0 z-20 flex flex-wrap items-center justify-end gap-3 border-t-2 border-primary bg-white px-5 py-3 shadow-[0_-6px_16px_rgb(2_6_23/0.08)] sm:px-8">
          {errorCount > 0 && (
            <p class="w-full text-sm font-semibold text-red-700 sm:mr-auto sm:w-auto">
              {errorCount === 1 ? "1 campo para revisar" : `${errorCount} campos para revisar`}
            </p>
          )}
          <button type="button" onClick$={props.onClose$} disabled={saveAction.isRunning} class="btn btn-outline flex-1 px-3 sm:flex-none sm:px-6">
            Cancelar
          </button>
          <button type="submit" disabled={saveAction.isRunning} class="btn btn-dark flex-1 px-3 sm:flex-none sm:px-6">
            {saveAction.isRunning ? "Guardando..." : isEdit ? (
              <>
                Guardar<span class="hidden sm:inline">&nbsp;cambios</span>
              </>
            ) : (
              "Crear beneficio"
            )}
          </button>
        </div>
      </Form>
    </>
  );
});

// --- PAGE ---

export default component$(() => {
  const location = useLocation();
  const benefits = useAdminCustomBenefitsLoader();
  const adminFilters = useAdminFiltersLoader();
  const deleteBenefitAction = useDeleteBenefitAction();
  const toggleBenefitActiveAction = useToggleBenefitActiveAction();
  const params = location.url.searchParams;

  // Deep links: ?estado=, ?vigencia=, ?ubicacion=sin, ?destacados=1 and ?editar=<id> from the
  // dashboard; ?nuevo=1&titulo=&telefono= from a merchant request (prefilled, never saved alone).
  const editTarget = benefits.value.rows.find((row) => row.id === params.get("editar")) ?? null;
  const createPrefill =
    !editTarget && params.get("nuevo") === "1"
      ? { titulo: (params.get("titulo") ?? "").trim().slice(0, 120), phone: (params.get("telefono") ?? "").trim().slice(0, 40) }
      : null;
  // A store that never turns null: props derived from it stay readable while the form unmounts.
  const form = useStore<{
    open: boolean;
    mode: "create" | "edit";
    source: AdminBenefitRow | null;
    prefill: { titulo: string; phone: string } | null;
    key: number;
  }>({
    open: !!editTarget || !!createPrefill,
    mode: editTarget ? "edit" : "create",
    source: editTarget,
    prefill: createPrefill,
    key: 1,
  });
  const deleteDialog = useSignal<HTMLDialogElement>();
  const deleteTarget = useSignal<{ id: string; titulo: string; couponCount: number } | null>(null);
  const deleteError = useSignal("");
  const deleteNotice = useSignal("");
  const saveNotice = useSignal<{ text: string; slug: string } | null>(null);

  const currentPage = useSignal(1);
  const searchQuery = useSignal("");
  const featuredOnly = useSignal(params.get("destacados") === "1");
  const withoutLocationOnly = useSignal(params.get("ubicacion") === "sin");
  const statusFilter = useSignal<StatusFilter>(
    params.get("estado") === "publicados" ? "published" : params.get("estado") === "borradores" ? "draft" : "all",
  );
  const validityFilter = useSignal<ValidityFilter>(
    params.get("vigencia") === "vencidos" ? "vencido" : params.get("vigencia") === "vence-pronto" ? "vence-pronto" : "all",
  );

  const openForm$ = $((mode: "create" | "edit", source: AdminBenefitRow | null) => {
    saveNotice.value = null;
    form.prefill = null;
    form.mode = mode;
    form.source = source;
    form.key++;
    form.open = true;
    revealForm(mode === "edit" ? "benefit-edit-form" : "benefit-create-form");
  });

  const closeForm$ = $(() => {
    form.open = false;
    // A reload must not reopen a form that was already closed or saved.
    const url = new URL(window.location.href);
    const keys = ["editar", "nuevo", "titulo", "telefono"].filter((key) => url.searchParams.has(key));
    if (keys.length) {
      keys.forEach((key) => url.searchParams.delete(key));
      history.replaceState(history.state, "", url);
    }
  });

  const openDeleteDialog$ = $((target: { id: string; titulo: string; couponCount: number }) => {
    deleteTarget.value = target;
    deleteError.value = "";
    deleteNotice.value = "";
    deleteDialog.value?.showModal();
  });

  const describeFilters = (benefit: AdminBenefitRow) => ({
    category: adminFilters.value.categorias.find((c) => c.id === benefit.categoryId)?.descripcion || `Cat #${benefit.categoryId}`,
    location: adminFilters.value.ubicaciones.find((l) => l.id === benefit.locationId)?.descripcion || `Loc #${benefit.locationId}`,
  });

  const toggleNotice = useComputed$(() => {
    const result = toggleBenefitActiveAction.value as { success?: boolean; titulo?: string; published?: boolean } | undefined;
    if (!result?.success) return undefined;
    return `«${result.titulo}» ${result.published ? "quedó publicado." : "pasó a borrador."}`;
  });


  useTask$(({ track }) => {
    track(() => [searchQuery.value, featuredOnly.value, withoutLocationOnly.value, statusFilter.value, validityFilter.value]);
    currentPage.value = 1;
  });

  const itemsPerPage = 25;
  const today = argentinaDay();

  const filteredBenefits = useComputed$(() => {
    let items = benefits.value.rows;
    if (featuredOnly.value) items = items.filter((benefit) => benefit.isFeatured);
    if (withoutLocationOnly.value) items = items.filter((benefit) => !hasCoordinates(benefit));
    if (statusFilter.value === "published") items = items.filter((b) => !isDraftBenefit(b.validUntil));
    else if (statusFilter.value === "draft") items = items.filter((b) => isDraftBenefit(b.validUntil));
    if (validityFilter.value !== "all") items = items.filter((b) => benefitValidity(b.validUntil, today) === validityFilter.value);
    const query = searchQuery.value.toLowerCase().trim();
    if (!query) return items;
    return items.filter(
      (b) =>
        b.titulo.toLowerCase().includes(query) ||
        b.resumen?.toLowerCase().includes(query) ||
        b.descripcion?.toLowerCase().includes(query) ||
        b.address?.toLowerCase().includes(query)
    );
  });

  const totalPages = useComputed$(() => Math.max(1, Math.ceil(filteredBenefits.value.length / itemsPerPage)));
  const paginatedBenefits = useComputed$(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return filteredBenefits.value.slice(start, start + itemsPerPage);
  });
  const filtersActive =
    !!searchQuery.value || featuredOnly.value || withoutLocationOnly.value || statusFilter.value !== "all" || validityFilter.value !== "all";

  const changePage = $((page: number) => {
    if (page >= 1 && page <= totalPages.value) currentPage.value = page;
  });

  const renderBadges = (benefit: AdminBenefitRow) => {
    const placement = benefit.featuredPlacement && featuredLabels[benefit.featuredPlacement];
    const expires = formatValidUntil(benefit.validUntil);
    const validity = benefitValidity(benefit.validUntil, today);
    return (
      <>
        {placement && (
          <span class={benefit.featuredPlacement === "home" ? "badge badge-accent" : "badge badge-muted"} title={placement.detail}>
            <LuSparkles class="h-3 w-3" aria-hidden="true" /> {placement.label}
          </span>
        )}
        {benefit.isPremiumOnly && <span class="badge badge-dark" title="Solo los socios Gold pueden generar el cupón">Solo Gold</span>}
        {benefit.pdfUrl && <span class="badge badge-muted" title="Tiene un PDF adjunto">PDF</span>}
        {!hasCoordinates(benefit) && (
          <span class="badge badge-muted" title="No aparece en el mapa hasta que cargues sus coordenadas">
            <LuMapPinOff class="h-3 w-3" /> Sin ubicación
          </span>
        )}
        {expires && (
          <span
            class={[
              "badge",
              validity === "vencido" ? "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200" : validity === "vence-pronto" ? "bg-amber-100 text-amber-900" : "badge-muted",
            ]}
          >
            {validity === "vencido" ? `Venció ${expires}` : `Vence ${expires}`}
          </span>
        )}
      </>
    );
  };

  const renderStatusToggle = (benefit: AdminBenefitRow) => {
    const isActive = !isDraftBenefit(benefit.validUntil);
    return (
      <label class="relative inline-flex min-h-10 cursor-pointer items-center">
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
          class="peer sr-only"
        />
        <span class="relative h-5 w-9 bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:bg-white after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:opacity-50" />
        <span class="ml-2 min-w-[4.75rem] text-left text-xs font-bold uppercase tracking-wide text-slate-600">
          {isActive ? "Publicado" : "Borrador"}
        </span>
      </label>
    );
  };

  const renderRowActions = (benefit: AdminBenefitRow) => (
    <div class="flex items-center justify-end gap-0.5">
      <button type="button" onClick$={() => openForm$("edit", benefit)} class={iconButtonClass} title="Editar" aria-label={`Editar ${benefit.titulo}`}>
        <LuPencil class="h-4 w-4" />
      </button>
      <button type="button" onClick$={() => openForm$("create", benefit)} class={iconButtonClass} title="Duplicar como borrador" aria-label={`Duplicar ${benefit.titulo}`}>
        <LuCopy class="h-4 w-4" />
      </button>
      <a href={`/beneficio/${benefit.slug}/`} target="_blank" rel="noopener" class={iconButtonClass} title="Ver en el sitio" aria-label={`Ver ${benefit.titulo} en el sitio (se abre en otra pestaña)`}>
        <LuExternalLink class="h-4 w-4" />
      </a>
      <button
        type="button"
        onClick$={() => openDeleteDialog$({ id: benefit.id, titulo: benefit.titulo, couponCount: benefit.couponCount })}
        class={`${iconButtonClass} text-red-700 hover:bg-red-50 hover:text-red-800`}
        title="Eliminar"
        aria-label={`Eliminar ${benefit.titulo}`}
      >
        <LuTrash2 class="h-4 w-4" />
      </button>
    </div>
  );

  const renderThumb = (benefit: AdminBenefitRow, size: "sm" | "md") => (
    <span class={["flex shrink-0 items-center justify-center overflow-hidden bg-slate-100", size === "sm" ? "h-12 w-16" : "h-12 w-[4.5rem]"]}>
      {benefit.imagen ? (
        <img src={previewSrc(benefit.imagen)} alt="" loading="lazy" width={80} height={56} class="h-full w-full object-cover" />
      ) : (
        <LuImage class="h-5 w-5 text-slate-400" />
      )}
    </span>
  );

  const chipClass = (active: boolean) => [
    "inline-flex min-h-11 items-center gap-2 border px-3 text-sm font-semibold transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
    active ? "border-primary bg-primary text-white" : "border-line bg-white text-slate-700 hover:border-primary",
  ];

  return (
    <div class="relative flex w-full flex-1 flex-col space-y-6 overflow-y-auto px-4 pt-8 text-left font-sans text-slate-800 sm:px-10 sm:pt-10">
      <dialog
        ref={deleteDialog}
        aria-labelledby="benefit-delete-title"
        aria-describedby="benefit-delete-description"
        class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md border-t-4 border-red-600 bg-white p-6 text-slate-800 shadow-xl backdrop:bg-brand-ink/60"
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
              if (form.source?.id === target.id) form.open = false;
            }
            deleteDialog.value?.close();
          }}
        >
          <h2 id="benefit-delete-title" class="heading-display text-xl text-primary">Eliminar beneficio</h2>
          <p id="benefit-delete-description" class="text-sm text-slate-600">
            “{deleteTarget.value?.titulo}” se eliminará de forma permanente.
          </p>
          {!!deleteTarget.value?.couponCount && (
            <p class="border-l-4 border-accent bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Tiene <strong>{deleteTarget.value.couponCount === 1 ? "1 cupón emitido" : `${deleteTarget.value.couponCount} cupones emitidos`}</strong>. También se borrarán y los socios dejarán de verlos en su historial.
            </p>
          )}
          <input type="hidden" name="id" value={deleteTarget.value?.id ?? ""} />
          <input type="hidden" name="includeCoupons" value={deleteTarget.value?.couponCount ? "true" : "false"} />
          <input type="hidden" name="expectedCouponCount" value={String(deleteTarget.value?.couponCount ?? 0)} />
          {deleteError.value && <p role="alert" class="text-sm font-semibold text-red-700">{deleteError.value}</p>}
          <div class="flex flex-wrap justify-end gap-3">
            <button type="button" disabled={deleteBenefitAction.isRunning} onClick$={() => deleteDialog.value?.close()} class="btn btn-outline btn-sm">Cancelar</button>
            <button type="submit" disabled={deleteBenefitAction.isRunning} class="btn btn-sm border-red-700 bg-red-700 text-white hover:bg-red-800">
              {deleteBenefitAction.isRunning
                ? "Eliminando..."
                : deleteTarget.value?.couponCount
                  ? `Eliminar beneficio y ${couponLabel(deleteTarget.value.couponCount)}`
                  : "Eliminar"}
            </button>
          </div>
        </Form>
      </dialog>

      <AdminPageHeader eyebrow="Catálogo" title="Beneficios" description="Creá, editá y elegí los beneficios que se muestran en la portada y en el listado.">
        <button
          type="button"
          onClick$={() => (form.open && form.mode === "create" && !form.source ? closeForm$() : openForm$("create", null))}
          aria-expanded={form.open && form.mode === "create" && !form.source}
          class="btn btn-dark"
        >
          <LuPlus class="h-4 w-4" />
          Nuevo beneficio
        </button>
      </AdminPageHeader>

      {deleteNotice.value && <Notice>{deleteNotice.value}</Notice>}
      {saveNotice.value && !form.open && (
        <Notice>
          {saveNotice.value.text}{" "}
          {saveNotice.value.slug && (
            <a href={`/beneficio/${saveNotice.value.slug}/`} target="_blank" rel="noopener" class="underline">
              Ver ficha<span class="sr-only"> (se abre en otra pestaña)</span>
            </a>
          )}
        </Notice>
      )}
      <ActionFeedback value={toggleBenefitActiveAction.value} success={toggleNotice.value} />

      {form.open && (
        <BenefitForm
          key={`${form.mode}-${form.source?.id ?? "new"}-${form.key}`}
          mode={form.mode}
          source={form.source}
          prefill={form.prefill}
          onClose$={closeForm$}
          onSaved$={(notice) => { saveNotice.value = notice; }}
          onEditOther$={(row) => openForm$("edit", row)}
        />
      )}

      <section aria-labelledby="benefit-list-title" class="space-y-4">
        <h2 id="benefit-list-title" class="sr-only">Listado de beneficios</h2>
        <div class="space-y-3 border border-line bg-white p-4">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div class="relative min-w-0 flex-1">
              <label for="benefit-search" class={fieldLabelClass}>Buscar</label>
              <LuSearch class="pointer-events-none absolute bottom-3.5 left-3 h-4 w-4 text-slate-500" />
              <input
                id="benefit-search"
                type="search"
                placeholder="Título, badge, descripción o dirección"
                value={searchQuery.value}
                onInput$={(_, el) => { searchQuery.value = el.value; }}
                class="field pl-9"
              />
            </div>
            <div class="grid grid-cols-2 gap-3 lg:flex">
              <div class="lg:w-44">
                <label for="benefit-status-filter" class={fieldLabelClass}>Estado</label>
                <select id="benefit-status-filter" value={statusFilter.value} onChange$={(_, el) => { statusFilter.value = el.value as StatusFilter; }} class="field cursor-pointer">
                  <option value="all" selected={statusFilter.value === "all"}>Todos</option>
                  <option value="published" selected={statusFilter.value === "published"}>Publicados</option>
                  <option value="draft" selected={statusFilter.value === "draft"}>Borradores</option>
                </select>
              </div>
              <div class="lg:w-48">
                <label for="benefit-validity-filter" class={fieldLabelClass}>Vigencia</label>
                <select id="benefit-validity-filter" value={validityFilter.value} onChange$={(_, el) => { validityFilter.value = el.value as ValidityFilter; }} class="field cursor-pointer">
                  <option value="all" selected={validityFilter.value === "all"}>Cualquiera</option>
                  <option value="vencido" selected={validityFilter.value === "vencido"}>Vencidos</option>
                  <option value="vence-pronto" selected={validityFilter.value === "vence-pronto"}>{`Vencen en ${EXPIRING_SOON_DAYS} días`}</option>
                </select>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed={featuredOnly.value} onClick$={() => { featuredOnly.value = !featuredOnly.value; }} class={chipClass(featuredOnly.value)}>
              <LuSparkles class="h-4 w-4" /> Solo destacados
            </button>
            <button type="button" aria-pressed={withoutLocationOnly.value} onClick$={() => { withoutLocationOnly.value = !withoutLocationOnly.value; }} class={chipClass(withoutLocationOnly.value)}>
              <LuMapPinOff class="h-4 w-4" /> Sin ubicación
            </button>
            <p class="ml-auto text-sm text-slate-600" aria-live="polite">
              {benefits.value.loadError ? "Listado no disponible" : filteredBenefits.value.length === 1 ? "1 beneficio" : `${filteredBenefits.value.length} beneficios`}
              {filtersActive && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick$={() => {
                      searchQuery.value = "";
                      featuredOnly.value = false;
                      withoutLocationOnly.value = false;
                      statusFilter.value = "all";
                      validityFilter.value = "all";
                    }}
                    class="font-bold text-primary underline cursor-pointer"
                  >
                    Limpiar filtros
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Cards up to `xl`, where the table has room for every column next to the sidebar */}
        <div class="border border-line bg-white">
          {benefits.value.loadError ? (
            <div role="alert" class="space-y-3 px-6 py-10 text-center">
              <p class="font-semibold text-primary">No pudimos cargar los beneficios.</p>
              <p class="text-sm text-slate-600">No se pudo consultar el listado. Reintentá para ver los beneficios guardados.</p>
              <a href={location.url.pathname + location.url.search} class="btn btn-outline">Reintentar</a>
            </div>
          ) : paginatedBenefits.value.length === 0 ? (
            <div class="flex items-center justify-center gap-2 px-6 py-12 text-center text-sm text-slate-600">
              <LuTicket class="h-5 w-5 text-slate-400" />
              <span>{benefits.value.rows.length ? "No hay beneficios que coincidan con los filtros." : "Todavía no hay beneficios. Tocá “Nuevo beneficio” para cargar el primero."}</span>
            </div>
          ) : (
            <>
              <ul class="divide-y divide-line xl:hidden">
                {paginatedBenefits.value.map((benefit) => {
                  const filters = describeFilters(benefit);
                  return (
                    <li key={benefit.id} class="space-y-3 p-4">
                      <div class="flex items-start gap-3">
                        {renderThumb(benefit, "sm")}
                        <div class="min-w-0 flex-1 space-y-1">
                          <p class="break-words font-bold text-primary">{benefit.titulo}</p>
                          <p class="text-sm text-slate-700">{benefit.resumen}</p>
                          <p class="text-xs text-slate-600">
                            <span class="font-bold">{filters.category}</span> · {filters.location} · {couponLabel(benefit.couponCount)}
                          </p>
                        </div>
                      </div>
                      <div class="flex flex-wrap gap-1.5">{renderBadges(benefit)}</div>
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        {renderStatusToggle(benefit)}
                        {renderRowActions(benefit)}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div class="hidden overflow-x-auto xl:block">
                <table class="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr class="border-b border-line bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600">
                      <th scope="col" class="py-3 pl-4 pr-2"><span class="sr-only">Imagen</span></th>
                      <th scope="col" class="px-3 py-3">Beneficio</th>
                      <th scope="col" class="px-3 py-3">Categoría</th>
                      <th scope="col" class="px-3 py-3 text-right">Cupones</th>
                      <th scope="col" class="px-3 py-3">Estado</th>
                      <th scope="col" class="py-3 pl-3 pr-4 text-right"><span class="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-line">
                    {paginatedBenefits.value.map((benefit) => {
                      const filters = describeFilters(benefit);
                      return (
                        <tr key={benefit.id} class="align-top hover:bg-slate-50">
                          <td class="py-3 pl-4 pr-2">{renderThumb(benefit, "md")}</td>
                          <td class="px-3 py-3">
                            <p class="font-bold text-primary">{benefit.titulo}</p>
                            <p class="text-slate-600">{benefit.resumen}</p>
                            <div class="mt-1.5 flex flex-wrap gap-1.5">{renderBadges(benefit)}</div>
                          </td>
                          <td class="px-3 py-3 text-slate-700">
                            <span class="font-semibold">{filters.category}</span>
                            <span class="block text-slate-600">{filters.location}</span>
                          </td>
                          <td class="px-3 py-3 text-right font-display text-lg font-semibold tabular-nums text-primary">
                            {benefit.couponCount}
                            <span class="sr-only"> {benefit.couponCount === 1 ? "cupón" : "cupones"}</span>
                          </td>
                          <td class="px-3 py-3">{renderStatusToggle(benefit)}</td>
                          <td class="py-3 pl-3 pr-4">{renderRowActions(benefit)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {totalPages.value > 1 && (
            <div class="flex items-center justify-between border-t border-line bg-slate-50 px-4 py-3">
              <span class="text-sm text-slate-600">
                Página <span class="font-bold text-primary">{currentPage.value}</span> de <span class="font-bold text-primary">{totalPages.value}</span>
              </span>
              <div class="flex items-center gap-1">
                <button type="button" onClick$={() => changePage(currentPage.value - 1)} disabled={currentPage.value === 1} class={`${iconButtonClass} border border-line bg-white disabled:opacity-40`} aria-label="Página anterior">
                  <LuChevronLeft class="h-4 w-4" />
                </button>
                <button type="button" onClick$={() => changePage(currentPage.value + 1)} disabled={currentPage.value === totalPages.value} class={`${iconButtonClass} border border-line bg-white disabled:opacity-40`} aria-label="Página siguiente">
                  <LuChevronRight class="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
      {/* Bottom room as an element, not padding: padding would lift the sticky save bar. */}
      <div aria-hidden="true" class="h-12 shrink-0" />
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
