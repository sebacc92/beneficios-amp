import { component$, Slot } from "@builder.io/qwik";
import { Link, useLocation, routeLoader$ } from "@builder.io/qwik-city";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

// Loader to fetch the authenticated user (our mock admin)
export const useAdminUser = routeLoader$((event) => {
  return (event.sharedMap.get("user") || null) as AuthenticatedUser | null;
});

export default component$(() => {
  const location = useLocation();
  const userLoader = useAdminUser();
  const user = userLoader.value;

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
    return cleanPath === cleanTarget;
  };

  const menuItems = [
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
      label: "Grilla Sponsors",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25a2.25 2.25 0 01-2.25 2.25h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
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
      label: "Agremiados",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 0110.089 20c-2.213 0-4.302-.63-6.089-1.73v-.109A11.386 11.386 0 0110.089 18c2.213 0 4.302.63 6.089 1.73zM10.089 18v-.003c0-1.113.285-2.16.786-3.07M15 7.5a3 3 0 11-6 0 3 3 0 016 0zm6 2.25a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
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
    <div class="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      {/* 1. Left Sidebar Navigation Panel */}
      <aside class="w-72 bg-[#0b1329] text-slate-300 flex flex-col flex-shrink-0 h-full select-none border-r border-slate-900 shadow-xl">
        {/* Brand Header */}
        <div class="px-6 py-7 border-b border-slate-800 flex items-center space-x-3.5 bg-[#080E1C]">
          <img
            src="/path446.png"
            alt="AMP Logo"
            width={100}
            height={40}
            class="h-9 w-auto object-contain"
          />
        </div>



        {/* Navigation Section Group */}
        <div class="flex-grow py-6 overflow-y-auto px-4 space-y-7">
          <div class="space-y-2">
            <span class="px-3 text-[10px] font-extrabold tracking-widest text-slate-500 uppercase block mb-3">
              Administración
            </span>
            <nav class="space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  class={[
                    "flex items-center space-x-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all uppercase tracking-wider",
                    isPathActive(item.path)
                      ? "bg-brand-green text-white shadow-md shadow-brand-green/20"
                      : "hover:bg-slate-800 hover:text-white text-slate-400",
                  ]}
                >
                  <span class={[isPathActive(item.path) ? "text-white" : "text-slate-500"]}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
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
              <span class="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest leading-none">
                {user ? user.role : "Admin"}
              </span>
            </div>
            <div class="ml-auto w-2 h-2 bg-emerald-500 rounded-full border border-emerald-400"></div>
          </div>

          {/* Return to Site Action */}
          <Link
            href="/"
            class="flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-xs font-extrabold text-slate-400 hover:text-white uppercase tracking-wider transition-all"
          >
            <svg class="w-4 h-4 rotate-180" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span>Volver al Sitio</span>
          </Link>
        </div>
      </aside>

      {/* 2. Main Content View Area */}
      <main class="flex-1 overflow-y-auto h-screen relative bg-slate-50 flex flex-col">
        <Slot />
      </main>
    </div>
  );
});
