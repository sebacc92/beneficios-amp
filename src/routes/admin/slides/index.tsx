import { component$, useSignal, useStore, useVisibleTask$, $, useTask$, type QRL } from "@builder.io/qwik";
import { isBrowser } from "@builder.io/qwik/build";
import { putImage } from "~/server/media";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import {
  LuArrowDown,
  LuArrowUp,
  LuEye,
  LuEyeOff,
  LuGripVertical,
  LuImage,
  LuPencil,
  LuPlus,
  LuSmartphone,
  LuTrash2,
  LuUpload,
  LuX,
} from "@qwikest/icons/lucide";
import { asc, eq, sql } from "drizzle-orm";
import { getDB } from "~/db";
import { heroSlides as heroSlidesTable } from "~/db/schema";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { ActionFeedback, Notice } from "~/components/admin/action-feedback";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { AdminPageHeader } from "~/components/admin/page-header";
import { FALLBACK_BOXES, HeroPreviewFrames, type PreviewSlide, type SlideBox, type SlideBoxes } from "~/components/admin/hero-preview";
import { isValidSiteLink } from "~/utils/benefit-admin";

type SlideRow = typeof heroSlidesTable.$inferSelect;
type FieldErrors = Record<string, string | undefined>;

const LINK_MESSAGE = "Usá una ruta del sitio que empiece con / (ej: /beneficios/) o un link completo que empiece con https://.";
const IMAGE_LINK_MESSAGE = "Pegá un link que empiece con https:// o una ruta que empiece con /.";
// Shown in the preview while a slide still has no image.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 10'%3E%3Crect width='16' height='10' fill='%23162456'/%3E%3C/svg%3E";

const fieldLabelClass = "field-label";
const hintClass = "mt-1 text-xs text-slate-600";
const iconButtonClass =
  "inline-flex h-10 w-10 items-center justify-center text-slate-600 transition-colors hover:bg-slate-100 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer";

const describeError = (id: string, error?: string, hint?: boolean) =>
  [error ? `${id}-error` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;

const fieldError = (id: string, message?: string) =>
  message ? (
    <p id={`${id}-error`} class="mt-1 text-xs font-semibold text-red-700">
      {message}
    </p>
  ) : null;

/** After a failed save, take the admin to the first field that needs attention (once it renders). */
const focusFirstInvalid = (formId: string, attempt = 0): void => {
  setTimeout(() => {
    const form = document.getElementById(formId);
    const target = form?.querySelector<HTMLElement>("[aria-invalid='true']") ?? form?.querySelector<HTMLElement>("[data-form-error]");
    if (!target) {
      if (attempt < 20) focusFirstInvalid(formId, attempt + 1);
      return;
    }
    target.scrollIntoView({ block: "center" });
    target.focus({ preventScroll: true });
  }, 50);
};

// --- SECURITY & LOADERS ---

export const useAdminSlidesLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    return await db.select().from(heroSlidesTable).orderBy(asc(heroSlidesTable.orderIndex));
  } catch (err) {
    console.error("Failed to load hero slides:", err);
    return [];
  }
});

// --- ACTIONS ---

const optionalLink = (message: string) =>
  z.string().trim().optional().refine((value) => !value || isValidSiteLink(value), message);

