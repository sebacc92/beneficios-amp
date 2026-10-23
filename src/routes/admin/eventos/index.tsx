import { $, component$, useSignal, useVisibleTask$, type QRL } from "@builder.io/qwik";
import { Form, routeAction$, routeLoader$, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuCalendar, LuCopy, LuExternalLink, LuMapPin, LuPencil, LuPlus, LuTrash2, LuX } from "@qwikest/icons/lucide";
import { ActionFeedback, Notice } from "~/components/admin/action-feedback";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { AdminPageHeader } from "~/components/admin/page-header";
import {
  clubImageError,
  deleteClubEvent,
  getClubEvent,
  listClubEventsForAdmin,
  saveClubEvent,
  type ClubEvent,
} from "~/server/club-content";
import { putImage } from "~/server/media";
import { CLUB } from "~/utils/club";
import {
  EVENT_KINDS,
  buenosAiresLocalToIso,
  eventKindLabel,
  eventKindLabels,
  formatDateTime,
  formatEventDate,
  formatEventParts,
  isoToBuenosAiresLocal,
  splitEventsByDay,
} from "~/utils/club-content";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

export const useAdminEventsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    // Upcoming: nearest first. Past: latest first, the same split /eventos uses.
    return splitEventsByDay(await listClubEventsForAdmin(event));
  } catch (err) {
    console.error("Failed to load events:", err);
    return { upcoming: [] as ClubEvent[], past: [] as ClubEvent[] };
  }
});

const isWebLink = (value: string) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export const useSaveEventAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    const imageError = clubImageError(data.image);
    if (imageError) return requestEvent.fail(400, { message: imageError });

    try {
      const existing = data.id ? await getClubEvent(requestEvent, data.id) : undefined;
      if (data.id && !existing) return requestEvent.fail(404, { message: "El evento ya no existe. Recargá la página." });
      // A copy keeps the original's photo unless the admin picks another one or removes it.
      const source = existing ?? (data.duplicateOf ? await getClubEvent(requestEvent, data.duplicateOf) : undefined);

      const keptImage = data.removeImage === "on" ? null : source?.image ?? null;
      const image = (await putImage(requestEvent, "event", undefined, data.image)) ?? keptImage;
      await saveClubEvent(requestEvent, {
        title: data.title.trim(),
        description: data.description.trim(),
        date: buenosAiresLocalToIso(data.dateTime)!,
        location: data.location.trim(),
        image,
        kind: data.kind || null,
        registrationUrl: data.registrationUrl?.trim() || null,
      }, data.id || undefined);

      return { success: true, message: data.id ? "Evento actualizado." : "Evento publicado en la Agenda." };
    } catch (err) {
      console.error("Save event error:", err);
      return requestEvent.fail(500, { message: "No se pudo guardar el evento. Intentá de nuevo." });
    }
  },
  zod$({
    id: z.string().optional(),
    duplicateOf: z.string().optional(),
    title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres."),
    description: z.string().trim().min(10, "Contá de qué se trata en al menos 10 caracteres."),
    dateTime: z.string().refine((value) => buenosAiresLocalToIso(value) !== null, "Ingresá la fecha y la hora."),
    location: z.string().trim().min(3, "Indicá dónde es el evento."),
    kind: z.union([z.literal(""), z.enum(EVENT_KINDS)]).optional(),
    registrationUrl: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || isWebLink(value), "Pegá el link completo del formulario, empezando con https://"),
    removeImage: z.string().optional(),
    image: z.any().optional(),
  }),
);

export const useDeleteEventAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });
    try {
      if (!(await deleteClubEvent(requestEvent, data.id))) {
        return requestEvent.fail(404, { message: "El evento ya no existe." });
      }
      return { success: true };
    } catch (err) {
      console.error("Delete event error:", err);
      return requestEvent.fail(500, { message: "No se pudo eliminar el evento." });
    }
  },
  zod$({ id: z.string() }),
);

const errorClass = "mt-1 text-xs text-red-700";
const iconButton = "inline-flex h-11 w-11 items-center justify-center border border-line hover:border-primary cursor-pointer";

interface EventDraft {
  title: string;
  dateTime: string;
  location: string;
  kind: string;
  registrationUrl: string;
  image: string | null;
}

