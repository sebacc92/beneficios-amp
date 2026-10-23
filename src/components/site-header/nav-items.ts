export interface NavItem {
  href: string;
  label: string;
}

/** One list for the desktop bar, the mobile drawer and the footer, so they never drift. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/beneficios/", label: "Beneficios" },
  { href: "/eventos/", label: "Agenda" },
  { href: "/como-funciona/", label: "Cómo Funciona" },
  { href: "/sorteos/", label: "Sorteos" },
  { href: "/sugerencias/", label: "Sugerencias" },
];

export const HOME_ITEM: NavItem = { href: "/", label: "Inicio" };
export const MAP_ITEM: NavItem = { href: "/mapa/", label: "Cerca Mío" };

export function isNavActive(pathname: string, href: string): boolean {
  const path = href.replace(/\/$/, "");
  if (!path) return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}