/** One action for both forms: with `id` it updates that slide, without it adds one at the end. */
export const useSaveSlideAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const [existing] = data.id ? await db.select().from(heroSlidesTable).where(eq(heroSlidesTable.id, data.id)).limit(1) : [];
      if (data.id && !existing) return requestEvent.fail(404, { message: "Ese slide ya no existe. Recargá la página." });

      const desktopUrl = (await putImage(requestEvent, "slide-desk", undefined, data.imageDesktop)) ?? (data.imageUrl || existing?.imageUrl || "");
      const mobileUrl = (await putImage(requestEvent, "slide-mob", undefined, data.imageMobile)) ?? (data.imageMobileUrl || "");
      if (!desktopUrl) {
        return requestEvent.fail(400, {
          message: "Falta la imagen principal.",
          fieldErrors: { imageUrl: "Subí una imagen o pegá su link." } as FieldErrors,
        });
      }

      const values = {
        imageUrl: desktopUrl,
        imageMobile: mobileUrl || desktopUrl,
        title: data.title,
        preTitle: data.preTitle || "Exclusivo LPRC",
        subtitle: data.subtitle,
        buttonText: data.buttonText || "Explorar",
        buttonLink: data.buttonLink || "/",
        isActive: data.isActive === "on" ? 1 : 0,
      };

      if (existing) {
        // The order belongs to drag and drop and the Subir/Bajar buttons only.
        await db.update(heroSlidesTable).set(values).where(eq(heroSlidesTable.id, existing.id));
        return { success: true, created: false, title: values.title };
      }

      const [{ last }] = await db.select({ last: sql<number>`coalesce(max(${heroSlidesTable.orderIndex}), 0)` }).from(heroSlidesTable);
      await db.insert(heroSlidesTable).values({
        id: "slide-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString(),
        ...values,
        orderIndex: Number(last) + 1,
        createdAt: new Date().toISOString(),
      });
      return { success: true, created: true, title: values.title };
    } catch (err: any) {
      console.error("Save slide error:", err);
      return requestEvent.fail(500, { message: data.id ? "No se pudo guardar el slide. Intentá de nuevo." : "No se pudo crear el slide. Intentá de nuevo." });
    }
  },
  zod$({
    id: z.string().optional(),
    preTitle: z.string().trim().max(60, "Usá hasta 60 caracteres.").optional(),
    title: z.string().trim().min(2, "Escribí un título de al menos 2 caracteres.").max(90, "Usá hasta 90 caracteres."),
    subtitle: z.string().trim().min(2, "Escribí una bajada de al menos 2 caracteres.").max(220, "Usá hasta 220 caracteres."),
    buttonText: z.string().trim().max(30, "Usá hasta 30 caracteres.").optional(),
    buttonLink: optionalLink(LINK_MESSAGE),
    imageUrl: optionalLink(IMAGE_LINK_MESSAGE),
    imageMobileUrl: optionalLink(IMAGE_LINK_MESSAGE),
    isActive: z.string().optional(),
    imageDesktop: z.any().optional(),
    imageMobile: z.any().optional(),
  })
);

export const useDeleteSlideAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      await db.delete(heroSlidesTable).where(eq(heroSlidesTable.id, data.id));
      return { success: true };
    } catch (err: any) {
      console.error("Delete slide error:", err);
      return requestEvent.fail(500, { message: "Error al eliminar el slide." });
    }
  },
  zod$({
    id: z.string(),
  })
);

export const useToggleActiveAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const id = data.id as string;
      const current = await db.select().from(heroSlidesTable).where(eq(heroSlidesTable.id, id)).limit(1);
      if (current.length === 0) return requestEvent.fail(404, { message: "Slide no encontrado." });

      const newActive = current[0].isActive === 1 ? 0 : 1;
      await db.update(heroSlidesTable).set({ isActive: newActive }).where(eq(heroSlidesTable.id, id));
      return { success: true, isActive: newActive };
    } catch (err: any) {
      console.error("Toggle active error:", err);
      return requestEvent.fail(500, { message: "Error al cambiar estado." });
    }
  },
  zod$({
    id: z.string(),
  })
);

export const useReorderSlidesAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const ids = data.ids as string[];
      for (let i = 0; i < ids.length; i++) {
        await db.update(heroSlidesTable).set({ orderIndex: i + 1 }).where(eq(heroSlidesTable.id, ids[i]));
      }
      return { success: true };
    } catch (err: any) {
      console.error("Reorder error:", err);
      return requestEvent.fail(500, { message: "Error al reordenar slides." });
    }
  },
  zod$({
    ids: z.array(z.string()),
  })
);

// --- IMAGE FIELD ---

/** Part of an image that `object-cover` keeps inside a box, in the image's own pixels. */
const visibleArea = (natural: SlideBox, box: SlideBox) => {
  const imageRatio = natural.width / natural.height;
  const boxRatio = box.width / box.height;
  if (imageRatio > boxRatio) {
    const width = natural.height * boxRatio;
    return { x: (natural.width - width) / 2, y: 0, width, height: natural.height };
  }
  const height = natural.width / boxRatio;
  return { x: 0, y: (natural.height - height) / 2, width: natural.width, height };
};

interface SlideImageFieldProps {
  id: string;
  name: string;
  urlName: string;
  label: string;
  guide: string;
  preview: string | null;
  url: string;
  box: SlideBox;
  boxLabel: string;
  /** On phones the text covers the whole width; on the desktop cover, the left part. */
  textWidth: number;
  error?: string;
  onFile$: QRL<(previewUrl: string) => void>;
  onUrl$: QRL<(url: string) => void>;
}