/** The /eventos card, fed by the form while it is being filled in. */
const EventCardPreview = component$<{ draft: EventDraft }>(({ draft }) => {
  const iso = buenosAiresLocalToIso(draft.dateTime);
  const parts = iso ? formatEventParts(iso) : null;
  const kind = eventKindLabel(draft.kind);
  return (
    <article class="border border-line bg-surface">
      <div class="relative aspect-[16/9] bg-secondary">
        {draft.image ? (
          <img src={draft.image} alt="" width={640} height={360} class="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div class="absolute inset-0 flex items-center justify-center">
            <img src="/lprc.avif" alt="" width={120} height={101} class="w-20 opacity-90" />
          </div>
        )}
        <div class="absolute left-3 top-3 flex flex-wrap gap-2">
          <span class="badge badge-accent">Próximo</span>
          {kind && <span class="badge badge-dark">{kind}</span>}
        </div>
      </div>
      <div class="flex flex-wrap items-end gap-x-4 gap-y-1 border-b-4 border-accent bg-primary px-5 py-4 text-white">
        <p class="font-display text-3xl font-bold leading-none tracking-wide text-accent">{iso ? formatEventDate(iso) : "DD/MM/AAAA"}</p>
        <p class="eyebrow pb-0.5 text-slate-200">{parts ? `${parts.weekday} · ${parts.time} hs` : "Día · hora"}</p>
      </div>
      <div class="space-y-3 p-5">
        <h3 class="heading-display text-2xl text-primary">{draft.title || "Título del evento"}</h3>
        <p class="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <LuMapPin class="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          {draft.location || "Lugar"}
        </p>
        {isWebLink(draft.registrationUrl.trim()) && <span class="btn btn-primary btn-sm">Inscribirme</span>}
      </div>
    </article>
  );
});

