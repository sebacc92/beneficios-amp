import { component$, useSignal, useTask$, $, type QRL } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { LuImage, LuMonitor, LuSmartphone, LuX, LuCheck, LuPencil, LuSparkles, LuLoader } from "@qwikest/icons/lucide";
import { ImageFramePreview } from "~/components/image-frame-preview/image-frame-preview";
import { uploadImageDataUrl } from "~/utils/upload-image";
import { optimizeImageFileToWebpVariants, buildSrcset, SLIDE_WIDTHS_DESKTOP, SLIDE_WIDTHS_MOBILE } from "~/utils/optimize-image";

// Relaciones de aspecto REALES del hero (ver hero-slider.tsx): desktop 1600×646
// (~2.48:1) y mobile 4:5. Se usan también para la previsualización con recorte.
const RATIO_DESKTOP = 1600 / 646;
const RATIO_MOBILE = 4 / 5;
const HELP_DESKTOP = "Recomendado 2560×1035px (panorámico ~2.48:1) · JPG, PNG o WebP · hasta ~2 MB";
const HELP_MOBILE = "Recomendado 1080×1350px (vertical 4:5) · JPG, PNG o WebP · hasta ~2 MB";

interface SlideFormModalProps {
  /** "create" abre el form vacío; "edit" precarga los valores del slide. */
  mode: "create" | "edit";
  /** Slide existente (solo en modo edit). */
  slide?: any;
  /** Orden a asignar al slide nuevo (modo create): se agrega al final. */
  nextOrder?: number;
  /** ActionStore de crear o actualizar (misma forma de campos). */
  action: any;
  /** Cierra el modal (el padre baja la señal correspondiente). */
  onClose: QRL<() => void>;
}

/**
 * Modal ÚNICO para crear y editar slides del carrusel. Antes había dos formularios
 * casi idénticos duplicados (uno inline para crear, otro en modal para editar);
 * ahora ambos usan este componente para mantener consistencia y una sola fuente.
 * Incluye la miniatura WYSIWYG del hero (ImageFramePreview) y footer fijo.
 */
