import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { LuMapPin, LuSearch } from "@qwikest/icons/lucide";

export default component$(() => {
  return (
    <section class="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
      <p class="text-sm font-black uppercase tracking-widest text-slate-600">Error 404</p>
      <h1 class="mt-3 text-4xl sm:text-5xl font-display font-black text-primary tracking-tight">
        No encontramos esta página
      </h1>
      <p class="mt-4 text-base text-slate-600">
        Puede que el beneficio ya no esté vigente o que el enlace tenga un error. Buscalo en el catálogo:
      </p>

      {/* Plain GET form: works even before the page becomes interactive. */}
      <form action="/beneficios/" method="get" role="search" class="mt-8 flex gap-2">
        <label for="not-found-search" class="sr-only">Buscar beneficios</label>
        <input
          id="not-found-search"
          type="search"
          name="buscar"
          placeholder="Buscar beneficios, marcas o categorías..."
          class="min-w-0 flex-1 rounded-full border border-line bg-surface px-5 py-3 text-base text-primary placeholder-slate-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
        <button type="submit" class="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 font-extrabold text-primary hover:bg-accent-hover cursor-pointer">
          <LuSearch class="w-4 h-4" />
          <span>Buscar</span>
        </button>
      </form>

      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/beneficios/" class="rounded-full border border-line bg-surface px-5 py-3 text-sm font-bold text-primary hover:border-accent">
          Ver todos los beneficios
        </Link>
        <Link href="/mapa/" class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-bold text-primary hover:border-accent">
          <LuMapPin class="w-4 h-4" /> Beneficios cerca mío
        </Link>
        <Link href="/" class="rounded-full border border-line bg-surface px-5 py-3 text-sm font-bold text-primary hover:border-accent">
          Ir al inicio
        </Link>
      </div>
    </section>
  );
});

export const head: DocumentHead = {
  title: "Página no encontrada - Beneficios LPRC",
  meta: [{ name: "robots", content: "noindex" }],
};
