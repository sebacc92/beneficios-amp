import { component$, useSignal, useStore, $, useTask$ } from "@builder.io/qwik";
import { put } from "@vercel/blob";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import {
  LuPlus,
  LuImage,
  LuTrash2,
  LuPencil,
  LuEye,
  LuEyeOff,
  LuMove,
  LuCheck,
  LuX,
} from "@qwikest/icons/lucide";
import { asc, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { galleryImages as galleryImagesTable } from "~/db/schema";
import { ensureGalleryTable } from "~/server/cache";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

// --- SECURITY & LOADERS ---

export const useAdminGalleryLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    await ensureGalleryTable(db);
    return await db.select().from(galleryImagesTable).orderBy(asc(galleryImagesTable.orderIndex));
  } catch (err) {
    console.error("Failed to load gallery images:", err);
    return [];
  }
});

// --- Helper de subida (mismo patrón Blob + fallback fs que admin/slides) ---
async function uploadGalleryFile(file: File, token: string | undefined): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  const extension = file.name.split(".").pop() || "png";
  const fileName = `gallery-${Date.now()}.${extension}`;

  if (token) {
    try {
      const blob = await put(fileName, file, { access: "public", token });
      return blob.url;
    } catch (e) {
      console.error("Vercel Blob failed, fallback to fs", e);
    }
  }

  const uploadsDir = `${process.cwd()}/public/uploads`;
  const fsModule = await import("fs/promises");
  await fsModule.mkdir(uploadsDir, { recursive: true });
  const filePath = `${uploadsDir}/${fileName}`;
  await fsModule.writeFile(filePath, buffer);
  return `/uploads/${fileName}`;
}

// --- ACTIONS ---

export const useCreateGalleryImageAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const id = "gallery-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();
      const token = process.env.BLOB_READ_WRITE_TOKEN || requestEvent.env.get("BLOB_READ_WRITE_TOKEN");

      let uploadedUrl = data.imageUrl || "";
      if (data.image && typeof data.image === "object" && (data.image as Blob).size > 0) {
        uploadedUrl = await uploadGalleryFile(data.image as File, token);
      }

      if (!uploadedUrl) {
        return requestEvent.fail(400, { message: "Debe proporcionar una imagen o subir un archivo." });
      }

      const existing = await db.select().from(galleryImagesTable);

      await db.insert(galleryImagesTable).values({
        id,
        imageUrl: uploadedUrl,
        title: data.title || null,
        orderIndex: existing.length + 1,
        isActive: 1,
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (err: any) {
      console.error("Create gallery image error:", err);
      return requestEvent.fail(500, { message: err.message || "Error al agregar la foto." });
    }
  },
  zod$({
    title: z.string().optional(),
    imageUrl: z.string().optional(),
    image: z.any().optional(),
  })
);

export const useUpdateGalleryImageAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const id = data.id as string;
      const existing = await db.select().from(galleryImagesTable).where(eq(galleryImagesTable.id, id)).limit(1);
      if (existing.length === 0) return requestEvent.fail(404, { message: "Foto no encontrada." });

      const token = process.env.BLOB_READ_WRITE_TOKEN || requestEvent.env.get("BLOB_READ_WRITE_TOKEN");
      let uploadedUrl = data.imageUrl || existing[0].imageUrl;
      if (data.image && typeof data.image === "object" && (data.image as Blob).size > 0) {
        uploadedUrl = await uploadGalleryFile(data.image as File, token);
      }

      await db.update(galleryImagesTable).set({
        imageUrl: uploadedUrl,
        title: data.title || null,
      }).where(eq(galleryImagesTable.id, id));

      return { success: true };
    } catch (err: any) {
      console.error("Update gallery image error:", err);
      return requestEvent.fail(500, { message: err.message || "Error al actualizar la foto." });
    }
  },
  zod$({
    id: z.string(),
    title: z.string().optional(),
    imageUrl: z.string().optional(),
    image: z.any().optional(),
  })
);

export const useDeleteGalleryImageAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      await db.delete(galleryImagesTable).where(eq(galleryImagesTable.id, data.id));
      return { success: true };
    } catch (err: any) {
      console.error("Delete gallery image error:", err);
      return requestEvent.fail(500, { message: "Error al eliminar la foto." });
    }
  },
  zod$({
    id: z.string(),
  })
);