/**
 * Upload with a crop guide: the yellow frame is what the home shows at the measured size,
 * the shaded parts get cut and the hatched band is where the slide's text goes.
 */
const SlideImageField = component$<SlideImageFieldProps>((props) => {
  const input = useSignal<HTMLInputElement>();
  const dragOver = useSignal(false);
  const natural = useSignal<SlideBox | null>(null);
  const area = natural.value ? visibleArea(natural.value, props.box) : null;

  // An SVG <image> exposes no natural size, so a detached <img> measures each new picture.
  // eslint-disable-next-line qwik/no-use-visible-task -- needs the browser's image decoder
  useVisibleTask$(({ track, cleanup }) => {
    const src = track(() => props.preview);
    natural.value = null;
    if (!src) return;
    const probe = new Image();
    probe.onload = () => { natural.value = { width: probe.naturalWidth, height: probe.naturalHeight }; };
    probe.src = src;
    cleanup(() => { probe.onload = null; });
  });

  return (
    <div class="space-y-2">
      <span id={`${props.id}-label`} class={fieldLabelClass}>{props.label}</span>
      <div
        preventdefault:dragover
        preventdefault:drop
        onDragOver$={() => { dragOver.value = true; }}
        onDragLeave$={() => { dragOver.value = false; }}
        onDrop$={(event) => {
          dragOver.value = false;
          const file = event.dataTransfer?.files[0];
          if (!file || !file.type.startsWith("image/") || !input.value || !event.dataTransfer) return;
          input.value.files = event.dataTransfer.files;
          props.onFile$(URL.createObjectURL(file));
        }}
        class={["border-2 border-dashed p-3 transition-colors", dragOver.value ? "border-primary bg-amber-50" : "border-slate-300 bg-slate-50"]}
      >
        {props.preview ? (
          <svg
            viewBox={natural.value ? `0 0 ${natural.value.width} ${natural.value.height}` : "0 0 16 10"}
            class="h-48 w-full bg-brand-ink"
            role="img"
            aria-label={`Imagen elegida con la guía de recorte para ${props.boxLabel}`}
          >
            <image
              href={props.preview}
              width={natural.value?.width ?? 16}
              height={natural.value?.height ?? 10}
              preserveAspectRatio="xMidYMid slice"
            />
            {natural.value && area && (
              <>
                <path
                  fill-rule="evenodd"
                  fill="rgb(2 6 23 / 0.6)"
                  d={`M0 0H${natural.value.width}V${natural.value.height}H0Z M${area.x} ${area.y}h${area.width}v${area.height}h${-area.width}Z`}
                />
                <rect
                  x={area.x + area.width * 0.04}
                  y={area.y + area.height * 0.5}
                  width={area.width * props.textWidth}
                  height={area.height * 0.46}
                  fill="rgb(255 255 255 / 0.18)"
                  stroke="white"
                  stroke-dasharray="6 4"
                  vector-effect="non-scaling-stroke"
                />
                <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="none" stroke="#FFD700" stroke-width="3" vector-effect="non-scaling-stroke" />
              </>
            )}
          </svg>
        ) : (
          <div class="flex h-48 flex-col items-center justify-center gap-2 text-center text-slate-600">
            {props.id.includes("mobile") ? <LuSmartphone class="h-8 w-8 text-slate-400" /> : <LuImage class="h-8 w-8 text-slate-400" />}
            <p class="text-sm font-semibold">Arrastrá la imagen acá</p>
          </div>
        )}
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <input
            ref={input}
            id={props.id}
            type="file"
            name={props.name}
            accept="image/*"
            aria-describedby={`${props.id}-hint`}
            onChange$={(_, el) => {
              const file = el.files?.[0];
              if (file) props.onFile$(URL.createObjectURL(file));
            }}
            class="peer sr-only"
          />
          <label for={props.id} class="btn btn-outline btn-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
            <LuUpload class="h-4 w-4" /> {props.preview ? "Cambiar imagen" : "Elegir imagen"}
          </label>
          {natural.value && (
            <span class="text-xs text-slate-600">
              {natural.value.width}×{natural.value.height} px
            </span>
          )}
        </div>
      </div>
      <p id={`${props.id}-hint`} class={hintClass}>
        {props.guide} El recuadro amarillo es lo que se ve en {props.boxLabel}; la franja rayada, donde va el texto.
      </p>
      <div>
        <label for={`${props.id}-url`} class={fieldLabelClass}>O pegá el link de la imagen</label>
        <input
          id={`${props.id}-url`}
          type="url"
          inputMode="url"
          name={props.urlName}
          value={props.url}
          placeholder="https://..."
          aria-invalid={props.error ? "true" : undefined}
          aria-describedby={describeError(`${props.id}-url`, props.error)}
          onChange$={(_, el) => props.onUrl$(el.value.trim())}
          class="field font-mono text-sm"
        />
        {fieldError(`${props.id}-url`, props.error)}
      </div>
    </div>
  );
});

