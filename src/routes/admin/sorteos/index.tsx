import { $, component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Form, routeAction$, routeLoader$, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuGift, LuPencil, LuPlus, LuTrash2 } from "@qwikest/icons/lucide";
import { ActionFeedback } from "~/components/admin/action-feedback";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import {
  clubImageError,
  deleteRaffle,
  getRaffle,
  listRafflesForAdmin,
  saveRaffle,
  type Raffle,
} from "~/server/club-content";
import { putImage } from "~/server/media";
import { formatCalendarDay, isRaffleActive } from "~/utils/club-content";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

export const useAdminRafflesLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const rows = await listRafflesForAdmin(event);
    return rows.map((row) => ({ ...row, isActive: isRaffleActive(row.drawDate) }));
  } catch (err) {
    console.error("Failed to load raffles:", err);
    return [];
  }
});

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
      await saveRaffle(requestEvent, {
        title: data.title.trim(),
        description: data.description.trim(),
        drawDate: data.drawDate,
        prizeDetail: data.prizeDetail.trim(),
        terms: data.terms.trim(),
        winners: data.winners?.trim() || null,
        image,
      }, data.id || undefined);

      return { success: true, message: data.id ? "Sorteo actualizado." : "Sorteo publicado." };
    } catch (err) {
      console.error("Save raffle error:", err);
      return requestEvent.fail(500, { message: "No se pudo guardar el sorteo. Intentá de nuevo." });
    }
  },
  zod$({
    id: z.string().optional(),
    title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres."),
    description: z.string().trim().min(10, "Contá de qué se trata en al menos 10 caracteres."),
    drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha del sorteo."),
    prizeDetail: z.string().trim().min(3, "Indicá el premio."),
    terms: z.string().trim().min(10, "Las bases y condiciones son obligatorias."),
    winners: z.string().optional(),
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

const inputClass = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base sm:text-sm focus:border-brand-navy focus:bg-white focus:outline-none";
const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-500";

export default component$(() => {
  const raffles = useAdminRafflesLoader();
  const saveAction = useSaveRaffleAction();
  const deleteAction = useDeleteRaffleAction();

  const formOpen = useSignal(false);
  const editing = useSignal<Raffle | null>(null);
  const focusRequest = useSignal(0);
  const deleteOpen = useSignal(false);
  const deleteTarget = useSignal<{ id: string; title: string } | null>(null);
  const deleteError = useSignal("");
  const deleteNotice = useSignal("");

  // The form renders after the click, so focus (and scroll) once it is in the DOM.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    if (track(() => focusRequest.value) > 0) document.getElementById("raffle-title")?.focus();
  });

  const openForm$ = $((raffle: Raffle | null) => {
    editing.value = raffle;
    formOpen.value = true;
    deleteNotice.value = "";
    focusRequest.value++;
  });

  const fieldErrors = saveAction.value?.failed ? saveAction.value.fieldErrors : undefined;

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1">
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

      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-navy"></span>
            <span class="text-[11px] font-extrabold tracking-widest text-slate-500 uppercase">Administración / Contenido</span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-navy-dark tracking-tight leading-none">Sorteos</h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Lo que los socios ven en <a href="/sorteos/" class="font-bold text-brand-navy underline">/sorteos</a>. Un sorteo figura como vigente hasta que termina su día de sorteo; después pasa a “Anteriores” con sus ganadores.
          </p>
        </div>
        <button
          type="button"
          onClick$={() => (formOpen.value && !editing.value ? (formOpen.value = false) : openForm$(null))}
          class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer"
        >
          <LuPlus class="w-4 h-4" aria-hidden="true" />
          <span>{formOpen.value && !editing.value ? "Cerrar formulario" : "Nuevo sorteo"}</span>
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
          <h2 class="text-lg font-bold text-brand-navy-dark">{editing.value ? `Editar “${editing.value.title}”` : "Nuevo sorteo"}</h2>
          <input type="hidden" name="id" value={editing.value?.id ?? ""} />

          <div class="grid gap-5 md:grid-cols-2">
            <div class="space-y-2 md:col-span-2">
              <label for="raffle-title" class={labelClass}>Título</label>
              <input id="raffle-title" name="title" required minLength={3} maxLength={120} value={editing.value?.title ?? ""} placeholder="Ej: Sorteo Aniversario del Club" class={inputClass} aria-invalid={!!fieldErrors?.title} aria-describedby={fieldErrors?.title ? "raffle-title-error" : undefined} />
              {fieldErrors?.title && <p id="raffle-title-error" role="alert" class="text-xs text-red-700">{fieldErrors.title}</p>}
            </div>

            <div class="space-y-2">
              <label for="raffle-date" class={labelClass}>Fecha del sorteo</label>
              <input id="raffle-date" name="drawDate" type="date" required value={editing.value?.drawDate ?? ""} class={inputClass} aria-invalid={!!fieldErrors?.drawDate} aria-describedby={fieldErrors?.drawDate ? "raffle-date-error" : undefined} />
              {fieldErrors?.drawDate && <p id="raffle-date-error" role="alert" class="text-xs text-red-700">{fieldErrors.drawDate}</p>}
            </div>

            <div class="space-y-2">
              <label for="raffle-prize" class={labelClass}>Premio</label>
              <input id="raffle-prize" name="prizeDetail" required minLength={3} maxLength={120} value={editing.value?.prizeDetail ?? ""} placeholder="Ej: 5 vouchers de $150.000" class={inputClass} aria-invalid={!!fieldErrors?.prizeDetail} aria-describedby={fieldErrors?.prizeDetail ? "raffle-prize-error" : undefined} />
              {fieldErrors?.prizeDetail && <p id="raffle-prize-error" role="alert" class="text-xs text-red-700">{fieldErrors.prizeDetail}</p>}
            </div>

            <div class="space-y-2 md:col-span-2">
              <label for="raffle-description" class={labelClass}>Descripción</label>
              <textarea id="raffle-description" name="description" required minLength={10} rows={3} value={editing.value?.description ?? ""} class={inputClass} aria-invalid={!!fieldErrors?.description} aria-describedby={fieldErrors?.description ? "raffle-description-error" : undefined} />
              {fieldErrors?.description && <p id="raffle-description-error" role="alert" class="text-xs text-red-700">{fieldErrors.description}</p>}
            </div>

            <div class="space-y-2 md:col-span-2">
              <label for="raffle-terms" class={labelClass}>Bases y condiciones</label>
              <textarea id="raffle-terms" name="terms" required minLength={10} rows={4} value={editing.value?.terms ?? ""} class={inputClass} aria-invalid={!!fieldErrors?.terms} aria-describedby={fieldErrors?.terms ? "raffle-terms-error" : undefined} />
              {fieldErrors?.terms && <p id="raffle-terms-error" role="alert" class="text-xs text-red-700">{fieldErrors.terms}</p>}
            </div>

            <div class="space-y-2 md:col-span-2">
              <label for="raffle-winners" class={labelClass}>Ganador/es (opcional)</label>
              <textarea id="raffle-winners" name="winners" rows={2} value={editing.value?.winners ?? ""} placeholder="Ej: Laura Fontana (Socio N° 3847)" aria-describedby="raffle-winners-hint" class={inputClass} />
              <p id="raffle-winners-hint" class="text-xs text-slate-500">Se muestra cuando el sorteo pasa a “Anteriores”. Si queda vacío, figura “Resultado a confirmar”.</p>
            </div>

            <div class="space-y-2 md:col-span-2">
              <label for="raffle-image" class={labelClass}>Imagen (opcional)</label>
              <input id="raffle-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="raffle-image-hint" class="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-bold file:text-slate-700 hover:file:bg-slate-200" />
              <p id="raffle-image-hint" class="text-xs text-slate-500">JPG, PNG o WebP de hasta 5 MB, horizontal.</p>
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
              {saveAction.isRunning ? "Guardando..." : editing.value ? "Guardar cambios" : "Publicar sorteo"}
            </button>
          </div>
        </Form>
      )}

      {raffles.value.length === 0 ? (
        <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center space-y-2">
          <LuGift class="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <p class="font-bold text-slate-700">Todavía no hay sorteos</p>
          <p class="text-sm text-slate-500">Mientras no haya ninguno, los socios ven el aviso “No hay sorteos vigentes”.</p>
        </div>
      ) : (
        <ul class="grid gap-4 lg:grid-cols-2">
          {raffles.value.map((raffle) => (
            <li key={raffle.id} class="flex gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              {raffle.image ? (
                <img src={raffle.image} alt="" width={96} height={96} loading="lazy" class="h-20 w-20 shrink-0 rounded-2xl object-cover" />
              ) : (
                <div class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <LuGift class="h-7 w-7" aria-hidden="true" />
                </div>
              )}
              <div class="min-w-0 flex-1 space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs font-bold text-slate-500">Sortea: {formatCalendarDay(raffle.drawDate)}</span>
                  {raffle.isActive ? (
                    <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">Vigente</span>
                  ) : (
                    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Finalizado</span>
                  )}
                  {!raffle.isActive && !raffle.winners && (
                    <span class="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800">Falta cargar ganador</span>
                  )}
                </div>
                <h2 class="font-bold text-slate-800 leading-snug">{raffle.title}</h2>
                <p class="text-xs text-slate-500 truncate">Premio: {raffle.prizeDetail}</p>
              </div>
              <div class="flex shrink-0 flex-col gap-1">
                <button type="button" onClick$={() => openForm$(raffle)} aria-label={`Editar sorteo ${raffle.title}`} title="Editar" class="rounded-full p-2.5 text-brand-navy hover:bg-emerald-50 cursor-pointer">
                  <LuPencil class="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick$={() => {
                    deleteTarget.value = { id: raffle.id, title: raffle.title };
                    deleteError.value = "";
                    deleteNotice.value = "";
                    deleteOpen.value = true;
                  }}
                  aria-label={`Eliminar sorteo ${raffle.title}`}
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
  title: "Sorteos - Panel de Administración LPRC",
};