export const SlideFormModal = component$<SlideFormModalProps>(({ mode, slide, nextOrder = 1, action, onClose }) => {
  const isEdit = mode === "edit";

  // Textos (alimentan el preview WYSIWYG en vivo y se envían por su name).
  const preTitle = useSignal<string>(slide?.preTitle ?? "");
  const title = useSignal<string>(slide?.title ?? "");
  const subtitle = useSignal<string>(slide?.subtitle ?? "");
  const btnText = useSignal<string>(slide?.buttonText ?? "Explorar");
  const btnLink = useSignal<string>(slide?.buttonLink ?? "");
  const isActive = useSignal<boolean>(isEdit ? slide?.isActive === 1 : true);

  // Imágenes: preview (objectURL local o URL existente) + inputs de archivo.
  const desktopPreview = useSignal<string | null>(slide?.imageUrl ?? null);
  const mobilePreview = useSignal<string | null>(slide?.imageMobile ?? slide?.imageUrl ?? null);
  const desktopRef = useSignal<HTMLInputElement | undefined>(undefined);
  const mobileRef = useSignal<HTMLInputElement | undefined>(undefined);
  const dragDesktop = useSignal(false);
  const dragMobile = useSignal(false);

  // URLs finales (en Blob) que viajan por el form. Se optimizan y suben en el
  // navegador —igual que el alta de beneficios— para que NUNCA suba el JPG/PNG
  // crudo (antes 800–1080 KiB por slide, causa #1 del LCP). El input de archivo
  // se limpia tras optimizar, así el multipart no reenvía el original pesado.
  const desktopUrl = useSignal<string>(slide?.imageUrl ?? "");
  const mobileUrl = useSignal<string>(slide?.imageMobile ?? "");
  // srcset responsive: se generan varias variantes por ancho (desktop 1280/1920,
  // mobile 480/768) y se sirven con srcset/sizes en el hero, para no mandar una
  // imagen enorme a un viewport chico.
  const desktopSrcset = useSignal<string>(slide?.imageSrcset ?? "");
  const mobileSrcset = useSignal<string>(slide?.imageMobileSrcset ?? "");
  const uploading = useSignal(0);
  const uploadError = useSignal<string | null>(null);

  // Marca que hubo un submit desde ESTA instancia, para no cerrar por un
  // action.value.success viejo (el store de la acción persiste entre aperturas).
  const submitted = useSignal(false);

  // Optimiza a WebP en varias anchos (variantes responsive), sube cada una a
  // Blob y arma el srcset. La URL de fallback (imageUrl/imageMobile) apunta a la
  // variante más grande. Limpia el <input type=file> (el crudo no viaja).
  const processFile = $(async (file: File, which: "desktop" | "mobile") => {
    if (!file.type.startsWith("image/")) return;
    uploadError.value = null;
    // Preview inmediata con el archivo local mientras se sube.
    const objectUrl = URL.createObjectURL(file);
    if (which === "desktop") desktopPreview.value = objectUrl;
    else mobilePreview.value = objectUrl;

    uploading.value++;
    try {
      const widths = which === "desktop" ? SLIDE_WIDTHS_DESKTOP : SLIDE_WIDTHS_MOBILE;
      const variants = await optimizeImageFileToWebpVariants(file, widths);
      // Subir todas las variantes en paralelo.
      const uploaded = await Promise.all(
        variants.map(async (v) => {
          const res = await uploadImageDataUrl(v.dataUrl, `slide-${which}-${v.width}`);
          if ("url" in res) return { url: res.url, width: v.width };
          throw new Error(res.error);
        })
      );
      const srcset = buildSrcset(uploaded);
      const largest = uploaded[uploaded.length - 1].url; // fallback = mayor ancho
      if (which === "desktop") {
        desktopUrl.value = largest;
        desktopSrcset.value = srcset;
      } else {
        mobileUrl.value = largest;
        mobileSrcset.value = srcset;
      }
    } catch (err: any) {
      uploadError.value = err?.message || "No se pudo procesar la imagen.";
    } finally {
      uploading.value--;
      // El archivo crudo ya no debe viajar por el multipart: solo las URLs en Blob.
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

  // Cierra al terminar con éxito (solo si el submit salió de esta instancia).
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
              <LuPencil class="w-4 h-4" />
              {isEdit ? "Editar Slide Promocional" : "Nuevo Slide Promocional"}
            </h3>
            <p class="text-[10px] text-slate-200 uppercase tracking-wider font-semibold">
              {isEdit ? `Slide ID: ${slide?.id}` : "Se agrega al final del carrusel"}
            </p>
          </div>
          <button
            type="button"
            onClick$={onClose}
            class="p-1 text-slate-200 hover:text-white rounded-full transition-colors cursor-pointer"
          >
            <LuX class="w-6 h-6" />
          </button>
        </div>

        <Form
          action={action}
          enctype="multipart/form-data"
          onSubmit$={() => { submitted.value = true; }}
          class="flex flex-col flex-1 min-h-0"
        >
          {isEdit && <input type="hidden" name="id" value={slide?.id} />}
          {/* El orden se maneja por drag & drop en la grilla; acá se preserva/asigna. */}
          <input type="hidden" name="orderIndex" value={isEdit ? slide?.orderIndex : nextOrder} />

          {/* Contenido scrolleable: solo esto scrollea, el footer queda fijo. */}
          <div class="flex-1 overflow-y-auto p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
            {/* Columna izquierda: textos */}
            <div class="space-y-4">
              <div class="border-b border-slate-100 pb-3">
                <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <LuSparkles class="w-4 h-4 text-brand-gold fill-brand-gold" />
                  Información Textual del Slide
                </h4>
              </div>

              <div class="space-y-1">
                <label class={labelCls}>Etiqueta Superior (Pre-Título)</label>
                <input type="text" name="preTitle" bind:value={preTitle} placeholder="Ej: La Plata y City Bell" class={`${inputCls} font-medium`} />
              </div>

              <div class="space-y-1">
                <label class={labelCls}>Título Principal</label>
                <input type="text" name="title" required bind:value={title} placeholder="Ej: Temporada de Invierno AMP+" class={`${inputCls} font-bold`} />
              </div>

              <div class="space-y-1">
                <label class={labelCls}>Descripción (Subtítulo)</label>
                <textarea name="subtitle" required rows={2} bind:value={subtitle} placeholder="Ej: Presentá tu credencial digital y disfrutá de los mejores descuentos..." class={`${inputCls} font-medium`} />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class={labelCls}>Texto del Botón</label>
                  <input type="text" name="buttonText" bind:value={btnText} placeholder="Explorar" class={`${inputCls} font-semibold`} />
                </div>
                <div class="space-y-1">
                  <label class={labelCls}>Enlace de Redirección (URL)</label>
                  <input type="text" name="buttonLink" bind:value={btnLink} placeholder="/beneficios" class={`${inputCls} font-mono`} />
                </div>
              </div>

              <div class="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div class="space-y-0.5">
                  <span class="text-xs font-bold text-slate-700 uppercase tracking-wider block">Activar Slide Inmediatamente</span>
                  <span class="text-[10px] text-slate-400 font-semibold">Desmarcar para guardar como borrador oculto.</span>
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
                  Multimedia & Adaptabilidad Móvil
                </h4>
              </div>

              {/* Desktop (panorámico ~2.48:1, igual que el hero real) */}
              <div class="space-y-2">
                <span class={labelCls}>Imagen Horizontal Desktop (panorámico ~2.48:1)</span>
                <div
                  preventdefault:dragover={true}
                  onDragOver$={() => (dragDesktop.value = true)}
                  onDragLeave$={() => (dragDesktop.value = false)}
                  onDrop$={$((ev) => onDrop(ev, "desktop"))}
                  class={[
                    "relative group aspect-[1600/646] w-full rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden flex flex-col items-center justify-center p-4 cursor-pointer text-center",
                    dragDesktop.value ? "border-brand-green bg-emerald-50/50 scale-[1.01]" : "border-slate-250 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400",
                  ]}
                  onClick$={() => desktopRef.value?.click()}
                >
                  <input type="file" name="imageDesktop" accept="image/*" ref={desktopRef} onChange$={(ev) => onFileChange(ev, "desktop")} stoppropagation:click={true} class="hidden" />
                  {desktopPreview.value ? (
                    <>
                      <ImageFramePreview src={desktopPreview.value} targetRatio={RATIO_DESKTOP} preTitle={preTitle.value} title={title.value} subtitle={subtitle.value} buttonText={btnText.value} />
                      <div class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2 z-30 backdrop-blur-xs">
                        <LuImage class="w-5 h-5" />
                        Reemplazar Imagen Desktop
                      </div>
                    </>
                  ) : (
                    <div class="flex flex-col items-center gap-2 text-slate-450 z-10">
                      <LuMonitor class="w-10 h-10 text-slate-400 stroke-1 group-hover:scale-110 transition-transform duration-300" />
                      <div class="text-xs font-bold text-slate-650">Arrastrá la imagen desktop aquí</div>
                      <div class="text-[10px] text-slate-400 font-semibold">Aspecto panorámico ~2.48:1 (marco real de la vista)</div>
                      <span class="inline-flex px-3 py-1 bg-white border border-slate-200 text-slate-650 text-[10px] font-black uppercase rounded-full shadow-xs mt-1">Buscar Archivo</span>
                    </div>
                  )}
                </div>
                <p class="text-[10px] text-slate-400 font-semibold">{HELP_DESKTOP}</p>
                <input type="text" name="imageUrl" bind:value={desktopUrl} placeholder="Ó ingresá URL de Imagen Desktop Externa" class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-medium font-mono" />
                <input type="hidden" name="imageSrcset" bind:value={desktopSrcset} />
              </div>

              {/* Mobile (vertical 4:5, igual que el hero real) */}
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
                  <input type="file" name="imageMobile" accept="image/*" ref={mobileRef} onChange$={(ev) => onFileChange(ev, "mobile")} stoppropagation:click={true} class="hidden" />
                  {mobilePreview.value ? (
                    <>
                      <ImageFramePreview src={mobilePreview.value} targetRatio={RATIO_MOBILE} preTitle={preTitle.value} title={title.value} subtitle={subtitle.value} buttonText={btnText.value} />
                      <div class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-2 z-30 backdrop-blur-xs">
                        <LuImage class="w-5 h-5" />
                        Reemplazar Imagen Mobile
                      </div>
                    </>
                  ) : (
                    <div class="flex flex-col items-center gap-2 text-slate-400 z-10">
                      <LuSmartphone class="w-10 h-10 text-slate-400 stroke-1 group-hover:scale-110 transition-transform duration-300" />
                      <div class="text-xs font-bold text-slate-650">Arrastrá la imagen mobile aquí</div>
                      <div class="text-[10px] text-slate-400 font-semibold">Aspecto 4:5 (marco real de la vista)</div>
                      <span class="inline-flex px-3 py-1 bg-white border border-slate-200 text-slate-650 text-[10px] font-black uppercase rounded-full shadow-xs mt-1">Buscar Archivo</span>
                    </div>
                  )}
                </div>
                <p class="text-[10px] text-slate-400 font-semibold text-center">{HELP_MOBILE}</p>
                <input type="text" name="imageMobileUrl" bind:value={mobileUrl} placeholder="Ó ingresá URL de Imagen Mobile Externa" class="w-full bg-slate-50 text-slate-800 text-xs px-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all font-medium font-mono" />
                <input type="hidden" name="imageMobileSrcset" bind:value={mobileSrcset} />
              </div>
            </div>
          </div>

          {/* Estado de optimización/subida de imágenes */}
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

          {/* Error (no bloqueante) */}
          {action.value?.failed && (
            <div class="shrink-0 px-6 sm:px-8 py-2.5 bg-red-50 text-red-700 text-xs font-bold border-t border-red-100">
              {action.value.message || "Revisá los campos e intentá de nuevo."}
            </div>
          )}

          {/* Footer fijo: siempre visible, no scrollea. */}
          <div class="shrink-0 bg-slate-50 px-6 sm:px-8 py-4 flex justify-end border-t border-slate-200 gap-3">
            <button type="button" onClick$={onClose} class="px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95">
              Cancelar
            </button>
            <button type="submit" disabled={action.isRunning || uploading.value > 0} class="px-6 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-1.5">
              <LuCheck class="w-4 h-4" />
              {uploading.value > 0 ? "Optimizando..." : action.isRunning ? "Guardando..." : isEdit ? "Guardar Cambios" : "Registrar Slide"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
});
