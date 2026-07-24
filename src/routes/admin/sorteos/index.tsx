import { component$, useSignal, useStore, $, useTask$ } from "@builder.io/qwik";
import { put } from "@vercel/blob";
import { routeLoader$, routeAction$, Form, z, zod$, type DocumentHead } from "@builder.io/qwik-city";
import { LuPlus, LuTrash2, LuGift, LuPencil, LuEye, LuEyeOff, LuMove, LuTrophy } from "@qwikest/icons/lucide";
import { asc, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { raffles as rafflesTable } from "~/db/schema";
import { ensureRafflesTable } from "~/server/cache";
import { RaffleFormModal } from "~/components/raffle-form-modal/raffle-form-modal";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

// --- SECURITY & LOADERS ---

export const useAdminRafflesLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") {
    throw event.redirect(302, "/login");
  }
  try {
    const db = getDB(event);
    await ensureRafflesTable(db);
    return await db.select().from(rafflesTable).orderBy(asc(rafflesTable.orderIndex));
  } catch (err) {
    console.error("Failed to load raffles:", err);
    return [];
  }
});

// --- helper: sube una imagen (file adjunto o URL ya subida) ---
async function resolveRaffleImage(
  fileField: any,
  urlField: any,
  fallback: string,
  prefix: string,
  token: string | undefined
): Promise<string> {
  if (fileField && typeof fileField === "object" && (fileField as Blob).size > 0) {
    const file = fileField as File;
    const extension = file.name.split(".").pop() || "png";
    const fileName = `${prefix}-${Date.now()}.${extension}`;
    if (!token) throw new Error("Almacenamiento de imágenes no configurado (BLOB_READ_WRITE_TOKEN).");
    const blob = await put(fileName, file, { access: "public", token });
    return blob.url;
  }
  return (urlField as string) || fallback;
}

type RafflePrize = { prize: string; winner: string };

// --- helper: valida/normaliza el JSON de premios (uno con ganador opcional) ---
function parseRafflePrizes(raw: unknown): RafflePrize[] {
  try {
    const parsed = JSON.parse((raw as string) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p: any) =>
        typeof p === "string" ? { prize: p, winner: "" } : { prize: String(p?.prize || ""), winner: String(p?.winner || "") }
      )
      .filter((p) => p.prize.trim().length > 0);
  } catch {
    return [];
  }
}

// --- ACTIONS ---

export const useCreateRaffleAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const uuid = "raffle-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();
      const token = process.env.BLOB_READ_WRITE_TOKEN || requestEvent.env.get("BLOB_READ_WRITE_TOKEN");

      const uploadedDesktopUrl = await resolveRaffleImage(data.imageDesktopFile, data.imageUrl, "", "raffle-desk", token);
      if (!uploadedDesktopUrl) return requestEvent.fail(400, { message: "Debe proporcionar una imagen para el sorteo." });
      const uploadedMobileUrl = await resolveRaffleImage(data.imageMobileFile, data.imageMobileUrl, "", "raffle-mob", token);

      const prizesArr = parseRafflePrizes(data.prizes);
      if (prizesArr.length === 0) return requestEvent.fail(400, { message: "Cargá al menos un premio." });

      await db.insert(rafflesTable).values({
        id: uuid,
        title: data.title,
        description: data.description || "",
        prizes: JSON.stringify(prizesArr),
        imageUrl: uploadedDesktopUrl,
        imageMobile: uploadedMobileUrl || uploadedDesktopUrl,
        drawDate: data.drawDate,
        terms: data.terms || null,
        isActive: data.isActive === "on" ? 1 : 0,
        orderIndex: Number(data.orderIndex || 0),
        createdAt: new Date().toISOString(),
      });

      return { success: true };
    } catch (err: any) {
      console.error("Create raffle error:", err);
      return requestEvent.fail(500, { message: err.message || "Error al crear el sorteo." });
    }
  },
  zod$({
    title: z.string().min(2, "El título debe tener al menos 2 caracteres."),
    description: z.string().optional(),
    prizes: z.string().optional(),
    drawDate: z.string().min(1, "La fecha del sorteo es obligatoria."),
    terms: z.string().optional(),
    imageUrl: z.string().optional(),
    imageMobileUrl: z.string().optional(),
    orderIndex: z.string().optional(),
    isActive: z.string().optional(),
    imageDesktopFile: z.any().optional(),
    imageMobileFile: z.any().optional(),
  })
);

