import { $, component$, useOnWindow, useSignal } from "@builder.io/qwik";

export const ScrollToTop = component$(() => {
  const show = useSignal(false);

  useOnWindow(
    "scroll",
    $(() => {
      // Use requestAnimationFrame for smooth UI updates
      requestAnimationFrame(() => {
        show.value = window.scrollY > 300;
      });
    }),
  );

  return (
    <button
      type="button"
      aria-label="Volver arriba"
      onClick$={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      class={`fixed right-6 bottom-6 z-50 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-brand-gold text-slate-950 border-2 border-brand-gold/45 shadow-xl transition-all duration-300 ease-in-out hover:scale-110 hover:bg-brand-gold/90 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 cursor-pointer ${
        show.value
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-10 opacity-0"
      }`}
      style={{ contain: "layout paint" }}
    >
      <svg class="h-7 w-7 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
});
