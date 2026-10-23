import { $, component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Form, routeAction$, routeLoader$, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuCalendar, LuMapPin, LuPencil, LuPlus, LuTrash2 } from "@qwikest/icons/lucide";
import { ActionFeedback } from "~/components/admin/action-feedback";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import {
  clubImageError,
  deleteClubEvent,
  getClubEvent,
  listClubEventsForAdmin,
  saveClubEvent,
  type ClubEvent,
} from "~/server/club-content";
import { putImage } from "~/server/media";
import { buenosAiresDay, buenosAiresLocalToIso, formatDateTime, isoToBuenosAiresLocal } from "~/utils/club-content";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

export const useAdminEventsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  const today = buenosAiresDay();
  try {
    const rows = await listClubEventsForAdmin(event);
    return rows.map((row) => ({ ...row, isPast: buenosAiresDay(row.date) < today }));
  } catch (err) {
    console.error("Failed to load events:", err);
    return [];
  }
});

export const useSaveEventAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    const imageError = clubImageError(data.image);
    if (imageError) return requestEvent.fail(400, { message: imageError });

    try {
      const existing = data.id ? await getClubEvent(requestEvent, data.id) : undefined;
      if (data.id && !existing) return requestEvent.fail(404, { message: "El evento ya no existe. Recargá la página." });

      const keptImage = data.removeImage === "on" ? null : existing?.image ?? null;
      const image = (await putImage(requestEvent, "event", undefined, data.image)) ?? keptImage;
      await saveClubEvent(requestEvent, {
        title: data.title.trim(),
        description: data.description.trim(),
        date: buenosAiresLocalToIso(data.dateTime)!,
        location: data.location.trim(),
        image,
      }, data.id || undefined);

      return { success: true, message: data.id ? "Evento actualizado." : "Evento publicado en la Agenda." };
    } catch (err) {
      console.error("Save event error:", err);
      return requestEvent.fail(500, { message: "No se pudo guardar el evento. Intentá de nuevo." });
    }
  },
  zod$({
    id: z.string().optional(),
    title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres."),
    description: z.string().trim().min(10, "Contá de qué se trata en al menos 10 caracteres."),
    dateTime: z.string().refine((value) => buenosAiresLocalToIso(value) !== null, "Ingresá la fecha y la hora."),
    location: z.string().trim().min(3, "Indicá dónde es el evento."),
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

const inputClass = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm focus:border-brand-navy focus:bg-white focus:outline-none";
const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-500";

export default component$(() => {
  const events = useAdminEventsLoader();
  const saveAction = useSaveEventAction();
  const deleteAction = useDeleteEventAction();

  const formOpen = useSignal(false);
  const editing = useSignal<ClubEvent | null>(null);
  const focusRequest = useSignal(0);
  const deleteOpen = useSignal(false);
  const deleteTarget = useSignal<{ id: string; title: string } | null>(null);
  const deleteError = useSignal("");
  const deleteNotice = useSignal("");

  // The form renders after the click, so focus (and scroll) once it is in the DOM.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    if (track(() => focusRequest.value) > 0) document.getElementById("event-title")?.focus();
  });

  const openForm$ = $((eventItem: ClubEvent | null) => {
    editing.value = eventItem;
    formOpen.value = true;
    deleteNotice.value = "";
    focusRequest.value++;
  });

  const fieldErrors = saveAction.value?.failed ? saveAction.value.fieldErrors : undefined;

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1">
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

      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-navy"></span>
            <span class="text-[11px] font-extrabold tracking-widest text-slate-500 uppercase">Administración / Contenido</span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-navy-dark tracking-tight leading-none">Agenda</h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Torneos, clínicas y actividades que los socios ven en <a href="/eventos/" class="font-bold text-brand-navy underline">/eventos</a>. Los eventos pasados se ocultan solos al día siguiente.
          </p>
        </div>
        <button
          type="button"
          onClick$={() => (formOpen.value && !editing.value ? (formOpen.value = false) : openForm$(null))}
          class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer"
        >
          <LuPlus class="w-4 h-4" aria-hidden="true" />
          <span>{formOpen.value && !editing.value ? "Cerrar formulario" : "Nuevo evento"}</span>
        </button>
      </div>

      <div class="space-y-4">
        <ActionFeedback value={saveAction.value} success={saveAction.value?.message} />
        {deleteNotice.value && (
          <div role="status" class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm">
            {deleteNotice.value}
          </div>
        )}
      </div>

      {formOpen.value && (
        <Form
          action={saveAction}
          enctype="multipart/form-data"
          onSubmitCompleted$={() => {
            if (saveAction.value?.success) {
              formOpen.value = false;
              editing.value = null;
            }
          }}
          class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-5 text-left"
        >
          <h2 class="text-lg font-bold text-brand-navy-dark">{editing.value ? `Editar “${editing.value.title}”` : "Nuevo evento"}</h2>
          <input type="hidden" name="id" value={editing.value?.id ?? ""} />

          <div class="grid gap-5 md:grid-cols-2">
            <div class="space-y-2 md:col-span-2">
              <label for="event-title" class={labelClass}>Título</label>
              <input id="event-title" name="title" required minLength={3} maxLength={120} value={editing.value?.title ?? ""} placeholder="Ej: Torneo Apertura — Primera División" class={inputClass} aria-invalid={!!fieldErrors?.title} aria-describedby={fieldErrors?.title ? "event-title-error" : undefined} />
              {fieldErrors?.title && <p id="event-title-error" role="alert" class="text-xs text-red-700">{fieldErrors.title}</p>}
            </div>

            <div class="space-y-2">
              <label for="event-date" class={labelClass}>Fecha y hora</label>
              <input id="event-date" name="dateTime" type="datetime-local" required value={editing.value ? isoToBuenosAiresLocal(editing.value.date) : ""} class={inputClass} aria-invalid={!!fieldErrors?.dateTime} aria-describedby={fieldErrors?.dateTime ? "event-date-error" : "event-date-hint"} />
              <p id="event-date-hint" class="text-xs text-slate-500">Hora de La Plata.</p>
              {fieldErrors?.dateTime && <p id="event-date-error" role="alert" class="text-xs text-red-700">{fieldErrors.dateTime}</p>}
            </div>

            <div class="space-y-2">
              <label for="event-location" class={labelClass}>Lugar</label>
              <input id="event-location" name="location" required minLength={3} maxLength={160} value={editing.value?.location ?? ""} placeholder="Ej: Sede Gonnet, cancha principal" class={inputClass} aria-invalid={!!fieldErrors?.location} aria-describedby={fieldErrors?.location ? "event-location-error" : undefined} />
              {fieldErrors?.location && <p id="event-location-error" role="alert" class="text-xs text-red-700">{fieldErrors.location}</p>}
            </div>

            <div class="space-y-2 md:col-span-2">
              <label for="event-description" class={labelClass}>Descripción</label>
              <textarea id="event-description" name="description" required minLength={10} rows={4} value={editing.value?.description ?? ""} class={inputClass} aria-invalid={!!fieldErrors?.description} aria-describedby={fieldErrors?.description ? "event-description-error" : undefined} />
              {fieldErrors?.description && <p id="event-description-error" role="alert" class="text-xs text-red-700">{fieldErrors.description}</p>}
            </div>

            <div class="space-y-2 md:col-span-2">
              <label for="event-image" class={labelClass}>Imagen (opcional)</label>
              <input id="event-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="event-image-hint" class="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-bold file:text-slate-700 hover:file:bg-slate-200" />
              <p id="event-image-hint" class="text-xs text-slate-500">JPG, PNG o WebP de hasta 5 MB. Se muestra de fondo, detrás de la fecha.</p>
              {editing.value?.image && (
                <div class="flex items-center gap-4 pt-1">
                  <img src={editing.value.image} alt="" width={96} height={64} class="h-16 w-24 rounded-xl object-cover border border-slate-200" />
                  <label class="inline-flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" name="removeImage" class="h-4 w-4 accent-red-600" />
                    Quitar la imagen actual
                  </label>
                </div>
              )}
            </div>
          </div>

          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-2">
            <button type="button" disabled={saveAction.isRunning} onClick$={() => { formOpen.value = false; editing.value = null; }} class="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold disabled:opacity-50 cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saveAction.isRunning} class="rounded-2xl bg-brand-navy px-5 py-3 text-sm font-bold text-white hover:bg-brand-navy-light disabled:opacity-50 cursor-pointer">
              {saveAction.isRunning ? "Guardando..." : editing.value ? "Guardar cambios" : "Publicar evento"}
            </button>
          </div>
        </Form>
      )}

      {events.value.length === 0 ? (
        <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-2">
          <LuCalendar class="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <p class="font-bold text-slate-700">Todavía no hay eventos</p>
          <p class="text-sm text-slate-500">Mientras la Agenda esté vacía, los socios ven el aviso “No hay eventos agendados”.</p>
        </div>
      ) : (
        <ul class="grid gap-4 lg:grid-cols-2">
          {events.value.map((eventItem) => (
            <li key={eventItem.id} class="flex gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              {eventItem.image ? (
                <img src={eventItem.image} alt="" width={96} height={96} loading="lazy" class="h-20 w-20 shrink-0 rounded-2xl object-cover" />
              ) : (
                <div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <LuCalendar class="h-7 w-7" aria-hidden="true" />
                </div>
              )}
              <div class="min-w-0 flex-1 space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-bold text-slate-500">{formatDateTime(eventItem.date)} hs</span>
                  {eventItem.isPast ? (
                    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Pasado</span>
                  ) : (
                    <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">Próximo</span>
                  )}
                </div>
                <h2 class="font-bold text-slate-800 leading-snug">{eventItem.title}</h2>
                <p class="flex items-center gap-1 text-xs text-slate-500">
                  <LuMapPin class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span class="truncate">{eventItem.location}</span>
                </p>
              </div>
              <div class="flex shrink-0 flex-col gap-1">
                <button type="button" onClick$={() => openForm$(eventItem)} aria-label={`Editar evento ${eventItem.title}`} title="Editar" class="rounded-full p-2.5 text-brand-navy hover:bg-emerald-50 cursor-pointer">
                  <LuPencil class="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick$={() => {
                    deleteTarget.value = { id: eventItem.id, title: eventItem.title };
                    deleteError.value = "";
                    deleteNotice.value = "";
                    deleteOpen.value = true;
                  }}
                  aria-label={`Eliminar evento ${eventItem.title}`}
                  title="Eliminar"
                  class="rounded-full p-2.5 text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <LuTrash2 class="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "Agenda - Panel de Administración LPRC",
};
