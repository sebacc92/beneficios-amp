import { component$, useSignal, useStore, useTask$, $, type QRL } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { LuImage, LuMonitor, LuSmartphone, LuX, LuCheck, LuGift, LuPlus, LuTrash2, LuLoader } from "@qwikest/icons/lucide";
import { ImageFramePreview } from "~/components/image-frame-preview/image-frame-preview";
import { RichTextEditor } from "~/components/rich-text-editor/rich-text-editor";
import { uploadImageDataUrl } from "~/utils/upload-image";
import { optimizeImageFileToWebp } from "~/utils/optimize-image";

// Relaciones de aspecto sugeridas para la imagen del sorteo (ver tabla de
// referencia): desktop 1200×675 (16:9, igual a la card del listado público)
// y mobile 1080×1350 (4:5, misma convención que el resto del sitio).
const RATIO_DESKTOP = 16 / 9;
const RATIO_MOBILE = 4 / 5;
const HELP_DESKTOP = "Recomendado 1200×675px (16:9) · Preferí subir en WebP · hasta ~2 MB";
const HELP_MOBILE = "Recomendado 1080×1350px (vertical 4:5) · Preferí subir en WebP · hasta ~2 MB";

interface RaffleFormModalProps {
  mode: "create" | "edit";
  raffle?: any;
  nextOrder?: number;
  action: any;
  onClose: QRL<() => void>;
}

/**
 * Modal único para crear y editar sorteos. Mismo patrón que SlideFormModal:
 * preview WYSIWYG del recorte de imagen, subida optimizada a Blob desde el
 * navegador, y footer fijo con estado de guardado.
 */
