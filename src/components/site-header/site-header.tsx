import { component$, useSignal, useTask$, $, sync$ } from "@builder.io/qwik";
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

  const suggestions = useSignal<
    Awaited<ReturnType<typeof getSearchSuggestions>>
  >([]);
  const showSuggestions = useSignal(false);
  const activeIndex = useSignal<number>(-1);
  const searchContainerRef = useSignal<HTMLDivElement | undefined>(undefined);

  useTask$(({ track, cleanup }) => {
    track(() => searchInput.value);

    if (searchInput.value.trim().length < 2) {
      suggestions.value = [];
      showSuggestions.value = false;
      activeIndex.value = -1;
      return;
    }

    const query = searchInput.value.trim();
    suggestions.value = [];
    showSuggestions.value = false;
    activeIndex.value = -1;
    let cancelled = false;
    const delayId = setTimeout(async () => {
      const results = await getSearchSuggestions(query);
      if (cancelled || query !== searchInput.value.trim()) return;
      suggestions.value = results;
      showSuggestions.value =
        results.length > 0 && document.activeElement?.id === "site-search";
      activeIndex.value = -1;
    }, 300);

    cleanup(() => {
      cancelled = true;
      clearTimeout(delayId);
    });
  });

  const handleKeyDown = $((ev: KeyboardEvent) => {
    if (!showSuggestions.value || suggestions.value.length === 0) return;

    if (ev.key === "ArrowDown") {
      activeIndex.value = (activeIndex.value + 1) % suggestions.value.length;
    } else if (ev.key === "ArrowUp") {
      activeIndex.value =
        (activeIndex.value - 1 + suggestions.value.length) %
        suggestions.value.length;
    } else if (ev.key === "Escape") {
      showSuggestions.value = false;
      activeIndex.value = -1;
    } else if (ev.key === "Enter") {
      if (
        activeIndex.value >= 0 &&
        activeIndex.value < suggestions.value.length
      ) {
        const selected = suggestions.value[activeIndex.value];
        showSuggestions.value = false;
        isMobileMenuOpen.value = false;
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
      {/* Top Banner — Dark navy with gold accent */}
      <div class="bg-primary text-accent text-[11px] py-2 px-4 text-center font-bold border-b border-accent/20 tracking-[0.15em] uppercase z-50">
        🏉 Portal de Beneficios Oficial — La Plata Rugby Club
      </div>

      {/* Main Sticky Header — Dark theme */}
      <header
        class="sticky top-0 z-40 bg-primary/95 backdrop-blur-md border-b border-secondary shadow-lg transition-all duration-300 print:hidden"
        window:onClick$={(ev) => {
          const target = ev.target as HTMLElement | null;
          if (!target) return;
          if (!searchContainerRef.value?.contains(target)) {
            showSuggestions.value = false;
          }
        }}
      >
        <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 lg:flex lg:justify-between lg:gap-4 lg:min-h-[104px] xl:min-h-[120px]">
            {/* Brand Logo */}
            <div class="order-1 flex items-center flex-shrink-0">
              <Link href="/" class="flex items-center group space-x-3">
                <div class="flex items-center space-x-2.5">
                  <img
                    src="/lprc.avif"
                    alt="La Plata Rugby Club"
                    width={120}
                    height={101}
                    class="w-[68px] h-auto flex-shrink-0 object-contain drop-shadow-md sm:w-[88px] xl:w-[120px]"
                  />
                  <div class="hidden sm:flex flex-col leading-none">
                    <span class="font-display font-black text-white text-lg tracking-wide uppercase">
                      La Plata Rugby Club
                    </span>
                    <span class="text-[9px] font-bold text-accent tracking-[0.2em] uppercase">
                      Portal de Beneficios
                    </span>
                  </div>
                  <div class="sm:hidden flex flex-col leading-none">
                    <span class="font-display font-black text-accent text-lg tracking-wide">
                      LPRC
                    </span>
                    <span class="text-[8px] font-bold text-slate-400 tracking-widest uppercase">
                      Beneficios
                    </span>
                  </div>
                </div>
              </Link>
            </div>

            {/* One search form shared by mobile and desktop */}
            <div
              ref={searchContainerRef}
              onFocusOut$={(event, element) => {
                if (!element.contains(event.relatedTarget as Node | null))
                  showSuggestions.value = false;
              }}
              class="order-3 col-span-2 relative flex w-full min-w-0 items-center lg:order-2 lg:flex-1 lg:max-w-md"
            >
              <form
                action="/beneficios/"
                method="get"
                role="search"
                class="w-full relative"
              >
                <input
                  id="site-search"
                  type="search"
                  name="buscar"
                  role="combobox"
                  aria-label="Buscar beneficios, marcas o categorías"
                  aria-autocomplete="list"
                  aria-expanded={showSuggestions.value}
                  aria-controls="site-search-suggestions"
                  aria-activedescendant={
                    activeIndex.value >= 0
                      ? `site-suggestion-${activeIndex.value}`
                      : undefined
                  }
                  placeholder="Buscar beneficios, marcas o categorías..."
                  bind:value={searchInput}
                  onFocus$={() => {
                    if (suggestions.value.length > 0) {
                      showSuggestions.value = true;
                    }
                  }}
                  data-has-suggestions={
                    showSuggestions.value && suggestions.value.length > 0
                      ? "true"
                      : "false"
                  }
                  data-has-selection={activeIndex.value >= 0 ? "true" : "false"}
                  onKeyDown$={[
                    sync$((event: KeyboardEvent, element: HTMLInputElement) => {
                      if (
                        element.dataset.hasSuggestions === "true" &&
                        (event.key === "ArrowDown" ||
                          event.key === "ArrowUp" ||
                          (event.key === "Enter" &&
                            element.dataset.hasSelection === "true"))
                      )
                        event.preventDefault();
                    }),
                    handleKeyDown,
                  ]}
                  class="w-full bg-secondary/60 text-white placeholder-slate-400 text-sm pl-12 pr-14 py-3 rounded-full border border-secondary focus:border-accent focus:bg-secondary focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all duration-300 shadow-sm"
                  autocomplete="off"
                />
                <button
                  type="submit"
                  aria-label="Buscar"
                  class="absolute right-1 top-1 bottom-1 flex w-11 items-center justify-center rounded-full bg-accent text-primary hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  <svg
                    class="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M5 12h14m-6-6 6 6-6 6"
                    />
                  </svg>
                </button>
                <div class="absolute left-4 top-3.5 text-slate-400 pointer-events-none">
                  <svg
                    class="w-5 h-5 text-accent"
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

              {/* Search suggestions */}
              {showSuggestions.value && suggestions.value.length > 0 && (
                <div class="absolute top-full left-0 right-0 mt-2 bg-primary border border-secondary rounded-2xl shadow-2xl overflow-hidden z-50 text-left animate-scale-in">
                  <div class="px-5 py-2.5 bg-secondary/50 border-b border-secondary text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Sugerencias
                  </div>
                  <div
                    id="site-search-suggestions"
                    role="listbox"
                    aria-label="Sugerencias de beneficios"
                    class="max-h-[min(20rem,55dvh)] overflow-y-auto divide-y divide-secondary"
                  >
                    {suggestions.value.map((item, idx) => (
                      <Link
                        key={item.id}
                        id={`site-suggestion-${idx}`}
                        role="option"
                        aria-selected={activeIndex.value === idx}
                        href={`/beneficio/${item.url}`}
                        onClick$={() => {
                          showSuggestions.value = false;
                        }}
                        class={[
                          "flex items-center justify-between px-5 py-3 transition-colors duration-150 cursor-pointer block select-none",
                          activeIndex.value === idx
                            ? "bg-accent/10 text-accent"
                            : "hover:bg-secondary/50 text-slate-300 hover:text-white",
                        ]}
                      >
                        <div class="flex flex-col min-w-0 pr-4">
                          <span class="font-extrabold text-sm truncate">
                            {item.titulo}
                          </span>
                          <span class="text-xs text-slate-500 font-medium truncate mt-0.5">
                            {item.resumen}
                          </span>
                        </div>
                        <span class="inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-secondary text-accent uppercase tracking-wide flex-shrink-0">
                          {item.categoria}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Navigation Links */}
            <nav class="order-4 hidden 2xl:flex items-center space-x-4 flex-shrink-0">
              <Link
                href="/como-funciona"
                class={`font-extrabold text-[13px] uppercase tracking-wider transition-all duration-300 py-2 border-b-2 hover:text-accent ${
                  isActive("/como-funciona")
                    ? "text-accent border-accent"
                    : "text-slate-400 border-transparent hover:border-accent/30"
                }`}
              >
                Cómo Funciona
              </Link>
              <Link
                href="/sorteos"
                class={`font-extrabold text-[13px] uppercase tracking-wider transition-all duration-300 py-2 border-b-2 hover:text-accent ${
                  isActive("/sorteos")
                    ? "text-accent border-accent"
                    : "text-slate-400 border-transparent hover:border-accent/30"
                }`}
              >
                Sorteos
              </Link>
              <Link
                href="/sugerencias"
                class={`font-extrabold text-[13px] uppercase tracking-wider transition-all duration-300 py-2 border-b-2 hover:text-accent ${
                  isActive("/sugerencias")
                    ? "text-accent border-accent"
                    : "text-slate-400 border-transparent hover:border-accent/30"
                }`}
              >
                Sugerencias
              </Link>
            </nav>

            {/* Right-most Action Buttons */}
            <div class="order-5 hidden xl:flex items-center space-x-3 flex-shrink-0">
              <Link
                href="/mapa"
                class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full border border-secondary bg-secondary/40 hover:bg-secondary text-white font-black text-sm shadow-sm hover:shadow-md transition-all uppercase tracking-wider cursor-pointer"
              >
                <LuMapPin class="w-4 h-4 text-accent" />
                <span>Cerca Mío</span>
              </Link>

              {user.value ? (
                <div class="flex items-center space-x-2.5">
                  {user.value.role === "admin" && (
                    <Link
                      href="/admin"
                      class="inline-flex items-center space-x-1.5 px-4.5 py-2.5 rounded-full border border-accent bg-accent/10 hover:bg-accent/20 text-accent font-extrabold text-[11.5px] uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                    >
                      <LuSettings class="w-3.5 h-3.5 text-accent" />
                      <span>Panel Admin</span>
                    </Link>
                  )}
                  <Link
                    href="/perfil"
                    class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full border border-accent bg-accent text-primary font-extrabold text-sm shadow-sm transition-all hover:bg-accent-hover"
                  >
                    <LuUser class="w-4 h-4 text-primary" />
                    <span class="truncate max-w-[120px]">
                      {user.value.name}
                    </span>
                  </Link>
                </div>
              ) : (
                <Link
                  href="/login"
                  class="inline-flex items-center space-x-2 px-6 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-primary font-extrabold text-sm shadow-md transition-all cursor-pointer"
                >
                  <LuLock class="w-4 h-4 text-primary" />
                  <span>Ingresar</span>
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div class="order-2 lg:order-6 2xl:hidden flex items-center flex-shrink-0">
              <button
                onClick$={() =>
                  (isMobileMenuOpen.value = !isMobileMenuOpen.value)
                }
                type="button"
                class="inline-flex items-center justify-center p-2 rounded-md text-accent hover:text-accent-hover focus:outline-none transition-colors duration-300"
                aria-controls="mobile-menu"
                aria-expanded={isMobileMenuOpen.value}
              >
                <span class="sr-only">
                  {isMobileMenuOpen.value
                    ? "Cerrar menú principal"
                    : "Abrir menú principal"}
                </span>
                {isMobileMenuOpen.value ? (
                  <svg
                    class="h-6 h-6"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    class="h-6 h-6"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer — Dark */}
        <div
          class={`2xl:hidden transition-all duration-300 overflow-hidden ${
            isMobileMenuOpen.value
              ? "max-h-[calc(100dvh-170px)] lg:max-h-[calc(100dvh-140px)] overflow-y-auto opacity-100 border-t border-secondary"
              : "max-h-0 opacity-0"
          }`}
          id="mobile-menu"
          hidden={!isMobileMenuOpen.value}
        >
          <div class="px-4 pt-2 pb-4 space-y-2 bg-primary">
            {user.value ? (
              <Link
                href="/perfil"
                onClick$={() => (isMobileMenuOpen.value = false)}
                class={`inline-flex items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold transition-colors ${
                  isActive("/perfil")
                    ? "text-accent bg-accent/10"
                    : "text-accent hover:bg-secondary"
                }`}
              >
                <LuUser class="w-4 h-4 text-accent" />
                <span>Mi Perfil</span>
              </Link>
            ) : (
              <Link
                href="/login"
                onClick$={() => (isMobileMenuOpen.value = false)}
                class="inline-flex items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold text-accent hover:bg-secondary"
              >
                <LuLock class="w-4 h-4 text-accent" />
                <span>Iniciar Sesión</span>
              </Link>
            )}

            {user.value?.role === "admin" && (
              <Link
                href="/admin"
                onClick$={() => (isMobileMenuOpen.value = false)}
                class="inline-flex items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold text-accent hover:bg-secondary"
              >
                <LuSettings class="w-4 h-4" />
                <span>Panel de administración</span>
              </Link>
            )}

            <Link
              href="/"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${
                isActive("/")
                  ? "text-accent bg-secondary"
                  : "text-slate-300 hover:bg-secondary hover:text-accent"
              }`}
            >
              Inicio
            </Link>
            <Link
              href="/mapa"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class="inline-flex items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold text-slate-300 hover:bg-secondary hover:text-accent"
            >
              <LuMapPin class="w-4 h-4 text-slate-500" />
              <span>Cerca Mío</span>
            </Link>
            <Link
              href="/eventos"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${
                isActive("/eventos")
                  ? "text-accent bg-secondary"
                  : "text-slate-300 hover:bg-secondary hover:text-accent"
              }`}
            >
              Agenda
            </Link>
            <Link
              href="/como-funciona"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${
                isActive("/como-funciona")
                  ? "text-accent bg-secondary"
                  : "text-slate-300 hover:bg-secondary hover:text-accent"
              }`}
            >
              Cómo Funciona
            </Link>
            <Link
              href="/sorteos"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${
                isActive("/sorteos")
                  ? "text-accent bg-secondary"
                  : "text-slate-300 hover:bg-secondary hover:text-accent"
              }`}
            >
              Sorteos
            </Link>
            <Link
              href="/sugerencias"
              onClick$={() => (isMobileMenuOpen.value = false)}
              class={`block px-3 py-2 rounded-md text-base font-semibold transition-colors ${
                isActive("/sugerencias")
                  ? "text-accent bg-secondary"
                  : "text-slate-300 hover:bg-secondary hover:text-accent"
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
