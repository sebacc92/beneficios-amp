import { $, component$, useSignal, useVisibleTask$, type QRL } from "@builder.io/qwik";
import { Form, routeAction$, routeLoader$, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuGift, LuPencil, LuPlus, LuTrash2, LuTrophy, LuX } from "@qwikest/icons/lucide";
import { ActionFeedback, Notice } from "~/components/admin/action-feedback";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { AdminPageHeader } from "~/components/admin/page-header";
import {
  clubImageError,
  deleteRaffle,
  getRaffle,
  listRafflesForAdmin,
  saveRaffle,
  type Raffle,
} from "~/server/club-content";
import { putImage } from "~/server/media";
import { buenosAiresDay, daysUntilCalendarDay, drawCountdownLabel, formatCalendarDay, splitRafflesByDrawDate } from "~/utils/club-content";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

/** Finished, published and still without winners: what the admin owes the members. */
const needsWinner = (raffle: Raffle, today: string) => raffle.status === "published" && raffle.drawDate < today && !raffle.winners?.trim();

export const useAdminRafflesLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  const today = buenosAiresDay();
  try {
    const { active, past } = splitRafflesByDrawDate(await listRafflesForAdmin(event));
    return { today, active, past, missingWinners: past.filter((raffle) => needsWinner(raffle, today)) };
  } catch (err) {
    console.error("Failed to load raffles:", err);
    return { today, active: [] as Raffle[], past: [] as Raffle[], missingWinners: [] as Raffle[] };
  }
});

// Six or more digits in a row is a full DNI or phone number; winners are public.
const FULL_NUMBER = /\d{6,}/;

export const useSaveRaffleAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    const imageError = clubImageError(data.image);
    if (imageError) return requestEvent.fail(400, { message: imageError });

    try {
      const existing = data.id ? await getRaffle(requestEvent, data.id) : undefined;
      if (data.id && !existing) return requestEvent.fail(404, { message: "El sorteo ya no existe. Recargá la página." });

      const keptImage = data.removeImage === "on" ? null : existing?.image ?? null;
      const image = (await putImage(requestEvent, "raffle", undefined, data.image)) ?? keptImage;
      const status = data.intent === "draft" ? "draft" : "published";
      await saveRaffle(requestEvent, {
        title: data.title.trim(),
        description: data.description.trim(),
        drawDate: data.drawDate,
        prizeDetail: data.prizeDetail.trim(),
        terms: data.terms.trim(),
        requirements: data.requirements?.trim() || null,
        // The field stays disabled (and is not sent) until the draw day.
        winners: data.winners === undefined ? existing?.winners ?? null : data.winners.trim() || null,
        status,
        image,
      }, data.id || undefined);

      const message =
        status === "draft"
          ? "Borrador guardado. No se ve en /sorteos hasta que lo publiques."
          : existing?.status === "published"
            ? "Sorteo actualizado."
            : "Sorteo publicado en /sorteos.";
      return { success: true, message };
    } catch (err) {
      console.error("Save raffle error:", err);
      return requestEvent.fail(500, { message: "No se pudo guardar el sorteo. Intentá de nuevo." });
    }
  },
  zod$({
    id: z.string().optional(),
    intent: z.enum(["draft", "published"]).default("published"),
    title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres."),
    description: z.string().trim().min(10, "Contá de qué se trata en al menos 10 caracteres."),
    drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha del sorteo."),
    prizeDetail: z.string().trim().min(3, "Indicá el premio."),
    terms: z.string().trim().min(10, "Las bases y condiciones son obligatorias."),
    requirements: z.string().optional(),
    winners: z
      .string()
      .optional()
      .refine((value) => !value || !FULL_NUMBER.test(value), "No publiques el DNI completo: dejá solo los últimos 3 o 4 números (DNI ***1234)."),
    removeImage: z.string().optional(),
    image: z.any().optional(),
  }),
);

export const useDeleteRaffleAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });
    try {
      if (!(await deleteRaffle(requestEvent, data.id))) {
        return requestEvent.fail(404, { message: "El sorteo ya no existe." });
      }
      return { success: true };
    } catch (err) {
      console.error("Delete raffle error:", err);
      return requestEvent.fail(500, { message: "No se pudo eliminar el sorteo." });
    }
  },
  zod$({ id: z.string() }),
);

