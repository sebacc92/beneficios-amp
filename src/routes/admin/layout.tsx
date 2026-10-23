import { component$, Slot, useSignal, useTask$ } from "@builder.io/qwik";
import { isBrowser } from "@builder.io/qwik/build";
import { Form, Link, useLocation, routeAction$, routeLoader$ } from "@builder.io/qwik-city";
import {
  LuArrowLeft,
  LuBot,
  LuCalendar,
  LuExternalLink,
  LuGauge,
  LuGift,
  LuHeartHandshake,
  LuImage,
  LuInbox,
  LuLogOut,
  LuMegaphone,
  LuMenu,
  LuPanelTop,
  LuQrCode,
  LuShieldCheck,
  LuTicket,
  LuUsers,
  LuX,
} from "@qwikest/icons/lucide";
import { and, count, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { getDB } from "~/db";
import { raffles } from "~/db/schema";
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

const ARGENTINA_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Published raffles whose draw day (Buenos Aires) is over and still have no winner loaded. */
export const useRafflesWithoutWinnerCount = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user || user.role !== "admin") return 0;
  try {
    const today = ARGENTINA_DAY.format(new Date());
    const [row] = await getDB(event)
      .select({ total: count() })
      .from(raffles)
      .where(
        and(
          lt(raffles.drawDate, today),
          ne(raffles.status, "draft"),
          or(isNull(raffles.winners), eq(sql`trim(${raffles.winners})`, "")),
        ),
      );
    return row?.total ?? 0;
  } catch (err) {
    console.error("Failed to count raffles without winner:", err);
    return 0;
  }
});

// Same mechanism as /perfil: revoke the session row, then clear the cookie.
export const useAdminLogoutAction = routeAction$(async (_, requestEvent) => {
  await destroySession(requestEvent);
  throw requestEvent.redirect(302, "/admin/login");
});

// Icons stay in module scope: nav data reaches NavLinks as props, which must be serializable.
const NAV_ICONS = {
  inicio: () => <LuGauge />,
  carrusel: () => <LuImage />,
  campana: () => <LuMegaphone />,
  popup: () => <LuPanelTop />,
  sponsors: () => <LuHeartHandshake />,
  beneficios: () => <LuTicket />,
  cupones: () => <LuQrCode />,
  agenda: () => <LuCalendar />,
  sorteos: () => <LuGift />,
  solicitudes: () => <LuInbox />,
  socios: () => <LuUsers />,
  admins: () => <LuShieldCheck />,
  ia: () => <LuBot />,
};

