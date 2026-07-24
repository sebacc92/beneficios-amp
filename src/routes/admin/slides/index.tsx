import { component$, useSignal, useStore, $, useTask$ } from "@builder.io/qwik";
import { put } from "@vercel/blob";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import {
  LuPlus,
  LuTrash2,
  LuSparkles,
  LuPencil,
  LuEye,
  LuEyeOff,
  LuSmartphone,
  LuMove,
} from "@qwikest/icons/lucide";
import { asc, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { heroSlides as heroSlidesTable } from "~/db/schema";
import { ensureHeroSlidesSeeded } from "~/server/cache";
import { SlideFormModal } from "~/components/slide-form-modal/slide-form-modal";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

// --- SECURITY & LOADERS ---

export const useAdminSlidesLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    await ensureHeroSlidesSeeded(db);
    return await db.select().from(heroSlidesTable).orderBy(asc(heroSlidesTable.orderIndex));
  } catch (err) {
    console.error("Failed to load hero slides:", err);
    return [];
  }
});

// --- ACTIONS ---

export const useCreateSlideAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const uuid = "slide-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();

      let uploadedDesktopUrl = data.imageUrl || "";
      let uploadedMobileUrl = data.imageMobileUrl || "";

      const token = process.env.BLOB_READ_WRITE_TOKEN || requestEvent.env.get("BLOB_READ_WRITE_TOKEN");

      // Handle Desktop Image
      if (data.imageDesktop && typeof data.imageDesktop === "object" && (data.imageDesktop as Blob).size > 0) {
        const file = data.imageDesktop as File;
        const extension = file.name.split(".").pop() || "png";
        const fileName = `slide-desk-${Date.now()}.${extension}`;

        if (!token) throw new Error("Almacenamiento de imágenes no configurado (BLOB_READ_WRITE_TOKEN).");
        const blob = await put(fileName, file, { access: "public", token });
        uploadedDesktopUrl = blob.url;
      }

      // Handle Mobile Image
      if (data.imageMobile && typeof data.imageMobile === "object" && (data.imageMobile as Blob).size > 0) {
        const file = data.imageMobile as File;
        const extension = file.name.split(".").pop() || "png";
        const fileName = `slide-mob-${Date.now()}.${extension}`;

        if (!token) throw new Error("Almacenamiento de imágenes no configurado (BLOB_READ_WRITE_TOKEN).");
        const blob = await put(fileName, file, { access: "public", token });
        uploadedMobileUrl = blob.url;
      }

      if (!uploadedDesktopUrl) {
        return requestEvent.fail(400, { message: "Debe proporcionar una imagen desktop o subir un archivo." });
      }

      await db.insert(heroSlidesTable).values({
        id: uuid,
        imageUrl: uploadedDesktopUrl,
        imageMobile: uploadedMobileUrl || uploadedDesktopUrl,
        imageSrcset: data.imageSrcset || null,
        imageMobileSrcset: data.imageMobileSrcset || null,
        title: data.title,
        preTitle: data.preTitle || "Exclusivo AMP+",
        subtitle: data.subtitle,
        buttonText: data.buttonText || "Explorar",
        buttonLink: data.buttonLink || "/",
        orderIndex: Number(data.orderIndex || 0),
        isActive: data.isActive === "on" ? 1 : 0,
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (err: any) {
      console.error("Create slide error:", err);
      return requestEvent.fail(500, { message: err.message || "Error al crear el slide." });
    }
  },
  zod$({
    preTitle: z.string().optional(),
    title: z.string().min(2, "El título debe tener al menos 2 caracteres."),
    subtitle: z.string().min(2, "El subtítulo debe tener al menos 2 caracteres."),
    buttonText: z.string().optional(),
    buttonLink: z.string().optional(),
    imageUrl: z.string().optional(),
    imageMobileUrl: z.string().optional(),
    imageSrcset: z.string().optional(),
    imageMobileSrcset: z.string().optional(),
    orderIndex: z.string().optional(),
    isActive: z.string().optional(),
    imageDesktop: z.any().optional(),
    imageMobile: z.any().optional(),
  })
);

