import { component$, useSignal, useTask$, $, sync$ } from "@builder.io/qwik";
import { Form, Link, useLocation, useNavigate } from "@builder.io/qwik-city";
import type { Signal } from "@builder.io/qwik";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { LuMapPin, LuSettings, LuUser, LuLock, LuTicket, LuLogOut, LuChevronDown } from "@qwikest/icons/lucide";
import { getSearchSuggestions, useSiteLogoutAction } from "~/routes/layout";
import { ClubBrand } from "~/components/club-brand/club-brand";
import { HOME_ITEM, MAP_ITEM, NAV_ITEMS, isNavActive } from "./nav-items";
import { loginUrl } from "~/utils/return-path";

interface SiteHeaderProps {
  user: Readonly<Signal<AuthenticatedUser | null>>;
}

export const SiteHeader = component$<SiteHeaderProps>(({ user }) => {
  const isMobileMenuOpen = useSignal(false);
  const isUserMenuOpen = useSignal(false);
  const location = useLocation();
  const logoutAction = useSiteLogoutAction();
  const searchInput = useSignal("");
  const menuButtonRef = useSignal<HTMLButtonElement>();

  const suggestions = useSignal<
    Awaited<ReturnType<typeof getSearchSuggestions>>
  >([]);
  const showSuggestions = useSignal(false);
  // "loading" covers the debounce too, so an empty list never reads as "no results" too early.
  const searchStatus = useSignal<"idle" | "loading" | "done">("idle");
  const activeIndex = useSignal<number>(-1);
  const navigate = useNavigate();
  const searchContainerRef = useSignal<HTMLDivElement | undefined>(undefined);

  useTask$(({ track, cleanup }) => {
    track(() => searchInput.value);

    if (searchInput.value.trim().length < 2) {
      suggestions.value = [];
      showSuggestions.value = false;
      searchStatus.value = "idle";
      activeIndex.value = -1;
      return;
    }

    const query = searchInput.value.trim();
    suggestions.value = [];
    searchStatus.value = "loading";
    showSuggestions.value = document.activeElement?.id === "site-search";
    activeIndex.value = -1;
    let cancelled = false;
    const delayId = setTimeout(async () => {
      const results = await getSearchSuggestions(query);
      if (cancelled || query !== searchInput.value.trim()) return;
      suggestions.value = results;
      searchStatus.value = "done";
      showSuggestions.value = document.activeElement?.id === "site-search";
      activeIndex.value = -1;
    }, 300);

    cleanup(() => {
      cancelled = true;
      clearTimeout(delayId);
    });
  });

  const handleKeyDown = $(async (ev: KeyboardEvent) => {
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
        await navigate(`/beneficio/${selected.url}`);
      }
    }
  });

  // Menus close on every navigation, including browser back/forward.
  useTask$(({ track }) => {
    track(() => location.url.pathname);
    isMobileMenuOpen.value = false;
    isUserMenuOpen.value = false;
  });

  const isActive = (path: string) => isNavActive(location.url.pathname, path);
  // /beneficios has its own search with filters; a second box in the header would compete with it.
  const showHeaderSearch = !isNavActive(location.url.pathname, "/beneficios/");
  const loginHref = loginUrl(location.url.pathname + location.url.search);

  return (
    <>
      {/* Official portal banner */}
      <div class="bg-accent text-primary text-[11px] py-2 px-4 text-center font-bold border-b border-accent-hover/20 tracking-[0.15em] uppercase z-50">
        <span aria-hidden="true">🏉</span> Portal de Beneficios Oficial — La Plata Rugby Club
      </div>

      {/* Main Sticky Header — Dark theme */}
      <header
        class="sticky top-0 z-40 bg-primary/95 backdrop-blur-md border-b border-secondary shadow-lg transition-all duration-300 print:hidden"
        onKeyDown$={(event) => {
          if (event.key !== "Escape") return;
          if (isMobileMenuOpen.value) {
            isMobileMenuOpen.value = false;
            menuButtonRef.value?.focus();
          }
          isUserMenuOpen.value = false;
        }}
        window:onClick$={(ev) => {
          const target = ev.target as HTMLElement | null;
          if (!target) return;
          if (!searchContainerRef.value?.contains(target)) {
            showSuggestions.value = false;
          }
        }}
      >
        <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 py-3 xl:grid-cols-[auto_minmax(12rem,1fr)_auto] xl:gap-x-6">
            {/* Brand Logo */}
            <div class="order-1 flex min-w-0 items-center">
              <ClubBrand />
            </div>

            {/* One search form shared by mobile and desktop (hidden on /beneficios, which has its own) */}
            {!showHeaderSearch && <div class="hidden xl:order-2 xl:block" aria-hidden="true" />}
            {showHeaderSearch && (
            <div
              ref={searchContainerRef}
              onFocusOut$={(event, element) => {
                if (!element.contains(event.relatedTarget as Node | null))
                  showSuggestions.value = false;
              }}
              class="order-3 col-span-2 relative flex w-full min-w-0 items-center xl:order-2 xl:col-span-1 xl:max-w-xl xl:justify-self-center"
            >
              <form
                action="/beneficios/"
                method="get"
                role="search"
                class="relative w-full min-w-0 overflow-hidden rounded-full"
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
                    if (searchInput.value.trim().length >= 2) {
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
                  class="w-full bg-surface text-primary placeholder-slate-500 text-base sm:text-sm pl-12 pr-14 py-3 rounded-full border border-line focus:border-accent focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all duration-300 shadow-sm"
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
                    class="w-5 h-5 text-primary"
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
              {showSuggestions.value && (
                <div class="absolute top-full left-0 right-0 mt-2 bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden z-50 text-left animate-scale-in">
                  <div class="px-5 py-2.5 bg-surface-muted border-b border-line text-[11px] font-black uppercase tracking-widest text-slate-600">
                    Sugerencias
                  </div>
                  {searchStatus.value === "loading" ? (
                    <p class="px-5 py-4 text-sm text-slate-600">Buscando…</p>
                  ) : suggestions.value.length === 0 ? (
                    <p class="px-5 py-4 text-sm text-slate-600">
                      No encontramos beneficios para «{searchInput.value.trim()}». Probá con otra palabra, una marca o una categoría.
                    </p>
                  ) : (
                    <div
                      id="site-search-suggestions"
                      role="listbox"
                      aria-label="Sugerencias de beneficios"
                      class="max-h-[min(20rem,55dvh)] overflow-y-auto divide-y divide-line"
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
                              ? "bg-amber-50 text-primary"
                              : "hover:bg-surface-muted text-primary",
                          ]}
                        >
                          <div class="flex flex-col min-w-0 pr-4">
                            <span class="font-extrabold text-sm truncate">
                              {item.titulo}
                            </span>
                            <span class="text-xs text-slate-600 font-medium truncate mt-0.5">
                              {item.resumen}
                            </span>
                          </div>
                          <span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-surface-muted text-primary uppercase tracking-wide flex-shrink-0">
                            {item.categoria}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                  <Link
                    href={suggestions.value.length || searchStatus.value === "loading"
                      ? `/beneficios/?buscar=${encodeURIComponent(searchInput.value.trim())}`
                      : "/beneficios/"}
                    onClick$={() => {
                      showSuggestions.value = false;
                    }}
                    class="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm font-bold text-primary hover:bg-surface-muted"
                  >
                    <span class="truncate">
                      {suggestions.value.length || searchStatus.value === "loading"
                        ? `Ver todos los resultados para «${searchInput.value.trim()}»`
                        : "Ver todo el catálogo"}
                    </span>
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              )}
              <p class="sr-only" aria-live="polite">
                {searchStatus.value !== "done"
                  ? ""
                  : suggestions.value.length === 0
                    ? "Sin resultados"
                    : suggestions.value.length === 1
                      ? "1 sugerencia"
                      : `${suggestions.value.length} sugerencias`}
              </p>
            </div>
            )}

            {/* Desktop Navigation Links */}
            <nav
              aria-label="Navegación principal"
              class="order-5 col-span-full hidden items-center justify-center gap-x-6 gap-y-2 border-t border-secondary pt-2 xl:flex xl:flex-wrap"
            >
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  class={`font-extrabold text-[13px] uppercase tracking-wider transition-colors duration-300 py-2 border-b-2 hover:text-accent ${
                    isActive(item.href)
                      ? "text-accent border-accent"
                      : "text-slate-300 border-transparent hover:border-accent/30"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Right-most Action Buttons */}
            <div class="order-4 hidden xl:order-3 xl:flex items-center gap-2 flex-shrink-0">
              <Link
                href={MAP_ITEM.href}
                aria-current={isActive(MAP_ITEM.href) ? "page" : undefined}
                class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full border border-secondary bg-secondary/40 hover:bg-secondary text-white font-black text-sm shadow-sm hover:shadow-md transition-all uppercase tracking-wider cursor-pointer"
              >
                <LuMapPin class="w-4 h-4 text-accent" />
                <span>{MAP_ITEM.label}</span>
              </Link>

              {user.value ? (
                <div
                  class="relative"
                  onFocusOut$={(event, element) => {
                    if (!element.contains(event.relatedTarget as Node | null)) isUserMenuOpen.value = false;
                  }}
                >
                  <button
                    type="button"
                    aria-expanded={isUserMenuOpen.value}
                    aria-controls="user-menu"
                    onClick$={() => (isUserMenuOpen.value = !isUserMenuOpen.value)}
                    class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full border border-accent bg-accent text-primary font-extrabold text-sm shadow-sm transition-all hover:bg-accent-hover cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <LuUser class="w-4 h-4 text-primary" />
                    <span class="truncate max-w-[120px]">{user.value.name}</span>
                    <LuChevronDown class={`w-4 h-4 transition-transform ${isUserMenuOpen.value ? "rotate-180" : ""}`} />
                    <span class="sr-only">: menú de tu cuenta</span>
                  </button>
                  {isUserMenuOpen.value && (
                    <div
                      id="user-menu"
                      class="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface text-primary shadow-2xl animate-scale-in"
                    >
                      <Link href="/perfil/" aria-current={location.url.pathname === "/perfil/" ? "page" : undefined} class="flex items-center gap-2 px-4 py-3 text-sm font-bold hover:bg-surface-muted">
                        <LuUser class="w-4 h-4" /> Mi perfil
                      </Link>
                      <Link href="/perfil/#mis-cupones" class="flex items-center gap-2 px-4 py-3 text-sm font-bold hover:bg-surface-muted">
                        <LuTicket class="w-4 h-4" /> Mis cupones
                      </Link>
                      {user.value.role === "admin" && (
                        <Link href="/admin" class="flex items-center gap-2 px-4 py-3 text-sm font-bold hover:bg-surface-muted">
                          <LuSettings class="w-4 h-4" /> Panel admin
                        </Link>
                      )}
                      <Form action={logoutAction} class="border-t border-line">
                        <button type="submit" disabled={logoutAction.isRunning} class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-red-700 hover:bg-red-50 cursor-pointer disabled:opacity-60">
                          <LuLogOut class="w-4 h-4" /> {logoutAction.isRunning ? "Cerrando sesión..." : "Cerrar sesión"}
                        </button>
                      </Form>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href={loginHref}
                  class="inline-flex items-center space-x-2 px-6 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-primary font-extrabold text-sm shadow-md transition-all cursor-pointer"
                >
                  <LuLock class="w-4 h-4 text-primary" />
                  <span>Ingresar</span>
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div class="order-2 xl:hidden flex items-center flex-shrink-0">
              <button
                ref={menuButtonRef}
                onClick$={() =>
                  (isMobileMenuOpen.value = !isMobileMenuOpen.value)
                }
                type="button"
                class="inline-flex h-11 w-11 items-center justify-center rounded-md text-accent hover:bg-secondary hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent transition-colors duration-300"
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
                    class="h-6 w-6"
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
                    class="h-6 w-6"
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
        <nav
          aria-label="Navegación móvil"
          class="xl:hidden max-h-[calc(100dvh-200px)] overflow-y-auto overscroll-contain border-t border-secondary"
          id="mobile-menu"
          hidden={!isMobileMenuOpen.value}
        >
          <div class="px-4 pt-2 pb-4 space-y-2 bg-primary">
            {user.value ? (
              <>
                <Link
                  href="/perfil/"
                  aria-current={location.url.pathname === "/perfil/" ? "page" : undefined}
                  class="inline-flex min-h-11 items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold text-accent hover:bg-secondary"
                >
                  <LuUser class="w-4 h-4 text-accent" />
                  <span>Mi Perfil</span>
                </Link>
                <Link
                  href="/perfil/#mis-cupones"
                  class="inline-flex min-h-11 items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold text-accent hover:bg-secondary"
                >
                  <LuTicket class="w-4 h-4 text-accent" />
                  <span>Mis cupones</span>
                </Link>
              </>
            ) : (
              <Link
                href={loginHref}
                class="inline-flex min-h-11 items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold text-accent hover:bg-secondary"
              >
                <LuLock class="w-4 h-4 text-accent" />
                <span>Iniciar Sesión</span>
              </Link>
            )}

            {user.value?.role === "admin" && (
              <Link
                href="/admin"
                class="inline-flex min-h-11 items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold text-accent hover:bg-secondary"
              >
                <LuSettings class="w-4 h-4" />
                <span>Panel de administración</span>
              </Link>
            )}

            {[HOME_ITEM, ...NAV_ITEMS, MAP_ITEM].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                // Also covers links to the page already open, where the pathname does not change.
                onClick$={() => (isMobileMenuOpen.value = false)}
                class={`flex min-h-11 items-center gap-2 px-3 py-2 rounded-md text-base font-semibold transition-colors ${
                  isActive(item.href)
                    ? "text-accent bg-secondary"
                    : "text-slate-300 hover:bg-secondary hover:text-accent"
                }`}
              >
                {item === MAP_ITEM && <LuMapPin class="w-4 h-4 text-slate-400" />}
                <span>{item.label}</span>
              </Link>
            ))}

            {user.value && (
              <Form action={logoutAction}>
                <button
                  type="submit"
                  disabled={logoutAction.isRunning}
                  class="inline-flex min-h-11 items-center gap-2 w-full px-3 py-2 rounded-md text-base font-bold text-red-300 hover:bg-secondary cursor-pointer disabled:opacity-60"
                >
                  <LuLogOut class="w-4 h-4" />
                  <span>{logoutAction.isRunning ? "Cerrando sesión..." : "Cerrar sesión"}</span>
                </button>
              </Form>
            )}
          </div>
        </nav>
      </header>
    </>
  );
});
