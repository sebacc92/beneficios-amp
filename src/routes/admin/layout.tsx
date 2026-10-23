import { component$, Slot, useSignal, useTask$, type JSXOutput } from "@builder.io/qwik";
import { Form, Link, useLocation, routeAction$, routeLoader$ } from "@builder.io/qwik-city";
import { LuCalendar, LuGift, LuInbox, LuLogOut } from "@qwikest/icons/lucide";
import { destroySession } from "~/server/auth";
import { countPendingInbox } from "~/server/club-content";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

// Loader to fetch the authenticated user (our mock admin)
export const useAdminUser = routeLoader$((event) => {
  return (event.sharedMap.get("user") || null) as AuthenticatedUser | null;
});

/** Cheap count queries, re-run after every admin action so the badge follows status changes. */
export const usePendingRequestsCount = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") return 0;
  try {
    return await countPendingInbox(event);
  } catch (err) {
    console.error("Failed to count pending requests:", err);
    return 0;
  }
});

// Same mechanism as /perfil: revoke the session row, then clear the cookie.
export const useAdminLogoutAction = routeAction$(async (_, requestEvent) => {
  await destroySession(requestEvent);
  throw requestEvent.redirect(302, "/admin/login");
});

export default component$(() => {
  const location = useLocation();
  const userLoader = useAdminUser();
  const user = userLoader.value;
  const pendingRequests = usePendingRequestsCount();
  const logoutAction = useAdminLogoutAction();
  const mobileMenuOpen = useSignal(false);
  const mobileMenuButton = useSignal<HTMLButtonElement>();

  useTask$(({ track }) => {
    track(() => location.url.pathname);
    mobileMenuOpen.value = false;
  });

  // Active tab helper based on path
  const currentPath = location.url.pathname;
  const isPathActive = (routePath: string) => {
    const cleanPath = currentPath.replace(/\/$/, "");
    const cleanTarget = routePath.replace(/\/$/, "");

    if (cleanTarget === "/admin/stats") {
      return cleanPath === "/admin/stats" || cleanPath === "/admin";
    }
    // If we're inside the chats details view, highlight the Asistente IA item
    if (cleanTarget === "/admin/ai" && cleanPath.includes("/admin/chats")) {
      return true;
    }
    return cleanPath === cleanTarget || cleanPath.startsWith(`${cleanTarget}/`);
  };

  const menuItems: { path: string; label: string; icon: JSXOutput; badge?: number }[] = [
    {
      path: "/admin/stats",
      label: "Estadísticas",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v5.25c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013 18.375v-5.25zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-9.75zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v14.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
    {
      path: "/admin/slides",
      label: "Carrusel Hero",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      ),
    },
    {
      path: "/admin/benefits",
      label: "Beneficios",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-12h12c.621 0 1.125.504 1.125 1.125V17c0 .621-.504 1.125-1.125 1.125H7.5A1.125 1.125 0 016.375 17V7.125C6.375 6.504 6.879 6 7.5 6zM4.5 8.625h1.5m-1.5 3h1.5m-1.5 3h1.5" />
        </svg>
      ),
    },
    {
      path: "/admin/sponsors",
      label: "Sponsors",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25a2.25 2.25 0 01-2.25 2.25h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
    {
      path: "/admin/eventos",
      label: "Agenda",
      icon: <LuCalendar class="w-5 h-5" />,
    },
    {
      path: "/admin/sorteos",
      label: "Sorteos",
      icon: <LuGift class="w-5 h-5" />,
    },
    {
      path: "/admin/solicitudes",
      label: "Solicitudes",
      icon: <LuInbox class="w-5 h-5" />,
      badge: pendingRequests.value,
    },
    {
      path: "/admin/ai",
      label: "Asistente IA",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      ),
    },
    {
      path: "/admin/users",
      label: "Activos",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 0110.089 20c-2.213 0-4.302-.63-6.089-1.73v-.109A11.386 11.386 0 0110.089 18c2.213 0 4.302.63 6.089 1.73zM10.089 18v-.003c0-1.113.285-2.16.786-3.07M15 7.5a3 3 0 11-6 0 3 3 0 016 0zm6 2.25a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      path: "/admin/cupones",
      label: "Cupones",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 14.25l6-6m4.5-3.75a3 3 0 11-6 0 3 3 0 016 0zM12 18.75a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      path: "/admin/popup",
      label: "Popup Inicial",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      path: "/admin/campana",
      label: "Campaña Inicio",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
      ),
    },
    {
      path: "/admin/admins",
      label: "Administradores",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    },
  ];

  return (
    <div
      class="flex h-dvh w-full flex-col overflow-hidden bg-slate-50 font-sans lg:flex-row"
      document:onKeyDown$={(event) => {
        if (event.key === "Escape" && mobileMenuOpen.value) {
          mobileMenuOpen.value = false;
          mobileMenuButton.value?.focus();
        }
      }}
    >
      <a
        href="#admin-content"
        preventdefault:click
        onClick$={() => document.getElementById("admin-content")?.focus()}
        class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-bold focus:text-slate-900 focus:shadow-lg"
      >
        Saltar al contenido
      </a>
      <header class="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-[#080E1C] px-4 py-3 text-white lg:hidden">
        <span class="text-sm font-bold">Panel de administración</span>
        <button
          ref={mobileMenuButton}
          type="button"
          aria-controls="admin-navigation"
          aria-expanded={mobileMenuOpen.value}
          onClick$={() => (mobileMenuOpen.value = !mobileMenuOpen.value)}
          class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-600 px-3 text-sm font-bold hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <svg aria-hidden="true" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" d={mobileMenuOpen.value ? "M6 6l12 12M6 18L18 6" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
          {mobileMenuOpen.value ? "Cerrar menú" : "Menú"}
        </button>
      </header>
      {/* 1. Left Sidebar Navigation Panel */}
      <aside
        id="admin-navigation"
        class={[
          "w-full max-h-[65dvh] min-h-0 flex-col flex-shrink-0 select-none border-r border-slate-900 bg-[#0b1329] text-slate-300 shadow-xl lg:flex lg:h-full lg:max-h-none lg:w-72",
          mobileMenuOpen.value ? "flex" : "hidden",
        ]}
      >
        {/* Brand Header */}
        <div class="hidden px-6 py-7 border-b border-slate-800 items-center space-x-3.5 bg-[#080E1C] lg:flex">
          <img
            src="/logo-lprc.svg"
            alt="LPRC Logo"
            width={120}
            height={48}
            class="h-[44px] w-auto object-contain"
          />
        </div>



        {/* Navigation Section Group */}
        <div class="min-h-0 flex-grow py-4 overflow-y-auto px-4 space-y-7 lg:py-6">
          <div class="space-y-2">
            <span class="px-3 text-[11px] font-extrabold tracking-widest text-slate-500 uppercase block mb-3">
              Administración
            </span>
            <nav aria-label="Administración" class="space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  aria-current={isPathActive(item.path) ? "page" : undefined}
                  onClick$={() => (mobileMenuOpen.value = false)}
                  class={[
                    "flex items-center space-x-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                    isPathActive(item.path)
                      ? "bg-brand-navy text-white shadow-md shadow-brand-navy/20"
                      : "hover:bg-slate-800 hover:text-white text-slate-400",
                  ]}
                >
                  <span class={[isPathActive(item.path) ? "text-white" : "text-slate-500"]}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {!!item.badge && (
                    <span
                      class={[
                        "ml-auto inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-extrabold normal-case tracking-normal",
                        isPathActive(item.path) ? "bg-white text-brand-navy-dark" : "bg-amber-400 text-slate-900",
                      ]}
                    >
                      {item.badge}
                      <span class="sr-only"> pendientes</span>
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Bottom Profile/Action Panel */}
        <div class="mt-auto border-t border-slate-800 bg-[#080E1C] p-4 space-y-3.5">
          {/* Active Admin Profile */}
          <div class="flex items-center space-x-3 bg-slate-900/50 p-2.5 rounded-2xl border border-slate-800/80">
            <div class="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center font-extrabold text-sm text-white uppercase border border-emerald-400 shadow-md">
              {user ? user.name.charAt(0) : "A"}
            </div>
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-bold text-white truncate leading-none mb-1">
                {user ? user.name : "Administrador"}
              </span>
              <span class="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest leading-none">
                {user ? user.role : "Admin"}
              </span>
            </div>
            <div class="ml-auto w-2 h-2 bg-emerald-500 rounded-full border border-emerald-400"></div>
          </div>

          {/* Return to Site Action */}
          <Link
            href="/"
            onClick$={() => (mobileMenuOpen.value = false)}
            class="flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-xs font-extrabold text-slate-400 hover:text-white uppercase tracking-wider transition-all"
          >
            <svg class="w-4 h-4 rotate-180" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span>Volver al Sitio</span>
          </Link>

          <Form action={logoutAction}>
            <button
              type="submit"
              disabled={logoutAction.isRunning}
              class="flex w-full items-center justify-center space-x-2 px-4 py-3 rounded-2xl border border-slate-800 hover:bg-red-950/40 hover:border-red-900 text-xs font-extrabold text-slate-400 hover:text-red-200 uppercase tracking-wider transition-all disabled:opacity-60 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <LuLogOut class="w-4 h-4" aria-hidden="true" />
              <span>{logoutAction.isRunning ? "Cerrando sesión..." : "Cerrar sesión"}</span>
            </button>
          </Form>
        </div>
      </aside>

      {/* 2. Main Content View Area */}
      <main id="admin-content" tabIndex={-1} class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-slate-50">
        <Slot />
      </main>
    </div>
  );
});