interface NavItem {
  path: string;
  label: string;
  icon: keyof typeof NAV_ICONS;
  /** Public page where the admin sees the result of this section. */
  publicPath?: string;
  /** Other admin paths that belong to this item (chat details live under Asistente IA). */
  also?: string[];
  badge?: number;
  badgeLabel?: string;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const clean = (path: string) => path.replace(/\/$/, "");

const matchesPath = (current: string, item: NavItem) => {
  const path = clean(current);
  if (clean(item.path) === "/admin/stats" && path === "/admin") return true;
  return [item.path, ...(item.also ?? [])].some((target) => path === clean(target) || path.startsWith(`${clean(target)}/`));
};

const NavLinks = component$<{ sections: NavSection[]; currentPath: string; idPrefix: string }>((props) => (
  <nav aria-label="Administración" class="space-y-5">
    {props.sections.map((section, index) => (
      <div key={section.label ?? index} class={!section.label && index > 0 ? "border-t border-white/10 pt-5" : ""}>
        {section.label && (
          <p id={`${props.idPrefix}-${index}`} class="eyebrow mb-2 px-5 text-[11px] text-slate-400">
            {section.label}
          </p>
        )}
        <ul aria-labelledby={section.label ? `${props.idPrefix}-${index}` : undefined} class="space-y-0.5">
          {section.items.map((item) => {
            const active = matchesPath(props.currentPath, item);
            return (
              <li key={item.path}>
                <Link
                  href={`${item.path}/`}
                  aria-current={active ? "page" : undefined}
                  class={[
                    "flex min-h-10 items-center gap-3 border-l-4 py-2 pl-4 pr-4 font-display text-[15px] font-medium uppercase tracking-[0.08em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
                    active ? "border-accent bg-secondary text-white" : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white",
                  ]}
                >
                  <span aria-hidden="true" class={["shrink-0 [&_svg]:h-5 [&_svg]:w-5", active ? "text-accent" : "text-slate-400"]}>{NAV_ICONS[item.icon]()}</span>
                  <span class="min-w-0 flex-1 truncate">{item.label}</span>
                  {!!item.badge && (
                    <span class="badge badge-accent min-w-6 justify-center tabular-nums">
                      {item.badge}
                      <span class="sr-only"> {item.badgeLabel}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    ))}
  </nav>
));

export default component$(() => {
  const location = useLocation();
  const userLoader = useAdminUser();
  const user = userLoader.value;
  const pendingRequests = usePendingRequestsCount();
  const rafflesWithoutWinner = useRafflesWithoutWinnerCount();
  const logoutAction = useAdminLogoutAction();
  const drawerOpen = useSignal(false);
  const drawer = useSignal<HTMLDialogElement>();
  const menuButton = useSignal<HTMLButtonElement>();

  useTask$(({ track }) => {
    track(() => location.url.pathname);
    drawerOpen.value = false;
  });

  useTask$(({ track }) => {
    const open = track(() => drawerOpen.value);
    if (!isBrowser || !drawer.value) return;
    if (open && !drawer.value.open) drawer.value.showModal();
    if (!open && drawer.value.open) drawer.value.close();
  });

  const sections: NavSection[] = [
    { items: [{ path: "/admin/stats", label: "Inicio", icon: "inicio", publicPath: "/" }] },
    {
      label: "Portada",
      items: [
        { path: "/admin/slides", label: "Carrusel", icon: "carrusel", publicPath: "/" },
        { path: "/admin/campana", label: "Campaña", icon: "campana", publicPath: "/" },
        { path: "/admin/popup", label: "Popup", icon: "popup", publicPath: "/" },
        { path: "/admin/sponsors", label: "Sponsors", icon: "sponsors", publicPath: "/" },
      ],
    },
    {
      label: "Catálogo",
      items: [
        { path: "/admin/benefits", label: "Beneficios", icon: "beneficios", publicPath: "/beneficios/" },
        { path: "/admin/cupones", label: "Cupones", icon: "cupones", publicPath: "/validar-cupon/" },
      ],
    },
    {
      label: "Club",
      items: [
        { path: "/admin/eventos", label: "Agenda", icon: "agenda", publicPath: "/eventos/" },
        {
          path: "/admin/sorteos",
          label: "Sorteos",
          icon: "sorteos",
          publicPath: "/sorteos/",
          badge: rafflesWithoutWinner.value,
          badgeLabel: rafflesWithoutWinner.value === 1 ? "sorteo sin ganador" : "sorteos sin ganador",
        },
        {
          path: "/admin/solicitudes",
          label: "Solicitudes",
          icon: "solicitudes",
          publicPath: "/sugerencias/",
          badge: pendingRequests.value,
          badgeLabel: pendingRequests.value === 1 ? "solicitud pendiente" : "solicitudes pendientes",
        },
      ],
    },
    {
      label: "Personas",
      items: [
        { path: "/admin/users", label: "Socios", icon: "socios" },
        { path: "/admin/admins", label: "Admins", icon: "admins" },
      ],
    },
    { items: [{ path: "/admin/ai", label: "Asistente IA", icon: "ia", publicPath: "/", also: ["/admin/chats"] }] },
  ];

  const currentPath = location.url.pathname;
  const currentSection = sections.find((section) => section.items.some((item) => matchesPath(currentPath, item)));
  const currentItem = currentSection?.items.find((item) => matchesPath(currentPath, item));
  const inChatDetail = clean(currentPath).startsWith("/admin/chats/");
  const crumbs = [currentSection?.label, currentItem?.label, inChatDetail ? "Conversación" : undefined].filter(
    (crumb): crumb is string => !!crumb,
  );
  const pendingTotal = pendingRequests.value + rafflesWithoutWinner.value;

  const renderViewOnSite = (variant: "light" | "dark") =>
    currentItem?.publicPath && (
      <a
        href={currentItem.publicPath}
        target="_blank"
        rel="noopener"
        class={["btn btn-sm shrink-0", variant === "light" ? "btn-outline" : "btn-outline-light w-full"]}
      >
        <LuExternalLink class="h-4 w-4" />
        Ver en el sitio
        <span class="sr-only"> (se abre en otra pestaña)</span>
      </a>
    );

  // In the drawer the public-page shortcut joins this panel, which leaves more room for the menu.
  const renderSessionPanel = (inDrawer: boolean) => (
    <div class="space-y-2.5 border-t border-white/10 p-4">
      {!inDrawer && (
        <p class="truncate px-1 text-xs text-slate-400">
          Sesión de <span class="font-semibold text-white">{user ? user.name : "Administrador"}</span>
        </p>
      )}
      {inDrawer && renderViewOnSite("dark")}
      <Link href="/" class="btn btn-outline-light btn-sm w-full">
        <LuArrowLeft class="h-4 w-4" />
        Volver al sitio
      </Link>
      <Form action={logoutAction}>
        <button type="submit" disabled={logoutAction.isRunning} class="btn btn-sm w-full border-white/20 bg-transparent text-slate-300 hover:border-red-300 hover:text-red-200">
          <LuLogOut class="h-4 w-4" aria-hidden="true" />
          {logoutAction.isRunning ? "Cerrando sesión..." : "Cerrar sesión"}
        </button>
      </Form>
    </div>
  );

  const renderBrand = (withCrest: boolean) => (
    <div class="flex items-center gap-3">
      {withCrest && <img src="/lprc.avif" alt="" width={120} height={101} class="h-auto w-11 shrink-0 object-contain" />}
      <div class="min-w-0 leading-tight">
        <p class="font-display text-lg font-bold uppercase tracking-wide text-white">Club de Beneficios</p>
        <p class="eyebrow text-[10px] text-accent">Panel de administración</p>
      </div>
    </div>
  );

  return (
    <div class="flex h-dvh w-full flex-col overflow-hidden bg-background font-sans lg:flex-row">
      <a
        href="#admin-content"
        preventdefault:click
        onClick$={() => document.getElementById("admin-content")?.focus()}
        class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4 focus:py-3 focus:font-bold focus:text-primary focus:shadow-lg"
      >
        Saltar al contenido
      </a>

      {/* Mobile header: current section and the drawer trigger. */}
      <header class="flex shrink-0 items-center justify-between gap-3 border-b-4 border-accent bg-primary px-4 py-2.5 text-white lg:hidden">
        <div class="min-w-0">
          <p class="eyebrow truncate text-[10px] text-accent">{currentSection?.label ?? "Panel de administración"}</p>
          <p class="truncate font-display text-lg font-semibold uppercase tracking-wide">{currentItem?.label ?? "Administración"}</p>
        </div>
        <button
          ref={menuButton}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen.value}
          aria-controls="admin-drawer"
          onClick$={() => (drawerOpen.value = true)}
          class="btn btn-outline-light btn-sm relative shrink-0"
        >
          <LuMenu class="h-5 w-5" />
          Menú
          {pendingTotal > 0 && (
            <span class="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-accent">
              <span class="sr-only">Hay pendientes</span>
            </span>
          )}
        </button>
      </header>

      {/* Mobile drawer: a native modal, so focus stays inside, Escape closes it and the page behind is inert. */}
      <dialog
        id="admin-drawer"
        ref={drawer}
        aria-label="Menú de administración"
        class="m-0 h-dvh max-h-none w-[min(20rem,88vw)] max-w-none overflow-hidden bg-primary p-0 text-white backdrop:bg-brand-ink/70"
        onClick$={(event, element) => {
          // A click on the backdrop lands on the dialog itself.
          if (event.target === element) drawerOpen.value = false;
        }}
        onClose$={() => {
          drawerOpen.value = false;
          menuButton.value?.focus();
        }}
      >
        <div class="flex h-full flex-col">
          <div class="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
            {renderBrand(false)}
            <button
              type="button"
              onClick$={() => (drawerOpen.value = false)}
              aria-label="Cerrar menú"
              class="flex h-11 w-11 shrink-0 items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <LuX class="h-6 w-6" />
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto py-5">
            <NavLinks sections={sections} currentPath={currentPath} idPrefix="drawer-section" />
          </div>
          {renderSessionPanel(true)}
        </div>
      </dialog>

      {/* Desktop sidebar; `relative` keeps the badges' sr-only text from stretching the document. */}
      <aside class="relative hidden h-full w-72 shrink-0 select-none flex-col bg-primary text-white lg:flex">
        <div class="border-b border-white/10 px-6 py-5">{renderBrand(true)}</div>
        <div class="min-h-0 flex-1 overflow-y-auto py-4">
          <NavLinks sections={sections} currentPath={currentPath} idPrefix="sidebar-section" />
        </div>
        {renderSessionPanel(false)}
      </aside>

      <main id="admin-content" tabIndex={-1} class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background focus:outline-none">
        {/* Desktop bar: where you are and the public page this section feeds. */}
        <div class="sticky top-0 z-30 hidden min-h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-white px-10 py-2 lg:flex">
          <nav aria-label="Ubicación en el panel">
            <ol class="flex items-center gap-2 text-sm">
              <li class="eyebrow text-slate-500">Administración</li>
              {crumbs.map((crumb, index) => (
                <li key={crumb} class="flex items-center gap-2">
                  <span aria-hidden="true" class="text-slate-400">›</span>
                  <span
                    aria-current={index === crumbs.length - 1 ? "page" : undefined}
                    class={index === crumbs.length - 1 ? "font-display text-base font-semibold uppercase tracking-wide text-primary" : "eyebrow text-slate-500"}
                  >
                    {crumb}
                  </span>
                </li>
              ))}
            </ol>
          </nav>
          {renderViewOnSite("light")}
        </div>
        <Slot />
      </main>
    </div>
  );
});
