import { normalizeSearchText } from "~/utils/catalog-search";
import { component$, Slot } from "@builder.io/qwik";
import { useLocation, routeAction$, routeLoader$, server$ } from "@builder.io/qwik-city";
import { Chatbot } from "~/components/chatbot/chatbot";
import { ScrollToTop } from "~/components/scroll-to-top/scroll-to-top";
import { SiteHeader } from "~/components/site-header/site-header";
import { SiteFooter } from "~/components/site-footer/site-footer";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { searchBenefits } from "~/server/cache";
import { destroySession } from "~/server/auth";
import { countUpcomingEvents } from "~/server/club-content";
import { CLUB } from "~/utils/club";

export const useLayoutUser = routeLoader$((event) => {
  return (event.sharedMap.get("user") || null) as AuthenticatedUser | null;
});

/** "Agenda" only appears in the navigation while there is something on it. */
export const useNavData = routeLoader$(async (event) => {
  if (event.url.pathname.startsWith("/admin")) return { showAgenda: false };
  // The 404 page is rendered once at build time: it must not depend on (or query) a database.
  if (event.url.pathname.endsWith("/404.html")) return { showAgenda: true };
  try {
    return { showAgenda: (await countUpcomingEvents(event)) > 0 };
  } catch (err) {
    console.error("Failed to count upcoming events:", err);
    return { showAgenda: true };
  }
});

/** Header "Cerrar sesión": same mechanism as /perfil (revoke the session row, clear the cookie). */
export const useSiteLogoutAction = routeAction$(async (_, requestEvent) => {
  await destroySession(requestEvent);
  throw requestEvent.redirect(302, "/");
});

export const getSearchSuggestions = server$(async function(query: string) {
  const normalizedQuery = normalizeSearchText(query || "");
  if (normalizedQuery.length < 2) return [];
  try {
    const results = await searchBenefits({
      query: normalizedQuery,
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
  const nav = useNavData();
  const path = location.url.pathname;

  if (path.startsWith("/admin")) {
    return (
      <div class="min-h-screen w-full bg-slate-50 flex overflow-hidden">
        <Slot />
      </div>
    );
  }

  // Shop staff validating coupons get a focused screen: no search, menus or chat.
  if (path.startsWith("/validar-cupon")) {
    return (
      <div class="min-h-screen flex flex-col bg-brand-ink font-sans text-white">
        <header class="border-b-4 border-accent bg-primary print:hidden">
          <div class="max-w-3xl mx-auto flex items-center justify-between gap-4 px-4 py-3">
            <a href="/" class="flex items-center gap-3">
              <img src="/lprc.avif" alt="" width={44} height={37} class="h-10 w-auto" />
              <span class="font-display text-lg font-semibold uppercase tracking-[0.12em]">
                {CLUB.name}
                <span class="block text-[11px] tracking-[0.2em] text-accent">Validación de beneficios</span>
              </span>
            </a>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} class="flex-grow">
          <Slot />
        </main>
      </div>
    );
  }

  const isCouponScreen = path.startsWith("/perfil/cupon/");
  // On a benefit page the sticky "Obtener cupón" bar owns the bottom of small screens.
  const hideFloatingOnMobile = path.startsWith("/beneficio/");

  return (
    <div class="min-h-screen flex flex-col bg-background font-sans text-primary">
      <a
        href="#main-content"
        class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-90 focus:bg-accent focus:px-5 focus:py-3 focus:font-bold focus:text-primary focus:outline-2 focus:outline-offset-2 focus:outline-white"
      >
        Ir al contenido principal
      </a>
      <SiteHeader user={user} showAgenda={nav.value.showAgenda} />

      <main id="main-content" tabIndex={-1} class="flex-grow scroll-mt-52">
        <Slot />
      </main>

      <SiteFooter showAgenda={nav.value.showAgenda} />

      {!isCouponScreen && (
        <div class={hideFloatingOnMobile ? "contents max-sm:hidden" : "contents"}>
          <Chatbot />
          <ScrollToTop />
        </div>
      )}
    </div>
  );
});