export const useUpdateRaffleAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const id = data.id as string;
      const existing = await db.select().from(rafflesTable).where(eq(rafflesTable.id, id)).limit(1);
      if (existing.length === 0) return requestEvent.fail(404, { message: "Sorteo no encontrado." });

      const token = process.env.BLOB_READ_WRITE_TOKEN || requestEvent.env.get("BLOB_READ_WRITE_TOKEN");
      const uploadedDesktopUrl = await resolveRaffleImage(data.imageDesktopFile, data.imageUrl, existing[0].imageUrl, "raffle-desk", token);
      const uploadedMobileUrl = await resolveRaffleImage(data.imageMobileFile, data.imageMobileUrl, existing[0].imageMobile || "", "raffle-mob", token);

      const prizesArr = parseRafflePrizes(data.prizes);
      if (prizesArr.length === 0) return requestEvent.fail(400, { message: "Cargá al menos un premio." });

      await db.update(rafflesTable).set({
        title: data.title,
        description: data.description || "",
        prizes: JSON.stringify(prizesArr),
        imageUrl: uploadedDesktopUrl,
        imageMobile: uploadedMobileUrl || uploadedDesktopUrl,
        drawDate: data.drawDate,
        terms: data.terms || null,
        isActive: data.isActive === "on" ? 1 : 0,
        orderIndex: Number(data.orderIndex || 0),
      }).where(eq(rafflesTable.id, id));

      return { success: true };
    } catch (err: any) {
      console.error("Update raffle error:", err);
      return requestEvent.fail(500, { message: err.message || "Error al actualizar el sorteo." });
    }
  },
  zod$({
    id: z.string(),
    title: z.string().min(2, "El título debe tener al menos 2 caracteres."),
    description: z.string().optional(),
    prizes: z.string().optional(),
    drawDate: z.string().min(1, "La fecha del sorteo es obligatoria."),
    terms: z.string().optional(),
    imageUrl: z.string().optional(),
    imageMobileUrl: z.string().optional(),
    orderIndex: z.string().optional(),
    isActive: z.string().optional(),
    imageDesktopFile: z.any().optional(),
    imageMobileFile: z.any().optional(),
  })
);

export const useDeleteRaffleAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      await db.delete(rafflesTable).where(eq(rafflesTable.id, data.id));
      return { success: true };
    } catch (err: any) {
      console.error("Delete raffle error:", err);
      return requestEvent.fail(500, { message: "Error al eliminar el sorteo." });
    }
  },
  zod$({ id: z.string() })
);

export const useToggleRaffleActiveAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const id = data.id as string;
      const current = await db.select().from(rafflesTable).where(eq(rafflesTable.id, id)).limit(1);
      if (current.length === 0) return requestEvent.fail(404, { message: "Sorteo no encontrado." });

      const newActive = current[0].isActive === 1 ? 0 : 1;
      await db.update(rafflesTable).set({ isActive: newActive }).where(eq(rafflesTable.id, id));
      return { success: true, isActive: newActive };
    } catch (err: any) {
      console.error("Toggle raffle active error:", err);
      return requestEvent.fail(500, { message: "Error al cambiar estado." });
    }
  },
  zod$({ id: z.string() })
);

export const useReorderRafflesAction = routeAction$(
  async (data, requestEvent) => {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user || user.role !== "admin") return requestEvent.fail(403, { message: "No autorizado." });

    try {
      const db = getDB(requestEvent);
      const ids = data.ids as string[];
      for (let i = 0; i < ids.length; i++) {
        await db.update(rafflesTable).set({ orderIndex: i + 1 }).where(eq(rafflesTable.id, ids[i]));
      }
      return { success: true };
    } catch (err: any) {
      console.error("Reorder raffles error:", err);
      return requestEvent.fail(500, { message: "Error al reordenar sorteos." });
    }
  },
  zod$({ ids: z.array(z.string()) })
);

