export interface NavItem {
  href: string;
  label: string;
}

export const HOME_ITEM: NavItem = { href: "/", label: "Inicio" };
export const MAP_ITEM: NavItem = { href: "/mapa/", label: "Cerca mío" };
export const AGENDA_ITEM: NavItem = { href: "/eventos/", label: "Agenda" };
export const COUPONS_ITEM: NavItem = { href: "/perfil/#mis-cupones", label: "Mis cupones" };
export const SUGGESTIONS_ITEM: NavItem = { href: "/sugerencias/", label: "Sugerencias" };

/**
 * Main navigation, shared by the desktop bar, the mobile drawer and the footer so they
 * never drift. "Agenda" is dropped while there are no upcoming events (see `navItems`);
 * "Sugerencias" lives in the footer.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/beneficios/", label: "Beneficios" },
  MAP_ITEM,
  AGENDA_ITEM,
  { href: "/como-funciona/", label: "Cómo funciona" },
  { href: "/sorteos/", label: "Sorteos" },
];

export function navItems({ showAgenda }: { showAgenda: boolean }): NavItem[] {
  return showAgenda ? NAV_ITEMS : NAV_ITEMS.filter((item) => item !== AGENDA_ITEM);
}

export function isNavActive(pathname: string, href: string): boolean {
  const path = href.replace(/[#?].*$/, "").replace(/\/$/, "");
  if (!path) return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}
