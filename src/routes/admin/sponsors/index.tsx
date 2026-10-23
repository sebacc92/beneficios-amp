import { component$, useSignal, $, useTask$, sync$ } from "@builder.io/qwik";
import { isBrowser } from "@builder.io/qwik/build";
import { putImage } from "~/server/media";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuPlus, LuBuilding, LuTrash2, LuPencil, LuArrowUp, LuArrowDown, LuGripVertical, LuEye, LuEyeOff, LuX } from "@qwikest/icons/lucide";
import { eq, max } from "drizzle-orm";
import { getDB } from "~/db";
import { sponsors as sponsorsTable } from "~/db/schema";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { ActionFeedback } from "~/components/admin/action-feedback";
import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { AdminPageHeader } from "~/components/admin/page-header";
import { SPONSOR_TIERS, SponsorMarquee, sortSponsorsByTier, sponsorTier, type SponsorTier } from "~/components/ui/SponsorMarquee";

type SponsorRow = typeof sponsorsTable.$inferSelect;

// --- SECURITY & LOADERS ---

export const useAdminSponsorsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    // `y` holds the display order; the site groups by tier first, so the panel does too.
    return sortSponsorsByTier(await db.select().from(sponsorsTable).orderBy(sponsorsTable.y));
  } catch (err) {
    console.error("Failed to load sponsors:", err);
    return [] as SponsorRow[];
  }
});

// --- ACTIONS ---

const linkSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => {
    if (!value) return true;
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Ingresá el link completo, empezando con https://");

const tierSchema = z.enum(["principal", "oficial", "proveedor"]).default("oficial");

export const useCreateSponsorAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const uuid = "sp-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();

      const uploadedImageUrl = await putImage(requestEvent, "sponsor", data.optimizedImage, data.image);
      if (!uploadedImageUrl) {
        return requestEvent.fail(400, { message: "Subí el logo de la marca." });
      }

      // New sponsors go last; counting rows would collide after a deletion.
      const [{ last }] = await db.select({ last: max(sponsorsTable.y) }).from(sponsorsTable);

      await db.insert(sponsorsTable).values({
        id: uuid,
        name: data.name.trim(),
        imageUrl: uploadedImageUrl,
        linkUrl: data.linkUrl || null,
        tier: data.tier,
        isActive: true,
        x: 0,
        y: (last ?? -1) + 1,
        w: 2,
        h: 2,
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (err: any) {
      console.error("Create sponsor error:", err);
      return requestEvent.fail(500, { message: err.message || "Error al crear el sponsor." });
    }
  },
  zod$({
    name: z.string().trim().min(2, "El nombre de la marca debe tener al menos 2 caracteres."),
    linkUrl: linkSchema,
    tier: tierSchema,
    optimizedImage: z.string().optional(),
    image: z.any().optional(),
  })
);

export const useUpdateSponsorAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const uploadedImageUrl = (await putImage(requestEvent, "sponsor", data.optimizedImage, data.image)) ?? data.imageUrl;

      await db
        .update(sponsorsTable)
        .set({
          name: data.name.trim(),
          imageUrl: uploadedImageUrl,
          linkUrl: data.linkUrl || null,
          tier: data.tier,
        })
        .where(eq(sponsorsTable.id, data.id));

      return { success: true };
    } catch (err: any) {
      console.error("Update sponsor error:", err);
      return requestEvent.fail(500, { message: err.message || "Error al actualizar el sponsor." });
    }
  },
  zod$({
    id: z.string(),
    name: z.string().trim().min(2, "El nombre de la marca debe tener al menos 2 caracteres."),
    imageUrl: z.string(),
    linkUrl: linkSchema,
    tier: tierSchema,
    optimizedImage: z.string().optional(),
    image: z.any().optional(),
  })
);

export const useToggleSponsorAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      await getDB(requestEvent)
        .update(sponsorsTable)
        .set({ isActive: data.isActive === "1" })
        .where(eq(sponsorsTable.id, data.id));
      return { success: true };
    } catch (err) {
      console.error("Toggle sponsor error:", err);
      return requestEvent.fail(500, { message: "No se pudo cambiar la visibilidad. Intentá de nuevo." });
    }
  },
  zod$({
    id: z.string(),
    isActive: z.enum(["0", "1"]),
  })
);

