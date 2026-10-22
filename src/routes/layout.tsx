import { component$, Slot } from "@builder.io/qwik";
import { useLocation, routeLoader$, server$ } from "@builder.io/qwik-city";
import { Chatbot } from "~/components/chatbot/chatbot";
import { ScrollToTop } from "~/components/scroll-to-top/scroll-to-top";
import { SiteHeader } from "~/components/site-header/site-header";
import { SiteFooter } from "~/components/site-footer/site-footer";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { searchBenefits } from "~/server/cache";

export const useLayoutUser = routeLoader$((event) => {
  return (event.sharedMap.get("user") || null) as AuthenticatedUser | null;
});

export const getSearchSuggestions = server$(async function(query: string) {
  if (!query || query.trim().length < 2) return [];
  try {
    const results = await searchBenefits({
      query: query.trim(),
      limit: 6,
      requestEvent: this
    });
    return results.data.map(b => ({
      id: b.id,
      titulo: b.titulo,
      resumen: b.resumen,
      url: b.url,
      categoria: b.categorias?.[0]?.descripcion || "Beneficio"
    }));
  } catch (err) {
    console.error("Error in getSearchSuggestions:", err);
    return [];
  }
});

export default component$(() => {
  const location = useLocation();
  const user = useLayoutUser();

  if (location.url.pathname.startsWith("/admin")) {
    return (
      <div class="min-h-screen w-full bg-slate-50 flex overflow-hidden">
        <Slot />
      </div>
    );
  }

  return (
    <div class="min-h-screen flex flex-col bg-background font-sans text-white">
      <a
        href="#main-content"
        class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-accent focus:px-5 focus:py-3 focus:font-bold focus:text-primary focus:outline-2 focus:outline-offset-2 focus:outline-white"
      >
        Ir al contenido principal
      </a>
      <SiteHeader user={user} />

      <main id="main-content" tabIndex={-1} class="flex-grow scroll-mt-52">
        <Slot />
      </main>

      <SiteFooter />

      {!location.url.pathname.startsWith("/perfil/cupon/") && (
        <>
          <Chatbot />
          <ScrollToTop />
        </>
      )}
    </div>
  );
});
