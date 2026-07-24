import { component$, useSignal, useTask$, $ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import type { Signal } from "@builder.io/qwik";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { LuMapPin, LuSettings, LuUser, LuLock } from "@qwikest/icons/lucide";
import { getSearchSuggestions } from "~/routes/layout";

interface SiteHeaderProps {
  user: Readonly<Signal<AuthenticatedUser | null>>;
}

export const SiteHeader = component$<SiteHeaderProps>(({ user }) => {
  const isMobileMenuOpen = useSignal(false);
  const location = useLocation();
  const searchInput = useSignal("");

  const suggestions = useSignal<any[]>([]);
  const showSuggestions = useSignal(false);
  const isSearching = useSignal(false);
  const activeIndex = useSignal<number>(-1);
  const searchContainerRef = useSignal<HTMLDivElement | undefined>(undefined);
  const mobileSearchContainerRef = useSignal<HTMLDivElement | undefined>(undefined);

  useTask$(({ track, cleanup }) => {
    track(() => searchInput.value);

    if (searchInput.value.trim().length < 2) {
      suggestions.value = [];
      showSuggestions.value = false;
      isSearching.value = false;
      activeIndex.value = -1;
      return;
    }

    const delayId = setTimeout(async () => {
      // Se abre el panel con estado de carga apenas arranca la consulta.
      isSearching.value = true;
      showSuggestions.value = true;
      activeIndex.value = -1;
      try {
        const results = await getSearchSuggestions(searchInput.value);
        suggestions.value = results;
      } finally {
        isSearching.value = false;
      }
    }, 300);

    cleanup(() => clearTimeout(delayId));
  });

  const handleKeyDown = $((ev: KeyboardEvent, isMobile = false) => {
    if (!showSuggestions.value || suggestions.value.length === 0) return;

    if (ev.key === "ArrowDown") {
      // eslint-disable-next-line qwik/no-async-prevent-default
      ev.preventDefault();
      activeIndex.value = (activeIndex.value + 1) % suggestions.value.length;
    } else if (ev.key === "ArrowUp") {
      // eslint-disable-next-line qwik/no-async-prevent-default
      ev.preventDefault();
      activeIndex.value = (activeIndex.value - 1 + suggestions.value.length) % suggestions.value.length;
    } else if (ev.key === "Escape") {
      showSuggestions.value = false;
      activeIndex.value = -1;
    } else if (ev.key === "Enter") {
      if (activeIndex.value >= 0 && activeIndex.value < suggestions.value.length) {
        // eslint-disable-next-line qwik/no-async-prevent-default
        ev.preventDefault();
        const selected = suggestions.value[activeIndex.value];
        showSuggestions.value = false;
        if (isMobile) {
          isMobileMenuOpen.value = false;
        }
        window.location.href = `/beneficio/${selected.url}`;
      }
    }
  });

  const isActive = (path: string) => {
    if (path === "/" && location.url.pathname === "/") return true;
    if (path !== "/" && location.url.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      {/* Top Banner */}
      <div class="bg-brand-green-dark text-brand-gold text-sm py-2 px-4 text-center font-semibold border-b border-brand-gold/25 tracking-wide shadow-sm z-50">
        Portal de Beneficios Oficial de la Agremiación Médica Platense
      </div>

      {/* Main Sticky Header */}
      <header
        class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300 print:hidden"
        window:onClick$={(ev) => {
          const target = ev.target as HTMLElement | null;
          if (!target) return;
          const clickInDesktop = searchContainerRef.value?.contains(target);
          const clickInMobile = mobileSearchContainerRef.value?.contains(target);
          if (!clickInDesktop && !clickInMobile) {
            showSuggestions.value = false;
          }
        }}
      >
        <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex items-center justify-between h-20 lg:h-24">
            {/* Brand Logo */}
            <div class="flex items-center flex-shrink-0">
              <Link href="/" class="flex items-center group">
                <img
                  src="/Logo.webp"
                  alt="Logo AMP"
                  width={255}
                  height={98}
                  class="h-16 lg:h-[72px] w-auto object-contain transition-all duration-300 group-hover:scale-105"
                />
              </Link>
            </div>

            {/* Global Search Bar (Desktop) */}
            <div ref={searchContainerRef} class="hidden lg:flex items-center relative max-w-md w-full mx-8">
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
                  onFocus$={() => {
                    if (suggestions.value.length > 0) {
                      showSuggestions.value = true;
                    }
                  }}
                  onKeyDown$={(ev) => handleKeyDown(ev, false)}
                  class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm pl-12 pr-4 py-2.5 rounded-full border-2 border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all duration-300 shadow-sm"
                  autocomplete="off"
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

              {/* Suggestions Dropdown (Desktop) */}
              {showSuggestions.value && searchInput.value.trim().length >= 2 && (
                <div class="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden z-50 text-left animate-scale-in">
                  <div class="px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    {isSearching.value && (
                      <span class="w-3 h-3 border-2 border-brand-green border-t-transparent rounded-full animate-spin inline-block" />
                    )}
                    {isSearching.value ? "Buscando..." : "Sugerencias"}
                  </div>
                  {isSearching.value ? (
                    <div class="px-5 py-6 flex items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                      <span class="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                      Buscando beneficios...
                    </div>
                  ) : suggestions.value.length === 0 ? (
                    <div class="px-5 py-6 text-center text-xs text-slate-400 font-medium">
                      Sin resultados para "{searchInput.value.trim()}"
                    </div>
                  ) : (
                  <div class="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {suggestions.value.map((item, idx) => (
                      <Link
                        key={item.id}
                        href={`/beneficio/${item.url}`}
                        onClick$={() => {
                          showSuggestions.value = false;
                        }}
                        class={[
                          "flex items-center justify-between px-5 py-3 transition-colors duration-150 cursor-pointer block select-none",
                          activeIndex.value === idx
                            ? "bg-brand-green/5 text-brand-green-dark"
                            : "hover:bg-slate-50 text-slate-700 hover:text-brand-green-dark"
                        ]}
                      >
                        <div class="flex flex-col min-w-0 pr-4">
                          <span class="font-extrabold text-sm truncate">{item.titulo}</span>
                          <span class="text-xs text-slate-400 font-medium truncate mt-0.5">{item.resumen}</span>
                        </div>
                        <span class="inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-100 text-slate-500 uppercase tracking-wide flex-shrink-0">
                          {item.categoria}
                        </span>
                      </Link>
                    ))}
                  </div>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Navigation Links */}
            <nav class="hidden lg:flex items-center space-x-6 flex-shrink-0">
              <Link
                href="/como-funciona"
                class={`font-extrabold text-[14px] uppercase tracking-wider transition-all duration-300 py-2 border-b-2 hover:text-brand-green ${isActive("/como-funciona")
                  ? "text-brand-green border-brand-green"
                  : "text-slate-500 border-transparent hover:border-brand-green/30"
                  }`}
              >
                Cómo Funciona
              </Link>
              <Link
                href="/sorteos"
                class={`font-extrabold text-[14px] uppercase tracking-wider transition-all duration-300 py-2 border-b-2 hover:text-brand-green ${isActive("/sorteos")
                  ? "text-brand-green border-brand-green"
                  : "text-slate-500 border-transparent hover:border-brand-green/30"
                  }`}
              >
                Sorteos
              </Link>
              <Link
                href="/sugerencias"
                class={`font-extrabold text-[14px] uppercase tracking-wider transition-all duration-300 py-2 border-b-2 hover:text-brand-green ${isActive("/sugerencias")
                  ? "text-brand-green border-brand-green"
                  : "text-slate-500 border-transparent hover:border-brand-green/30"
                  }`}
              >
                Sugerencias
              </Link>
            </nav>

            {/* Right-most Action Buttons */}
            <div class="hidden md:flex items-center space-x-3 ml-4 flex-shrink-0">
              <Link
                href="/mapa"
                class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-black text-sm shadow-sm hover:shadow-md transition-all uppercase tracking-wider cursor-pointer"
              >
                <LuMapPin class="w-4 h-4 text-brand-green" />
                <span>Cerca Mío</span>
              </Link>

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

            {/* Mobile Menu Button */}
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
          class={`lg:hidden transition-all duration-300 overflow-hidden ${isMobileMenuOpen.value ? "max-h-96 opacity-100 border-t border-slate-200" : "max-h-0 opacity-0"
            }`}
          id="mobile-menu"
        >
          <div class="px-4 pt-2 pb-4 space-y-2 bg-white">
            {/* Search Bar for Mobile */}
            <div ref={mobileSearchContainerRef} class="relative w-full mb-3">
              <form
                onSubmit$={(e) => {
                  e.preventDefault();
                  if (searchInput.value.trim()) {
                    window.location.href = `/beneficios?buscar=${encodeURIComponent(searchInput.value.trim())}`;
                  }
                }}
                class="relative w-full"
              >
                <input
                  type="text"
                  placeholder="Buscar beneficio..."
                  bind:value={searchInput}
                  onFocus$={() => {
                    if (suggestions.value.length > 0) {
                      showSuggestions.value = true;
                    }
                  }}
                  onKeyDown$={(ev) => handleKeyDown(ev, true)}
                  class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm pl-10 pr-4 py-2 rounded-full border border-slate-200 focus:border-brand-green focus:outline-none"
                  autocomplete="off"
                />
                <div class="absolute left-3.5 top-2.5 text-slate-400 pointer-events-none">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </form>

              {/* Suggestions Dropdown (Mobile) */}
              {showSuggestions.value && searchInput.value.trim().length >= 2 && (
                <div class="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden z-50 text-left animate-scale-in">
                  <div class="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    {isSearching.value && (
                      <span class="w-3 h-3 border-2 border-brand-green border-t-transparent rounded-full animate-spin inline-block" />
                    )}
                    {isSearching.value ? "Buscando..." : "Sugerencias"}
                  </div>
                  {isSearching.value ? (
                    <div class="px-4 py-5 flex items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                      <span class="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                      Buscando...
                    </div>
                  ) : suggestions.value.length === 0 ? (
                    <div class="px-4 py-5 text-center text-xs text-slate-400 font-medium">
                      Sin resultados para "{searchInput.value.trim()}"
                    </div>
                  ) : (
                  <div class="max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {suggestions.value.map((item, idx) => (
                      <Link
                        key={item.id}
                        href={`/beneficio/${item.url}`}
                        onClick$={() => {
                          showSuggestions.value = false;
                          isMobileMenuOpen.value = false;
                        }}
                        class={[
                          "flex items-center justify-between px-4 py-2.5 transition-colors duration-150 cursor-pointer block select-none",
                          activeIndex.value === idx
                            ? "bg-brand-green/5 text-brand-green-dark"
                            : "hover:bg-slate-50 text-slate-700 hover:text-brand-green-dark"
                        ]}
                      >
                        <div class="flex flex-col min-w-0 pr-3">
                          <span class="font-bold text-xs truncate">{item.titulo}</span>
                          <span class="text-[10px] text-slate-400 truncate mt-0.5">{item.resumen}</span>
                        </div>
                        <span class="inline-block px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-slate-100 text-slate-500 uppercase tracking-wide flex-shrink-0">
                          {item.categoria}
                        </span>
                      </Link>
                    ))}
                  </div>
                  )}
                </div>
              )}
            </div>

            {user.value ? (
              <Link
                href="/perfil"
                onClick$={() => (isMobileMenuOpen.value = false)}
                class={`inline-flex items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold transition-colors ${isActive("/perfil") ? "text-brand-green bg-emerald-50" : "text-brand-green hover:bg-slate-50"
                  }`}
              >
                <LuUser class="w-4 h-4 text-brand-green" />
                <span>Mi Perfil</span>
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
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${isActive("/") ? "text-brand-green bg-slate-50" : "text-slate-600 hover:bg-slate-50 hover:text-brand-green"
                }`}
            >
              Inicio
            </Link>
            <Link
              href="/mapa"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class="inline-flex items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold text-slate-700 hover:bg-slate-50 hover:text-brand-green"
            >
              <LuMapPin class="w-4 h-4 text-slate-500" />
              <span>Cerca Mío</span>
            </Link>
            <Link
              href="/como-funciona"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${isActive("/como-funciona") ? "text-brand-green bg-slate-50" : "text-slate-600 hover:bg-slate-50 hover:text-brand-green"
                }`}
            >
              Cómo Funciona
            </Link>
            <Link
              href="/sorteos"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${isActive("/sorteos") ? "text-brand-green bg-slate-50" : "text-slate-600 hover:bg-slate-50 hover:text-brand-green"
                }`}
            >
              Sorteos
            </Link>
            <Link
              href="/sugerencias"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${isActive("/sugerencias") ? "text-brand-green bg-slate-50" : "text-slate-600 hover:bg-slate-50 hover:text-brand-green"
                }`}
            >
              Sugerencias
            </Link>
          </div>
        </div>
      </header>
    </>
  );
});
