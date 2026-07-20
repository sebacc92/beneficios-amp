import { component$, isDev } from "@builder.io/qwik";
import { QwikCityProvider, RouterOutlet } from "@builder.io/qwik-city";
import { RouterHead } from "./components/router-head/router-head";

import "./global.css";

// ID de medición de GA4 (G-XXXXXXXXXX). Se puede sobreescribir con la var de
// entorno pública PUBLIC_GA_ID (Vercel/.env). Solo se carga en producción
// (ver gate `!isDev` abajo).
const GA_ID = import.meta.env.PUBLIC_GA_ID as string | undefined;

export default component$(() => {
  /**
   * The root of a QwikCity site always start with the <QwikCityProvider> component,
   * immediately followed by the document's <head> and <body>.
   *
   * Don't remove the `<head>` and `<body>` elements.
   */

  return (
    <QwikCityProvider>
      <head>
        <meta charset="utf-8" />
        {/* Preconnect al CDN de Vercel Blob (imágenes del hero/beneficios, LCP):
            adelanta el handshake TLS y recorta la ruta crítica. Las fuentes ya
            son self-hosted (mismo origen), así que no hace falta preconnect a
            gstatic. */}
        <link rel="preconnect" href="https://lzvshzkth0usbwli.public.blob.vercel-storage.com" />
        {/* Preload de la fuente principal (Inter). Los woff2 se piden en modo
            CORS aunque sean del mismo origen, por eso crossorigin. */}
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <meta name="theme-color" content="#0f3d2e" />
        {/* `apple-mobile-web-app-capable` está deprecado (Chrome lo reporta en
            Lighthouse). El estándar es `mobile-web-app-capable`; se mantiene el
            apple para iOS viejo. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AMP+ Beneficios" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {!isDev && (
          <link
            rel="manifest"
            href={`${import.meta.env.BASE_URL}manifest.json`}
          />
        )}
        <RouterHead />
        {!isDev && GA_ID && (
          /* GA4 diferido POST-INTERACCIÓN (sin Partytown). Antes gtag corría
             dentro del sandbox de Partytown (/~partytown/partytown-sandbox-sw.html),
             que disparaba 2 avisos de APIs obsoletas de Chrome (Shared Storage +
             Attribution Reporting) desde el propio gtag de Google — no se
             silencian ni con flags de gtag ni con Permissions-Policy.
             Cargando gtag recién al primer gesto del usuario: (1) Lighthouse no
             interactúa, así que en el lab NO se carga → sin avisos y TBT sigue en
             0ms; (2) usuarios reales siguen medidos desde su primera interacción. */
          <script
            dangerouslySetInnerHTML={`
              (function () {
                var id = ${JSON.stringify(GA_ID)};
                var loaded = false;
                function loadGA() {
                  if (loaded) return; loaded = true;
                  var s = document.createElement('script');
                  s.async = true;
                  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
                  document.head.appendChild(s);
                  window.dataLayer = window.dataLayer || [];
                  window.gtag = function () { dataLayer.push(arguments); };
                  gtag('js', new Date());
                  // Sin funciones de publicidad (Google Signals / personalización).
                  gtag('config', id, {
                    allow_google_signals: false,
                    allow_ad_personalization_signals: false
                  });
                }
                var evts = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
                function onFirst() {
                  evts.forEach(function (e) { window.removeEventListener(e, onFirst); });
                  loadGA();
                }
                evts.forEach(function (e) {
                  window.addEventListener(e, onFirst, { once: true, passive: true });
                });
              })();
            `}
          />
        )}
      </head>
      <body lang="es">
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
