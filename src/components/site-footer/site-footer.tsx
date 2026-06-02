import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export const SiteFooter = component$(() => {
  return (
    <footer class="bg-slate-50 text-slate-650 border-t border-slate-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Branding Column */}
          <div class="col-span-1 md:col-span-2 space-y-4">
            <div class="flex items-center space-x-3.5">
              <img
                src="/logo-beneficios_amp2.webp"
                alt="Logo AMP"
                width={156}
                height={60}
                class="h-[54px] w-auto object-contain brightness-95"
              />
            </div>
            <p class="text-sm text-slate-500 max-w-sm font-medium">
              Comprometidos con el bienestar de la comunidad médica. Disfrutá de una exclusiva cartilla de más de 250 comercios adheridos, descuentos, y sorteos exclusivos en toda la provincia y el país.
            </p>
            {/* Social Media Networks */}
            <div class="flex items-center space-x-3.5 pt-2">
              <a
                href="https://www.facebook.com/ameplaoficial/"
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
                href="https://www.instagram.com/ameplaoficial/?hl=es-la"
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
                href="https://x.com/ameplaoficial"
                target="_blank"
                rel="noopener"
                class="w-9 h-9 bg-slate-200 hover:bg-brand-green text-slate-700 hover:text-white flex items-center justify-center rounded-full transition-all duration-300 shadow-sm"
                aria-label="X (Twitter)"
              >
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a
                href="https://www.youtube.com/@ameplaoficial"
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
            <ul class="space-y-3.5 text-sm text-slate-500 font-medium">
              <li class="flex items-start space-x-2.5">
                <svg class="w-4 h-4 mt-0.5 text-brand-green flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>
                  <strong>AMEPLA</strong><br />
                  Calle 6 Nº 1137/35 - 1900<br />
                  La Plata - Buenos Aires - Argentina
                </span>
              </li>
              <li class="flex items-start space-x-2.5">
                <svg class="w-4 h-4 mt-1.5 text-brand-green flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.98-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <div class="flex flex-col space-y-1">
                  <span><strong>Tel:</strong> (0221) 429-8400</span>
                  <span><strong>Secretaría Administrativa:</strong><br />(0221) 429-8417</span>
                  <span><strong>El Cardón:</strong> (0221) 496-2537</span>
                </div>
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
  );
});