const EventRow = component$<{
  eventItem: ClubEvent;
  past?: boolean;
  onEdit$: QRL<(eventItem: ClubEvent) => void>;
  onDuplicate$: QRL<(eventItem: ClubEvent) => void>;
  onDelete$: QRL<(eventItem: ClubEvent) => void>;
}>(({ eventItem, past, onEdit$, onDuplicate$, onDelete$ }) => {
  const kind = eventKindLabel(eventItem.kind);
  return (
    <li class={["flex flex-col gap-4 border border-line bg-surface p-4 sm:flex-row", past && "bg-surface-muted"]}>
      <div class="relative h-32 w-full shrink-0 bg-secondary sm:h-24 sm:w-40">
        {eventItem.image ? (
          <img src={eventItem.image} alt="" width={160} height={96} loading="lazy" class={["h-full w-full object-cover", past && "grayscale"]} />
        ) : (
          <div class="flex h-full w-full items-center justify-center text-slate-300">
            <LuCalendar class="h-7 w-7" aria-hidden="true" />
          </div>
        )}
      </div>
      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="flex flex-wrap items-center gap-2">
          {past ? <span class="badge badge-muted">Pasado</span> : <span class="badge badge-accent">Próximo</span>}
          {kind && <span class="badge badge-dark">{kind}</span>}
          <span class="text-xs font-bold text-slate-600">{formatDateTime(eventItem.date)} hs</span>
        </div>
        <h3 class="heading-display text-lg text-primary">{eventItem.title}</h3>
        <p class="flex items-center gap-1 text-sm text-slate-600">
          <LuMapPin class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span class="truncate">{eventItem.location}</span>
        </p>
        {eventItem.registrationUrl && (
          <a href={eventItem.registrationUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs font-bold text-secondary underline underline-offset-2">
            Link de inscripción
            <LuExternalLink class="h-3 w-3" aria-hidden="true" />
            <span class="sr-only"> (abre en una pestaña nueva)</span>
          </a>
        )}
      </div>
      <div class="flex shrink-0 gap-2 sm:flex-col">
        <button type="button" onClick$={() => onEdit$(eventItem)} aria-label={`Editar evento ${eventItem.title}`} title="Editar" class={`${iconButton} text-primary`}>
          <LuPencil class="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick$={() => onDuplicate$(eventItem)} aria-label={`Duplicar evento ${eventItem.title}`} title="Duplicar" class={`${iconButton} text-primary`}>
          <LuCopy class="h-4 w-4" aria-hidden="true" />
        </button>
        <button type="button" onClick$={() => onDelete$(eventItem)} aria-label={`Eliminar evento ${eventItem.title}`} title="Eliminar" class={`${iconButton} text-red-700 hover:border-red-600 hover:bg-red-50`}>
          <LuTrash2 class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
});

export default component$(() => {
  const events = useAdminEventsLoader();
  const saveAction = useSaveEventAction();
  const deleteAction = useDeleteEventAction();

  const formOpen = useSignal(false);
  const editing = useSignal<ClubEvent | null>(null);
  const duplicateOf = useSignal<ClubEvent | null>(null);
  const focusRequest = useSignal(0);
  const deleteOpen = useSignal(false);
  const deleteTarget = useSignal<{ id: string; title: string } | null>(null);
  const deleteError = useSignal("");
  const deleteNotice = useSignal("");

  const titleSig = useSignal("");
  const descriptionSig = useSignal("");
  const dateSig = useSignal("");
  const locationSig = useSignal("");
  const kindSig = useSignal("");
  const registrationSig = useSignal("");
  const imageSig = useSignal<string | null>(null);
  const removeImageSig = useSignal(false);

  // The form renders after the click, so focus (and scroll) once it is in the DOM.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    if (track(() => focusRequest.value) > 0) document.getElementById("event-title")?.focus();
  });

  const openForm$ = $((eventItem: ClubEvent | null, mode: "edit" | "duplicate" = "edit") => {
    editing.value = mode === "edit" ? eventItem : null;
    duplicateOf.value = mode === "duplicate" ? eventItem : null;
    titleSig.value = eventItem?.title ?? "";
    descriptionSig.value = eventItem?.description ?? "";
    // A copy is almost always for another date, so it starts without one.
    dateSig.value = eventItem && mode === "edit" ? isoToBuenosAiresLocal(eventItem.date) : "";
    locationSig.value = eventItem?.location ?? "";
    kindSig.value = eventKindLabel(eventItem?.kind) ? eventItem!.kind! : "";
    registrationSig.value = eventItem?.registrationUrl ?? "";
    imageSig.value = eventItem?.image ?? null;
    removeImageSig.value = false;
    formOpen.value = true;
    deleteNotice.value = "";
    focusRequest.value++;
  });

  const closeForm$ = $(() => {
    formOpen.value = false;
    editing.value = null;
    duplicateOf.value = null;
  });

  const askDelete$ = $((eventItem: ClubEvent) => {
    deleteTarget.value = { id: eventItem.id, title: eventItem.title };
    deleteError.value = "";
    deleteNotice.value = "";
    deleteOpen.value = true;
  });

  const fieldErrors = saveAction.value?.failed ? saveAction.value.fieldErrors : undefined;
  const { upcoming, past } = events.value;
  const storedImage = (editing.value ?? duplicateOf.value)?.image ?? null;
  const previewImage = removeImageSig.value && imageSig.value === storedImage ? null : imageSig.value;
  const registrationInvalid = registrationSig.value.trim() !== "" && !isWebLink(registrationSig.value.trim());

  return (
    <div class="w-full px-4 sm:px-10 py-8 sm:py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 text-left">
      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar evento"
        confirmLabel="Eliminar evento"
        pending={deleteAction.isRunning}
        error={deleteError.value}
        onConfirm$={async () => {
          const target = deleteTarget.value;
          if (!target) return;
          const result = await deleteAction.submit({ id: target.id });
          if (result.value.failed) {
            deleteError.value = result.value.message || "No se pudo eliminar el evento.";
            return;
          }
          deleteNotice.value = `“${target.title}” se eliminó de la Agenda.`;
          deleteOpen.value = false;
        }}
      >
        <p>“{deleteTarget.value?.title}” dejará de verse en la Agenda. Esta acción no se puede deshacer.</p>
      </ConfirmDialog>

      <AdminPageHeader
        title="Agenda"
        description="Torneos, clínicas y actividades que los socios ven en /eventos. Los eventos pasan solos a “Pasados” al día siguiente."
      >
        <button
          type="button"
          onClick$={() => (formOpen.value && !editing.value && !duplicateOf.value ? closeForm$() : openForm$(null))}
          class="btn btn-dark whitespace-nowrap"
        >
          {formOpen.value && !editing.value && !duplicateOf.value ? <LuX class="w-4 h-4" aria-hidden="true" /> : <LuPlus class="w-4 h-4" aria-hidden="true" />}
          <span>{formOpen.value && !editing.value && !duplicateOf.value ? "Cerrar formulario" : "Nuevo evento"}</span>
        </button>
      </AdminPageHeader>

      <aside class="flex flex-col gap-3 border-l-4 border-accent bg-primary px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-slate-200">
          La agenda completa del club está en <strong class="text-white">lprc.com.ar/eventos</strong>. No se importa sola: cargá acá los eventos que quieras destacar para los socios.
        </p>
        <a href={CLUB.agendaUrl} target="_blank" rel="noopener noreferrer" class="btn btn-outline-light btn-sm shrink-0">
          Ver agenda del club
          <LuExternalLink class="h-4 w-4" aria-hidden="true" />
          <span class="sr-only"> (abre en una pestaña nueva)</span>
        </a>
      </aside>

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
              <h2 class="heading-display text-xl text-primary">
                {editing.value ? `Editar “${editing.value.title}”` : duplicateOf.value ? "Copia de un evento" : "Nuevo evento"}
              </h2>
              <button type="button" disabled={saveAction.isRunning} onClick$={closeForm$} class="btn btn-outline btn-sm">
                Cancelar
              </button>
            </div>
            {duplicateOf.value && (
              <p class="border-l-4 border-accent bg-surface-muted px-4 py-3 text-sm text-slate-700">
                Copiamos los datos de “{duplicateOf.value.title}”. Elegí la nueva fecha y publicalo.
              </p>
            )}
            <input type="hidden" name="id" value={editing.value?.id ?? ""} />
            <input type="hidden" name="duplicateOf" value={duplicateOf.value?.id ?? ""} />

            <div class="grid gap-5 md:grid-cols-2">
              <div class="md:col-span-2">
                <label for="event-title" class="field-label">Título</label>
                <input id="event-title" name="title" required minLength={3} maxLength={120} value={titleSig.value} onInput$={(_, el) => (titleSig.value = el.value)} placeholder="Ej: Torneo Apertura — Primera División" class="field" aria-invalid={!!fieldErrors?.title} aria-describedby={fieldErrors?.title ? "event-title-error" : undefined} />
                {fieldErrors?.title && <p id="event-title-error" role="alert" class={errorClass}>{fieldErrors.title}</p>}
              </div>

              <div>
                <label for="event-kind" class="field-label">Tipo</label>
                <select id="event-kind" name="kind" value={kindSig.value} onChange$={(_, el) => (kindSig.value = el.value)} class="field cursor-pointer">
                  <option value="" selected={kindSig.value === ""}>Sin tipo</option>
                  {EVENT_KINDS.map((kind) => (
                    <option key={kind} value={kind} selected={kindSig.value === kind}>{eventKindLabels[kind]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label for="event-date" class="field-label">Fecha y hora</label>
                <input id="event-date" name="dateTime" type="datetime-local" required value={dateSig.value} onInput$={(_, el) => (dateSig.value = el.value)} class="field" aria-invalid={!!fieldErrors?.dateTime} aria-describedby={fieldErrors?.dateTime ? "event-date-error" : "event-date-hint"} />
                <p id="event-date-hint" class="mt-1 text-xs text-slate-500">Hora de La Plata.</p>
                {fieldErrors?.dateTime && <p id="event-date-error" role="alert" class={errorClass}>{fieldErrors.dateTime}</p>}
              </div>

              <div class="md:col-span-2">
                <label for="event-location" class="field-label">Lugar</label>
                <input id="event-location" name="location" required minLength={3} maxLength={160} value={locationSig.value} onInput$={(_, el) => (locationSig.value = el.value)} placeholder="Ej: Sede Gonnet, cancha principal" class="field" aria-invalid={!!fieldErrors?.location} aria-describedby={fieldErrors?.location ? "event-location-error" : undefined} />
                {fieldErrors?.location && <p id="event-location-error" role="alert" class={errorClass}>{fieldErrors.location}</p>}
              </div>

              <div class="md:col-span-2">
                <label for="event-description" class="field-label">Descripción</label>
                <textarea id="event-description" name="description" required minLength={10} rows={4} value={descriptionSig.value} onInput$={(_, el) => (descriptionSig.value = el.value)} class="field" aria-invalid={!!fieldErrors?.description} aria-describedby={fieldErrors?.description ? "event-description-error" : undefined} />
                {fieldErrors?.description && <p id="event-description-error" role="alert" class={errorClass}>{fieldErrors.description}</p>}
              </div>

              <div class="md:col-span-2">
                <label for="event-registration" class="field-label">Inscripción (opcional)</label>
                <input
                  id="event-registration"
                  name="registrationUrl"
                  type="url"
                  value={registrationSig.value}
                  onInput$={(_, el) => (registrationSig.value = el.value)}
                  placeholder="https://forms.gle/..."
                  class="field"
                  aria-invalid={registrationInvalid || !!fieldErrors?.registrationUrl}
                  aria-describedby={registrationInvalid || fieldErrors?.registrationUrl ? "event-registration-error" : "event-registration-hint"}
                />
                {registrationInvalid || fieldErrors?.registrationUrl ? (
                  <p id="event-registration-error" role="alert" class={errorClass}>{fieldErrors?.registrationUrl ?? "Pegá el link completo del formulario, empezando con https://"}</p>
                ) : (
                  <p id="event-registration-hint" class="mt-1 text-xs text-slate-500">Link del formulario o la página para anotarse. Con link, la tarjeta muestra “Inscribirme”.</p>
                )}
              </div>

              <div class="md:col-span-2">
                <label for="event-image" class="field-label">Imagen (opcional)</label>
                <input
                  id="event-image"
                  name="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-describedby="event-image-hint"
                  onChange$={(_, el) => {
                    const file = el.files?.[0];
                    imageSig.value = file ? URL.createObjectURL(file) : storedImage;
                    if (file) removeImageSig.value = false;
                  }}
                  class="block w-full text-sm text-slate-600 file:mr-4 file:min-h-11 file:cursor-pointer file:border file:border-primary file:bg-surface file:px-4 file:py-2 file:text-sm file:font-bold file:text-primary hover:file:bg-surface-muted"
                />
                <p id="event-image-hint" class="mt-1 text-xs text-slate-500">
                  Foto horizontal 16:9 (por ejemplo 1600×900), JPG, PNG o WebP de hasta 5 MB. En la computadora se recorta más alta: dejá lo importante en el centro y sin texto en los bordes.
                </p>
                {storedImage && (
                  <label class="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="removeImage" checked={removeImageSig.value} onChange$={(_, el) => (removeImageSig.value = el.checked)} class="h-4 w-4 accent-red-600" />
                    {duplicateOf.value ? "No copiar la imagen del evento original" : "Quitar la imagen actual"}
                  </label>
                )}
              </div>
            </div>

            <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="submit" disabled={saveAction.isRunning || registrationInvalid} class="btn btn-primary">
                {saveAction.isRunning ? "Guardando..." : editing.value ? "Guardar cambios" : "Publicar evento"}
              </button>
            </div>
          </div>

          <section aria-labelledby="event-preview-title" class="space-y-2 xl:sticky xl:top-24 xl:self-start">
            <h3 id="event-preview-title" class="field-label">Vista previa en /eventos</h3>
            <EventCardPreview
              draft={{
                title: titleSig.value,
                dateTime: dateSig.value,
                location: locationSig.value,
                kind: kindSig.value,
                registrationUrl: registrationSig.value,
                image: previewImage,
              }}
            />
            <p class="text-xs text-slate-500">Así se ve en el celular; en la computadora la foto va a la izquierda y la fecha al lado.</p>
          </section>
        </Form>
      )}

      <section aria-labelledby="upcoming-title" class="space-y-4">
        <h2 id="upcoming-title" class="heading-display text-xl text-primary">Próximos ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <div class="card border-dashed p-8 text-center space-y-2">
            <LuCalendar class="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
            <p class="font-bold text-slate-700">No hay eventos próximos</p>
            <p class="text-sm text-slate-500">Mientras no haya, “Agenda” no aparece en el menú del sitio y /eventos remite a la agenda del club.</p>
          </div>
        ) : (
          <ul class="grid gap-3 xl:grid-cols-2">
            {upcoming.map((eventItem) => (
              <EventRow key={eventItem.id} eventItem={eventItem} onEdit$={(item) => openForm$(item)} onDuplicate$={(item) => openForm$(item, "duplicate")} onDelete$={askDelete$} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <details class="group space-y-4">
          <summary class="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 heading-display text-xl text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
            <h2 class="inline">Pasados ({past.length})</h2>
            <span class="text-sm font-sans font-bold normal-case tracking-normal text-secondary underline underline-offset-2">
              <span class="group-open:hidden">Mostrar</span>
              <span class="hidden group-open:inline">Ocultar</span>
            </span>
          </summary>
          <p class="text-sm text-slate-600">Más recientes primero. Usá “Duplicar” para repetir un evento con otra fecha.</p>
          <ul class="grid gap-3 xl:grid-cols-2">
            {past.map((eventItem) => (
              <EventRow key={eventItem.id} past eventItem={eventItem} onEdit$={(item) => openForm$(item)} onDuplicate$={(item) => openForm$(item, "duplicate")} onDelete$={askDelete$} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "Agenda - Panel de Administración LPRC",
};
