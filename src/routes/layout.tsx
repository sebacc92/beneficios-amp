import { component$, Slot, useSignal } from "@builder.io/qwik";
import { Link, useLocation, routeLoader$ } from "@builder.io/qwik-city";
import { Chatbot } from "~/components/chatbot/chatbot";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { LuMapPin, LuSettings, LuUser, LuCrown, LuLock } from "@qwikest/icons/lucide";

export const useLayoutUser = routeLoader$((event) => {
  return (event.sharedMap.get("user") || null) as AuthenticatedUser | null;
});

export default component$(() => {
  const isMobileMenuOpen = useSignal(false);
  const location = useLocation();
  const searchInput = useSignal("");
  const user = useLayoutUser();

  // Determine active links
  const isActive = (path: string) => {
    if (path === "/" && location.url.pathname === "/") return true;
    if (path !== "/" && location.url.pathname.startsWith(path)) return true;
    return false;
  };

  if (location.url.pathname.startsWith("/admin")) {
    return (
      <div class="min-h-screen w-full bg-slate-50 flex overflow-hidden">
        <Slot />
      </div>
    );
  }

  return (
    <div class="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-800">
      {/* Top Banner (Optional Premium Touch) */}
      <div class="bg-brand-green-dark text-brand-gold text-sm py-2 px-4 text-center font-semibold border-b border-brand-gold/25 tracking-wide shadow-sm z-50">
        Portal de Beneficios Oficial de la Agremiación Médica Platense
      </div>

      {/* Main Sticky Header */}
      <header class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300 print:hidden">
        <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-20">
            {/* Brand Logo & Title */}
            <div class="flex items-center flex-shrink-0">
              <Link href="/" class="flex items-center group">
                <img
                  src="/path446.png"
                  alt="Logo AMP"
                  width={160}
                  height={60}
                  class="h-15 w-auto object-contain transition-all duration-300 group-hover:scale-105"
                />
              </Link>
            </div>

            {/* Global Search Bar (Desktop - Larger and Featured) */}
            <div class="hidden lg:flex items-center relative max-w-md w-full mx-8">
              <form
                onSubmit$={(e) => {
                  e.preventDefault();
                  if (searchInput.value.trim()) {
                    window.location.href = `/beneficios?buscar=${encodeURIComponent(searchInput.value.trim())}`;
                  }
                }}
                class="w-full relative"
              >
                <input
                  type="text"
                  placeholder="Buscar beneficios, marcas o categorías..."
                  bind:value={searchInput}
                  class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm pl-12 pr-4 py-2.5 rounded-full border-2 border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all duration-300 shadow-sm"
                />
                <div class="absolute left-4 top-3 text-slate-400 pointer-events-none">
                  <svg
                    class="w-5 h-5 text-brand-green"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </form>
            </div>

            {/* Desktop Navigation Links */}
            <nav class="hidden lg:flex items-center space-x-6 flex-shrink-0">
              <Link
                href="/como-funciona"
                class={`font-extrabold text-[14px] uppercase tracking-wider transition-all duration-300 py-2 border-b-2 hover:text-brand-green ${
                  isActive("/como-funciona") 
                    ? "text-brand-green border-brand-green" 
                    : "text-slate-500 border-transparent hover:border-brand-green/30"
                }`}
              >
                Cómo Funciona
              </Link>
              <Link
                href="/sorteos"
                class={`font-extrabold text-[14px] uppercase tracking-wider transition-all duration-300 py-2 border-b-2 hover:text-brand-green ${
                  isActive("/sorteos") 
                    ? "text-brand-green border-brand-green" 
                    : "text-slate-500 border-transparent hover:border-brand-green/30"
                }`}
              >
                Sorteos
              </Link>
              <Link
                href="/sugerencias"
                class={`font-extrabold text-[14px] uppercase tracking-wider transition-all duration-300 py-2 border-b-2 hover:text-brand-green ${
                  isActive("/sugerencias") 
                    ? "text-brand-green border-brand-green" 
                    : "text-slate-500 border-transparent hover:border-brand-green/30"
                }`}
              >
                Sugerencias
              </Link>
            </nav>

            {/* Right-most Action Buttons */}
            <div class="hidden md:flex items-center space-x-3 ml-4 flex-shrink-0">
              {/* "Cerca Mío" Map View Button */}
              <Link
                href="/?vista=mapa"
                class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-black text-sm shadow-sm hover:shadow-md transition-all uppercase tracking-wider cursor-pointer"
              >
                <LuMapPin class="w-4 h-4 text-brand-green" />
                <span>Cerca Mío</span>
              </Link>

              {/* User Session Action Button */}
              {user.value ? (
                <div class="flex items-center space-x-2.5">
                  {user.value.role === "admin" && (
                    <Link
                      href="/admin"
                      class="inline-flex items-center space-x-1.5 px-4.5 py-2.5 rounded-full border border-brand-gold bg-amber-50 hover:bg-amber-100 text-brand-gold-dark font-extrabold text-[11.5px] uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                    >
                      <LuSettings class="w-3.5 h-3.5 text-brand-gold-dark" />
                      <span>Panel Admin</span>
                    </Link>
                  )}
                  <Link
                    href="/perfil"
                    class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full border border-brand-green bg-emerald-50 hover:bg-emerald-100 text-brand-green font-extrabold text-sm shadow-sm transition-all"
                  >
                    <LuUser class="w-4 h-4 text-brand-green" />
                    <span class="truncate max-w-[120px]">{user.value.name}</span>
                    {user.value.role === "premium" && <LuCrown class="w-4 h-4 text-brand-gold fill-brand-gold" />}
                  </Link>
                </div>
              ) : (
                <Link
                  href="/login"
                  class="inline-flex items-center space-x-2 px-6 py-2.5 rounded-full bg-brand-green hover:bg-brand-green-light text-white font-extrabold text-sm shadow-md transition-all cursor-pointer"
                >
                  <LuLock class="w-4 h-4 text-white" />
                  <span>Ingresar</span>
                </Link>
              )}
            </div>

            {/* Mobile Menu Button (Hamburger) */}
            <div class="lg:hidden flex items-center">
              <button
                onClick$={() => (isMobileMenuOpen.value = !isMobileMenuOpen.value)}
                type="button"
                class="inline-flex items-center justify-center p-2 rounded-md text-brand-green hover:text-brand-green-light focus:outline-none transition-colors duration-300"
                aria-controls="mobile-menu"
                aria-expanded={isMobileMenuOpen.value}
              >
                <span class="sr-only">Abrir menú principal</span>
                {isMobileMenuOpen.value ? (
                  <svg class="h-6 h-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg class="h-6 h-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <div
          class={`lg:hidden transition-all duration-300 overflow-hidden ${
            isMobileMenuOpen.value ? "max-h-96 opacity-100 border-t border-slate-200" : "max-h-0 opacity-0"
          }`}
          id="mobile-menu"
        >
          <div class="px-4 pt-2 pb-4 space-y-2 bg-white">
            {/* Search Bar for Mobile */}
            <form
              onSubmit$={(e) => {
                e.preventDefault();
                if (searchInput.value.trim()) {
                  window.location.href = `/beneficios?buscar=${encodeURIComponent(searchInput.value.trim())}`;
                }
              }}
              class="relative w-full mb-3"
            >
              <input
                type="text"
                placeholder="Buscar beneficio..."
                bind:value={searchInput}
                class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm pl-10 pr-4 py-2 rounded-full border border-slate-200 focus:border-brand-green focus:outline-none"
              />
              <div class="absolute left-3.5 top-2.5 text-slate-400 pointer-events-none">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </form>

             {user.value ? (
              <Link
                href="/perfil"
                onClick$={() => (isMobileMenuOpen.value = false)}
                class={`inline-flex items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold transition-colors ${
                  isActive("/perfil") ? "text-brand-green bg-emerald-50" : "text-brand-green hover:bg-slate-50"
                }`}
              >
                <LuUser class="w-4 h-4 text-brand-green" />
                <span>Mi Perfil</span>
                {user.value.role === "premium" && <LuCrown class="w-4 h-4 text-brand-gold fill-brand-gold" />}
              </Link>
            ) : (
              <Link
                href="/login"
                onClick$={() => (isMobileMenuOpen.value = false)}
                class="inline-flex items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold text-brand-green hover:bg-slate-50"
              >
                <LuLock class="w-4 h-4 text-brand-green" />
                <span>Iniciar Sesión</span>
              </Link>
            )}

            <Link
              href="/"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${
                isActive("/") ? "text-brand-green bg-slate-50" : "text-slate-600 hover:bg-slate-50 hover:text-brand-green"
              }`}
            >
              Inicio
            </Link>
            <Link
              href="/?vista=mapa"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class="inline-flex items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold text-slate-700 hover:bg-slate-50 hover:text-brand-green"
            >
              <LuMapPin class="w-4 h-4 text-slate-500" />
              <span>Cerca Mío</span>
            </Link>
            <Link
              href="/eventos"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${
                isActive("/eventos") ? "text-brand-green bg-slate-50" : "text-slate-600 hover:bg-slate-50 hover:text-brand-green"
              }`}
            >
              Agenda
            </Link>
            <Link
              href="/como-funciona"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${
                isActive("/como-funciona") ? "text-brand-green bg-slate-50" : "text-slate-600 hover:bg-slate-50 hover:text-brand-green"
              }`}
            >
              Cómo Funciona
            </Link>
            <Link
              href="/sorteos"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${
                isActive("/sorteos") ? "text-brand-green bg-slate-50" : "text-slate-600 hover:bg-slate-50 hover:text-brand-green"
              }`}
            >
              Sorteos
            </Link>
            <Link
              href="/sugerencias"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${
                isActive("/sugerencias") ? "text-brand-green bg-slate-50" : "text-slate-600 hover:bg-slate-50 hover:text-brand-green"
              }`}
            >
              Sugerencias
            </Link>
          </div>
        </div>
      </header>

      {/* Main Body Slot */}
      <main class="flex-grow">
        <Slot />
      </main>

      {/* Premium Footer */}
      <footer class="bg-slate-50 text-slate-650 border-t border-slate-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Branding Column */}
            <div class="col-span-1 md:col-span-2 space-y-4">
              <div class="flex items-center space-x-3.5">
                <img
                  src="/path446.png"
                  alt="Logo AMP"
                  width={130}
                  height={50}
                  class="h-11 w-auto object-contain brightness-95"
                />
                <span class="text-slate-850 font-display font-black text-lg">
                  Agremiación Médica Platense
                </span>
              </div>
              <p class="text-sm text-slate-500 max-w-sm font-medium">
                Comprometidos con el bienestar de la comunidad médica. Disfrutá de una exclusiva cartilla de más de 250 comercios adheridos, descuentos, y sorteos exclusivos en toda la provincia y el país.
              </p>
              {/* Social Media Networks */}
              <div class="flex items-center space-x-4 pt-2">
                <a
                  href="https://www.facebook.com/AgremiacionMedicaPlatense"
                  target="_blank"
                  rel="noopener"
                  class="w-9 h-9 bg-slate-200 hover:bg-brand-green text-slate-700 hover:text-white flex items-center justify-center rounded-full transition-all duration-300 shadow-sm"
                  aria-label="Facebook"
                >
                  <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
                  </svg>
                </a>
                <a
                  href="https://www.instagram.com/ameplatense"
                  target="_blank"
                  rel="noopener"
                  class="w-9 h-9 bg-slate-200 hover:bg-brand-green text-slate-700 hover:text-white flex items-center justify-center rounded-full transition-all duration-300 shadow-sm"
                  aria-label="Instagram"
                >
                  <svg class="w-5 h-5 stroke-current fill-none stroke-2" viewBox="0 0 24 24">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                </a>
                <a
                  href="https://www.youtube.com/channel/UCnJj6TzC6_oZ3z3qV86pMzA"
                  target="_blank"
                  rel="noopener"
                  class="w-9 h-9 bg-slate-200 hover:bg-brand-green text-slate-700 hover:text-white flex items-center justify-center rounded-full transition-all duration-300 shadow-sm"
                  aria-label="YouTube"
                >
                  <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11c.502-1.87.502-5.837.502-5.837s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Quick Links Column */}
            <div class="col-span-1 space-y-4">
              <h3 class="text-slate-850 font-display font-black text-sm uppercase tracking-wider border-l-2 border-brand-gold pl-2">
                Navegación
              </h3>
              <ul class="space-y-2.5 text-sm text-slate-550">
                <li>
                  <Link href="/" class="hover:text-brand-green transition-colors font-bold">
                    Inicio / Beneficios
                  </Link>
                </li>
                <li>
                  <Link href="/como-funciona" class="hover:text-brand-green transition-colors font-bold">
                    Cómo Funciona
                  </Link>
                </li>
                <li>
                  <Link href="/sorteos" class="hover:text-brand-green transition-colors font-bold">
                    Sorteos
                  </Link>
                </li>
                <li>
                  <Link href="/sugerencias" class="hover:text-brand-green transition-colors font-bold">
                    Sugerencias
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact Details Column */}
            <div class="col-span-1 space-y-4">
              <h3 class="text-slate-850 font-display font-black text-sm uppercase tracking-wider border-l-2 border-brand-gold pl-2">
                Contacto
              </h3>
              <ul class="space-y-3 text-sm text-slate-500 font-medium">
                <li class="flex items-start space-x-2.5">
                  <svg class="w-4 h-4 mt-0.5 text-brand-green flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Calle 6 Nro. 1118 entre 55 y 56,<br />La Plata, Prov. de Buenos Aires.</span>
                </li>
                <li class="flex items-center space-x-2.5">
                  <svg class="w-4 h-4 text-brand-green flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.98-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>+54 (221) 439-1300</span>
                </li>
                <li class="flex items-center space-x-2.5">
                  <svg class="w-4 h-4 text-brand-green flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>info@amepla.org.ar</span>
                </li>
              </ul>
            </div>
          </div>

          <div class="mt-12 pt-8 border-t border-slate-200 text-center text-xs text-slate-450 font-semibold flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>&copy; {new Date().getFullYear()} Agremiación Médica Platense. Todos los derechos reservados.</p>
            <div class="flex items-center space-x-4">
              <a href="https://amepla.org.ar" target="_blank" rel="noopener" class="hover:text-brand-green transition-colors">Web Oficial AMP</a>
              <span>&bull;</span>
              <a href="https://ampmas.amepla.org.ar" target="_blank" rel="noopener" class="hover:text-brand-green transition-colors">AMP+ App</a>
            </div>
          </div>
        </div>
      </footer>
      {!location.url.pathname.startsWith("/admin") && <Chatbot />}
    </div>
  );
});
