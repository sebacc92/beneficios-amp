import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { ClubBrand } from "~/components/club-brand/club-brand";

export const SiteFooter = component$(() => {
  return (
    <footer class="bg-primary text-slate-400 border-t border-secondary print:hidden">
      <div class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 items-start">
          {/* Branding Column */}
          <div class="min-w-0 sm:col-span-2 space-y-4">
            <ClubBrand />
            <p class="text-sm text-slate-400 max-w-sm font-medium">
              Club de Beneficios para socios activos de La Plata Rugby Club.
              Disfrutá de descuentos, sorteos y convenios exclusivos en una
              amplia red de comercios adheridos.
            </p>
            {/* Social Media Networks */}
            <div class="flex items-center space-x-3.5 pt-2">
              <a
                href="https://www.facebook.com/laplatarugbyclub"
                target="_blank"
                rel="noopener"
                class="w-9 h-9 bg-secondary hover:bg-accent text-slate-300 hover:text-primary flex items-center justify-center rounded-full transition-all duration-300 shadow-sm"
                aria-label="Facebook"
              >
                <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/laplatarugbyclub/"
                target="_blank"
                rel="noopener"
                class="w-9 h-9 bg-secondary hover:bg-accent text-slate-300 hover:text-primary flex items-center justify-center rounded-full transition-all duration-300 shadow-sm"
                aria-label="Instagram"
              >
                <svg
                  class="w-5 h-5 stroke-current fill-none stroke-2"
                  viewBox="0 0 24 24"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a
                href="https://x.com/laplatarugby"
                target="_blank"
                rel="noopener"
                class="w-9 h-9 bg-secondary hover:bg-accent text-slate-300 hover:text-primary flex items-center justify-center rounded-full transition-all duration-300 shadow-sm"
                aria-label="X (Twitter)"
              >
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://www.youtube.com/@laplatarugbyclub"
                target="_blank"
                rel="noopener"
                class="w-9 h-9 bg-secondary hover:bg-accent text-slate-300 hover:text-primary flex items-center justify-center rounded-full transition-all duration-300 shadow-sm"
                aria-label="YouTube"
              >
                <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11c.502-1.87.502-5.837.502-5.837s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links Column */}
          <div class="min-w-0 space-y-4">
            <h3 class="text-white font-display font-black text-sm uppercase tracking-wider border-l-2 border-accent pl-2">
              Navegación
            </h3>
            <ul class="space-y-2.5 text-sm text-slate-300">
              <li>
                <Link
                  href="/"
                  class="hover:text-accent transition-colors font-bold"
                >
                  Inicio
                </Link>
              </li>
              <li>
                <Link
                  href="/beneficios"
                  class="hover:text-accent transition-colors font-bold"
                >
                  Todos los beneficios
                </Link>
              </li>
              <li>
                <Link
                  href="/como-funciona"
                  class="hover:text-accent transition-colors font-bold"
                >
                  Cómo Funciona
                </Link>
              </li>
              <li>
                <Link
                  href="/sorteos"
                  class="hover:text-accent transition-colors font-bold"
                >
                  Sorteos
                </Link>
              </li>
              <li>
                <Link
                  href="/sugerencias"
                  class="hover:text-accent transition-colors font-bold"
                >
                  Sugerencias
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Details Column */}
          <div class="min-w-0 space-y-4">
            <h3 class="text-white font-display font-black text-sm uppercase tracking-wider border-l-2 border-accent pl-2">
              Contacto
            </h3>
            <ul class="space-y-3.5 text-sm text-slate-400 font-medium">
              <li class="flex items-start space-x-2.5">
                <svg
                  class="w-4 h-4 mt-0.5 text-accent flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>
                  <strong>La Plata Rugby Club</strong>
                  <br />
                  Camino Centenario y 507
                  <br />
                  Manuel B. Gonnet, La Plata - Argentina
                </span>
              </li>
              <li class="flex items-start space-x-2.5">
                <svg
                  class="w-4 h-4 mt-1.5 text-accent flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.98-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <div class="flex flex-col space-y-1">
                  <span>
                    <strong>Tel:</strong> (0221) 489-5777
                  </span>
                  <span>
                    <strong>Secretaría:</strong> (0221) 489-5777
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-12 pt-8 pb-16 border-t border-secondary text-left text-xs text-slate-400 font-semibold flex flex-col lg:flex-row lg:flex-wrap items-start lg:items-center justify-between gap-4">
          <p>
            &copy; {new Date().getFullYear()} La Plata Rugby Club. Todos los
            derechos reservados.
          </p>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href="https://lprc.com.ar"
              target="_blank"
              rel="noopener"
              class="hover:text-accent transition-colors"
            >
              Web Oficial LPRC
            </a>
            <span>&bull;</span>
            <a
              href="https://beneficios.lprc.com.ar"
              target="_blank"
              rel="noopener"
              class="hover:text-accent transition-colors"
            >
              LPRC App
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
});
