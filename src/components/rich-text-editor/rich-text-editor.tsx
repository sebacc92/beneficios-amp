import { component$, useSignal, useVisibleTask$, $, type Signal } from "@builder.io/qwik";
import { LuBold, LuItalic, LuList, LuListOrdered, LuLink } from "@qwikest/icons/lucide";

interface RichTextEditorProps {
  /** Señal de dos vías con el HTML del contenido (se sincroniza en cada cambio). */
  value: Signal<string>;
  placeholder?: string;
}

/**
 * Editor WYSIWYG liviano y compatible con Qwik (contentEditable + toolbar mínima),
 * sin dependencias externas. Sólo produce formatos permitidos: negrita, itálica,
 * listas (ul/ol), links y párrafos. El HTML resultante se sanitiza igualmente en
 * el servidor antes de guardar y al renderizar (ver utils/sanitize-html).
 */
export const RichTextEditor = component$<RichTextEditorProps>(({ value, placeholder }) => {
  const editorRef = useSignal<HTMLElement>();

  // Carga inicial del contenido (una sola vez) desde la señal.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const el = editorRef.value;
    if (el && !el.dataset.init) {
      el.innerHTML = value.value || "";
      el.dataset.init = "1";
    }
  });

  const sync = $(() => {
    if (editorRef.value) value.value = editorRef.value.innerHTML;
  });

  const exec = $((command: string, arg?: string) => {
    editorRef.value?.focus();
    // execCommand está deprecado pero sigue siendo la vía más simple y sin
    // dependencias para un editor básico; el HTML se sanitiza igual.
    document.execCommand(command, false, arg);
    if (editorRef.value) value.value = editorRef.value.innerHTML;
  });

  const addLink = $(() => {
    const url = window.prompt("URL del enlace (debe empezar con http:// o https://):", "https://");
    if (url && /^https?:\/\//i.test(url.trim())) {
      editorRef.value?.focus();
      document.execCommand("createLink", false, url.trim());
      if (editorRef.value) value.value = editorRef.value.innerHTML;
    } else if (url) {
      window.alert("El enlace debe empezar con http:// o https://");
    }
  });

  const btnClass =
    "w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white hover:text-brand-green border border-transparent hover:border-slate-200 transition-all";

  return (
    <div class="rounded-2xl border border-slate-200 bg-slate-50 focus-within:border-brand-green focus-within:bg-white transition-all overflow-hidden">
      {/* Toolbar (preventdefault:mousedown para no perder la selección del editor) */}
      <div class="flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 bg-slate-100/70">
        <button type="button" title="Negrita" preventdefault:mousedown class={btnClass} onClick$={() => exec("bold")}>
          <LuBold class="w-4 h-4" />
        </button>
        <button type="button" title="Itálica" preventdefault:mousedown class={btnClass} onClick$={() => exec("italic")}>
          <LuItalic class="w-4 h-4" />
        </button>
        <span class="w-px h-5 bg-slate-300 mx-1" />
        <button type="button" title="Lista con viñetas" preventdefault:mousedown class={btnClass} onClick$={() => exec("insertUnorderedList")}>
          <LuList class="w-4 h-4" />
        </button>
        <button type="button" title="Lista numerada" preventdefault:mousedown class={btnClass} onClick$={() => exec("insertOrderedList")}>
          <LuListOrdered class="w-4 h-4" />
        </button>
        <span class="w-px h-5 bg-slate-300 mx-1" />
        <button type="button" title="Insertar enlace" preventdefault:mousedown class={btnClass} onClick$={addLink}>
          <LuLink class="w-4 h-4" />
        </button>
      </div>

      {/* Área editable */}
      <div
        ref={editorRef}
        contentEditable="true"
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder || "Escribí los detalles del beneficio…"}
        onInput$={sync}
        onBlur$={sync}
        class="rte-content min-h-[140px] max-h-[360px] overflow-y-auto px-4 py-3 text-sm text-slate-800 leading-relaxed focus:outline-none prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-a:text-brand-green"
      />
    </div>
  );
});
