import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { LuArrowRight, LuMapPin, LuSearch } from "@qwikest/icons/lucide";

/*
 * In production this page is pre-rendered once at build time (404.html) and served for
 * every unknown address, so it cannot load live benefits nor know the address on the
 * server: whatever depends on the URL is decided in the browser.
 */

// Catalog categories (src/server/data/seed.json). Linked as searches, which also match the
// category name, so a renumbered category never leaves an empty filter.
const CATEGORY_LINKS = ["Gastronomía", "Gimnasios", "Turismo", "Compras"];

const DEFAULT_REPORT_HREF = "/sugerencias/?tipo=Otro";

export default component$(() => {
  const isBenefit = useSignal(false);
  const reportHref = useSignal(DEFAULT_REPORT_HREF);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const { pathname, href } = window.location;
    isBenefit.value = pathname.startsWith("/beneficio/") || pathname === "/beneficio";
    const params = new URLSearchParams({
      tipo: isBenefit.value ? "Problema Comercio" : "Otro",
      mensaje: `Encontré un enlace roto: ${href}`,
    });
    reportHref.value = `/sugerencias/?${params.toString()}`;
  });

  return (
    <div class="bg-background">
      <section class="border-b-4 border-accent bg-primary text-white">
        <div class="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-center sm:px-6 sm:py-16">
          <img src="/lprc.avif" alt="" width={120} height={101} class="h-auto w-24 shrink-0 sm:w-36" />
          <div>
            <p class="eyebrow text-accent">Error 404</p>
            <h1 class="heading-display mt-2 text-4xl sm:text-5xl">¡Knock-on! Esta página se nos cayó</h1>
            <span class="title-bar mt-4" aria-hidden="true" />
            {isBenefit.value ? (
              <>
                <p class="heading-display mt-5 text-2xl text-accent">Este beneficio ya no está vigente</p>
                <p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                  Puede que haya terminado o que cambió de dirección. Los beneficios vigentes están en el catálogo.
                </p>
              </>
            ) : (
              <p class="mt-5 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                El enlace puede estar mal escrito o la página ya no existe. Levantala desde acá: buscá un beneficio o volvé al catálogo.
              </p>
            )}
          </div>
        </div>
      </section>

      <div class="mx-auto max-w-4xl space-y-12 px-4 py-10 sm:px-6 sm:py-14">
        {/* Plain GET form: works even before the page becomes interactive. */}
        <form action="/beneficios/" method="get" role="search" class="flex flex-col gap-3 sm:flex-row">
          <label for="not-found-search" class="sr-only">
            Buscar beneficios
          </label>
          <input
            id="not-found-search"
            type="search"
            name="buscar"
            placeholder="Buscar beneficios, marcas o categorías…"
            class="field min-w-0 flex-1 text-base"
          />
          <button type="submit" class="btn btn-dark">
            <LuSearch class="h-4 w-4" aria-hidden="true" />
            Buscar
          </button>
        </form>

        <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/beneficios/" class="btn btn-primary">
            Ver todos los beneficios
            <LuArrowRight class="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/mapa/" class="btn btn-outline">
            <LuMapPin class="h-4 w-4" aria-hidden="true" />
            Beneficios cerca mío
          </Link>
          <Link href="/" class="btn btn-outline">
            Ir al inicio
          </Link>
        </div>

        <section aria-labelledby="not-found-categories-title">
          <h2 id="not-found-categories-title" class="heading-display text-2xl text-primary">
            Explorá por categoría
          </h2>
          <span class="title-bar mt-3" aria-hidden="true" />
          <ul class="mt-6 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
            {CATEGORY_LINKS.map((category) => (
              <li key={category}>
                <Link
                  href={`/beneficios/?buscar=${encodeURIComponent(category)}`}
                  class="flex min-h-20 items-center justify-between gap-2 bg-surface px-4 py-4 font-display text-base font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                >
                  {category}
                  <LuArrowRight class="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p class="border-t border-line pt-6 text-sm text-slate-600">
          ¿Llegaste desde un enlace del portal o de un comercio?{" "}
          <a href={reportHref.value} class="font-bold text-primary underline underline-offset-4">
            Reportar enlace roto
          </a>
        </p>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Página no encontrada - Club de Beneficios LPRC",
  meta: [{ name: "robots", content: "noindex" }],
};