export const useDeleteSponsorAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      await db.delete(sponsorsTable).where(eq(sponsorsTable.id, data.id));
      return { success: true };
    } catch (err: any) {
      console.error("Delete sponsor error:", err);
      return requestEvent.fail(500, { message: "Error al eliminar el sponsor." });
    }
  },
  zod$({
    id: z.string(),
  })
);

export const useReorderSponsorsAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const ids = JSON.parse(data.idsJson) as string[];

      for (let i = 0; i < ids.length; i++) {
        await db
          .update(sponsorsTable)
          .set({ y: i }) // Store sorting rank index in the y coordinate
          .where(eq(sponsorsTable.id, ids[i]));
      }

      return { success: true };
    } catch (err: any) {
      console.error("Reorder sponsors error:", err);
      return requestEvent.fail(500, { message: "Error al ordenar." });
    }
  },
  zod$({
    idsJson: z.string(),
  })
);

export default component$(() => {
  const sponsorsLoader = useAdminSponsorsLoader();
  const createSponsorAction = useCreateSponsorAction();
  const updateSponsorAction = useUpdateSponsorAction();
  const toggleAction = useToggleSponsorAction();
  const deleteSponsorAction = useDeleteSponsorAction();
  const reorderAction = useReorderSponsorsAction();

  const isFormOpen = useSignal(false);
  const editingSponsor = useSignal<SponsorRow | null>(null);

  // Form Fields signals
  const formName = useSignal("");
  const formLinkUrl = useSignal("");
  const formTier = useSignal<SponsorTier>("oficial");
  const sponsorPreviewUrl = useSignal<string | null>(null);
  const optimizedImageBase64 = useSignal<string>("");

  // Local copy of the list so reordering and hiding feel instant
  const orderedSponsors = useSignal<SponsorRow[]>([]);
  const formPanel = useSignal<HTMLElement>();
  const draggedId = useSignal<string | null>(null);
  const dragOverId = useSignal<string | null>(null);
  const announcement = useSignal("");

  const isDeleteOpen = useSignal(false);
  const deleteTarget = useSignal<{ id: string; name: string } | null>(null);
  const deleteError = useSignal("");

  // The page scrolls inside the admin layout, so bring the form itself into view.
  useTask$(({ track }) => {
    const open = track(() => isFormOpen.value);
    track(() => editingSponsor.value);
    if (!isBrowser || !open) return;
    requestAnimationFrame(() => formPanel.value?.scrollIntoView({ behavior: "smooth", block: "start" }));
  });

  const closeForm$ = $(() => {
    isFormOpen.value = false;
    editingSponsor.value = null;
  });

  const confirmDeleteSponsor$ = $(async () => {
    if (!deleteTarget.value) return;
    const { value } = await deleteSponsorAction.submit({ id: deleteTarget.value.id });
    if (value.failed) {
      deleteError.value = value.message || "No se pudo eliminar el sponsor. Intentá de nuevo.";
      return;
    }
    isDeleteOpen.value = false;
  });

  useTask$(({ track }) => {
    track(() => sponsorsLoader.value);
    orderedSponsors.value = [...sponsorsLoader.value];
  });

  const handleEditClick = $((sp: SponsorRow) => {
    editingSponsor.value = sp;
    formName.value = sp.name;
    formLinkUrl.value = sp.linkUrl || "";
    formTier.value = sponsorTier(sp.tier);
    sponsorPreviewUrl.value = sp.imageUrl;
    optimizedImageBase64.value = "";
    isFormOpen.value = true;
  });

  const handleNewClick = $(() => {
    const closing = isFormOpen.value && !editingSponsor.value;
    editingSponsor.value = null;
    formName.value = "";
    formLinkUrl.value = "";
    formTier.value = "oficial";
    sponsorPreviewUrl.value = null;
    optimizedImageBase64.value = "";
    isFormOpen.value = !closing;
  });

  // Shared by drag & drop, the arrow keys and the Subir/Bajar buttons. Moves stay inside a
  // tier because the site always shows the tiers in order; a failed save restores the list.
  const moveSponsor$ = $(async (id: string, targetId: string | null, step?: number) => {
    const previous = orderedSponsors.value;
    const from = previous.findIndex((sponsor) => sponsor.id === id);
    if (from < 0) return;
    const tier = sponsorTier(previous[from].tier);
    const to = targetId ? previous.findIndex((sponsor) => sponsor.id === targetId) : from + (step ?? 0);
    if (to === from || to < 0 || to >= previous.length || sponsorTier(previous[to].tier) !== tier) return;

    const items = [...previous];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    orderedSponsors.value = items;

    const group = items.filter((sponsor) => sponsorTier(sponsor.tier) === tier);
    const position = group.findIndex((sponsor) => sponsor.id === id) + 1;
    announcement.value = `${moved.name}: posición ${position} de ${group.length}.`;

    const { value } = await reorderAction.submit({ idsJson: JSON.stringify(items.map((sponsor) => sponsor.id)) });
    if (value.failed) {
      orderedSponsors.value = previous;
      announcement.value = "No se pudo guardar el orden. Volvió a como estaba.";
    }
  });

  const toggleSponsor$ = $(async (sp: SponsorRow) => {
    const next = !sp.isActive;
    const previous = orderedSponsors.value;
    orderedSponsors.value = previous.map((item) => (item.id === sp.id ? { ...item, isActive: next } : item));
    const { value } = await toggleAction.submit({ id: sp.id, isActive: next ? "1" : "0" });
    if (value.failed) orderedSponsors.value = previous;
  });

  const formAction = editingSponsor.value ? updateSponsorAction.value : createSponsorAction.value;
  const fieldErrors = formAction?.failed ? formAction.fieldErrors : undefined;
  const activeSponsors = orderedSponsors.value.filter((sponsor) => sponsor.isActive);
  const hiddenCount = orderedSponsors.value.length - activeSponsors.length;

  return (
    <div class="w-full px-4 sm:px-10 py-8 sm:py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      <AdminPageHeader
        title="Sponsors"
        description="Las marcas que acompañan al club, en la franja “Nos acompañan” del inicio. Los principales se muestran primero y más grandes."
      >
        <button type="button" onClick$={handleNewClick} aria-expanded={isFormOpen.value && !editingSponsor.value} class="btn btn-dark whitespace-nowrap">
          {isFormOpen.value && !editingSponsor.value ? <LuX class="w-4 h-4" aria-hidden="true" /> : <LuPlus class="w-4 h-4" aria-hidden="true" />}
          <span>{isFormOpen.value && !editingSponsor.value ? "Cerrar formulario" : "Agregar sponsor"}</span>
        </button>
      </AdminPageHeader>

      <div class="space-y-6 text-left">
        {isFormOpen.value && (
          <div ref={formPanel} class="scroll-mt-24">
            <Form
              action={editingSponsor.value ? updateSponsorAction : createSponsorAction}
              enctype="multipart/form-data"
              onSubmitCompleted$={() => {
                // Close only once saved, so a rejected submission keeps what was typed
                const result = editingSponsor.value ? updateSponsorAction.value : createSponsorAction.value;
                if (result?.success) closeForm$();
              }}
              class="card p-5 sm:p-8 space-y-6"
            >
              <div class="flex items-start justify-between gap-4">
                <h2 class="heading-display text-xl text-primary">
                  {editingSponsor.value ? `Editar ${editingSponsor.value.name}` : "Nuevo sponsor"}
                </h2>
                <button type="button" onClick$={closeForm$} class="btn btn-outline btn-sm">
                  Cancelar
                </button>
              </div>

              {formAction?.failed && <ActionFeedback value={formAction} />}

              {editingSponsor.value && <input type="hidden" name="id" value={editingSponsor.value.id} />}
              {editingSponsor.value && <input type="hidden" name="imageUrl" value={editingSponsor.value.imageUrl} />}
              <input type="hidden" name="optimizedImage" value={optimizedImageBase64.value} />

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label for="sponsor-name" class="field-label">Nombre de la marca</label>
                  <input
                    id="sponsor-name"
                    type="text"
                    name="name"
                    required
                    value={formName.value}
                    onInput$={(e, el) => (formName.value = el.value)}
                    placeholder="Ej: Swiss Medical"
                    aria-invalid={!!fieldErrors?.name}
                    aria-describedby={fieldErrors?.name ? "sponsor-name-error" : "sponsor-name-hint"}
                    class="field"
                  />
                  <p id="sponsor-name-hint" class="mt-1 text-xs text-slate-500">Es el texto alternativo del logo.</p>
                  {fieldErrors?.name && <p id="sponsor-name-error" role="alert" class="mt-1 text-xs text-red-700">{fieldErrors.name}</p>}
                </div>

                <div>
                  <label for="sponsor-link" class="field-label">Link (opcional)</label>
                  <input
                    id="sponsor-link"
                    type="url"
                    name="linkUrl"
                    value={formLinkUrl.value}
                    onInput$={(e, el) => (formLinkUrl.value = el.value)}
                    placeholder="https://swissmedical.com.ar"
                    aria-invalid={!!fieldErrors?.linkUrl}
                    aria-describedby={fieldErrors?.linkUrl ? "sponsor-link-error" : "sponsor-link-hint"}
                    class="field"
                  />
                  <p id="sponsor-link-hint" class="mt-1 text-xs text-slate-500">Se abre en una pestaña nueva al tocar el logo.</p>
                  {fieldErrors?.linkUrl && <p id="sponsor-link-error" role="alert" class="mt-1 text-xs text-red-700">{fieldErrors.linkUrl}</p>}
                </div>
              </div>

              <fieldset>
                <legend class="field-label">Nivel</legend>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SPONSOR_TIERS.map((tier) => (
                    <label
                      key={tier.value}
                      class={[
                        "flex min-h-11 cursor-pointer items-start gap-3 border p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                        formTier.value === tier.value ? "border-primary bg-surface-muted" : "border-line bg-surface hover:border-slate-400",
                      ]}
                    >
                      <input
                        type="radio"
                        name="tier"
                        value={tier.value}
                        checked={formTier.value === tier.value}
                        onChange$={() => (formTier.value = tier.value)}
                        class="mt-1 h-4 w-4 accent-primary"
                      />
                      <span>
                        <span class="block text-sm font-bold text-primary">{tier.label}</span>
                        <span class="block text-xs text-slate-600">{tier.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label for="sponsor-logo" class="field-label">Logo</label>
                <input
                  id="sponsor-logo"
                  type="file"
                  name="image"
                  accept="image/png,image/svg+xml,image/webp,image/jpeg"
                  required={!editingSponsor.value}
                  aria-describedby="sponsor-logo-hint"
                  onChange$={$((event: Event) => {
                    const element = event.target as HTMLInputElement;
                    if (!element.files || element.files.length === 0) return;
                    const file = element.files[0];

                    // SVGs are kept as they are: vectors need no resizing.
                    if (file.type === "image/svg+xml") {
                      optimizedImageBase64.value = "";
                      sponsorPreviewUrl.value = URL.createObjectURL(file);
                      return;
                    }

                    // Shrink bitmaps in the browser to twice the largest size the site shows (240×64).
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      const img = new Image();
                      img.onload = () => {
                        const canvas = document.createElement("canvas");
                        const maxW = 480;
                        const maxH = 240;
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
                          // WebP keeps the transparent background
                          const dataUrl = canvas.toDataURL("image/webp", 0.85);
                          optimizedImageBase64.value = dataUrl;
                          sponsorPreviewUrl.value = dataUrl;
                        }
                      };
                      img.src = e.target?.result as string;
                    };
                    reader.readAsDataURL(file);
                  })}
                  class="block w-full text-sm text-slate-600 file:mr-4 file:min-h-11 file:cursor-pointer file:border file:border-primary file:bg-surface file:px-4 file:py-2 file:text-sm file:font-bold file:text-primary hover:file:bg-surface-muted"
                />
                <p id="sponsor-logo-hint" class="mt-1 text-xs text-slate-600">
                  <strong>PNG o SVG con fondo transparente, horizontal</strong> (por ejemplo 480×128). Se ajusta a una caja de 180×48 px sobre fondo blanco; los principales, a 240×64.
                  {editingSponsor.value && " Si no elegís otro archivo, se mantiene el logo actual."}
                </p>
              </div>

              <section aria-labelledby="sponsor-preview-title" class="space-y-2">
                <h3 id="sponsor-preview-title" class="field-label">Así se ve en el inicio</h3>
                {sponsorPreviewUrl.value ? (
                  <div class="border border-line">
                    <SponsorMarquee
                      preview
                      sponsors={[{ id: "preview", name: formName.value || "Logo del sponsor", imageUrl: sponsorPreviewUrl.value, tier: formTier.value }]}
                    />
                  </div>
                ) : (
                  <div class="flex min-h-24 items-center justify-center gap-2 border border-dashed border-slate-300 bg-surface-muted p-4 text-sm text-slate-600">
                    <LuBuilding class="h-5 w-5 text-slate-400" aria-hidden="true" />
                    Elegí el logo para verlo a tamaño real.
                  </div>
                )}
              </section>

              <div class="flex justify-end">
                <button type="submit" disabled={createSponsorAction.isRunning || updateSponsorAction.isRunning} class="btn btn-primary">
                  {createSponsorAction.isRunning || updateSponsorAction.isRunning ? "Guardando..." : editingSponsor.value ? "Guardar cambios" : "Agregar sponsor"}
                </button>
              </div>
            </Form>
          </div>
        )}

        {/* Action Feedbacks (form failures are shown inside the open form) */}
        {createSponsorAction.value?.success && <ActionFeedback value={createSponsorAction.value} success="Sponsor agregado." />}
        {updateSponsorAction.value?.success && <ActionFeedback value={updateSponsorAction.value} success="Sponsor actualizado." />}
        <ActionFeedback value={deleteSponsorAction.value} success="Sponsor eliminado." />
        <ActionFeedback value={toggleAction.value} />
        <ActionFeedback value={reorderAction.value} />

        {orderedSponsors.value.length === 0 ? (
          <div class="card flex flex-col items-center justify-center gap-3 border-dashed p-10 text-center">
            <LuBuilding class="w-10 h-10 text-slate-400" aria-hidden="true" />
            <p class="font-bold text-slate-700">Todavía no hay sponsors</p>
            <p class="text-sm text-slate-500 max-w-xs">Con “Agregar sponsor” cargás la primera marca. Mientras no haya ninguna, el inicio no muestra la franja.</p>
          </div>
        ) : (
          <>
            <section aria-labelledby="sponsors-strip-title" class="space-y-2">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="sponsors-strip-title" class="heading-display text-lg text-primary">Vista previa del inicio</h2>
                <p class="text-xs text-slate-600">
                  {activeSponsors.length === 0
                    ? "Todos los sponsors están ocultos: el inicio no muestra la franja."
                    : `${activeSponsors.length} visible${activeSponsors.length === 1 ? "" : "s"}${hiddenCount ? ` · ${hiddenCount} oculto${hiddenCount === 1 ? "" : "s"}` : ""}. En el sitio, con más de 4 la franja se desplaza sola.`}
                </p>
              </div>
              {activeSponsors.length > 0 && (
                <div class="border border-line">
                  <SponsorMarquee preview sponsors={activeSponsors} />
                </div>
              )}
            </section>

            <section aria-labelledby="sponsors-list-title" class="card p-4 sm:p-8 space-y-6">
              <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                  <h2 id="sponsors-list-title" class="heading-display text-lg text-primary">Orden de los sponsors ({orderedSponsors.value.length})</h2>
                  <p class="text-sm text-slate-600 mt-1">
                    Arrastrá cada fila o usá Subir y Bajar; con el teclado, enfocá el ícono de arrastre y usá las flechas. El orden se guarda solo y vale dentro de cada nivel.
                  </p>
                </div>
                <p class="text-xs font-bold text-slate-600 min-h-4" aria-hidden="true">
                  {reorderAction.isRunning ? "Guardando orden..." : ""}
                </p>
              </div>
              <p class="sr-only" aria-live="polite">{announcement.value}</p>

              {SPONSOR_TIERS.map((tier) => {
                const group = orderedSponsors.value.filter((sponsor) => sponsorTier(sponsor.tier) === tier.value);
                if (group.length === 0) return null;
                return (
                  <div key={tier.value} class="space-y-3">
                    <h3 class="eyebrow text-slate-600">{tier.label} · {group.length}</h3>
                    <ol class="space-y-2">
                      {group.map((sp, idx) => {
                        const isDragged = draggedId.value === sp.id;
                        const isOver = dragOverId.value === sp.id && !isDragged;
                        return (
                          <li
                            key={sp.id}
                            draggable={true}
                            preventdefault:dragover
                            preventdefault:drop
                            onDragStart$={(ev) => {
                              draggedId.value = sp.id;
                              if (ev.dataTransfer) {
                                ev.dataTransfer.effectAllowed = "move";
                                ev.dataTransfer.setData("text/plain", sp.id);
                              }
                            }}
                            onDragOver$={() => {
                              const dragged = orderedSponsors.value.find((item) => item.id === draggedId.value);
                              dragOverId.value = dragged && sponsorTier(dragged.tier) === tier.value ? sp.id : null;
                            }}
                            onDrop$={async () => {
                              const from = draggedId.value;
                              const to = dragOverId.value;
                              draggedId.value = null;
                              dragOverId.value = null;
                              if (from && to) await moveSponsor$(from, to);
                            }}
                            onDragEnd$={() => {
                              draggedId.value = null;
                              dragOverId.value = null;
                            }}
                            class={[
                              "flex flex-wrap items-center gap-3 border bg-surface p-3 transition-colors",
                              isDragged ? "opacity-40 border-dashed border-primary" : isOver ? "border-accent border-2 bg-surface-muted" : "border-line",
                            ]}
                          >
                            <button
                              id={`sponsor-handle-${sp.id}`}
                              type="button"
                              class="flex h-11 w-9 shrink-0 cursor-grab items-center justify-center text-slate-500 hover:text-primary active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-accent"
                              aria-label={`Reordenar ${sp.name}, posición ${idx + 1} de ${group.length}. Usá las flechas arriba y abajo.`}
                              aria-keyshortcuts="ArrowUp ArrowDown"
                              onKeyDown$={[
                                sync$((event: KeyboardEvent) => {
                                  if (event.key === "ArrowUp" || event.key === "ArrowDown") event.preventDefault();
                                }),
                                $(async (event: KeyboardEvent) => {
                                  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                                  await moveSponsor$(sp.id, null, event.key === "ArrowUp" ? -1 : 1);
                                  requestAnimationFrame(() => document.getElementById(`sponsor-handle-${sp.id}`)?.focus());
                                }),
                              ]}
                            >
                              <LuGripVertical class="h-5 w-5" aria-hidden="true" />
                            </button>
                            <span class="hidden w-6 shrink-0 text-center font-display text-lg font-bold text-slate-400 sm:inline" aria-hidden="true">{idx + 1}</span>

                            {/* Same box the home uses for this tier, on white */}
                            <div class={["flex shrink-0 items-center justify-center border border-line bg-white p-1", sp.isActive ? "" : "opacity-50"]}>
                              <img
                                src={sp.imageUrl}
                                alt=""
                                width={tier.value === "principal" ? 240 : tier.value === "proveedor" ? 140 : 180}
                                height={tier.value === "principal" ? 64 : tier.value === "proveedor" ? 36 : 48}
                                loading="lazy"
                                class={[
                                  "object-contain",
                                  tier.value === "principal" ? "h-16 w-[240px]" : tier.value === "proveedor" ? "h-9 w-[140px]" : "h-12 w-[180px]",
                                ]}
                              />
                            </div>

                            <div class="min-w-0 flex-1 basis-40">
                              <p class="flex flex-wrap items-center gap-2">
                                <span class="font-bold text-primary truncate">{sp.name}</span>
                                {!sp.isActive && <span class="badge badge-muted">Oculto</span>}
                              </p>
                              <p class="text-xs text-slate-500 truncate mt-0.5">
                                {sp.linkUrl ? (
                                  <a href={sp.linkUrl} target="_blank" rel="noopener noreferrer" class="font-bold text-secondary underline-offset-2 hover:underline">
                                    {sp.linkUrl.replace(/^https?:\/\/(www\.)?/, "")}
                                    <span class="sr-only"> (abre en una pestaña nueva)</span>
                                  </a>
                                ) : (
                                  "Sin link"
                                )}
                              </p>
                            </div>

                            <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={sp.isActive}
                                aria-label={`Mostrar ${sp.name} en el inicio`}
                                disabled={toggleAction.isRunning}
                                onClick$={() => toggleSponsor$(sp)}
                                class={[
                                  "inline-flex min-h-11 w-full items-center justify-center gap-2 border px-3 text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60 sm:w-auto",
                                  sp.isActive ? "border-primary bg-primary text-white" : "border-slate-300 bg-surface text-slate-600 hover:border-primary",
                                ]}
                              >
                                {sp.isActive ? <LuEye class="h-4 w-4" aria-hidden="true" /> : <LuEyeOff class="h-4 w-4" aria-hidden="true" />}
                                {sp.isActive ? "Visible" : "Oculto"}
                              </button>
                              <button
                                type="button"
                                disabled={idx === 0 || reorderAction.isRunning}
                                onClick$={() => moveSponsor$(sp.id, null, -1)}
                                class="inline-flex h-11 w-11 items-center justify-center border border-line text-slate-600 hover:border-primary hover:text-primary disabled:opacity-30 disabled:hover:border-line cursor-pointer"
                                aria-label={`Subir ${sp.name}`}
                                title="Subir"
                              >
                                <LuArrowUp class="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === group.length - 1 || reorderAction.isRunning}
                                onClick$={() => moveSponsor$(sp.id, null, 1)}
                                class="inline-flex h-11 w-11 items-center justify-center border border-line text-slate-600 hover:border-primary hover:text-primary disabled:opacity-30 disabled:hover:border-line cursor-pointer"
                                aria-label={`Bajar ${sp.name}`}
                                title="Bajar"
                              >
                                <LuArrowDown class="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick$={() => handleEditClick(sp)}
                                class="inline-flex h-11 w-11 items-center justify-center border border-line text-primary hover:border-primary cursor-pointer"
                                title="Editar"
                                aria-label={`Editar ${sp.name}`}
                              >
                                <LuPencil class="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick$={() => {
                                  deleteTarget.value = { id: sp.id, name: sp.name };
                                  deleteError.value = "";
                                  isDeleteOpen.value = true;
                                }}
                                class="inline-flex h-11 w-11 items-center justify-center border border-line text-red-700 hover:border-red-600 hover:bg-red-50 cursor-pointer"
                                title="Eliminar"
                                aria-label={`Eliminar ${sp.name}`}
                              >
                                <LuTrash2 class="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>

      <ConfirmDialog
        open={isDeleteOpen}
        title="Eliminar sponsor"
        confirmLabel="Eliminar sponsor"
        pending={deleteSponsorAction.isRunning}
        error={deleteError.value}
        onConfirm$={confirmDeleteSponsor$}
      >
        <p>“{deleteTarget.value?.name}” se borra del panel y deja de mostrarse en el inicio. Si solo querés sacarlo por un tiempo, usá “Visible / Oculto”.</p>
      </ConfirmDialog>
    </div>
  );
});

export const head: DocumentHead = {
  title: "LPRC Club - Sponsors",
  meta: [
    {
      name: "description",
      content: "Administrar sponsors asociados.",
    },
  ],
};
