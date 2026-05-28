import { component$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuPlus, LuImage, LuTrash2, LuSparkles } from "@qwikest/icons/lucide";
import { asc, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { heroSlides as heroSlidesTable } from "~/db/schema";
import { ensureHeroSlidesSeeded } from "~/server/cache";
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

      let uploadedImageUrl = data.imageUrl || "";

      if (data.image && typeof data.image === "object" && (data.image as Blob).size > 0) {
        const file = data.image as File;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploadsDir = `${process.cwd()}/public/uploads`;
        const fsModule = await import("fs/promises");
        await fsModule.mkdir(uploadsDir, { recursive: true });

        const extension = file.name.split(".").pop() || "png";
        const fileName = `slide-${Date.now()}.${extension}`;
        const filePath = `${uploadsDir}/${fileName}`;
        await fsModule.writeFile(filePath, buffer);

        uploadedImageUrl = `/uploads/${fileName}`;
      }

      if (!uploadedImageUrl) {
        return requestEvent.fail(400, { message: "Debe proporcionar una imagen o subir un archivo." });
      }

      await db.insert(heroSlidesTable).values({
        id: uuid,
        imageUrl: uploadedImageUrl,
        title: data.title,
        subtitle: data.subtitle,
        buttonText: data.buttonText || "Explorar",
        buttonLink: data.buttonLink || "/",
        orderIndex: Number(data.orderIndex || 0),
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (err: any) {
      console.error("Create slide error:", err);
      return requestEvent.fail(500, { message: err.message || "Error al crear el slide." });
    }
  },
  zod$({
    title: z.string().min(2, "El título debe tener al menos 2 caracteres."),
    subtitle: z.string().min(2, "El subtítulo debe tener al menos 2 caracteres."),
    buttonText: z.string().optional(),
    buttonLink: z.string().optional(),
    imageUrl: z.string().optional(),
    orderIndex: z.string().optional(),
    image: z.any().optional(),
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

export default component$(() => {
  const slidesLoader = useAdminSlidesLoader();
  const createSlideAction = useCreateSlideAction();
  const deleteSlideAction = useDeleteSlideAction();

  const isCreateSlideOpen = useSignal(false);
  const slidePreviewUrl = useSignal<string | null>(null);

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
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
            Carrusel Hero
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Modificá de forma dinámica las imágenes, títulos, y enlaces del carrusel promocional de la página principal.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick$={() => (isCreateSlideOpen.value = !isCreateSlideOpen.value)}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <LuPlus class="w-4 h-4" />
            <span>{isCreateSlideOpen.value ? "Cerrar Panel" : "Añadir Slide"}</span>
          </button>
        </div>
      </div>

      <div class="space-y-6 animate-in fade-in duration-300 text-left">
        {/* Action Feedback alerts */}
        {createSlideAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm">
            ✓ Slide promocional agregado exitosamente al carrusel principal.
          </div>
        )}

        {/* Create Slide Form Panel */}
        {isCreateSlideOpen.value && (
          <Form action={createSlideAction} enctype="multipart/form-data" class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-5 animate-in slide-in-from-top-6 duration-300">
            <h4 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Nuevo Slide Promocional</h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Título del Slide</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Ej: Hotelería Dazzler"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Subtítulo (Descripción corta)</label>
                <input
                  type="text"
                  name="subtitle"
                  required
                  placeholder="Ej: Presentá tu credencial digital y disfrutá..."
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Texto del Botón</label>
                <input
                  type="text"
                  name="buttonText"
                  placeholder="Explorar"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Enlace del Botón (Link)</label>
                <input
                  type="text"
                  name="buttonLink"
                  placeholder="/"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Orden de Visualización</label>
                <input
                  type="number"
                  name="orderIndex"
                  value="0"
                  min="0"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Slide Image Options */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Imagen de Fondo (Slide)</label>
                <div class="flex items-center gap-4">
                  <div class="w-20 h-12 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {slidePreviewUrl.value ? (
                      <img src={slidePreviewUrl.value} alt="Preview" width={80} height={48} class="w-full h-full object-cover" />
                    ) : (
                      <LuImage class="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <label class="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-extrabold rounded-full transition-all cursor-pointer flex items-center gap-1.5 shadow-sm">
                    <LuImage class="w-4 h-4" />
                    Subir Imagen Local
                    <input
                      type="file"
                      name="image"
                      accept="image/*"
                      onChange$={$((event: Event) => {
                        const element = event.target as HTMLInputElement;
                        if (!element.files || element.files.length === 0) return;
                        const file = element.files[0];
                        slidePreviewUrl.value = URL.createObjectURL(file);
                      })}
                      class="hidden"
                    />
                  </label>
                </div>
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Ó ingresar URL de Imagen Externa</label>
                <input
                  type="text"
                  name="imageUrl"
                  placeholder="https://ejemplo.com/slide1.jpg"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={createSlideAction.isRunning}
              class="py-3 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
            >
              {createSlideAction.isRunning ? "Registrando..." : "Añadir a Carrusel"}
            </button>
          </Form>
        )}

        {/* Visual Slide Deck Preview Grid */}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {slidesLoader.value.length === 0 ? (
            <div class="col-span-full h-64 border-2 border-dashed border-slate-250 rounded-3xl flex flex-col items-center justify-center text-slate-450 gap-2 font-medium">
              <span>🎠 No hay slides promocionales configurados en el sistema.</span>
            </div>
          ) : (
            slidesLoader.value.map((slide) => (
              <div key={slide.id} class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col group hover:shadow-md transition-all">
                {/* Background image overlay mock */}
                <div class="h-40 bg-slate-900 relative overflow-hidden flex items-center justify-center">
                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    class="w-full h-full object-cover opacity-80"
                    width={320}
                    height={160}
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent flex flex-col justify-end p-4 text-left">
                    <span class="text-[9px] font-black uppercase text-brand-gold tracking-widest mb-1 inline-flex items-center gap-1">
                      <LuSparkles class="w-3 h-3 text-brand-gold fill-brand-gold animate-pulse" />
                      Slide #{slide.orderIndex}
                    </span>
                    <h3 class="text-sm font-black text-white leading-tight font-display">{slide.title}</h3>
                    <p class="text-[10px] text-slate-200 line-clamp-1 mt-0.5">{slide.subtitle}</p>
                  </div>

                  {/* Delete overlay */}
                  <Form action={deleteSlideAction} class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <input type="hidden" name="id" value={slide.id} />
                    <button
                      type="submit"
                      class="p-1.5 text-red-500 hover:text-red-700 bg-white hover:bg-red-50 rounded-full border border-slate-200 shadow-sm transition-all cursor-pointer"
                      title="Eliminar Slide"
                    >
                      <LuTrash2 class="w-4 h-4" />
                    </button>
                  </Form>
                </div>

                <div class="p-4 flex-grow flex flex-col justify-between text-left space-y-3">
                  <div class="text-[10px] font-bold text-slate-500 space-y-1">
                    <div>
                      <span class="uppercase tracking-widest text-slate-400">Texto Botón:</span>{" "}
                      <span class="text-slate-700 font-semibold">{slide.buttonText || "Explorar"}</span>
                    </div>
                    <div class="truncate">
                      <span class="uppercase tracking-widest text-slate-400">Link Destino:</span>{" "}
                      <span class="text-slate-700 font-semibold font-mono">{slide.buttonLink || "/"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "AMP+ Club - Carrusel Hero",
  meta: [
    {
      name: "description",
      content: "Administrar slides dinámicos del carrusel principal.",
    },
  ],
};