export const useUpdateSlideAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const id = data.id as string;
      const existing = await db.select().from(heroSlidesTable).where(eq(heroSlidesTable.id, id)).limit(1);
      if (existing.length === 0) return requestEvent.fail(404, { message: "Slide no encontrado." });

      let uploadedDesktopUrl = data.imageUrl || existing[0].imageUrl;
      let uploadedMobileUrl = data.imageMobileUrl || existing[0].imageMobile || "";

      const token = process.env.BLOB_READ_WRITE_TOKEN || requestEvent.env.get("BLOB_READ_WRITE_TOKEN");

      // Handle Desktop Image
      if (data.imageDesktop && typeof data.imageDesktop === "object" && (data.imageDesktop as Blob).size > 0) {
        const file = data.imageDesktop as File;
        const extension = file.name.split(".").pop() || "png";
        const fileName = `slide-desk-${Date.now()}.${extension}`;

        if (!token) throw new Error("Almacenamiento de imágenes no configurado (BLOB_READ_WRITE_TOKEN).");
        const blob = await put(fileName, file, { access: "public", token });
        uploadedDesktopUrl = blob.url;
      }

      // Handle Mobile Image
      if (data.imageMobile && typeof data.imageMobile === "object" && (data.imageMobile as Blob).size > 0) {
        const file = data.imageMobile as File;
        const extension = file.name.split(".").pop() || "png";
        const fileName = `slide-mob-${Date.now()}.${extension}`;

        if (!token) throw new Error("Almacenamiento de imágenes no configurado (BLOB_READ_WRITE_TOKEN).");
        const blob = await put(fileName, file, { access: "public", token });
        uploadedMobileUrl = blob.url;
      }

      await db.update(heroSlidesTable).set({
        imageUrl: uploadedDesktopUrl,
        imageMobile: uploadedMobileUrl || uploadedDesktopUrl,
        imageSrcset: data.imageSrcset || null,
        imageMobileSrcset: data.imageMobileSrcset || null,
        title: data.title,
        preTitle: data.preTitle || "Exclusivo AMP+",
        subtitle: data.subtitle,
        buttonText: data.buttonText || "Explorar",
        buttonLink: data.buttonLink || "/",
        orderIndex: Number(data.orderIndex || 0),
        isActive: data.isActive === "on" ? 1 : 0,
      }).where(eq(heroSlidesTable.id, id));

      return { success: true };
    } catch (err: any) {
      console.error("Update slide error:", err);
      return requestEvent.fail(500, { message: err.message || "Error al actualizar el slide." });
    }
  },
  zod$({
    id: z.string(),
    preTitle: z.string().optional(),
    title: z.string().min(2, "El título debe tener al menos 2 caracteres."),
    subtitle: z.string().min(2, "El subtítulo debe tener al menos 2 caracteres."),
    buttonText: z.string().optional(),
    buttonLink: z.string().optional(),
    imageUrl: z.string().optional(),
    imageMobileUrl: z.string().optional(),
    imageSrcset: z.string().optional(),
    imageMobileSrcset: z.string().optional(),
    orderIndex: z.string().optional(),
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

export default component$(() => {
  const slidesLoader = useAdminSlidesLoader();
  const createSlideAction = useCreateSlideAction();
  const updateSlideAction = useUpdateSlideAction();
  const deleteSlideAction = useDeleteSlideAction();
  const toggleActiveAction = useToggleActiveAction();
  const reorderSlidesAction = useReorderSlidesAction();

  const isCreateSlideOpen = useSignal(false);
  
  // Estado del modal de edición (qué slide se está editando).
  const editingSlide = useSignal<any | null>(null);

  // Copia local de los slides para el reordenamiento con drag & drop de las tarjetas.
  const localSlides = useStore<{ list: any[] }>({ list: [] });
  useTask$(({ track }) => {
    track(() => slidesLoader.value);
    localSlides.list = [...slidesLoader.value];
  });

  // Índices de la tarjeta arrastrada / sobrevolada (reordenamiento).
  const draggedIdx = useSignal<number | null>(null);
  const draggedOverIdx = useSignal<number | null>(null);

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto bg-slate-50/50">
      {/* SaaS Dashboard layout header */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              Administración / Personalización
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Carrusel Hero Promocional
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Modificá de forma dinámica las imágenes, etiquetas superiores, títulos, subtítulos y enlaces del carrusel de la página principal.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick$={() => { isCreateSlideOpen.value = true; }}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <LuPlus class="w-4 h-4" />
            <span>Añadir Slide</span>
          </button>
        </div>
      </div>

      <div class="space-y-8 animate-in fade-in duration-300 text-left">
        {/* Action feedback alerts */}
        {createSlideAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-bounce">
            ✓ Slide promocional agregado exitosamente al carrusel principal.
          </div>
        )}
        {updateSlideAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-bounce">
            ✓ Slide promocional actualizado exitosamente.
          </div>
        )}

        {/* Modal de creación (mismo componente que edición). */}
        {isCreateSlideOpen.value && (
          <SlideFormModal
            mode="create"
            nextOrder={localSlides.list.length + 1}
            action={createSlideAction}
            onClose={$(() => { isCreateSlideOpen.value = false; })}
          />
        )}

        {/* Drag & Drop Visual Deck Info Badge */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl gap-3 text-slate-600 font-medium">
          <div class="flex items-center gap-2 text-xs text-left">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-gold text-brand-green-dark text-[10px] font-black">!</span>
            <span>
              <strong>Ordenamiento Visual Nativo</strong>: Arrastrá y soltá las tarjetas para reordenarlas de forma inmediata. El sistema sincronizará los cambios automáticamente.
            </span>
          </div>
          {reorderSlidesAction.isRunning && (
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-brand-green text-[10px] font-bold uppercase tracking-wide rounded-full animate-pulse">
              Sincronizando orden...
            </span>
          )}
        </div>

        {/* Visual Slide Deck Preview Grid (Draggable Cards) */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {localSlides.list.length === 0 ? (
            <div class="col-span-full h-64 border-2 border-dashed border-slate-250 rounded-3xl flex flex-col items-center justify-center text-slate-450 gap-2 font-medium">
              <span>🎠 No hay slides promocionales configurados en el sistema.</span>
            </div>
          ) : (
            localSlides.list.map((slide, idx) => {
              const isDragged = idx === draggedIdx.value;
              const isOver = idx === draggedOverIdx.value;
              return (
                <div
                  key={slide.id}
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

                    const items = [...localSlides.list];
                    const [draggedItem] = items.splice(draggedIdx.value, 1);
                    items.splice(draggedOverIdx.value, 0, draggedItem);

                    localSlides.list = items;

                    // Bulk reorder update action on server
                    reorderSlidesAction.submit({ ids: items.map((x) => x.id) });

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
                  {/* Drag Handle Overlay bar */}
                  <div class="absolute top-2 left-2 z-20 opacity-40 group-hover:opacity-150 transition-opacity bg-black/55 backdrop-blur-xs p-1.5 rounded-lg cursor-grab active:cursor-grabbing text-white" title="Arrastrar para reordenar">
                    <LuMove class="w-3.5 h-3.5" />
                  </div>

                  {/* Header Badges */}
                  <div class="absolute top-2 right-2 z-20 flex gap-1.5 items-center">
                    <span class={[
                      "inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase backdrop-blur-md shadow-xs border text-white",
                      slide.isActive === 1 
                        ? "bg-emerald-500/80 border-emerald-400" 
                        : "bg-red-500/80 border-red-400"
                    ]}>
                      {slide.isActive === 1 ? "Activo" : "Borrador"}
                    </span>
                  </div>

                  {/* Background Desktop image mockup overlay */}
                  <div class="h-44 bg-slate-900 relative overflow-hidden flex items-center justify-center select-none border-b border-slate-100">
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      class="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                      width={320}
                      height={160}
                    />
                    
                    {/* Shadow overlay gradient */}
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent flex flex-col justify-end p-4 text-left">
                      <span class="text-[9px] font-black uppercase text-brand-gold tracking-widest mb-0.5 inline-flex items-center gap-1">
                        <LuSparkles class="w-2.5 h-2.5 text-brand-gold fill-brand-gold animate-pulse" />
                        {slide.preTitle || "Exclusivo AMP+"}
                      </span>
                      <h3 class="text-sm font-black text-white leading-tight font-display">{slide.title}</h3>
                      <p class="text-[10px] text-slate-200 line-clamp-1 mt-0.5">{slide.subtitle}</p>
                    </div>
                  </div>

                  {/* Body actions row */}
                  <div class="p-4 flex-grow flex flex-col justify-between text-left space-y-4 bg-white">
                    <div class="text-[10px] font-bold text-slate-500 space-y-1">
                      <div>
                        <span class="uppercase tracking-widest text-slate-400">Texto Botón:</span>{" "}
                        <span class="text-slate-700 font-semibold">{slide.buttonText || "Explorar"}</span>
                      </div>
                      <div class="truncate">
                        <span class="uppercase tracking-widest text-slate-400">Link Destino:</span>{" "}
                        <span class="text-slate-700 font-semibold font-mono">{slide.buttonLink || "/"}</span>
                      </div>
                      {slide.imageMobile && (
                        <div class="truncate flex items-center gap-1 mt-1 text-[9px] text-emerald-700 font-black">
                          <LuSmartphone class="w-3 h-3" />
                          Tiene Imagen Mobile
                        </div>
                      )}
                    </div>

                    {/* Premium action buttons suite */}
                    <div class="flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
                      <span class="text-[10px] font-bold text-slate-400 font-mono">
                        #{slide.orderIndex || idx + 1}
                      </span>
                      <div class="flex items-center gap-1.5">
                        {/* Edit Button */}
                        <button
                          onClick$={() => { editingSlide.value = slide; }}
                          class="p-2 text-slate-650 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full border border-slate-200/60 shadow-xs transition-all cursor-pointer active:scale-90"
                          title="Editar Slide"
                        >
                          <LuPencil class="w-3.5 h-3.5" />
                        </button>

                        {/* Visibility Toggle Button */}
                        <Form action={toggleActiveAction}>
                          <input type="hidden" name="id" value={slide.id} />
                          <button
                            type="submit"
                            class={[
                              "p-2 rounded-full border shadow-xs transition-all cursor-pointer active:scale-90",
                              slide.isActive === 1 
                                ? "text-emerald-650 hover:text-emerald-800 bg-emerald-50 border-emerald-100 hover:bg-emerald-100" 
                                : "text-slate-450 hover:text-slate-600 bg-slate-50 border-slate-200/60 hover:bg-slate-100"
                            ]}
                            title={slide.isActive === 1 ? "Desactivar (Ocultar)" : "Activar (Mostrar)"}
                          >
                            {slide.isActive === 1 ? <LuEye class="w-3.5 h-3.5" /> : <LuEyeOff class="w-3.5 h-3.5" />}
                          </button>
                        </Form>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick$={$(async () => {
                            if (confirm(`¿Eliminar el slide "${slide.title}"? Esta acción no se puede deshacer.`)) {
                              await deleteSlideAction.submit({ id: slide.id });
                            }
                          })}
                          class="p-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-full border border-red-100 shadow-xs transition-all cursor-pointer active:scale-90"
                          title="Eliminar Slide"
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

      {/* Editing Slide Modal Overlay */}
      {/* Modal de edición (mismo componente que creación). */}
      {editingSlide.value && (
        <SlideFormModal
          mode="edit"
          slide={editingSlide.value}
          action={updateSlideAction}
          onClose={$(() => { editingSlide.value = null; })}
        />
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "AMP+ Club - Carrusel Hero",
  meta: [
    {
      name: "description",
      content: "Administrar slides dinámicos con adaptabilidad móvil y ordenamiento visual nativo drag-and-drop.",
    },
  ],
};