export const useToggleGalleryActiveAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const id = data.id as string;
      const current = await db.select().from(galleryImagesTable).where(eq(galleryImagesTable.id, id)).limit(1);
      if (current.length === 0) return requestEvent.fail(404, { message: "Foto no encontrada." });

      const newActive = current[0].isActive === 1 ? 0 : 1;
      await db.update(galleryImagesTable).set({ isActive: newActive }).where(eq(galleryImagesTable.id, id));
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

export const useReorderGalleryAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const ids = data.ids as string[];
      for (let i = 0; i < ids.length; i++) {
        await db.update(galleryImagesTable).set({ orderIndex: i + 1 }).where(eq(galleryImagesTable.id, ids[i]));
      }
      return { success: true };
    } catch (err: any) {
      console.error("Reorder error:", err);
      return requestEvent.fail(500, { message: "Error al reordenar fotos." });
    }
  },
  zod$({
    ids: z.array(z.string()),
  })
);

export default component$(() => {
  const galleryLoader = useAdminGalleryLoader();
  const createAction = useCreateGalleryImageAction();
  const updateAction = useUpdateGalleryImageAction();
  const deleteAction = useDeleteGalleryImageAction();
  const toggleActiveAction = useToggleGalleryActiveAction();
  const reorderAction = useReorderGalleryAction();

  const isCreateOpen = useSignal(false);

  // Drag and Drop Uploader State (Creation Form)
  const preview = useSignal<string | null>(null);
  const inputRef = useSignal<HTMLInputElement | undefined>(undefined);
  const isDragOver = useSignal(false);

  // Drag and Drop Uploader State (Edition Form Modal)
  const editingImage = useSignal<any | null>(null);
  const editPreview = useSignal<string | null>(null);
  const editInputRef = useSignal<HTMLInputElement | undefined>(undefined);
  const isDragOverEdit = useSignal(false);

  // Client-side Visual Array for HTML5 Drag & Drop sorting
  const localImages = useStore<{ list: any[] }>({ list: [] });
  useTask$(({ track }) => {
    track(() => galleryLoader.value);
    localImages.list = [...galleryLoader.value];
  });

  const draggedIdx = useSignal<number | null>(null);
  const draggedOverIdx = useSignal<number | null>(null);

  const handleFileChange = $((event: Event, target: "create" | "edit") => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const previewUrl = URL.createObjectURL(file);
    if (target === "create") {
      preview.value = previewUrl;
    } else {
      editPreview.value = previewUrl;
    }
  });

  const handleDrop = $((event: DragEvent, target: "create" | "edit") => {
    if (!event.dataTransfer || event.dataTransfer.files.length === 0) return;
    const file = event.dataTransfer.files[0];
    if (!file.type.startsWith("image/")) return;

    const previewUrl = URL.createObjectURL(file);
    if (target === "create") {
      isDragOver.value = false;
      preview.value = previewUrl;
      if (inputRef.value) inputRef.value.files = event.dataTransfer.files;
    } else {
      isDragOverEdit.value = false;
      editPreview.value = previewUrl;
      if (editInputRef.value) editInputRef.value.files = event.dataTransfer.files;
    }
  });

  const resetPreview = $(() => {
    preview.value = null;
    if (inputRef.value) inputRef.value.value = "";
  });

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto bg-slate-50/50">
      {/* Header */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              Administración / Contenido
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Galería de Fotos
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Administrá las fotos que se muestran en la galería de la página principal. Podés reordenarlas arrastrando las tarjetas.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick$={() => {
              isCreateOpen.value = !isCreateOpen.value;
              resetPreview();
            }}
            class={[
              "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer",
              isCreateOpen.value ? "bg-slate-600 hover:bg-slate-700" : "bg-brand-green hover:bg-brand-green-light",
            ]}
          >
            {isCreateOpen.value ? <LuX class="w-4 h-4" /> : <LuPlus class="w-4 h-4" />}
            <span>{isCreateOpen.value ? "Cerrar panel" : "Añadir Foto"}</span>
          </button>
        </div>
      </div>

      <div class="space-y-8 animate-in fade-in duration-300 text-left">
        {/* Action feedback alerts */}
        {createAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-bounce">
            ✓ Foto agregada exitosamente a la galería.
          </div>
        )}
        {updateAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-bounce">
            ✓ Foto actualizada exitosamente.
          </div>
        )}

        {/* Create form panel */}
        {isCreateOpen.value && (
          <Form
            action={createAction}
            enctype="multipart/form-data"
            onSubmit$={resetPreview}
            class="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-md grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-top-6 duration-300"
          >
            {/* Left Column: Uploader */}
            <div class="space-y-2">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Imagen</span>
              <div
                preventdefault:dragover={true}
                onDragOver$={() => {
                  isDragOver.value = true;
                }}
                onDragLeave$={() => (isDragOver.value = false)}
                onDrop$={$((ev) => handleDrop(ev, "create"))}
                class={[
                  "relative group h-56 rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden flex flex-col items-center justify-center p-4 cursor-pointer text-center",
                  isDragOver.value
                    ? "border-brand-green bg-emerald-50/50 scale-[1.01]"
                    : "border-slate-250 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400",
                ]}
                onClick$={() => inputRef.value?.click()}
              >
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  ref={inputRef}
                  onChange$={(ev) => handleFileChange(ev, "create")}
                  stoppropagation:click={true}
                  class="hidden"
                />

                {preview.value ? (
                  <>
                    <img
                      src={preview.value}
                      alt="Preview"
                      class="absolute inset-0 w-full h-full object-cover z-0"
                      width={400}
                      height={225}
                    />
                    <div class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2 z-15 backdrop-blur-xs">
                      <LuImage class="w-5 h-5" />
                      Reemplazar Imagen
                    </div>
                  </>
                ) : (
                  <div class="flex flex-col items-center gap-2 text-slate-450 z-10">
                    <LuImage class="w-10 h-10 text-slate-400 stroke-1 group-hover:scale-110 transition-transform duration-300" />
                    <div class="text-xs font-bold text-slate-650">Arrastrá la foto aquí</div>
                    <div class="text-[10px] text-slate-400 font-semibold">Formato horizontal o vertical, cualquier tamaño</div>
                    <span class="inline-flex px-3 py-1 bg-white border border-slate-200 text-slate-650 text-[10px] font-black uppercase rounded-full shadow-xs mt-1">
                      Buscar Archivo
                    </span>
                  </div>
                )}
              </div>
              <input
                type="text"
                name="imageUrl"
                placeholder="Ó ingresá una URL de imagen externa"
                class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-medium font-mono"
              />
            </div>

            {/* Right Column: Title + Actions */}
            <div class="space-y-5 flex flex-col">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Título / Leyenda (opcional)</label>
                <input
                  type="text"
                  name="title"
                  placeholder="Ej: Cena Anual 2026"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-medium"
                />
                <p class="text-[10px] text-slate-400 font-semibold">Se muestra como leyenda cuando el usuario abre la foto en el sitio.</p>
              </div>

              <div class="mt-auto flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick$={() => {
                    isCreateOpen.value = false;
                    resetPreview();
                  }}
                  class="px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createAction.isRunning}
                  class="px-6 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95"
                >
                  {createAction.isRunning ? "Guardando..." : "💾 Agregar Foto"}
                </button>
              </div>
            </div>
          </Form>
        )}

        {/* Drag & Drop Visual Deck Info Badge */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl gap-3 text-slate-600 font-medium">
          <div class="flex items-center gap-2 text-xs text-left">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-gold text-brand-green-dark text-[10px] font-black">!</span>
            <span>
              <strong>Ordenamiento Visual Nativo</strong>: Arrastrá y soltá las tarjetas para reordenarlas de forma inmediata.
            </span>
          </div>
          {reorderAction.isRunning && (
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-brand-green text-[10px] font-bold uppercase tracking-wide rounded-full animate-pulse">
              Sincronizando orden...
            </span>
          )}
        </div>

        {/* Visual Grid (Draggable Cards) */}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {localImages.list.length === 0 ? (
            <div class="col-span-full h-64 border-2 border-dashed border-slate-250 rounded-3xl flex flex-col items-center justify-center text-slate-450 gap-2 font-medium">
              <span>🖼️ No hay fotos configuradas en la galería.</span>
            </div>
          ) : (
            localImages.list.map((image, idx) => {
              const isDragged = idx === draggedIdx.value;
              const isOver = idx === draggedOverIdx.value;
              return (
                <div
                  key={image.id}
                  draggable={true}
                  preventdefault:dragover={true}
                  onDragStart$={(ev) => {
                    draggedIdx.value = idx;
                    if (ev.dataTransfer) {
                      ev.dataTransfer.effectAllowed = "move";
                    }
                  }}
                  onDragOver$={() => {
                    draggedOverIdx.value = idx;
                  }}
                  onDrop$={$(() => {
                    if (draggedIdx.value === null || draggedOverIdx.value === null) return;
                    if (draggedIdx.value === draggedOverIdx.value) return;

                    const items = [...localImages.list];
                    const [draggedItem] = items.splice(draggedIdx.value, 1);
                    items.splice(draggedOverIdx.value, 0, draggedItem);

                    localImages.list = items;
                    reorderAction.submit({ ids: items.map((x) => x.id) });

                    draggedIdx.value = null;
                    draggedOverIdx.value = null;
                  })}
                  onDragEnd$={() => {
                    draggedIdx.value = null;
                    draggedOverIdx.value = null;
                  }}
                  class={[
                    "bg-white rounded-3xl border overflow-hidden shadow-sm flex flex-col group hover:shadow-md transition-all duration-300 relative",
                    isDragged ? "opacity-35 scale-95 border-brand-green border-dashed border-2" : "border-slate-200",
                    isOver && !isDragged ? "border-brand-gold border-dashed border-2 scale-[1.02]" : "",
                  ]}
                >
                  {/* Drag Handle */}
                  <div class="absolute top-2 left-2 z-20 opacity-40 group-hover:opacity-150 transition-opacity bg-black/55 backdrop-blur-xs p-1.5 rounded-lg cursor-grab active:cursor-grabbing text-white" title="Arrastrar para reordenar">
                    <LuMove class="w-3.5 h-3.5" />
                  </div>

                  {/* Status Badge */}
                  <div class="absolute top-2 right-2 z-20 flex gap-1.5 items-center">
                    <span class={[
                      "inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase backdrop-blur-md shadow-xs border text-white",
                      image.isActive === 1
                        ? "bg-emerald-500/80 border-emerald-400"
                        : "bg-red-500/80 border-red-400",
                    ]}>
                      {image.isActive === 1 ? "Activa" : "Oculta"}
                    </span>
                  </div>

                  {/* Thumbnail */}
                  <div class="h-40 bg-slate-900 relative overflow-hidden flex items-center justify-center select-none border-b border-slate-100">
                    <img
                      src={image.imageUrl}
                      alt={image.title || "Foto de galería"}
                      class="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700"
                      width={320}
                      height={160}
                    />
                  </div>

                  {/* Body actions row */}
                  <div class="p-4 flex-grow flex flex-col justify-between text-left space-y-4 bg-white">
                    <div class="text-xs font-bold text-slate-700 truncate min-h-[1rem]">
                      {image.title || <span class="text-slate-350 font-medium italic">Sin título</span>}
                    </div>

                    <div class="flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
                      <span class="text-[10px] font-bold text-slate-400 font-mono">
                        #{image.orderIndex || idx + 1}
                      </span>
                      <div class="flex items-center gap-1.5">
                        <button
                          onClick$={() => {
                            editingImage.value = image;
                            editPreview.value = image.imageUrl;
                          }}
                          class="p-2 text-slate-650 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full border border-slate-200/60 shadow-xs transition-all cursor-pointer active:scale-90"
                          title="Editar Foto"
                        >
                          <LuPencil class="w-3.5 h-3.5" />
                        </button>

                        <Form action={toggleActiveAction}>
                          <input type="hidden" name="id" value={image.id} />
                          <button
                            type="submit"
                            class={[
                              "p-2 rounded-full border shadow-xs transition-all cursor-pointer active:scale-90",
                              image.isActive === 1
                                ? "text-emerald-650 hover:text-emerald-800 bg-emerald-50 border-emerald-100 hover:bg-emerald-100"
                                : "text-slate-450 hover:text-slate-600 bg-slate-50 border-slate-200/60 hover:bg-slate-100",
                            ]}
                            title={image.isActive === 1 ? "Ocultar" : "Mostrar"}
                          >
                            {image.isActive === 1 ? <LuEye class="w-3.5 h-3.5" /> : <LuEyeOff class="w-3.5 h-3.5" />}
                          </button>
                        </Form>

                        <button
                          type="button"
                          onClick$={$(async () => {
                            if (confirm(`¿Eliminar la foto "${image.title || "sin título"}"? Esta acción no se puede deshacer.`)) {
                              await deleteAction.submit({ id: image.id });
                            }
                          })}
                          class="p-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-full border border-red-100 shadow-xs transition-all cursor-pointer active:scale-90"
                          title="Eliminar Foto"
                        >
                          <LuTrash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Editing Modal */}
      {editingImage.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-300">
          <div class="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div class="bg-brand-green text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 class="font-display font-extrabold text-base text-brand-gold flex items-center gap-1.5">
                  <LuPencil class="w-4 h-4" />
                  Editar Foto
                </h3>
                <p class="text-[10px] text-slate-200 uppercase tracking-wider font-semibold">
                  Foto ID: {editingImage.value.id}
                </p>
              </div>
              <button
                onClick$={() => {
                  editingImage.value = null;
                  editPreview.value = null;
                }}
                class="p-1 text-slate-200 hover:text-white rounded-full transition-colors cursor-pointer"
              >
                <LuX class="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content Form */}
            <Form
              action={updateAction}
              enctype="multipart/form-data"
              onSubmit$={() => {
                editingImage.value = null;
                editPreview.value = null;
              }}
              class="flex-1 overflow-y-auto p-6 sm:p-8 space-y-5 text-left"
            >
              <input type="hidden" name="id" value={editingImage.value.id} />

              <div class="space-y-2">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Imagen</span>
                <div
                  preventdefault:dragover={true}
                  onDragOver$={() => {
                    isDragOverEdit.value = true;
                  }}
                  onDragLeave$={() => (isDragOverEdit.value = false)}
                  onDrop$={$((ev) => handleDrop(ev, "edit"))}
                  class={[
                    "relative group h-48 rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden flex flex-col items-center justify-center p-3 cursor-pointer text-center",
                    isDragOverEdit.value
                      ? "border-brand-green bg-emerald-50/50 scale-[1.01]"
                      : "border-slate-250 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400",
                  ]}
                  onClick$={() => editInputRef.value?.click()}
                >
                  <input
                    type="file"
                    name="image"
                    accept="image/*"
                    ref={editInputRef}
                    onChange$={(ev) => handleFileChange(ev, "edit")}
                    class="hidden"
                  />

                  {editPreview.value ? (
                    <>
                      <img
                        src={editPreview.value}
                        alt="Edit Preview"
                        class="absolute inset-0 w-full h-full object-cover z-0"
                        width={400}
                        height={225}
                      />
                      <div class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2 z-15 backdrop-blur-xs">
                        <LuImage class="w-4 h-4" />
                        Cambiar Imagen
                      </div>
                    </>
                  ) : (
                    <div class="flex flex-col items-center gap-1.5 text-slate-405 z-10">
                      <LuImage class="w-8 h-8 text-slate-400 stroke-1" />
                      <span class="text-xs font-bold text-slate-650">Soltá la nueva imagen aquí</span>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  name="imageUrl"
                  value={editingImage.value.imageUrl}
                  placeholder="URL de Imagen Externa"
                  class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-mono"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Título / Leyenda</label>
                <input
                  type="text"
                  name="title"
                  value={editingImage.value.title || ""}
                  placeholder="Ej: Cena Anual 2026"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-medium"
                />
              </div>

              {/* Modal Footer Controls */}
              <div class="-mx-6 sm:-mx-8 -mb-6 sm:-mb-8 bg-slate-50 p-5 flex justify-end border-t border-slate-150 gap-3">
                <button
                  type="button"
                  onClick$={() => {
                    editingImage.value = null;
                    editPreview.value = null;
                  }}
                  class="px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updateAction.isRunning}
                  class="px-6 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <LuCheck class="w-4 h-4" />
                  {updateAction.isRunning ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "AMP+ Club - Galería de Fotos",
  meta: [
    {
      name: "description",
      content: "Administrar la galería de fotos que se muestra en la página principal.",
    },
  ],
};