// --- EDITOR ---

interface SlideEditorProps {
  slide: SlideRow | null;
  onClose$: QRL<() => void>;
  onSaved$: QRL<(message: string) => void>;
}

const SlideEditor = component$<SlideEditorProps>((props) => {
  const saveAction = useSaveSlideAction();
  const slide = props.slide;
  const formId = slide ? "slide-edit-form" : "slide-create-form";
  const preTitle = useSignal(slide?.preTitle ?? "");
  const title = useSignal(slide?.title ?? "");
  const subtitle = useSignal(slide?.subtitle ?? "");
  const buttonText = useSignal(slide?.buttonText ?? "");
  const buttonLink = useSignal(slide?.buttonLink ?? "");
  const isActive = useSignal(slide ? slide.isActive === 1 : true);
  const images = useStore({
    desktopUrl: slide?.imageUrl ?? "",
    desktopPreview: slide?.imageUrl || (null as string | null),
    // A slide saved without its own phone image stores the desktop one twice.
    mobileUrl: slide && slide.imageMobile !== slide.imageUrl ? slide.imageMobile ?? "" : "",
    mobilePreview: slide && slide.imageMobile !== slide.imageUrl ? slide.imageMobile || null : (null as string | null),
  });
  const boxes = useStore<SlideBoxes>({ desktop: null, mobile: null });

  const result = saveAction.value as { failed?: boolean; message?: string; fieldErrors?: FieldErrors } | undefined;
  const errors: FieldErrors = result?.failed ? result.fieldErrors ?? {} : {};
  const linkLooksWrong = !!buttonLink.value.trim() && !isValidSiteLink(buttonLink.value);

  const previewSlide: PreviewSlide = {
    id: slide?.id ?? "nuevo",
    imageUrl: images.desktopPreview || PLACEHOLDER_IMAGE,
    imageMobile: images.mobilePreview || null,
    title: title.value || "Título del slide",
    subtitle: subtitle.value || "Bajada del slide",
    preTitle: preTitle.value || "Exclusivo LPRC",
    buttonText: buttonText.value || "Explorar",
    buttonLink: buttonLink.value || "/",
  };

  const textInput = (
    name: "preTitle" | "title" | "buttonText" | "buttonLink",
    label: string,
    value: typeof title,
    options: { placeholder: string; hint?: string; maxLength: number; mono?: boolean },
  ) => {
    const id = `${formId}-${name}`;
    const error = errors[name] ?? (name === "buttonLink" && linkLooksWrong ? LINK_MESSAGE : undefined);
    return (
      <div>
        <label for={id} class={fieldLabelClass}>{label}</label>
        <input
          id={id}
          type="text"
          name={name}
          value={value.value}
          maxLength={options.maxLength}
          placeholder={options.placeholder}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describeError(id, error, !!options.hint)}
          onInput$={(_, el) => { value.value = el.value; }}
          class={["field", options.mono ? "font-mono" : ""]}
        />
        {fieldError(id, error)}
        {options.hint && <p id={`${id}-hint`} class={hintClass}>{options.hint}</p>}
      </div>
    );
  };

  return (
    <Form
      id={formId}
      action={saveAction}
      enctype="multipart/form-data"
      noValidate
      onSubmitCompleted$={async () => {
        const outcome = saveAction.value;
        if (outcome?.success) {
          await props.onSaved$(`«${outcome.title}» ${outcome.created ? "se agregó al final del carrusel." : "se guardó."}`);
          await props.onClose$();
        } else {
          focusFirstInvalid(formId);
        }
      }}
      class="flex h-full flex-col"
    >
      <div class="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-8">
        <div>
          <p class="eyebrow text-[11px] text-amber-900">{slide ? "Editar slide" : "Nuevo slide"}</p>
          <h2 id="slide-editor-title" class="heading-display text-2xl text-primary break-words">{slide ? slide.title : "Agregar al carrusel"}</h2>
        </div>
        <button type="button" onClick$={props.onClose$} aria-label="Cerrar sin guardar" class={iconButtonClass}>
          <LuX class="h-5 w-5" />
        </button>
      </div>

      <div class="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-8">
        {slide && <input type="hidden" name="id" value={slide.id} />}
        {result?.failed && (
          <div role="alert" tabIndex={-1} data-form-error class="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800 focus:outline-none">
            <p class="font-bold">{result.message || "No se pudo guardar. Revisá los datos e intentá de nuevo."}</p>
          </div>
        )}

        <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <fieldset class="min-w-0 space-y-4">
            <legend class="heading-display mb-2 text-lg text-primary">Textos</legend>
            {textInput("preTitle", "Etiqueta (opcional)", preTitle, { placeholder: "Ej: Exclusivo socios", maxLength: 60, hint: "Va en el recuadro amarillo, arriba del título." })}
            {textInput("title", "Título", title, { placeholder: "Ej: Temporada 2026 LPRC", maxLength: 90 })}
            <div>
              <label for={`${formId}-subtitle`} class={fieldLabelClass}>Bajada</label>
              <textarea
                id={`${formId}-subtitle`}
                name="subtitle"
                rows={3}
                maxLength={220}
                value={subtitle.value}
                placeholder="Ej: Presentá tu cupón y disfrutá de los descuentos de la familia amarilla."
                aria-invalid={errors.subtitle ? "true" : undefined}
                aria-describedby={describeError(`${formId}-subtitle`, errors.subtitle)}
                onInput$={(_, el) => { subtitle.value = el.value; }}
                class="field"
              />
              {fieldError(`${formId}-subtitle`, errors.subtitle)}
            </div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {textInput("buttonText", "Texto del botón", buttonText, { placeholder: "Explorar", maxLength: 30 })}
              {textInput("buttonLink", "Link destino", buttonLink, { placeholder: "/beneficios/", maxLength: 300, mono: true, hint: "Ruta del sitio (/beneficios/) o link https://." })}
            </div>
            <div class="flex items-start gap-3 border border-line bg-slate-50 p-4">
              <input
                type="checkbox"
                id={`${formId}-isActive`}
                name="isActive"
                checked={isActive.value}
                onChange$={(_, el) => { isActive.value = el.checked; }}
                class="mt-0.5 h-5 w-5 shrink-0 accent-primary"
              />
              <label for={`${formId}-isActive`} class="text-sm font-bold text-primary cursor-pointer">
                Visible en la portada
                <span class="block text-xs font-normal text-slate-600">Destildalo para guardarlo oculto y mostrarlo más adelante.</span>
              </label>
            </div>
          </fieldset>

          <fieldset class="min-w-0 space-y-6">
            <legend class="heading-display mb-2 text-lg text-primary">Imágenes</legend>
            <SlideImageField
              id={`${formId}-desktop`}
              name="imageDesktop"
              urlName="imageUrl"
              label="Imagen principal"
              guide="Horizontal, de al menos 1600 px de ancho (ej: 1600×1000). La portada la recorta según la pantalla: dejá lo importante en el centro."
              preview={images.desktopPreview}
              url={images.desktopUrl}
              box={boxes.desktop ?? FALLBACK_BOXES.desktop}
              boxLabel={`una computadora de 1440 px (${(boxes.desktop ?? FALLBACK_BOXES.desktop).width}×${(boxes.desktop ?? FALLBACK_BOXES.desktop).height})`}
              textWidth={0.8}
              error={errors.imageUrl}
              onFile$={(url) => { images.desktopPreview = url; }}
              onUrl$={(url) => { images.desktopUrl = url; if (url && isValidSiteLink(url)) images.desktopPreview = url; }}
            />
            <SlideImageField
              id={`${formId}-mobile`}
              name="imageMobile"
              urlName="imageMobileUrl"
              label="Imagen para celular (opcional)"
              guide="Cuadrada o apenas vertical (ej: 1080×1080). Si no subís una, el celular usa la principal."
              preview={images.mobilePreview}
              url={images.mobileUrl}
              box={boxes.mobile ?? FALLBACK_BOXES.mobile}
              boxLabel={`un celular de 390 px (${(boxes.mobile ?? FALLBACK_BOXES.mobile).width}×${(boxes.mobile ?? FALLBACK_BOXES.mobile).height})`}
              textWidth={0.92}
              error={errors.imageMobileUrl}
              onFile$={(url) => { images.mobilePreview = url; }}
              onUrl$={(url) => { images.mobileUrl = url; images.mobilePreview = url && isValidSiteLink(url) ? url : null; }}
            />
          </fieldset>
        </div>

        <section aria-labelledby={`${formId}-preview-title`} class="space-y-3 border-t border-line pt-6">
          <div>
            <h3 id={`${formId}-preview-title`} class="heading-display text-lg text-primary">Vista previa en la portada</h3>
            <p class="text-sm text-slate-600">Es la portada real con este slide, en una computadora y en un celular. Se actualiza mientras escribís.</p>
          </div>
          <HeroPreviewFrames slides={[previewSlide]} boxes={boxes} />
        </section>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-3 border-t-2 border-primary bg-white px-5 py-3 sm:px-8">
        <button type="button" disabled={saveAction.isRunning} onClick$={props.onClose$} class="btn btn-outline flex-1 px-3 sm:flex-none sm:px-6">
          Cancelar
        </button>
        <button type="submit" disabled={saveAction.isRunning} class="btn btn-dark flex-1 px-3 sm:flex-none sm:px-6">
          {saveAction.isRunning ? "Guardando..." : slide ? (
            <>
              Guardar<span class="hidden sm:inline">&nbsp;cambios</span>
            </>
          ) : (
            "Agregar slide"
          )}
        </button>
      </div>
    </Form>
  );
});

