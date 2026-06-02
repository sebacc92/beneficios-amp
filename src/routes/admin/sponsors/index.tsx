import { component$, useSignal, $, useTask$ } from "@builder.io/qwik";
import { put } from "@vercel/blob";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuPlus, LuImage, LuBuilding, LuTrash2, LuPencil, LuArrowLeft, LuArrowRight } from "@qwikest/icons/lucide";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { sponsors as sponsorsTable } from "~/db/schema";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

// --- SECURITY & LOADERS ---

export const useAdminSponsorsLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    // Sort sponsors by the custom display order field (y)
    return await db.select().from(sponsorsTable).orderBy(sponsorsTable.y);
  } catch (err) {
    console.error("Failed to load sponsors:", err);
    return [];
  }
});

// --- ACTIONS ---

export const useCreateSponsorAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const uuid = "sp-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();

      let uploadedImageUrl = "";
      let isBlob = false;
      const token = process.env.BLOB_READ_WRITE_TOKEN || requestEvent.env.get("BLOB_READ_WRITE_TOKEN");

      if (data.optimizedImage && typeof data.optimizedImage === "string" && data.optimizedImage.startsWith("data:image")) {
        const base64Data = data.optimizedImage.replace(/^data:image\/\w+;base64,/, "");
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const fileName = `sponsor-${Date.now()}.webp`;

        if (token) {
          try {
            const blob = await put(fileName, bytes, { access: "public", token });
            uploadedImageUrl = blob.url;
            isBlob = true;
          } catch (e) {
            console.error("Vercel Blob failed, fallback to fs", e);
          }
        }

        if (!isBlob) {
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, bytes);
          uploadedImageUrl = `/uploads/${fileName}`;
        }

      } else if (data.image && typeof data.image === "object" && (data.image as Blob).size > 0) {
        const file = data.image as File;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const extension = file.name.split(".").pop() || "png";
        const fileName = `sponsor-${Date.now()}.${extension}`;

        if (token) {
          try {
            const blob = await put(fileName, file, { access: "public", token });
            uploadedImageUrl = blob.url;
            isBlob = true;
          } catch (e) {
            console.error("Vercel Blob failed, fallback to fs", e);
          }
        }

        if (!isBlob) {
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, buffer);
          uploadedImageUrl = `/uploads/${fileName}`;
        }
      }

      if (!uploadedImageUrl) {
        return requestEvent.fail(400, { message: "Debe proporcionar una imagen válida." });
      }

      // Calculate next display order (y) by counting existing sponsors
      const existingSponsors = await db.select().from(sponsorsTable);
      const nextOrder = existingSponsors.length;

      await db.insert(sponsorsTable).values({
        id: uuid,
        name: data.name,
        imageUrl: uploadedImageUrl,
        linkUrl: data.linkUrl || null,
        x: 0,
        y: nextOrder,
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
    name: z.string().min(2, "El nombre del sponsor debe tener al menos 2 caracteres."),
    linkUrl: z.string().optional(),
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
      let uploadedImageUrl = data.imageUrl;
      let isBlob = false;
      const token = process.env.BLOB_READ_WRITE_TOKEN || requestEvent.env.get("BLOB_READ_WRITE_TOKEN");

      if (data.optimizedImage && typeof data.optimizedImage === "string" && data.optimizedImage.startsWith("data:image")) {
        const base64Data = data.optimizedImage.replace(/^data:image\/\w+;base64,/, "");
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const fileName = `sponsor-${Date.now()}.webp`;

        if (token) {
          try {
            const blob = await put(fileName, bytes, { access: "public", token });
            uploadedImageUrl = blob.url;
            isBlob = true;
          } catch (e) {
            console.error("Vercel Blob failed, fallback to fs", e);
          }
        }

        if (!isBlob) {
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, bytes);
          uploadedImageUrl = `/uploads/${fileName}`;
        }
      } else if (data.image && typeof data.image === "object" && (data.image as Blob).size > 0) {
        const file = data.image as File;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        const extension = file.name.split(".").pop() || "png";
        const fileName = `sponsor-${Date.now()}.${extension}`;

        if (token) {
          try {
            const blob = await put(fileName, file, { access: "public", token });
            uploadedImageUrl = blob.url;
            isBlob = true;
          } catch (e) {
            console.error("Vercel Blob failed, fallback to fs", e);
          }
        }

        if (!isBlob) {
          const uploadsDir = `${process.cwd()}/public/uploads`;
          const fsModule = await import("fs/promises");
          await fsModule.mkdir(uploadsDir, { recursive: true });
          const filePath = `${uploadsDir}/${fileName}`;
          await fsModule.writeFile(filePath, buffer);
          uploadedImageUrl = `/uploads/${fileName}`;
        }
      }

      await db
        .update(sponsorsTable)
        .set({
          name: data.name,
          imageUrl: uploadedImageUrl,
          linkUrl: data.linkUrl || null,
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
    name: z.string().min(2, "El nombre del sponsor debe tener al menos 2 caracteres."),
    imageUrl: z.string(),
    linkUrl: z.string().optional(),
    optimizedImage: z.string().optional(),
    image: z.any().optional(),
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
  const deleteSponsorAction = useDeleteSponsorAction();
  const reorderAction = useReorderSponsorsAction();

  const isFormOpen = useSignal(false);
  const editingSponsor = useSignal<any | null>(null);

  // Form Fields signals
  const formName = useSignal("");
  const formLinkUrl = useSignal("");
  const sponsorPreviewUrl = useSignal<string | null>(null);
  const optimizedImageBase64 = useSignal<string>("");

  // Reorder local signals mirroring database loader
  const orderedSponsors = useSignal<any[]>([]);

  useTask$(({ track }) => {
    track(() => sponsorsLoader.value);
    orderedSponsors.value = [...sponsorsLoader.value];
  });

  const handleEditClick = $((sp: any) => {
    editingSponsor.value = sp;
    formName.value = sp.name;
    formLinkUrl.value = sp.linkUrl || "";
    sponsorPreviewUrl.value = sp.imageUrl;
    optimizedImageBase64.value = "";
    isFormOpen.value = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const handleNewClick = $(() => {
    editingSponsor.value = null;
    formName.value = "";
    formLinkUrl.value = "";
    sponsorPreviewUrl.value = null;
    optimizedImageBase64.value = "";
    isFormOpen.value = !isFormOpen.value;
  });

  // Client-side instant reorder with autosave submit
  const handleMove = $(async (index: number, direction: "left" | "right") => {
    const arr = [...orderedSponsors.value];
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= arr.length) return;

    // Swap locally for instant visual feedback
    const temp = arr[index];
    arr[index] = arr[targetIndex];
    arr[targetIndex] = temp;
    
    orderedSponsors.value = arr;

    // Autosave new order
    await reorderAction.submit({
      idsJson: JSON.stringify(arr.map(s => s.id))
    });
  });

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto">
      {/* Header layout */}
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              Administración / Personalización
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Sponsors
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Gestioná las marcas y auspiciantes asociados que se deslizan en el carrusel de la página de inicio.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick$={handleNewClick}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <LuPlus class="w-4 h-4" />
            <span>{isFormOpen.value && !editingSponsor.value ? "Cerrar Panel" : "Añadir Sponsor"}</span>
          </button>
        </div>
      </div>

      <div class="space-y-6 animate-in fade-in duration-300 text-left">
        {/* Dynamic Form Panel (Create or Edit) */}
        {isFormOpen.value && (
          <Form 
            action={editingSponsor.value ? updateSponsorAction : createSponsorAction} 
            enctype="multipart/form-data" 
            onSubmit$={() => {
              // Automatically closes form panel upon submission
              setTimeout(() => {
                isFormOpen.value = false;
                editingSponsor.value = null;
              }, 400);
            }}
            class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-5 animate-in slide-in-from-top-6 duration-300"
          >
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {editingSponsor.value ? `Editar Sponsor: ${editingSponsor.value.name}` : "Nuevo Sponsor Publicitario"}
              </h4>
              {editingSponsor.value && (
                <button
                  type="button"
                  onClick$={() => {
                    isFormOpen.value = false;
                    editingSponsor.value = null;
                  }}
                  class="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase tracking-widest cursor-pointer"
                >
                  Cancelar
                </button>
              )}
            </div>

            {editingSponsor.value && <input type="hidden" name="id" value={editingSponsor.value.id} />}
            {editingSponsor.value && <input type="hidden" name="imageUrl" value={editingSponsor.value.imageUrl} />}
            <input type="hidden" name="optimizedImage" value={optimizedImageBase64.value} />

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Título / Nombre de la Marca (Tooltip)</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formName.value}
                  onInput$={(e) => (formName.value = (e.target as HTMLInputElement).value)}
                  placeholder="Ej: Swiss Medical"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Enlace de Redirección (Link)</label>
                <input
                  type="url"
                  name="linkUrl"
                  value={formLinkUrl.value}
                  onInput$={(e) => (formLinkUrl.value = (e.target as HTMLInputElement).value)}
                  placeholder="Ej: https://swissmedical.com"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Uploader Image Options */}
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Logotipo del Sponsor</label>
              <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-1">
                <div class="w-24 h-24 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {sponsorPreviewUrl.value ? (
                    <img src={sponsorPreviewUrl.value} alt="Preview" width={96} height={96} class="w-full h-full object-contain" />
                  ) : (
                    <LuBuilding class="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div class="space-y-2">
                  <label class="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-650 text-xs font-black rounded-full transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm active:scale-95">
                    <LuImage class="w-4 h-4 text-brand-green" />
                    Subir Logotipo
                    <input
                      type="file"
                      name="image"
                      accept="image/*"
                      onChange$={$((event: Event) => {
                        const element = event.target as HTMLInputElement;
                        if (!element.files || element.files.length === 0) return;
                        const file = element.files[0];

                        // Keep SVGs raw (as vector graphics are already fully optimized)
                        if (file.type === "image/svg+xml") {
                          optimizedImageBase64.value = "";
                          sponsorPreviewUrl.value = URL.createObjectURL(file);
                          return;
                        }

                        // Web Browser HTML5 Canvas Resizer Pipeline
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement("canvas");
                            const maxW = 360;
                            const maxH = 180;
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
                              // Export as lightweight transparent WebP format
                              const dataUrl = canvas.toDataURL("image/webp", 0.85);
                              optimizedImageBase64.value = dataUrl;
                              sponsorPreviewUrl.value = dataUrl;
                            }
                          };
                          img.src = e.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      })}
                      class="hidden"
                    />
                  </label>
                  <p class="text-[10px] text-slate-400 font-medium">Recomendable: imágenes horizontales o cuadradas. Los archivos PNG, JPEG y WebP se optimizarán y convertirán a WebP de forma automática para máxima velocidad de carga.</p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={createSponsorAction.isRunning || updateSponsorAction.isRunning}
              class="py-3 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer active:scale-95"
            >
              {createSponsorAction.isRunning || updateSponsorAction.isRunning ? "Procesando..." : "Guardar Cambios"}
            </button>
          </Form>
        )}

        {/* Action Feedbacks */}
        {createSponsorAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-in fade-in duration-300">
            ✓ Sponsor agregado y optimizado exitosamente.
          </div>
        )}

        {updateSponsorAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-in fade-in duration-300">
            ✓ Sponsor actualizado y optimizado exitosamente.
          </div>
        )}

        {/* Sponsors Cards List Grid */}
        <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
            <div>
              <h3 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Sponsors Cargados ({orderedSponsors.value.length})</h3>
              <p class="text-[10px] text-slate-400 font-bold mt-0.5">Ordená la fila usando las flechas. Los cambios se guardan automáticamente en tiempo real.</p>
            </div>
            {reorderAction.isRunning && (
              <span class="text-[10px] font-black text-brand-green animate-pulse uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                Guardando orden...
              </span>
            )}
          </div>
          
          {orderedSponsors.value.length === 0 ? (
            <div class="h-64 flex flex-col items-center justify-center text-slate-450 text-xs font-bold gap-3 border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/40">
              <LuBuilding class="w-10 h-10 text-slate-300" />
              <div class="text-center space-y-1">
                <p>No hay sponsors registrados aún.</p>
                <p class="text-[10px] text-slate-400 font-medium max-w-xs">Hacé clic en "Añadir Sponsor" arriba para registrar tu primer auspiciante.</p>
              </div>
            </div>
          ) : (
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {orderedSponsors.value.map((sp, idx) => (
                <div 
                  key={sp.id} 
                  class="relative bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-between group shadow-sm hover:shadow-md transition-all h-60 text-center"
                >
                  {/* Logo Preview */}
                  <div class="h-24 w-full flex items-center justify-center bg-white rounded-xl border border-slate-100 p-3 overflow-hidden shadow-inner">
                    <img 
                      src={sp.imageUrl} 
                      alt={sp.name} 
                      class="max-h-full max-w-full object-contain" 
                      width={140}
                      height={80}
                      loading="lazy"
                    />
                  </div>

                  {/* Sponsor Info */}
                  <div class="w-full mt-3 text-left px-1">
                    <h4 class="text-xs font-extrabold text-slate-800 truncate" title={sp.name}>{sp.name}</h4>
                    <p class="text-[10px] text-slate-400 truncate mt-1">
                      {sp.linkUrl ? (
                        <a href={sp.linkUrl} target="_blank" rel="noopener noreferrer" class="text-brand-green font-bold hover:underline">
                          {sp.linkUrl.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
                      ) : (
                        "Sin enlace de redirección"
                      )}
                    </p>
                  </div>

                  {/* Move left / right sorting buttons */}
                  <div class="flex items-center justify-between w-full border-t border-slate-200/60 pt-3 mt-3">
                    <button
                      type="button"
                      disabled={idx === 0 || reorderAction.isRunning}
                      onClick$={() => handleMove(idx, "left")}
                      class="p-1 px-2 bg-white text-slate-500 hover:text-brand-green disabled:opacity-30 disabled:hover:text-slate-500 rounded-lg border border-slate-200 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer text-[10px] font-bold flex items-center gap-1 leading-none"
                      title="Mover a la izquierda"
                    >
                      <LuArrowLeft class="w-3 h-3" />
                      <span>Izq</span>
                    </button>

                    <button
                      type="button"
                      disabled={idx === orderedSponsors.value.length - 1 || reorderAction.isRunning}
                      onClick$={() => handleMove(idx, "right")}
                      class="p-1 px-2 bg-white text-slate-500 hover:text-brand-green disabled:opacity-30 disabled:hover:text-slate-500 rounded-lg border border-slate-200 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer text-[10px] font-bold flex items-center gap-1 leading-none"
                      title="Mover a la derecha"
                    >
                      <span>Der</span>
                      <LuArrowRight class="w-3 h-3" />
                    </button>
                  </div>

                  {/* Floating Action Controls */}
                  <div class="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick$={() => handleEditClick(sp)}
                      class="p-1.5 text-slate-500 hover:text-brand-green bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
                      title="Editar Sponsor"
                    >
                      <LuPencil class="w-3.5 h-3.5" />
                    </button>
                    <Form 
                      action={deleteSponsorAction} 
                      onSubmit$={(ev) => {
                        if (!window.confirm(`¿Estás seguro de que deseas eliminar el sponsor "${sp.name}"?`)) {
                          ev.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={sp.id} />
                      <button
                        type="submit"
                        class="p-1.5 text-red-500 hover:text-red-700 bg-white hover:bg-red-50 rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
                        title="Eliminar Sponsor"
                      >
                        <LuTrash2 class="w-3.5 h-3.5" />
                      </button>
                    </Form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "AMP+ Club - Sponsors",
  meta: [
    {
      name: "description",
      content: "Administrar sponsors asociados.",
    },
  ],
};
