import { component$, useSignal, $ } from "@builder.io/qwik";

interface ImageFramePreviewProps {
  /** URL de la imagen a previsualizar (objectURL local o URL remota). */
  src: string;
  /** Relación de aspecto real del hero (ancho/alto). Desktop ~3.66, mobile 0.8 (4:5). */
  targetRatio: number;
  /** Textos del hero para simular el resultado final (opcionales, en vivo). */
  preTitle?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  /** Desvío tolerado respecto al objetivo antes de advertir (0.15 = 15%). */
  tolerance?: number;
}

/**
 * Miniatura FIEL del hero: muestra la imagen con el mismo recorte que el sitio
 * (object-cover en la relación real) y le encima el degradado + los textos
 * (pre-título, título, subtítulo, botón) tal como aparecen en el home. Lo que se
 * ve acá es exactamente lo que se verá en el hero. Escala la tipografía con
 * container queries (cqw) para verse bien tanto en el marco desktop como mobile.
 *
 * Es presentacional: el marco/borde y el input de archivo los pone el contenedor
 * (un `relative` con la relación de aspecto ya aplicada).
 */
export const ImageFramePreview = component$<ImageFramePreviewProps>(
  ({ src, targetRatio, preTitle, title, subtitle, buttonText, tolerance = 0.15 }) => {
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
        {/* La imagen tal cual se renderiza en el hero (object-cover, mismo recorte). */}
        <img
          src={src}
          alt="Vista previa del hero"
          onLoad$={onLoad}
          class="absolute inset-0 w-full h-full object-cover z-0"
        />

        {/* Degradado idéntico al hero, para leer el recorte y los textos. */}
        <div class="absolute inset-0 z-10 bg-gradient-to-t from-[#020617]/95 via-[#020617]/40 to-transparent pointer-events-none" />

        {/* Textos como en el hero (abajo-izquierda), escalados al ancho del marco. */}
        <div
          class="absolute inset-0 z-20 flex flex-col justify-end items-start text-left text-white pointer-events-none px-[5%] pb-[7%]"
          style="container-type: inline-size"
        >
          {preTitle && (
            <span
              class="inline-flex items-center rounded-full bg-brand-gold text-brand-green-dark font-black uppercase tracking-wider shadow mb-[2.5cqw]"
              style="font-size:clamp(6px,2.6cqw,12px); padding:0.35em 0.9em"
            >
              {preTitle}
            </span>
          )}
          {title && (
            <div
              class="font-display font-black leading-none drop-shadow-md"
              style="font-size:clamp(13px,6cqw,44px)"
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div
              class="font-medium text-slate-100 drop-shadow leading-snug mt-[2cqw] line-clamp-2"
              style="font-size:clamp(7px,2.8cqw,15px)"
            >
              {subtitle}
            </div>
          )}
          {buttonText && (
            <span
              class="inline-flex items-center rounded-full bg-brand-gold text-brand-green-dark font-black uppercase tracking-wider shadow mt-[3cqw]"
              style="font-size:clamp(6px,2.6cqw,12px); padding:0.5em 1.2em"
            >
              {buttonText}
            </span>
          )}
        </div>

        {/* Dimensiones detectadas + advertencia de recorte fuerte (arriba, sin tapar los textos). */}
        {natW.value && natH.value && (
          <div class="absolute top-1.5 left-1.5 z-30 flex flex-col gap-1 items-start pointer-events-none">
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
