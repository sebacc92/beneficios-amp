import { component$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import { LuMapPin, LuPhone, LuMessageCircle } from "@qwikest/icons/lucide";
import { ClubBrand } from "~/components/club-brand/club-brand";
import { HOME_ITEM, SUGGESTIONS_ITEM, isNavActive, navItems } from "~/components/site-header/nav-items";
import { CLUB, WHATSAPP_MESSAGES, whatsappLink } from "~/utils/club";

interface SiteFooterProps {
  showAgenda: boolean;
}

const headingClass = "font-display text-sm font-semibold uppercase tracking-[0.16em] text-white border-l-4 border-accent pl-3";
const externalLinkClass = "hover:text-accent transition-colors font-semibold";

const CLUB_LINKS = [
  { href: CLUB.site, label: "Sitio oficial del club" },
  { href: CLUB.clubUrl, label: "El club" },
  { href: CLUB.fixtureUrl, label: "Fixture y posiciones" },
  { href: CLUB.agendaUrl, label: "Agenda del club" },
];

export const SiteFooter = component$<SiteFooterProps>(({ showAgenda }) => {
  const location = useLocation();
  const links = [HOME_ITEM, ...navItems({ showAgenda }), SUGGESTIONS_ITEM];

  return (
    <footer class="bg-primary text-slate-300 border-t-4 border-accent print:hidden">
      <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 items-start">
          {/* Branding Column */}
          <div class="min-w-0 sm:col-span-2 space-y-4">
            <ClubBrand />
            <p class="text-sm text-slate-300 max-w-sm">
              Beneficios para socios de {CLUB.name}: descuentos en comercios adheridos, sorteos y actividades del club.
            </p>
            <p class="eyebrow text-accent">El primer club de rugby de la ciudad · Desde {CLUB.foundedYear}</p>
            {/* Same networks as lprc.com.ar */}
            <div class="flex items-center gap-2 pt-1">
              <a
                href={CLUB.social.instagram}
                target="_blank"
                rel="noopener"
                class="w-10 h-10 bg-secondary hover:bg-accent text-white hover:text-primary flex items-center justify-center transition-colors"
                aria-label="Instagram (abre en una pestaña nueva)"
              >
                <svg class="w-5 h-5 stroke-current fill-none stroke-2" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a
                href={CLUB.social.facebook}
                target="_blank"
                rel="noopener"
                class="w-10 h-10 bg-secondary hover:bg-accent text-white hover:text-primary flex items-center justify-center transition-colors"
                aria-label="Facebook (abre en una pestaña nueva)"
              >
                <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
                </svg>
              </a>
              <a
                href={CLUB.social.x}
                target="_blank"
                rel="noopener"
                class="w-10 h-10 bg-secondary hover:bg-accent text-white hover:text-primary flex items-center justify-center transition-colors"
                aria-label="X (Twitter) (abre en una pestaña nueva)"
              >
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Portal links */}
          <nav aria-labelledby="footer-portal" class="min-w-0 space-y-4">
            <h2 id="footer-portal" class={headingClass}>Beneficios</h2>
            <ul class="space-y-2.5 text-sm text-slate-200">
              {links.map((item) => {
                const active = isNavActive(location.url.pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      class={`hover:text-accent transition-colors font-semibold ${active ? "text-accent" : ""}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link href="/ayuda-ingreso/" class="hover:text-accent transition-colors font-semibold">
                  Ayuda para ingresar
                </Link>
              </li>
            </ul>
          </nav>

          {/* Club and merchants */}
          <nav aria-labelledby="footer-club" class="min-w-0 space-y-4">
            <h2 id="footer-club" class={headingClass}>El club</h2>
            <ul class="space-y-2.5 text-sm text-slate-200">
              {CLUB_LINKS.map((item) => (
                <li key={item.href}>
                  <a href={item.href} target="_blank" rel="noopener" class={externalLinkClass}>
                    {item.label}
                    <span class="sr-only"> (abre en una pestaña nueva)</span>
                  </a>
                </li>
              ))}
              <li class="pt-2">
                <Link href="/validar-cupon/" class="hover:text-accent transition-colors font-semibold">
                  Comercios: validar cupones
                </Link>
              </li>
            </ul>
          </nav>

          {/* Contact Details Column */}
          <div class="min-w-0 space-y-4">
            <h2 class={headingClass}>Contactanos</h2>
            <ul class="space-y-4 text-sm text-slate-300">
              <li class="flex items-start gap-2.5">
                <LuMapPin class="w-4 h-4 mt-0.5 text-accent flex-shrink-0" />
                <span>
                  <a href={CLUB.mapsUrl} target="_blank" rel="noopener" class="hover:text-accent">
                    <strong class="text-white">{CLUB.name}</strong>
                    <br />
                    {CLUB.address}
                    <br />
                    {CLUB.locality}
                    <span class="sr-only"> (Google Maps, abre en una pestaña nueva)</span>
                  </a>
                  <br />
                  <span class="text-xs text-slate-400">{CLUB.memberAccess}</span>
                </span>
              </li>
              <li class="flex items-start gap-2.5">
                <LuMessageCircle class="w-4 h-4 mt-0.5 text-accent flex-shrink-0" />
                <a href={whatsappLink(WHATSAPP_MESSAGES.consulta)} target="_blank" rel="noopener" class="hover:text-accent">
                  <strong class="text-white">WhatsApp:</strong> {CLUB.whatsappDisplay}
                  <span class="sr-only"> (abre en una pestaña nueva)</span>
                </a>
              </li>
              <li class="flex items-start gap-2.5">
                <LuPhone class="w-4 h-4 mt-0.5 text-accent flex-shrink-0" />
                <a href={CLUB.phoneHref} class="hover:text-accent">
                  <strong class="text-white">Secretaría:</strong> {CLUB.phoneDisplay}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-12 pt-8 pb-16 border-t border-secondary text-xs text-slate-400 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <p>
            &copy; {new Date().getFullYear()} {CLUB.name}. Todos los derechos reservados.
          </p>
          <a href={CLUB.site} target="_blank" rel="noopener" class="font-display uppercase tracking-[0.16em] text-slate-300 hover:text-accent">
            lprc.com.ar
            <span class="sr-only"> (sitio oficial, abre en una pestaña nueva)</span>
          </a>
        </div>
      </div>
    </footer>
  );
});
