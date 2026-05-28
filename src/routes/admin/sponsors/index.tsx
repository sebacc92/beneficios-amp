import { component$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuPlus, LuImage, LuBuilding, LuTrash2 } from "@qwikest/icons/lucide";
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
    return await db.select().from(sponsorsTable).orderBy(sponsorsTable.y, sponsorsTable.x);
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

      let uploadedImageUrl = data.imageUrl || "";

      if (data.image && typeof data.image === "object" && (data.image as Blob).size > 0) {
        const file = data.image as File;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploadsDir = `${process.cwd()}/public/uploads`;
        const fsModule = await import("fs/promises");
        await fsModule.mkdir(uploadsDir, { recursive: true });

        const extension = file.name.split(".").pop() || "png";
        const fileName = `sponsor-${Date.now()}.${extension}`;
        const filePath = `${uploadsDir}/${fileName}`;
        await fsModule.writeFile(filePath, buffer);

        uploadedImageUrl = `/uploads/${fileName}`;
      }

      if (!uploadedImageUrl) {
        return requestEvent.fail(400, { message: "Debe proporcionar una imagen o subir un archivo." });
      }

      await db.insert(sponsorsTable).values({
        id: uuid,
        name: data.name,
        imageUrl: uploadedImageUrl,
        linkUrl: data.linkUrl || null,
        x: Number(data.x || 0),
        y: Number(data.y || 0),
        w: Number(data.w || 2),
        h: Number(data.h || 2),
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
    imageUrl: z.string().optional(),
    linkUrl: z.string().optional(),
    x: z.string().optional(),
    y: z.string().optional(),
    w: z.string().optional(),
    h: z.string().optional(),
    image: z.any().optional(),
  })
);

export const useUpdateSponsorPositionAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const x = Number(data.x);
      const y = Number(data.y);
      const w = Number(data.w);
      const h = Number(data.h);

      if (x < 0 || x > 5 || w < 1 || w > 6 || x + w > 6) {
        return requestEvent.fail(400, { message: "Dimensiones de columna inválidas. Máximo 6 de ancho." });
      }
      if (y < 0 || h < 1) {
        return requestEvent.fail(400, { message: "Dimensiones de fila inválidas." });
      }

      await db
        .update(sponsorsTable)
        .set({ x, y, w, h })
        .where(eq(sponsorsTable.id, data.id));

      return { success: true };
    } catch (err: any) {
      console.error("Update sponsor error:", err);
      return requestEvent.fail(500, { message: "Error al actualizar coordenadas." });
    }
  },
  zod$({
    id: z.string(),
    x: z.string(),
    y: z.string(),
    w: z.string(),
    h: z.string(),
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

export default component$(() => {
  const sponsorsLoader = useAdminSponsorsLoader();
  const createSponsorAction = useCreateSponsorAction();
  const updateSponsorPositionAction = useUpdateSponsorPositionAction();
  const deleteSponsorAction = useDeleteSponsorAction();

  const isCreateSponsorOpen = useSignal(false);
  const sponsorPreviewUrl = useSignal<string | null>(null);

  const sponsors = sponsorsLoader.value;
  const maxRow = sponsors.reduce((max, sp) => Math.max(max, sp.y + sp.h), 0);
  const totalRows = Math.max(6, maxRow + 1);

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
            Grilla de Sponsors
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Organizá de manera visual e interactiva la disposición 2D de tus auspiciantes en la página de inicio.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick$={() => (isCreateSponsorOpen.value = !isCreateSponsorOpen.value)}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <LuPlus class="w-4 h-4" />
            <span>{isCreateSponsorOpen.value ? "Cerrar Panel" : "Añadir Sponsor"}</span>
          </button>
        </div>
      </div>

      <div class="space-y-6 animate-in fade-in duration-300 text-left">
        {/* Create Sponsor Form Panel */}
        {isCreateSponsorOpen.value && (
          <Form action={createSponsorAction} enctype="multipart/form-data" class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md space-y-5 animate-in slide-in-from-top-6 duration-300">
            <h4 class="text-sm font-bold text-slate-800 uppercase tracking-wider">Nuevo Sponsor Publicitario</h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nombre de la Marca</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Ej: Dazzler Hoteles"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Enlace de Redirección (Link)</label>
                <input
                  type="url"
                  name="linkUrl"
                  placeholder="Ej: https://dazzler.com"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Uploader Image Options */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Logotipo del Sponsor</label>
                <div class="flex items-center gap-4">
                  <div class="w-16 h-16 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {sponsorPreviewUrl.value ? (
                      <img src={sponsorPreviewUrl.value} alt="Preview" width={64} height={64} class="w-full h-full object-contain" />
                    ) : (
                      <LuBuilding class="w-7 h-7 text-slate-400" />
                    )}
                  </div>
                  <label class="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-extrabold rounded-full transition-all cursor-pointer flex items-center gap-1.5 shadow-sm">
                    <LuImage class="w-4 h-4" />
                    Subir Logo Local
                    <input
                      type="file"
                      name="image"
                      accept="image/*"
                      onChange$={$((event: Event) => {
                        const element = event.target as HTMLInputElement;
                        if (!element.files || element.files.length === 0) return;
                        const file = element.files[0];
                        sponsorPreviewUrl.value = URL.createObjectURL(file);
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
                  placeholder="https://ejemplo.com/logo.png"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
                />
                <p class="text-[10px] text-slate-400 font-medium">Recomendable: imágenes horizontales o cuadradas en formato SVG o PNG transparente.</p>
              </div>
            </div>

            {/* Initial coordinates */}
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Columna inicial (X)</label>
                <select name="x" class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none">
                  <option value="0">Columna 1 (Cero)</option>
                  <option value="1">Columna 2</option>
                  <option value="2">Columna 3</option>
                  <option value="3">Columna 4</option>
                  <option value="4">Columna 5</option>
                  <option value="5">Columna 6</option>
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Fila inicial (Y)</label>
                <input
                  type="number"
                  name="y"
                  value="0"
                  min="0"
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none"
                />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Ancho inicial (Celdas)</label>
                <select name="w" class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none">
                  <option value="1">1 Columna</option>
                  <option value="2" selected>2 Columnas (Mediano)</option>
                  <option value="3">3 Columnas (Grande)</option>
                  <option value="4">4 Columnas</option>
                  <option value="6">6 Columnas (Completo)</option>
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block">Alto inicial (Celdas)</label>
                <select name="h" class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none">
                  <option value="1">1 Fila (Banda)</option>
                  <option value="2" selected>2 Filas (Caja)</option>
                  <option value="3">3 Filas (Caja Alta)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={createSponsorAction.isRunning}
              class="py-3 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
            >
              {createSponsorAction.isRunning ? "Registrando..." : "Cargar en Grilla"}
            </button>
          </Form>
        )}

        {/* Action Feedbacks */}
        {createSponsorAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm">
            ✓ Sponsor agregado exitosamente y posicionado en la grilla.
          </div>
        )}

        {/* VISUAL EDITOR GRIDS */}
        <div>
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Tablero Organizador (Grilla Interactiva 6x)</h4>
            <div class="flex items-center gap-3 text-[10px] font-bold text-slate-400">
              <span class="inline-flex items-center gap-1">
                <span class="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300 inline-block"></span> Columnas (w)
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300 inline-block"></span> Filas (h)
              </span>
            </div>
          </div>

          <div class="relative w-full rounded-3xl border border-slate-200 bg-slate-50/60 p-4 min-h-[500px] overflow-x-auto select-none shadow-inner">
                {/* Grid Guides (Dashed Background Layer) */}
                <div class="grid grid-cols-6 gap-3 w-full h-full absolute inset-0 p-4 pointer-events-none">
                  {Array.from({ length: totalRows * 6 }).map((_, i) => {
                    const col = i % 6;
                    const row = Math.floor(i / 6);
                    return (
                      <div
                        key={`guide-${i}`}
                        style={{
                          gridColumn: `${col + 1} / span 1`,
                          gridRow: `${row + 1} / span 1`
                        }}
                        class="border border-dashed border-slate-250 bg-slate-100/30 rounded-2xl flex flex-col items-center justify-center text-[9px] font-bold text-slate-300 h-24 shadow-sm"
                      >
                        <span class="opacity-50">C{col + 1}, F{row + 1}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Active Sponsors Interactive Layer */}
                <div class="grid grid-cols-6 gap-3 w-full h-full relative z-10">
                  {sponsors.length === 0 ? (
                    <div class="col-span-6 h-96 flex flex-col items-center justify-center text-slate-400 text-xs font-semibold gap-2">
                      <span>La grilla de sponsors está vacía en este momento.</span>
                      <span class="text-[10px] text-slate-350">Hacé clic en "Añadir Sponsor" para agregar logotipos publicitarios.</span>
                    </div>
                  ) : (
                    sponsors.map((sp) => {
                      const minHeightPx = sp.h * 96 + (sp.h - 1) * 12; // cell height is 96px, gap-3 is 12px
                      return (
                        <div
                          key={sp.id}
                          style={{
                            gridColumn: `${sp.x + 1} / span ${sp.w}`,
                            gridRow: `${sp.y + 1} / span ${sp.h}`,
                            minHeight: `${minHeightPx}px`
                          }}
                          class="bg-white rounded-2xl border border-slate-200/90 shadow-md flex flex-col items-center justify-between p-3 relative group/card transition-all hover:shadow-xl hover:border-slate-350 hover:-translate-y-0.5 overflow-hidden animate-fade-in"
                        >
                          {/* Brand Header */}
                          <div class="w-full flex justify-between items-start gap-1 text-left">
                            <span class="text-[9px] font-black uppercase text-slate-400 tracking-wider bg-slate-100 rounded px-1.5 py-0.5 max-w-[70%] truncate">
                              {sp.name}
                            </span>
                            <span class="text-[8px] font-mono font-bold text-[#0a442a] bg-emerald-50 rounded px-1 tracking-tighter">
                              {sp.w}x{sp.h}
                            </span>
                          </div>

                          {/* Logo Display */}
                          <div class="flex-grow flex items-center justify-center p-2 max-h-[50%]">
                            <img
                              src={sp.imageUrl}
                              alt={sp.name}
                              class="max-h-16 max-w-full object-contain pointer-events-none"
                              width={120}
                              height={64}
                            />
                          </div>

                          {/* Visual Dynamic Shifting & Resizing Panel */}
                          <div class="w-full space-y-2 mt-2 pt-2 border-t border-slate-100">
                            {/* Position Moving Arrows Row */}
                            <div class="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-150 gap-1.5">
                              <span class="text-[8px] font-bold text-slate-400 uppercase tracking-widest pl-1">Posición</span>
                              <div class="flex items-center gap-1">
                                {/* Left */}
                                <Form action={updateSponsorPositionAction} class="inline">
                                  <input type="hidden" name="id" value={sp.id} />
                                  <input type="hidden" name="x" value={String(Math.max(0, sp.x - 1))} />
                                  <input type="hidden" name="y" value={String(sp.y)} />
                                  <input type="hidden" name="w" value={String(sp.w)} />
                                  <input type="hidden" name="h" value={String(sp.h)} />
                                  <button
                                    type="submit"
                                    disabled={sp.x === 0}
                                    class="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-emerald-50 hover:text-brand-green border border-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none text-xs font-black shadow-sm transition-all cursor-pointer active:scale-90"
                                    title="Mover Izquierda"
                                  >
                                    ←
                                  </button>
                                </Form>

                                {/* Down */}
                                <Form action={updateSponsorPositionAction} class="inline">
                                  <input type="hidden" name="id" value={sp.id} />
                                  <input type="hidden" name="x" value={String(sp.x)} />
                                  <input type="hidden" name="y" value={String(sp.y + 1)} />
                                  <input type="hidden" name="w" value={String(sp.w)} />
                                  <input type="hidden" name="h" value={String(sp.h)} />
                                  <button
                                    type="submit"
                                    class="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-emerald-50 hover:text-brand-green border border-slate-200 text-slate-600 text-xs font-black shadow-sm transition-all cursor-pointer active:scale-90"
                                    title="Mover Abajo"
                                  >
                                    ↓
                                  </button>
                                </Form>

                                {/* Up */}
                                <Form action={updateSponsorPositionAction} class="inline">
                                  <input type="hidden" name="id" value={sp.id} />
                                  <input type="hidden" name="x" value={String(sp.x)} />
                                  <input type="hidden" name="y" value={String(Math.max(0, sp.y - 1))} />
                                  <input type="hidden" name="w" value={String(sp.w)} />
                                  <input type="hidden" name="h" value={String(sp.h)} />
                                  <button
                                    type="submit"
                                    disabled={sp.y === 0}
                                    class="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-emerald-50 hover:text-brand-green border border-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none text-xs font-black shadow-sm transition-all cursor-pointer active:scale-90"
                                    title="Mover Arriba"
                                  >
                                    ↑
                                  </button>
                                </Form>

                                {/* Right */}
                                <Form action={updateSponsorPositionAction} class="inline">
                                  <input type="hidden" name="id" value={sp.id} />
                                  <input type="hidden" name="x" value={String(Math.min(6 - sp.w, sp.x + 1))} />
                                  <input type="hidden" name="y" value={String(sp.y)} />
                                  <input type="hidden" name="w" value={String(sp.w)} />
                                  <input type="hidden" name="h" value={String(sp.h)} />
                                  <button
                                    type="submit"
                                    disabled={sp.x + sp.w >= 6}
                                    class="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-emerald-50 hover:text-brand-green border border-slate-200 text-slate-600 disabled:opacity-30 disabled:pointer-events-none text-xs font-black shadow-sm transition-all cursor-pointer active:scale-90"
                                    title="Mover Derecha"
                                  >
                                    →
                                  </button>
                                </Form>
                              </div>
                            </div>

                            {/* Size Stretching Row */}
                            <div class="flex justify-between items-center bg-slate-50 p-1.5 rounded-lg border border-slate-150 gap-1.5">
                              <span class="text-[8px] font-bold text-slate-400 uppercase tracking-widest pl-1">Tamaño</span>
                              <div class="flex items-center gap-1.5">
                                {/* Columns w */}
                                <div class="flex border border-slate-200 rounded overflow-hidden shadow-sm">
                                  {/* w- */}
                                  <Form action={updateSponsorPositionAction} class="inline">
                                    <input type="hidden" name="id" value={sp.id} />
                                    <input type="hidden" name="x" value={String(sp.x)} />
                                    <input type="hidden" name="y" value={String(sp.y)} />
                                    <input type="hidden" name="w" value={String(Math.max(1, sp.w - 1))} />
                                    <input type="hidden" name="h" value={String(sp.h)} />
                                    <button
                                      type="submit"
                                      disabled={sp.w <= 1}
                                      class="w-6 h-5 flex items-center justify-center bg-white text-emerald-800 hover:bg-emerald-50 disabled:opacity-30 text-[9px] font-black cursor-pointer border-r border-slate-200"
                                      title="Reducir Ancho"
                                    >
                                      -w
                                    </button>
                                  </Form>
                                  {/* w+ */}
                                  <Form action={updateSponsorPositionAction} class="inline">
                                    <input type="hidden" name="id" value={sp.id} />
                                    <input type="hidden" name="x" value={String(sp.x)} />
                                    <input type="hidden" name="y" value={String(sp.y)} />
                                    <input type="hidden" name="w" value={String(Math.min(6 - sp.x, sp.w + 1))} />
                                    <input type="hidden" name="h" value={String(sp.h)} />
                                    <button
                                      type="submit"
                                      disabled={sp.x + sp.w >= 6}
                                      class="w-6 h-5 flex items-center justify-center bg-white text-emerald-800 hover:bg-emerald-50 disabled:opacity-30 text-[9px] font-black cursor-pointer"
                                      title="Aumentar Ancho"
                                    >
                                      +w
                                    </button>
                                  </Form>
                                </div>

                                {/* Rows h */}
                                <div class="flex border border-slate-200 rounded overflow-hidden shadow-sm">
                                  {/* h- */}
                                  <Form action={updateSponsorPositionAction} class="inline">
                                    <input type="hidden" name="id" value={sp.id} />
                                    <input type="hidden" name="x" value={String(sp.x)} />
                                    <input type="hidden" name="y" value={String(sp.y)} />
                                    <input type="hidden" name="w" value={String(sp.w)} />
                                    <input type="hidden" name="h" value={String(Math.max(1, sp.h - 1))} />
                                    <button
                                      type="submit"
                                      disabled={sp.h <= 1}
                                      class="w-6 h-5 flex items-center justify-center bg-white text-amber-800 hover:bg-amber-50 disabled:opacity-30 text-[9px] font-black cursor-pointer border-r border-slate-200"
                                      title="Reducir Alto"
                                    >
                                      -h
                                    </button>
                                  </Form>
                                  {/* h+ */}
                                  <Form action={updateSponsorPositionAction} class="inline">
                                    <input type="hidden" name="id" value={sp.id} />
                                    <input type="hidden" name="x" value={String(sp.x)} />
                                    <input type="hidden" name="y" value={String(sp.y)} />
                                    <input type="hidden" name="w" value={String(sp.w)} />
                                    <input type="hidden" name="h" value={String(sp.h + 1)} />
                                    <button
                                      type="submit"
                                      class="w-6 h-5 flex items-center justify-center bg-white text-amber-800 hover:bg-amber-50 text-[9px] font-black cursor-pointer"
                                      title="Aumentar Alto"
                                    >
                                      +h
                                    </button>
                                  </Form>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Floating Delete button */}
                          <Form action={deleteSponsorAction} class="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity z-20">
                            <input type="hidden" name="id" value={sp.id} />
                            <button
                              type="submit"
                              class="p-1 text-red-500 hover:text-red-700 bg-white hover:bg-red-50 rounded-full border border-slate-200 shadow-sm transition-all cursor-pointer"
                              title="Eliminar Sponsor"
                            >
                              <LuTrash2 class="w-3 h-3" />
                            </button>
                          </Form>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
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
      content: "Administrar sponsors modular grid.",
    },
  ],
};