export const RaffleFormModal = component$<RaffleFormModalProps>(({ mode, raffle, nextOrder = 1, action, onClose }) => {
  const isEdit = mode === "edit";

  const title = useSignal<string>(raffle?.title ?? "");
  const description = useSignal<string>(raffle?.description ?? "");
  const drawDate = useSignal<string>(raffle?.drawDate ?? "");
  const terms = useSignal<string>(raffle?.terms ?? "");
  const isActive = useSignal<boolean>(isEdit ? raffle?.isActive === 1 : true);

  // Premios: lista dinámica, un ganador por premio. Arranca con 1 vacío
  // (create) o los ya cargados (edit).
  type Prize = { prize: string; winner: string };
  const initialPrizes: Prize[] = (() => {
    if (!isEdit) return [{ prize: "", winner: "" }];
    try {
      const parsed = JSON.parse(raffle?.prizes || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p: any) =>
          typeof p === "string" ? { prize: p, winner: "" } : { prize: p?.prize || "", winner: p?.winner || "" }
        );
      }
      return [{ prize: "", winner: "" }];
    } catch {
      return [{ prize: "", winner: "" }];
    }
  })();
  const prizes = useStore<{ list: Prize[] }>({ list: initialPrizes });
  const prizesJson = useSignal<string>(JSON.stringify(initialPrizes));

  useTask$(({ track }) => {
    track(() => prizes.list);
    prizesJson.value = JSON.stringify(prizes.list.filter((p) => p.prize.trim().length > 0));
  });

  // Imágenes
  const desktopPreview = useSignal<string | null>(raffle?.imageUrl ?? null);
  const mobilePreview = useSignal<string | null>(raffle?.imageMobile ?? raffle?.imageUrl ?? null);
  const desktopRef = useSignal<HTMLInputElement | undefined>(undefined);
  const mobileRef = useSignal<HTMLInputElement | undefined>(undefined);
  const dragDesktop = useSignal(false);
  const dragMobile = useSignal(false);
  const desktopUrl = useSignal<string>(raffle?.imageUrl ?? "");
  const mobileUrl = useSignal<string>(raffle?.imageMobile ?? "");
  const uploading = useSignal(0);
  const uploadError = useSignal<string | null>(null);

  const submitted = useSignal(false);

  const processFile = $(async (file: File, which: "desktop" | "mobile") => {
    if (!file.type.startsWith("image/")) return;
    uploadError.value = null;
    const objectUrl = URL.createObjectURL(file);
    if (which === "desktop") desktopPreview.value = objectUrl;
    else mobilePreview.value = objectUrl;

    uploading.value++;
    try {
      const [maxW, maxH] = which === "desktop" ? [1600, 1600] : [1080, 1350];
      const dataUrl = await optimizeImageFileToWebp(file, maxW, maxH);
      const res = await uploadImageDataUrl(dataUrl, `raffle-${which}`);
      if (!("url" in res)) throw new Error(res.error);
      if (which === "desktop") desktopUrl.value = res.url;
      else mobileUrl.value = res.url;
    } catch (err: any) {
      uploadError.value = err?.message || "No se pudo procesar la imagen.";
    } finally {
      uploading.value--;
      if (which === "desktop" && desktopRef.value) desktopRef.value.value = "";
      else if (which === "mobile" && mobileRef.value) mobileRef.value.value = "";
    }
  });

  const onFileChange = $((ev: Event, which: "desktop" | "mobile") => {
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    processFile(input.files[0], which);
  });

  const onDrop = $((ev: DragEvent, which: "desktop" | "mobile") => {
    if (!ev.dataTransfer || ev.dataTransfer.files.length === 0) return;
    const file = ev.dataTransfer.files[0];
    if (which === "desktop") dragDesktop.value = false;
    else dragMobile.value = false;
    processFile(file, which);
  });

  useTask$(({ track }) => {
    const v = track(() => action.value);
    if (submitted.value && v && (v as any).success) {
      onClose();
    }
  });

  const inputCls =
    "w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all";
  const labelCls = "text-xs font-bold text-slate-500 uppercase tracking-wider block";

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-300">
      <div class="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div class="bg-brand-green text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 class="font-display font-extrabold text-base text-brand-gold flex items-center gap-1.5">
              <LuGift class="w-4 h-4" />
              {isEdit ? "Editar Sorteo" : "Nuevo Sorteo"}
            </h3>
            <p class="text-[10px] text-slate-200 uppercase tracking-wider font-semibold">
              {isEdit ? `Sorteo ID: ${raffle?.id}` : "Se agrega a la lista de sorteos"}
            </p>
          </div>
          <button type="button" onClick$={onClose} class="p-1 text-slate-200 hover:text-white rounded-full transition-colors cursor-pointer">
            <LuX class="w-6 h-6" />
          </button>
        </div>

        <Form action={action} enctype="multipart/form-data" onSubmit$={() => { submitted.value = true; }} class="flex flex-col flex-1 min-h-0">
          {isEdit && <input type="hidden" name="id" value={raffle?.id} />}
          <input type="hidden" name="orderIndex" value={isEdit ? raffle?.orderIndex : nextOrder} />
          <input type="hidden" name="prizes" value={prizesJson.value} />

          <div class="flex-1 overflow-y-auto p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
            {/* Columna izquierda: textos */}
            <div class="space-y-4">
              <div class="border-b border-slate-100 pb-3">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <LuGift class="w-4 h-4 text-brand-gold" />
                  Información del Sorteo
                </h4>
              </div>

              <div class="space-y-1">
                <label class={labelCls}>Título</label>
                <input type="text" name="title" required bind:value={title} placeholder="Ej: Sorteo Especial de Invierno" class={`${inputCls} font-bold`} />
              </div>

              <div class="space-y-1">
                <label class={labelCls}>Descripción</label>
                <RichTextEditor value={description} placeholder="Contá de qué se trata el sorteo, cómo se participa..." />
                <input type="hidden" name="description" value={description.value} />
              </div>

              {/* Premios: lista dinámica, siempre al menos 1 */}
              <div class="space-y-2">
                <label class={labelCls}>Premios y Ganadores</label>
                <div class="space-y-2">
                  {prizes.list.map((item, idx) => (
                    <div key={idx} class="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-2xl p-3">
                      <div class="flex-1 space-y-1.5">
                        <input
                          type="text"
                          value={item.prize}
                          onInput$={(_, el) => {
                            const next = [...prizes.list];
                            next[idx] = { ...next[idx], prize: el.value };
                            prizes.list = next;
                          }}
                          placeholder={`Premio ${idx + 1}`}
                          class={`${inputCls} font-medium`}
                        />
                        <input
                          type="text"
                          value={item.winner}
                          onInput$={(_, el) => {
                            const next = [...prizes.list];
                            next[idx] = { ...next[idx], winner: el.value };
                            prizes.list = next;
                          }}
                          placeholder="Ganador/a (se completa al finalizar)"
                          class={`${inputCls} text-xs`}
                        />
                      </div>
                      {prizes.list.length > 1 && (
                        <button
                          type="button"
                          onClick$={() => { prizes.list = prizes.list.filter((_, i) => i !== idx); }}
                          class="p-2.5 mt-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all cursor-pointer flex-shrink-0"
                          title="Quitar premio"
                        >
                          <LuTrash2 class="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick$={() => { prizes.list = [...prizes.list, { prize: "", winner: "" }]; }}
                  class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  <LuPlus class="w-3.5 h-3.5" />
                  Agregar otro premio
                </button>
              </div>

              <div class="space-y-1">
                <label class={labelCls}>Fecha del Sorteo</label>
                <input type="date" name="drawDate" required bind:value={drawDate} class={`${inputCls} font-semibold`} />
              </div>

              <div class="space-y-1">
                <label class={labelCls}>Bases y Condiciones</label>
                <textarea name="terms" rows={3} bind:value={terms} placeholder="Quiénes participan, cómo se elige al ganador, etc." class={`${inputCls} font-medium`} />
              </div>

              <div class="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div class="space-y-0.5">
                  <span class="text-xs font-bold text-slate-700 uppercase tracking-wider block">Sorteo Vigente</span>
                  <span class="text-[10px] text-slate-400 font-semibold">Desmarcar cuando el sorteo ya se haya realizado (pasa a "Finalizado").</span>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="isActive" bind:checked={isActive} class="sr-only peer" />
                  <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
                </label>
              </div>
            </div>

            {/* Columna derecha: imágenes */}
            <div class="space-y-5">
              <div class="border-b border-slate-100 pb-3">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <LuImage class="w-4 h-4 text-brand-green" />
                  Imagen del Sorteo
                </h4>
              </div>

              {/* Desktop (16:9) */}
              <div class="space-y-2">
                <span class={labelCls}>Imagen Horizontal Desktop (16:9)</span>
                <div
                  preventdefault:dragover={true}
                  onDragOver$={() => (dragDesktop.value = true)}
                  onDragLeave$={() => (dragDesktop.value = false)}
                  onDrop$={$((ev) => onDrop(ev, "desktop"))}
                  class={[
                    "relative group aspect-video w-full rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden flex flex-col items-center justify-center p-4 cursor-pointer text-center",
                    dragDesktop.value ? "border-brand-green bg-emerald-50/50 scale-[1.01]" : "border-slate-250 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400",
                  ]}
                  onClick$={() => desktopRef.value?.click()}
                >
                  <input type="file" name="imageDesktopFile" accept="image/*" ref={desktopRef} onChange$={(ev) => onFileChange(ev, "desktop")} stoppropagation:click={true} class="hidden" />
                  {desktopPreview.value ? (
                    <>
                      <ImageFramePreview src={desktopPreview.value} targetRatio={RATIO_DESKTOP} title={title.value} />
                      <div class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2 z-30 backdrop-blur-xs">
                        <LuImage class="w-5 h-5" />
                        Reemplazar Imagen Desktop
                      </div>
                    </>
                  ) : (
                    <div class="flex flex-col items-center gap-2 text-slate-450 z-10">
                      <LuMonitor class="w-10 h-10 text-slate-400 stroke-1 group-hover:scale-110 transition-transform duration-300" />
                      <div class="text-xs font-bold text-slate-650">Arrastrá la imagen desktop aquí</div>
                      <div class="text-[10px] text-slate-400 font-semibold">Aspecto 16:9</div>
                      <span class="inline-flex px-3 py-1 bg-white border border-slate-200 text-slate-650 text-[10px] font-black uppercase rounded-full shadow-xs mt-1">Buscar Archivo</span>
                    </div>
                  )}
                </div>
                <p class="text-[10px] text-slate-400 font-semibold">{HELP_DESKTOP}</p>
                <input type="text" name="imageUrl" bind:value={desktopUrl} placeholder="Ó ingresá URL de Imagen Externa" class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-medium font-mono" />
              </div>

              {/* Mobile (4:5) */}
              <div class="space-y-2">
                <span class={labelCls}>Imagen Vertical Mobile (4:5)</span>
                <div
                  preventdefault:dragover={true}
                  onDragOver$={() => (dragMobile.value = true)}
                  onDragLeave$={() => (dragMobile.value = false)}
                  onDrop$={$((ev) => onDrop(ev, "mobile"))}
                  class={[
                    "relative group aspect-[4/5] w-full max-w-[220px] mx-auto rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden flex flex-col items-center justify-center p-4 cursor-pointer text-center",
                    dragMobile.value ? "border-brand-green bg-emerald-50/50 scale-[1.01]" : "border-slate-250 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400",
                  ]}
                  onClick$={() => mobileRef.value?.click()}
                >
                  <input type="file" name="imageMobileFile" accept="image/*" ref={mobileRef} onChange$={(ev) => onFileChange(ev, "mobile")} stoppropagation:click={true} class="hidden" />
                  {mobilePreview.value ? (
                    <>
                      <ImageFramePreview src={mobilePreview.value} targetRatio={RATIO_MOBILE} title={title.value} />
                      <div class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2 z-30 backdrop-blur-xs">
                        <LuImage class="w-5 h-5" />
                        Reemplazar Imagen Mobile
                      </div>
                    </>
                  ) : (
                    <div class="flex flex-col items-center gap-2 text-slate-400 z-10">
                      <LuSmartphone class="w-10 h-10 text-slate-400 stroke-1 group-hover:scale-110 transition-transform duration-300" />
                      <div class="text-xs font-bold text-slate-650">Arrastrá la imagen mobile aquí</div>
                      <div class="text-[10px] text-slate-400 font-semibold">Aspecto 4:5</div>
                      <span class="inline-flex px-3 py-1 bg-white border border-slate-200 text-slate-650 text-[10px] font-black uppercase rounded-full shadow-xs mt-1">Buscar Archivo</span>
                    </div>
                  )}
                </div>
                <p class="text-[10px] text-slate-400 font-semibold text-center">{HELP_MOBILE}</p>
                <input type="text" name="imageMobileUrl" bind:value={mobileUrl} placeholder="Ó ingresá URL de Imagen Externa" class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-medium font-mono" />
              </div>
            </div>
          </div>

          {uploading.value > 0 && (
            <div class="shrink-0 px-6 sm:px-8 py-2.5 bg-emerald-50 text-emerald-700 text-xs font-bold border-t border-emerald-100 flex items-center gap-2">
              <LuLoader class="w-4 h-4 animate-spin" />
              Optimizando y subiendo imagen (WebP)…
            </div>
          )}
          {uploadError.value && (
            <div class="shrink-0 px-6 sm:px-8 py-2.5 bg-red-50 text-red-700 text-xs font-bold border-t border-red-100">
              {uploadError.value}
            </div>
          )}
          {action.value?.failed && (
            <div class="shrink-0 px-6 sm:px-8 py-2.5 bg-red-50 text-red-700 text-xs font-bold border-t border-red-100">
              {action.value.message || "Revisá los campos e intentá de nuevo."}
            </div>
          )}

          <div class="shrink-0 bg-slate-50 px-6 sm:px-8 py-4 flex justify-end border-t border-slate-200 gap-3">
            <button type="button" onClick$={onClose} class="px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95">
              Cancelar
            </button>
            <button type="submit" disabled={action.isRunning || uploading.value > 0} class="px-6 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-1.5">
              <LuCheck class="w-4 h-4" />
              {uploading.value > 0 ? "Optimizando..." : action.isRunning ? "Guardando..." : isEdit ? "Guardar Cambios" : "Registrar Sorteo"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
});