export default component$(() => {
  const rafflesLoader = useAdminRafflesLoader();
  const createRaffleAction = useCreateRaffleAction();
  const updateRaffleAction = useUpdateRaffleAction();
  const deleteRaffleAction = useDeleteRaffleAction();
  const toggleActiveAction = useToggleRaffleActiveAction();
  const reorderRafflesAction = useReorderRafflesAction();

  const isCreateOpen = useSignal(false);
  const editingRaffle = useSignal<any | null>(null);

  const localRaffles = useStore<{ list: any[] }>({ list: [] });
  useTask$(({ track }) => {
    track(() => rafflesLoader.value);
    localRaffles.list = [...rafflesLoader.value];
  });

  const draggedIdx = useSignal<number | null>(null);
  const draggedOverIdx = useSignal<number | null>(null);

  const formatDate = (dateStr: string) => {
    const parts = (dateStr || "").split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const prizesSummary = (prizesJson: string) => {
    const list = parseRafflePrizes(prizesJson);
    const withWinner = list.filter((p) => p.winner.trim().length > 0).length;
    return { total: list.length, withWinner };
  };

  return (
    <div class="w-full px-6 sm:px-10 py-10 space-y-8 pb-24 font-sans text-slate-800 flex flex-col flex-1 overflow-y-auto bg-slate-50/50">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-slate-200 pb-7 gap-4">
        <div class="space-y-1.5 text-left">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-brand-green"></span>
            <span class="text-[10px] font-extrabold tracking-widest text-slate-450 uppercase">
              Administración / Promociones
            </span>
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Sorteos & Promociones
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Creá, editá y gestioná los sorteos que se muestran en la página pública de Sorteos.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            onClick$={() => { isCreateOpen.value = true; }}
            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <LuPlus class="w-4 h-4" />
            <span>Nuevo Sorteo</span>
          </button>
        </div>
      </div>

      <div class="space-y-8 animate-in fade-in duration-300 text-left">
        {createRaffleAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-bounce">
            ✓ Sorteo creado exitosamente.
          </div>
        )}
        {updateRaffleAction.value?.success && (
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm animate-bounce">
            ✓ Sorteo actualizado exitosamente.
          </div>
        )}

        {isCreateOpen.value && (
          <RaffleFormModal
            mode="create"
            nextOrder={localRaffles.list.length + 1}
            action={createRaffleAction}
            onClose={$(() => { isCreateOpen.value = false; })}
          />
        )}

        <div class="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl gap-3 text-slate-600 font-medium">
          <div class="flex items-center gap-2 text-xs text-left">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-gold text-brand-green-dark text-[10px] font-black">!</span>
            <span>
              <strong>Ordenamiento Visual Nativo</strong>: Arrastrá y soltá las tarjetas para reordenarlas. El orden se sincroniza automáticamente.
            </span>
          </div>
          {reorderRafflesAction.isRunning && (
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-brand-green text-[10px] font-bold uppercase tracking-wide rounded-full animate-pulse">
              Sincronizando orden...
            </span>
          )}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {localRaffles.list.length === 0 ? (
            <div class="col-span-full h-64 border-2 border-dashed border-slate-250 rounded-3xl flex flex-col items-center justify-center text-slate-450 gap-2 font-medium">
              <span>🎁 No hay sorteos configurados en el sistema.</span>
            </div>
          ) : (
            localRaffles.list.map((raffle, idx) => {
              const isDragged = idx === draggedIdx.value;
              const isOver = idx === draggedOverIdx.value;
              return (
                <div
                  key={raffle.id}
                  draggable={true}
                  preventdefault:dragover={true}
                  onDragStart$={(ev) => {
                    draggedIdx.value = idx;
                    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver$={() => { draggedOverIdx.value = idx; }}
                  onDrop$={$(() => {
                    if (draggedIdx.value === null || draggedOverIdx.value === null) return;
                    if (draggedIdx.value === draggedOverIdx.value) return;
                    const items = [...localRaffles.list];
                    const [draggedItem] = items.splice(draggedIdx.value, 1);
                    items.splice(draggedOverIdx.value, 0, draggedItem);
                    localRaffles.list = items;
                    reorderRafflesAction.submit({ ids: items.map((x) => x.id) });
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
                  <div class="absolute top-2 left-2 z-20 opacity-40 group-hover:opacity-150 transition-opacity bg-black/55 backdrop-blur-xs p-1.5 rounded-lg cursor-grab active:cursor-grabbing text-white" title="Arrastrar para reordenar">
                    <LuMove class="w-3.5 h-3.5" />
                  </div>

                  <div class="absolute top-2 right-2 z-20 flex gap-1.5 items-center">
                    <span class={[
                      "inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase backdrop-blur-md shadow-xs border text-white",
                      raffle.isActive === 1 ? "bg-emerald-500/80 border-emerald-400" : "bg-slate-500/80 border-slate-400",
                    ]}>
                      {raffle.isActive === 1 ? "Vigente" : "Finalizado"}
                    </span>
                  </div>

                  <div class="h-44 bg-slate-900 relative overflow-hidden flex items-center justify-center select-none border-b border-slate-100">
                    <img
                      src={raffle.imageUrl}
                      alt={raffle.title}
                      class="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                      width={320}
                      height={176}
                    />
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent flex flex-col justify-end p-4 text-left">
                      <span class="text-[9px] font-black uppercase text-brand-gold tracking-widest mb-0.5 inline-flex items-center gap-1">
                        <LuGift class="w-2.5 h-2.5 text-brand-gold" />
                        Sortea: {formatDate(raffle.drawDate)}
                      </span>
                      <h3 class="text-sm font-black text-white leading-tight font-display line-clamp-1">{raffle.title}</h3>
                    </div>
                  </div>

                  <div class="p-4 flex-grow flex flex-col justify-between text-left space-y-4 bg-white">
                    <div class="text-[10px] font-bold text-slate-500 space-y-1">
                      <div class="flex items-center gap-1">
                        <LuTrophy class="w-3 h-3 text-brand-gold" />
                        <span class="uppercase tracking-widest text-slate-400">Premios:</span>{" "}
                        <span class="text-slate-700 font-semibold">{prizesSummary(raffle.prizes).total}</span>
                      </div>
                      {prizesSummary(raffle.prizes).withWinner > 0 && (
                        <div class="truncate">
                          <span class="uppercase tracking-widest text-slate-400">Con ganador/a:</span>{" "}
                          <span class="text-emerald-700 font-semibold">
                            {prizesSummary(raffle.prizes).withWinner}/{prizesSummary(raffle.prizes).total}
                          </span>
                        </div>
                      )}
                    </div>

                    <div class="flex items-center justify-between border-t border-slate-100 pt-3 gap-2">
                      <span class="text-[10px] font-bold text-slate-400 font-mono">
                        #{raffle.orderIndex || idx + 1}
                      </span>
                      <div class="flex items-center gap-1.5">
                        <button
                          onClick$={() => { editingRaffle.value = raffle; }}
                          class="p-2 text-slate-650 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-full border border-slate-200/60 shadow-xs transition-all cursor-pointer active:scale-90"
                          title="Editar Sorteo"
                        >
                          <LuPencil class="w-3.5 h-3.5" />
                        </button>

                        <Form action={toggleActiveAction}>
                          <input type="hidden" name="id" value={raffle.id} />
                          <button
                            type="submit"
                            class={[
                              "p-2 rounded-full border shadow-xs transition-all cursor-pointer active:scale-90",
                              raffle.isActive === 1
                                ? "text-emerald-650 hover:text-emerald-800 bg-emerald-50 border-emerald-100 hover:bg-emerald-100"
                                : "text-slate-450 hover:text-slate-600 bg-slate-50 border-slate-200/60 hover:bg-slate-100",
                            ]}
                            title={raffle.isActive === 1 ? "Marcar como Finalizado" : "Marcar como Vigente"}
                          >
                            {raffle.isActive === 1 ? <LuEye class="w-3.5 h-3.5" /> : <LuEyeOff class="w-3.5 h-3.5" />}
                          </button>
                        </Form>

                        <button
                          type="button"
                          onClick$={$(async () => {
                            if (confirm(`¿Eliminar el sorteo "${raffle.title}"? Esta acción no se puede deshacer.`)) {
                              await deleteRaffleAction.submit({ id: raffle.id });
                            }
                          })}
                          class="p-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-full border border-red-100 shadow-xs transition-all cursor-pointer active:scale-90"
                          title="Eliminar Sorteo"
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

      {editingRaffle.value && (
        <RaffleFormModal
          mode="edit"
          raffle={editingRaffle.value}
          action={updateRaffleAction}
          onClose={$(() => { editingRaffle.value = null; })}
        />
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "AMP+ Club - Sorteos",
  meta: [
    {
      name: "description",
      content: "Administrar sorteos y promociones exclusivas para agremiados.",
    },
  ],
};
