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

  // Active tab helper based on path or query parameters
  const currentTab = location.url.searchParams.get("tab") || "stats";
  const isTabActive = (tabKey: string) => {
    // If we're inside the chats details view, highlight the audit tab
    if (tabKey === "audit" && location.url.pathname.includes("/admin/chats/")) {
      return true;
    }
    return currentTab === tabKey && !location.url.pathname.includes("/admin/chats/");
  };

  const menuItems = [
    {
      key: "stats",
      label: "Estadísticas",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v5.25c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013 18.375v-5.25zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-9.75zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v14.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
    {
      key: "sponsors",
      label: "Grilla Sponsors",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25a2.25 2.25 0 01-2.25 2.25h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
    {
      key: "benefits",
      label: "Beneficios (CRUD)",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-12h12c.621 0 1.125.504 1.125 1.125V17c0 .621-.504 1.125-1.125 1.125H7.5A1.125 1.125 0 016.375 17V7.125C6.375 6.504 6.879 6 7.5 6zM4.5 8.625h1.5m-1.5 3h1.5m-1.5 3h1.5" />
        </svg>
      ),
    },
    {
      key: "users",
      label: "Usuarios y Socios",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.109A11.386 11.386 0 0110.089 20c-2.213 0-4.302-.63-6.089-1.73v-.109A11.386 11.386 0 0110.089 18c2.213 0 4.302.63 6.089 1.73zM10.089 18v-.003c0-1.113.285-2.16.786-3.07M15 7.5a3 3 0 11-6 0 3 3 0 016 0zm6 2.25a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
    },
    {
      key: "audit",
      label: "Auditoría Chats IA",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      ),
    },
    {
      key: "config",
      label: "Configuración IA",
      icon: (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
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
          <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1.5 border border-brand-gold shadow-md">
            <img
              src="https://beneficios.amepla.org.ar/images/logo.png"
              alt="AMP Logo"
              width={35}
              height={35}
              class="object-contain"
            />
          </div>
          <div class="flex flex-col">
            <span class="text-white font-display font-extrabold text-base tracking-wider uppercase leading-none">
              AMP<span class="text-brand-gold">+</span> Club
            </span>
            <span class="text-brand-green-light text-[9px] uppercase font-bold tracking-widest mt-1">
              Panel Administrativo
            </span>
          </div>
        </div>

        {/* Real-time Status Badge */}
        <div class="px-6 py-3 border-b border-slate-800 flex items-center justify-between text-xs font-semibold bg-[#0f1935]/40 text-slate-400">
          <span class="uppercase tracking-wider">Estado</span>
          <div class="flex items-center space-x-1.5">
            <span class="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span class="text-white font-medium uppercase text-[10px] tracking-wider">Activo</span>
          </div>
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
                  key={item.key}
                  href={`/admin?tab=${item.key}`}
                  class={[
                    "flex items-center space-x-3.5 px-4 py-3 rounded-2xl text-sm font-bold transition-all uppercase tracking-wider",
                    isTabActive(item.key)
                      ? "bg-brand-green text-white shadow-md shadow-brand-green/20"
                      : "hover:bg-slate-800 hover:text-white text-slate-400",
                  ]}
                >
                  <span class={[isTabActive(item.key) ? "text-white" : "text-slate-500"]}>
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
