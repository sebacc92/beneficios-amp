import { component$, useSignal, $ } from "@builder.io/qwik";

interface ImageFramePreviewProps {
  /** URL de la imagen a previsualizar (objectURL local o URL remota). */
  src: string;
  /** Relación de aspecto objetivo del render real (ancho/alto). 16:9 = 1.777…, 9:16 = 0.5625. */
  targetRatio: number;
  /** Texto de la etiqueta de la zona segura. */
  safeLabel?: string;
  /** Desvío tolerado respecto al objetivo antes de advertir (0.15 = 15%). */
  tolerance?: number;
}

/**
 * Muestra una imagen DENTRO de un marco con la relación de aspecto real del
 * render (16:9 desktop, 9:16 mobile), usando object-cover — exactamente como se
 * verá en el sitio, incluido el recorte. Superpone una "zona segura" para que el
 * admin mantenga ahí el contenido importante, y advierte (sin bloquear) si la
 * imagen subida tiene una relación de aspecto muy distinta a la esperada.
 *
 * Es presentacional: el marco/borde y el input de archivo los pone el contenedor.
 * Va dentro de un contenedor `relative` con la relación de aspecto ya aplicada.
 */
export const ImageFramePreview = component$<ImageFramePreviewProps>(
  ({ src, targetRatio, safeLabel = "Zona segura", tolerance = 0.15 }) => {
    const natW = useSignal<number | null>(null);
    const natH = useSignal<number | null>(null);

    const onLoad = $((_: Event, el: HTMLImageElement) => {
      natW.value = el.naturalWidth;
      natH.value = el.naturalHeight;
    });

    const ratio = natW.value && natH.value ? natW.value / natH.value : null;
    const mismatch = ratio !== null && Math.abs(ratio - targetRatio) / targetRatio > tolerance;

    return (
      <>
        {/* La imagen tal cual se renderiza en el sitio (object-cover recorta igual). */}
        <img
          src={src}
          alt="Vista previa"
          onLoad$={onLoad}
          class="absolute inset-0 w-full h-full object-cover z-0"
        />

        {/* Zona segura: recuadro punteado centrado. Fuera de él la imagen puede
            recortarse según el dispositivo, así que el contenido clave va adentro. */}
        <div class="absolute inset-0 z-10 pointer-events-none flex items-start justify-center p-[7%]">
          <div class="w-full h-full border-2 border-dashed border-white/70 rounded-lg relative">
            <span class="absolute -top-0.5 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
              {safeLabel}
            </span>
          </div>
        </div>

        {/* Dimensiones detectadas + advertencia (no bloqueante) de recorte fuerte. */}
        {natW.value && natH.value && (
          <div class="absolute bottom-1.5 left-1.5 z-20 flex flex-col gap-1 items-start pointer-events-none">
            <span class="px-2 py-0.5 rounded-full bg-black/60 text-white text-[9px] font-bold tracking-wide">
              {natW.value}×{natH.value}px
            </span>
            {mismatch && (
              <span class="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black tracking-wide">
                ⚠ Relación distinta · se recortará
              </span>
            )}
          </div>
        )}
      </>
    );
  }
);