const errorClass = "mt-1 text-xs text-red-700";
const iconButton = "inline-flex h-11 w-11 items-center justify-center border border-line hover:border-primary cursor-pointer";

interface RaffleDraft {
  title: string;
  description: string;
  drawDate: string;
  prizeDetail: string;
  requirements: string;
  image: string | null;
  today: string;
}

/** The "Sorteos vigentes" card of /sorteos, fed by the form. */
const RaffleCardPreview = component$<{ draft: RaffleDraft }>(({ draft }) => {
  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(draft.drawDate);
  const finished = hasDate && draft.drawDate < draft.today;
  return (
    <article class="border border-line bg-surface">
      <div class="relative aspect-[16/9] bg-secondary">
        {draft.image ? (
          <img src={draft.image} alt="" width={640} height={360} class="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div class="absolute inset-0 flex items-center justify-center">
            <LuGift class="h-16 w-16 text-accent" aria-hidden="true" />
          </div>
        )}
        <span class={["badge absolute left-3 top-3", finished ? "badge-muted" : "badge-accent"]}>{finished ? "Finalizado" : "Vigente"}</span>
      </div>
      <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b-4 border-accent bg-primary px-5 py-4 text-white">
        <p class="font-display text-2xl font-bold uppercase leading-none tracking-wide text-accent">
          {hasDate ? (finished ? "Ya se sorteó" : drawCountdownLabel(daysUntilCalendarDay(draft.drawDate, new Date(`${draft.today}T12:00:00-03:00`)))) : "Se sortea en..."}
        </p>
        <p class="eyebrow text-slate-200">Sorteo: {hasDate ? formatCalendarDay(draft.drawDate) : "DD/MM/AAAA"}</p>
      </div>
      <div class="space-y-4 p-5">
        <div>
          <h3 class="heading-display text-2xl text-primary">{draft.title || "Título del sorteo"}</h3>
          {draft.description && <p class="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{draft.description}</p>}
        </div>
        <dl class="grid gap-px border border-line bg-line text-sm">
          <div class="bg-surface-muted p-3">
            <dt class="eyebrow text-amber-900">Premio</dt>
            <dd class="mt-1 font-semibold text-primary">{draft.prizeDetail || "—"}</dd>
          </div>
          <div class="bg-surface p-3">
            <dt class="eyebrow text-amber-900">Quiénes participan</dt>
            <dd class="mt-1 line-clamp-3 whitespace-pre-line text-slate-700">{draft.requirements.trim() || <span class="text-slate-500">Texto general del sitio (socios con DNI registrado, sin anotarse).</span>}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
});

const RaffleRow = component$<{ raffle: Raffle; today: string; onEdit$: QRL<(raffle: Raffle) => void>; onDelete$: QRL<(raffle: Raffle) => void> }>(
  ({ raffle, today, onEdit$, onDelete$ }) => {
    const finished = raffle.drawDate < today;
    const missing = needsWinner(raffle, today);
    return (
      <li class={["flex flex-col gap-4 border bg-surface p-4 sm:flex-row", missing ? "border-accent border-l-4" : "border-line"]}>
        <div class="relative h-32 w-full shrink-0 bg-secondary sm:h-24 sm:w-40">
          {raffle.image ? (
            <img src={raffle.image} alt="" width={160} height={96} loading="lazy" class={["h-full w-full object-cover", finished && "grayscale"]} />
          ) : (
            <div class="flex h-full w-full items-center justify-center">
              <LuGift class="h-7 w-7 text-accent" aria-hidden="true" />
            </div>
          )}
        </div>
        <div class="min-w-0 flex-1 space-y-1.5">
          <div class="flex flex-wrap items-center gap-2">
            {raffle.status === "draft" && <span class="badge border border-dashed border-slate-500 bg-surface text-slate-700">Borrador</span>}
            {finished ? <span class="badge badge-muted">Finalizado</span> : <span class="badge badge-accent">Vigente</span>}
            <span class="text-xs font-bold text-slate-600">Sortea: {formatCalendarDay(raffle.drawDate)}</span>
          </div>
          <h3 class="heading-display text-lg text-primary">{raffle.title}</h3>
          <p class="truncate text-sm text-slate-600">Premio: {raffle.prizeDetail}</p>
          {raffle.status === "draft" ? (
            <p class="text-xs text-slate-500">No se ve en /sorteos hasta que lo publiques.</p>
          ) : finished && (
            <p class={["flex items-start gap-1.5 text-xs", missing ? "font-bold text-amber-900" : "text-slate-600"]}>
              <LuTrophy class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span class="line-clamp-2 whitespace-pre-line">{raffle.winners?.trim() || "Falta cargar ganador"}</span>
            </p>
          )}
        </div>
        <div class="flex shrink-0 gap-2 sm:flex-col">
          <button type="button" onClick$={() => onEdit$(raffle)} aria-label={`Editar sorteo ${raffle.title}`} title="Editar" class={`${iconButton} text-primary`}>
            <LuPencil class="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick$={() => onDelete$(raffle)} aria-label={`Eliminar sorteo ${raffle.title}`} title="Eliminar" class={`${iconButton} text-red-700 hover:border-red-600 hover:bg-red-50`}>
            <LuTrash2 class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </li>
    );
  },
);

export default component$(() => {
  const raffles = useAdminRafflesLoader();
  const saveAction = useSaveRaffleAction();
  const deleteAction = useDeleteRaffleAction();

  const formOpen = useSignal(false);
  const editing = useSignal<Raffle | null>(null);
  const focusRequest = useSignal(0);
  const focusTarget = useSignal("raffle-title");
  const deleteOpen = useSignal(false);
  const deleteTarget = useSignal<{ id: string; title: string } | null>(null);
  const deleteError = useSignal("");
  const deleteNotice = useSignal("");

  const titleSig = useSignal("");
  const descriptionSig = useSignal("");
  const dateSig = useSignal("");
  const prizeSig = useSignal("");
  const requirementsSig = useSignal("");
  const imageSig = useSignal<string | null>(null);
  const removeImageSig = useSignal(false);

  // The form renders after the click, so focus (and scroll) once it is in the DOM.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    if (track(() => focusRequest.value) > 0) {
      const field = document.getElementById(focusTarget.value);
      field?.focus();
      field?.scrollIntoView({ block: "center" });
    }
  });

  const openForm$ = $((raffle: Raffle | null, focus = "raffle-title") => {
    editing.value = raffle;
    titleSig.value = raffle?.title ?? "";
    descriptionSig.value = raffle?.description ?? "";
    dateSig.value = raffle?.drawDate ?? "";
    prizeSig.value = raffle?.prizeDetail ?? "";
    requirementsSig.value = raffle?.requirements ?? "";
    imageSig.value = raffle?.image ?? null;
    removeImageSig.value = false;
    formOpen.value = true;
    deleteNotice.value = "";
    focusTarget.value = focus;
    focusRequest.value++;
  });

  const closeForm$ = $(() => {
    formOpen.value = false;
    editing.value = null;
  });

  const askDelete$ = $((raffle: Raffle) => {
    deleteTarget.value = { id: raffle.id, title: raffle.title };
    deleteError.value = "";
    deleteNotice.value = "";
    deleteOpen.value = true;
  });

  const { today, active, past, missingWinners } = raffles.value;
  const fieldErrors = saveAction.value?.failed ? saveAction.value.fieldErrors : undefined;
  const drawReached = /^\d{4}-\d{2}-\d{2}$/.test(dateSig.value) && dateSig.value <= today;
  const winnersMissing = drawReached && editing.value?.status === "published" && !editing.value.winners?.trim();
  const isDraft = editing.value?.status === "draft";
  const storedImage = editing.value?.image ?? null;
  const previewImage = removeImageSig.value && imageSig.value === storedImage ? null : imageSig.value;

  return (
    <div class="w-full px-4 sm:px-10 py-8 sm:py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 text-left">
      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar sorteo"
        confirmLabel="Eliminar sorteo"
        pending={deleteAction.isRunning}
        error={deleteError.value}
        onConfirm$={async () => {
          const target = deleteTarget.value;
          if (!target) return;
          const result = await deleteAction.submit({ id: target.id });
          if (result.value.failed) {
            deleteError.value = result.value.message || "No se pudo eliminar el sorteo.";
            return;
          }
          deleteNotice.value = `“${target.title}” se eliminó.`;
          deleteOpen.value = false;
        }}
      >
        <p>“{deleteTarget.value?.title}” dejará de verse en Sorteos, incluidos sus ganadores. Esta acción no se puede deshacer.</p>
      </ConfirmDialog>

      <AdminPageHeader
        title="Sorteos"
        description="Lo que los socios ven en /sorteos. Un sorteo figura como vigente hasta que termina su día; después pasa a “Sorteos finalizados” con sus ganadores. Los borradores no se publican."
      >
        <button
          type="button"
          onClick$={() => (formOpen.value && !editing.value ? closeForm$() : openForm$(null))}
          class="btn btn-dark whitespace-nowrap"
        >
          {formOpen.value && !editing.value ? <LuX class="w-4 h-4" aria-hidden="true" /> : <LuPlus class="w-4 h-4" aria-hidden="true" />}
          <span>{formOpen.value && !editing.value ? "Cerrar formulario" : "Nuevo sorteo"}</span>
        </button>
      </AdminPageHeader>

      {missingWinners.length > 0 && (
        <section aria-labelledby="missing-winners-title" class="border-l-4 border-accent bg-primary px-5 py-4 text-white">
          <h2 id="missing-winners-title" class="flex items-center gap-2 heading-display text-lg">
            <LuTrophy class="h-5 w-5 text-accent" aria-hidden="true" />
            Falta cargar ganador ({missingWinners.length})
          </h2>
          <p class="mt-1 text-sm text-slate-300">Ya se sortearon y en /sorteos figuran como “Resultado a confirmar”.</p>
          <ul class="mt-3 space-y-2">
            {missingWinners.map((raffle) => (
              <li key={raffle.id} class="flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-2">
                <span class="text-sm">
                  <strong>{raffle.title}</strong> · sorteado el {formatCalendarDay(raffle.drawDate)}
                </span>
                <button type="button" onClick$={() => openForm$(raffle, "raffle-winners")} class="btn btn-primary btn-sm">
                  Cargar ganador
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(saveAction.value || deleteNotice.value) && (
        <div class="space-y-4">
          <ActionFeedback value={saveAction.value} success={saveAction.value?.message} />
          {deleteNotice.value && <Notice>{deleteNotice.value}</Notice>}
        </div>
      )}

      {formOpen.value && (
        <Form
          action={saveAction}
          enctype="multipart/form-data"
          onSubmitCompleted$={() => {
            if (saveAction.value?.success) closeForm$();
          }}
          class="card grid gap-8 p-5 sm:p-8 xl:grid-cols-[minmax(0,1fr)_22rem]"
        >
          <div class="space-y-5">
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <h2 class="heading-display text-xl text-primary">{editing.value ? `Editar “${editing.value.title}”` : "Nuevo sorteo"}</h2>
                {editing.value && (
                  <p class="text-sm text-slate-600">{isDraft ? "Es un borrador: no se ve en /sorteos." : "Está publicado en /sorteos."}</p>
                )}
              </div>
              <button type="button" disabled={saveAction.isRunning} onClick$={closeForm$} class="btn btn-outline btn-sm">
                Cancelar
              </button>
            </div>
            <input type="hidden" name="id" value={editing.value?.id ?? ""} />

            <div class="grid gap-5 md:grid-cols-2">
              <div class="md:col-span-2">
                <label for="raffle-title" class="field-label">Título</label>
                <input id="raffle-title" name="title" required minLength={3} maxLength={120} value={titleSig.value} onInput$={(_, el) => (titleSig.value = el.value)} placeholder="Ej: Sorteo Aniversario del Club" class="field" aria-invalid={!!fieldErrors?.title} aria-describedby={fieldErrors?.title ? "raffle-title-error" : undefined} />
                {fieldErrors?.title && <p id="raffle-title-error" role="alert" class={errorClass}>{fieldErrors.title}</p>}
              </div>

              <div>
                <label for="raffle-date" class="field-label">Fecha del sorteo</label>
                <input id="raffle-date" name="drawDate" type="date" required value={dateSig.value} onInput$={(_, el) => (dateSig.value = el.value)} class="field" aria-invalid={!!fieldErrors?.drawDate} aria-describedby={fieldErrors?.drawDate ? "raffle-date-error" : undefined} />
                {fieldErrors?.drawDate && <p id="raffle-date-error" role="alert" class={errorClass}>{fieldErrors.drawDate}</p>}
              </div>

              <div>
                <label for="raffle-prize" class="field-label">Premio</label>
                <input id="raffle-prize" name="prizeDetail" required minLength={3} maxLength={120} value={prizeSig.value} onInput$={(_, el) => (prizeSig.value = el.value)} placeholder="Ej: 5 vouchers de $150.000" class="field" aria-invalid={!!fieldErrors?.prizeDetail} aria-describedby={fieldErrors?.prizeDetail ? "raffle-prize-error" : undefined} />
                {fieldErrors?.prizeDetail && <p id="raffle-prize-error" role="alert" class={errorClass}>{fieldErrors.prizeDetail}</p>}
              </div>

              <div class="md:col-span-2">
                <label for="raffle-description" class="field-label">Descripción</label>
                <textarea id="raffle-description" name="description" required minLength={10} rows={3} value={descriptionSig.value} onInput$={(_, el) => (descriptionSig.value = el.value)} class="field" aria-invalid={!!fieldErrors?.description} aria-describedby={fieldErrors?.description ? "raffle-description-error" : undefined} />
                {fieldErrors?.description && <p id="raffle-description-error" role="alert" class={errorClass}>{fieldErrors.description}</p>}
              </div>

              <div class="md:col-span-2">
                <label for="raffle-requirements" class="field-label">Quiénes participan (opcional)</label>
                <textarea
                  id="raffle-requirements"
                  name="requirements"
                  rows={2}
                  maxLength={400}
                  value={requirementsSig.value}
                  onInput$={(_, el) => (requirementsSig.value = el.value)}
                  placeholder="Ej: Socios con la cuota al día que hayan usado al menos un beneficio en noviembre."
                  aria-describedby="raffle-requirements-hint"
                  class="field"
                />
                <p id="raffle-requirements-hint" class="mt-1 text-xs text-slate-500">
                  Se muestra en la tarjeta de /sorteos. Si lo dejás vacío, se muestra el texto general: socios con DNI registrado en el portal, sin anotarse.
                </p>
              </div>

              <div class="md:col-span-2">
                <label for="raffle-terms" class="field-label">Bases y condiciones</label>
                <textarea id="raffle-terms" name="terms" required minLength={10} rows={4} value={editing.value?.terms ?? ""} class="field" aria-invalid={!!fieldErrors?.terms} aria-describedby={fieldErrors?.terms ? "raffle-terms-error" : undefined} />
                {fieldErrors?.terms && <p id="raffle-terms-error" role="alert" class={errorClass}>{fieldErrors.terms}</p>}
              </div>

              <div class={["md:col-span-2", winnersMissing && "border-l-4 border-accent bg-surface-muted p-4"]}>
                <label for="raffle-winners" class="field-label">Ganador/es</label>
                {winnersMissing && <p class="mb-2 text-sm font-bold text-amber-900">El sorteo ya se hizo: cargá quién ganó.</p>}
                <textarea
                  id="raffle-winners"
                  name="winners"
                  rows={2}
                  disabled={!drawReached}
                  value={editing.value?.winners ?? ""}
                  placeholder="Laura F. — DNI ***3847"
                  aria-invalid={!!fieldErrors?.winners}
                  aria-describedby={fieldErrors?.winners ? "raffle-winners-error raffle-winners-hint" : "raffle-winners-hint"}
                  class="field disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-slate-500"
                />
                {fieldErrors?.winners && <p id="raffle-winners-error" role="alert" class={errorClass}>{fieldErrors.winners}</p>}
                <p id="raffle-winners-hint" class="mt-1 text-xs text-slate-500">
                  {drawReached
                    ? "Uno por línea, con nombre e inicial del apellido y los últimos números del DNI: “Laura F. — DNI ***3847”. Nunca el DNI completo."
                    : `Se habilita el día del sorteo${/^\d{4}-\d{2}-\d{2}$/.test(dateSig.value) ? ` (${formatCalendarDay(dateSig.value)})` : ""}. Hasta entonces /sorteos no muestra ganadores.`}
                </p>
              </div>

              <div class="md:col-span-2">
                <label for="raffle-image" class="field-label">Imagen (opcional)</label>
                <input
                  id="raffle-image"
                  name="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-describedby="raffle-image-hint"
                  onChange$={(_, el) => {
                    const file = el.files?.[0];
                    imageSig.value = file ? URL.createObjectURL(file) : storedImage;
                    if (file) removeImageSig.value = false;
                  }}
                  class="block w-full text-sm text-slate-600 file:mr-4 file:min-h-11 file:cursor-pointer file:border file:border-primary file:bg-surface file:px-4 file:py-2 file:text-sm file:font-bold file:text-primary hover:file:bg-surface-muted"
                />
                <p id="raffle-image-hint" class="mt-1 text-xs text-slate-500">
                  Foto horizontal 16:9 (por ejemplo 1600×900) del premio, JPG, PNG o WebP de hasta 5 MB. Arriba a la izquierda va la etiqueta “Vigente”: dejá esa esquina sin texto.
                </p>
                {storedImage && (
                  <label class="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="removeImage" checked={removeImageSig.value} onChange$={(_, el) => (removeImageSig.value = el.checked)} class="h-4 w-4 accent-red-600" />
                    Quitar la imagen actual
                  </label>
                )}
              </div>
            </div>

            {/* The first submit button is the one Enter triggers, so it is the main action. */}
            <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="submit" name="intent" value="published" disabled={saveAction.isRunning} class="btn btn-primary sm:order-2">
                {saveAction.isRunning ? "Guardando..." : editing.value && !isDraft ? "Guardar cambios" : "Publicar sorteo"}
              </button>
              <button type="submit" name="intent" value="draft" disabled={saveAction.isRunning} class="btn btn-outline sm:order-1">
                {editing.value && !isDraft ? "Pasar a borrador" : "Guardar borrador"}
              </button>
            </div>
          </div>

          <section aria-labelledby="raffle-preview-title" class="space-y-2 xl:sticky xl:top-24 xl:self-start">
            <h3 id="raffle-preview-title" class="field-label">Vista previa en /sorteos</h3>
            <RaffleCardPreview
              draft={{
                title: titleSig.value,
                description: descriptionSig.value,
                drawDate: dateSig.value,
                prizeDetail: prizeSig.value,
                requirements: requirementsSig.value,
                image: previewImage,
                today,
              }}
            />
          </section>
        </Form>
      )}

      {active.length + past.length === 0 ? (
        <div class="card border-dashed p-10 text-center space-y-2">
          <LuGift class="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <p class="font-bold text-slate-700">Todavía no hay sorteos</p>
          <p class="text-sm text-slate-500">Mientras no haya ninguno publicado, los socios ven el aviso “No hay sorteos vigentes”.</p>
        </div>
      ) : (
        <>
          <section aria-labelledby="active-raffles-title" class="space-y-4">
            <h2 id="active-raffles-title" class="heading-display text-xl text-primary">Vigentes ({active.length})</h2>
            {active.length === 0 ? (
              <p class="text-sm text-slate-600">No hay sorteos vigentes.</p>
            ) : (
              <ul class="grid gap-3 xl:grid-cols-2">
                {active.map((raffle) => (
                  <RaffleRow key={raffle.id} raffle={raffle} today={today} onEdit$={(item) => openForm$(item)} onDelete$={askDelete$} />
                ))}
              </ul>
            )}
          </section>

          {past.length > 0 && (
            <section aria-labelledby="past-raffles-title" class="space-y-4">
              <h2 id="past-raffles-title" class="heading-display text-xl text-primary">Finalizados ({past.length})</h2>
              <ul class="grid gap-3 xl:grid-cols-2">
                {past.map((raffle) => (
                  <RaffleRow key={raffle.id} raffle={raffle} today={today} onEdit$={(item) => openForm$(item, needsWinner(item, today) ? "raffle-winners" : "raffle-title")} onDelete$={askDelete$} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "Sorteos - Panel de Administración LPRC",
};
