import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link, type DocumentHead } from "@builder.io/qwik-city";
import { LuHome, LuTicket, LuMapPin, LuMessageSquare, LuSearch } from "@qwikest/icons/lucide";

// Ruta catch-all: es el mecanismo de Qwik City para un 404 personalizado. Al
// existir esta ruta, cualquier URL no encontrada la renderiza (en vez del error
// genérico). El loader fija el status HTTP 404 real (no 200), y funciona tanto en
// navegación SPA como en la carga directa de una URL inexistente.
export const useNotFound = routeLoader$((event) => {
  event.status(404);
  return { path: event.url.pathname };
});

export default component$(() => {
  const nf = useNotFound();

  const links = [
    { href: "/", label: "Inicio", icon: LuHome },
    { href: "/beneficios", label: "Beneficios", icon: LuTicket },
    { href: "/mapa", label: "Mapa", icon: LuMapPin },
    { href: "/sugerencias", label: "Contacto", icon: LuMessageSquare },
  ];

  return (
    <div class="relative min-h-[70vh] flex items-center justify-center px-4 py-16 overflow-hidden">
      <div class="absolute -top-24 -right-24 w-80 h-80 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none" />
      <div class="absolute -bottom-24 -left-24 w-80 h-80 bg-brand-green/10 rounded-full blur-3xl pointer-events-none" />

      <div class="relative w-full max-w-xl text-center space-y-7">
        {/* Identidad AMP+ */}
        <div class="flex items-center justify-center gap-2">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-brand-green/10 text-brand-green border border-brand-green/20">
            AMP+ · Club de Beneficios
          </span>
        </div>

        <div class="space-y-2">
          <p class="font-display font-black text-7xl sm:text-8xl leading-none bg-gradient-to-br from-brand-green-dark to-brand-green bg-clip-text text-transparent select-none">
            404
          </p>
          <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-brand-green-dark tracking-tight">
            Uy… esta página no existe
          </h1>
          <p class="text-sm sm:text-base text-slate-500 font-medium max-w-md mx-auto leading-relaxed">
            Parece que el enlace está roto o el beneficio que buscabas ya no está disponible.
            No te preocupes, encontrá lo que necesitás desde acá.
          </p>
        </div>

        {/* Buscador de beneficios */}
        <form action="/beneficios" method="get" class="flex items-center gap-2 max-w-md mx-auto">
          <div class="relative flex-grow">
            <LuSearch class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              name="buscar"
              placeholder="Buscá un beneficio, comercio o rubro…"
              class="w-full bg-white text-slate-800 placeholder-slate-400 text-sm pl-10 pr-3 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green transition-all shadow-sm"
            />
          </div>
          <button
            type="submit"
            class="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Buscar
          </button>
        </form>

        {/* Links útiles */}
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                class="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white border border-slate-200 hover:border-brand-green hover:shadow-md transition-all"
              >
                <Icon class="w-5 h-5 text-slate-400 group-hover:text-brand-green transition-colors" />
                <span class="text-xs font-bold text-slate-600 group-hover:text-brand-green-dark">{l.label}</span>
              </Link>
            );
          })}
        </div>

        <p class="text-[11px] text-slate-400 font-medium pt-2">
          Ruta solicitada: <span class="font-mono text-slate-500">{nf.value.path}</span>
        </p>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Página no encontrada (404) - Club AMP+",
  meta: [
    {
      name: "description",
      content: "La página que buscás no existe. Explorá los beneficios de la Agremiación Médica Platense.",
    },
    { name: "robots", content: "noindex" },
  ],
};