// --- PAGE ---

export default component$(() => {
  const slidesLoader = useAdminSlidesLoader();
  const deleteSlideAction = useDeleteSlideAction();
  const toggleActiveAction = useToggleActiveAction();
  const reorderSlidesAction = useReorderSlidesAction();

  const editorDialog = useSignal<HTMLDialogElement>();
  // Never null, so props read from it stay valid while the editor unmounts.
  const editor = useStore<{ open: boolean; slide: SlideRow | null; key: number }>({ open: false, slide: null, key: 0 });
  const saveNotice = useSignal("");

  // Client-side Visual Array of Slides for HTML5 Drag & Drop sorting
  const localSlides = useStore<{ list: SlideRow[] }>({ list: [] });
  useTask$(({ track }) => {
    track(() => slidesLoader.value);
    localSlides.list = [...slidesLoader.value];
  });

  useTask$(({ track }) => {
    const open = track(() => editor.open);
    if (!isBrowser || !editorDialog.value) return;
    if (open && !editorDialog.value.open) editorDialog.value.showModal();
    if (!open && editorDialog.value.open) editorDialog.value.close();
  });

  const openEditor$ = $((slide: SlideRow | null) => {
    saveNotice.value = "";
    editor.slide = slide;
    editor.key++;
    editor.open = true;
  });

  const closeEditor$ = $(() => {
    editor.open = false;
  });

  // HTML5 Drag & Drop Card indices tracking
  const draggedIdx = useSignal<number | null>(null);
  const draggedOverIdx = useSignal<number | null>(null);

  // Shared by drag & drop and the Subir/Bajar buttons; restores the old order if the save fails.
  const moveSlide$ = $(async (from: number, to: number) => {
    if (from === to || to < 0 || to >= localSlides.list.length) return;
    const previous = [...localSlides.list];
    const items = [...localSlides.list];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    localSlides.list = items;
    const { value } = await reorderSlidesAction.submit({ ids: items.map((x) => x.id) });
    if (value.failed) localSlides.list = previous;
  });

  const isDeleteOpen = useSignal(false);
  const deleteTarget = useSignal<{ id: string; title: string } | null>(null);
  const deleteError = useSignal("");

  const confirmDeleteSlide$ = $(async () => {
    if (!deleteTarget.value) return;
    const { value } = await deleteSlideAction.submit({ id: deleteTarget.value.id });
    if (value.failed) {
      deleteError.value = value.message || "No se pudo eliminar el slide. Intentá de nuevo.";
      return;
    }
    isDeleteOpen.value = false;
  });

  const visibleSlides: PreviewSlide[] = localSlides.list
    .filter((slide) => slide.isActive === 1)
    .map((slide) => ({
      id: slide.id,
      imageUrl: slide.imageUrl,
      imageMobile: slide.imageMobile,
      title: slide.title,
      subtitle: slide.subtitle,
      preTitle: slide.preTitle,
      buttonText: slide.buttonText,
      buttonLink: slide.buttonLink,
    }));

  return (
    <div class="relative flex w-full flex-1 flex-col space-y-8 overflow-y-auto px-4 py-8 pb-24 text-left font-sans text-slate-800 sm:px-10 sm:py-10">
      <AdminPageHeader
        eyebrow="Portada"
        title="Carrusel"
        description="Los slides que rotan junto al bloque del club en la portada. Arrastralos o usá Subir y Bajar para cambiar el orden."
      >
        <button type="button" onClick$={() => openEditor$(null)} class="btn btn-dark">
          <LuPlus class="h-4 w-4" />
          Nuevo slide
        </button>
      </AdminPageHeader>

      <div class="space-y-3">
        {saveNotice.value && <Notice>{saveNotice.value}</Notice>}
        <ActionFeedback
          value={toggleActiveAction.value}
          success={(toggleActiveAction.value as { isActive?: number } | undefined)?.isActive === 1 ? "El slide ahora se muestra en la portada." : "El slide quedó oculto."}
        />
        <ActionFeedback value={deleteSlideAction.value} success="Slide eliminado." />
        <ActionFeedback value={reorderSlidesAction.value} success="Orden del carrusel guardado." />
      </div>

      <section aria-labelledby="slides-list-title" class="space-y-4">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="slides-list-title" class="heading-display text-xl text-primary">Slides</h2>
          <p class="text-sm text-slate-600" aria-live="polite">
            {reorderSlidesAction.isRunning
              ? "Guardando el orden..."
              : `${visibleSlides.length} visibles de ${localSlides.list.length}. El orden se guarda al instante.`}
          </p>
        </div>

        {localSlides.list.length === 0 ? (
          <div class="border-2 border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-600">
            Todavía no hay slides. Tocá “Nuevo slide” para cargar el primero.
          </div>
        ) : (
          <ol class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {localSlides.list.map((slide, idx) => {
              const isDragged = idx === draggedIdx.value;
              const isOver = idx === draggedOverIdx.value;
              const visible = slide.isActive === 1;
              return (
                <li
                  key={slide.id}
                  draggable={true}
                  preventdefault:dragover={true}
                  onDragStart$={(ev) => {
                    draggedIdx.value = idx;
                    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver$={() => {
                    draggedOverIdx.value = idx;
                  }}
                  onDrop$={$(async () => {
                    if (draggedIdx.value === null || draggedOverIdx.value === null) return;
                    const from = draggedIdx.value;
                    const to = draggedOverIdx.value;
                    draggedIdx.value = null;
                    draggedOverIdx.value = null;
                    await moveSlide$(from, to);
                  })}
                  onDragEnd$={() => {
                    draggedIdx.value = null;
                    draggedOverIdx.value = null;
                  }}
                  class={[
                    "flex flex-col border bg-white transition-colors",
                    isDragged ? "border-2 border-dashed border-primary opacity-40" : isOver ? "border-2 border-dashed border-accent" : "border-line",
                    visible ? "" : "bg-slate-50",
                  ]}
                >
                  <div class="relative">
                    <img
                      src={slide.imageUrl}
                      alt=""
                      loading="lazy"
                      width={640}
                      height={360}
                      class={["aspect-video w-full object-cover", visible ? "" : "opacity-60 grayscale"]}
                    />
                    <span class="absolute left-2 top-2 inline-flex h-9 w-9 cursor-grab items-center justify-center bg-brand-ink/70 text-white active:cursor-grabbing" title="Arrastrá para cambiar el orden">
                      <LuGripVertical class="h-4 w-4" />
                    </span>
                    <span class={["badge absolute right-2 top-2", visible ? "badge-accent" : "badge-muted"]}>
                      {visible ? <LuEye class="h-3 w-3" /> : <LuEyeOff class="h-3 w-3" />}
                      {visible ? "Visible" : "Oculto"}
                    </span>
                    {slide.imageMobile && slide.imageMobile !== slide.imageUrl && (
                      <img
                        src={slide.imageMobile}
                        alt=""
                        loading="lazy"
                        width={60}
                        height={60}
                        title="Imagen para celular"
                        class="absolute bottom-2 right-2 h-14 w-14 border-2 border-white object-cover"
                      />
                    )}
                  </div>
                  <div class="flex flex-1 flex-col gap-3 p-4">
                    <div class="min-w-0 space-y-1">
                      <p class="eyebrow text-[11px] text-amber-900">
                        <span class="text-slate-600">#{idx + 1}</span> · {slide.preTitle || "Exclusivo LPRC"}
                      </p>
                      <h3 class="heading-display text-xl text-primary break-words">{slide.title}</h3>
                      <p class="line-clamp-2 text-sm text-slate-600">{slide.subtitle}</p>
                    </div>
                    <dl class="space-y-1 text-xs text-slate-700">
                      <div class="flex gap-1.5">
                        <dt class="font-bold">Botón:</dt>
                        <dd class="min-w-0 truncate">
                          {slide.buttonText || "Explorar"} → <span class="font-mono">{slide.buttonLink || "/"}</span>
                        </dd>
                      </div>
                      <div class="flex gap-1.5">
                        <dt class="font-bold">Celular:</dt>
                        <dd>{slide.imageMobile && slide.imageMobile !== slide.imageUrl ? "imagen propia" : "usa la principal"}</dd>
                      </div>
                    </dl>
                    <div class="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
                      <div class="flex items-center">
                        <button
                          type="button"
                          onClick$={() => moveSlide$(idx, idx - 1)}
                          disabled={idx === 0 || reorderSlidesAction.isRunning}
                          aria-label={`Subir ${slide.title}`}
                          title="Subir"
                          class={iconButtonClass}
                        >
                          <LuArrowUp class="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick$={() => moveSlide$(idx, idx + 1)}
                          disabled={idx === localSlides.list.length - 1 || reorderSlidesAction.isRunning}
                          aria-label={`Bajar ${slide.title}`}
                          title="Bajar"
                          class={iconButtonClass}
                        >
                          <LuArrowDown class="h-4 w-4" />
                        </button>
                      </div>
                      <div class="flex items-center">
                        <button type="button" onClick$={() => openEditor$(slide)} class={iconButtonClass} title="Editar" aria-label={`Editar ${slide.title}`}>
                          <LuPencil class="h-4 w-4" />
                        </button>
                        <Form action={toggleActiveAction}>
                          <input type="hidden" name="id" value={slide.id} />
                          <button
                            type="submit"
                            disabled={toggleActiveAction.isRunning}
                            aria-label={visible ? `Ocultar ${slide.title}` : `Mostrar ${slide.title}`}
                            title={visible ? "Ocultar" : "Mostrar"}
                            class={iconButtonClass}
                          >
                            {visible ? <LuEyeOff class="h-4 w-4" /> : <LuEye class="h-4 w-4" />}
                          </button>
                        </Form>
                        <button
                          type="button"
                          onClick$={() => {
                            deleteTarget.value = { id: slide.id, title: slide.title };
                            deleteError.value = "";
                            isDeleteOpen.value = true;
                          }}
                          class={`${iconButtonClass} text-red-700 hover:bg-red-50 hover:text-red-800`}
                          title="Eliminar"
                          aria-label={`Eliminar ${slide.title}`}
                        >
                          <LuTrash2 class="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {visibleSlides.length > 0 && (
        <section aria-labelledby="slides-preview-title" class="card space-y-4 p-5 sm:p-6">
          <div>
            <h2 id="slides-preview-title" class="heading-display text-xl text-primary">Así se ve la portada</h2>
            <p class="text-sm text-slate-600">La portada real con los slides visibles, en el orden de arriba.</p>
          </div>
          <HeroPreviewFrames slides={visibleSlides} />
        </section>
      )}

      <dialog
        ref={editorDialog}
        aria-labelledby="slide-editor-title"
        class="fixed inset-0 m-auto h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-6xl overflow-hidden border-t-4 border-accent bg-white p-0 text-left text-slate-800 shadow-xl backdrop:bg-brand-ink/60"
        preventdefault:cancel
        onCancel$={closeEditor$}
        onClose$={closeEditor$}
      >
        {editor.open && (
          <SlideEditor
            key={editor.key}
            slide={editor.slide}
            onClose$={closeEditor$}
            onSaved$={(message) => { saveNotice.value = message; }}
          />
        )}
      </dialog>

      <ConfirmDialog
        open={isDeleteOpen}
        title="Eliminar slide"
        confirmLabel="Eliminar slide"
        pending={deleteSlideAction.isRunning}
        error={deleteError.value}
        onConfirm$={confirmDeleteSlide$}
      >
        <p>“{deleteTarget.value?.title}” se eliminará del carrusel de forma permanente.</p>
      </ConfirmDialog>
    </div>
  );
});

export const head: DocumentHead = {
  title: "LPRC Club - Carrusel Hero",
  meta: [
    {
      name: "description",
      content: "Administrar los slides del carrusel de la portada.",
    },
  ],
};
