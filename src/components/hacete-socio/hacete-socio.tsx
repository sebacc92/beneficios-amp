import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { CLUB, WHATSAPP_MESSAGES, whatsappLink } from "~/utils/club";

interface HaceteSocioProps {
  /** "band" is a full-width navy/yellow block; "card" fits sidebars and narrow columns. */
  variant?: "band" | "card";
  class?: string;
}

/**
 * The club's main call to action ("Hacete socio" on lprc.com.ar), for visitors who
 * reach a benefit or the login without being members yet.
 */
export const HaceteSocio = component$<HaceteSocioProps>(({ variant = "band", class: extraClass = "" }) => {
  const href = whatsappLink(WHATSAPP_MESSAGES.haceteSocio);

  if (variant === "card") {
    return (
      <aside class={`border-t-4 border-accent bg-primary p-6 text-white ${extraClass}`} aria-labelledby="hacete-socio-card-title">
        <p class="eyebrow text-accent">¿Todavía no sos socio?</p>
        <h2 id="hacete-socio-card-title" class="heading-display mt-2 text-2xl">Sumate a la familia amarilla</h2>
        <p class="mt-3 text-sm leading-relaxed text-slate-300">
          Los beneficios son para socios de {CLUB.name}. Escribinos y te contamos cómo asociarte. Siempre serás bienvenido.
        </p>
        <a href={href} target="_blank" rel="noopener" class="btn btn-primary mt-5 w-full">
          Hacete socio
          <span class="sr-only"> (WhatsApp, abre en una pestaña nueva)</span>
        </a>
      </aside>
    );
  }

  return (
    <section class={`grid md:grid-cols-2 ${extraClass}`} aria-labelledby="hacete-socio-title">
      <div class="bg-primary px-6 py-10 text-white sm:px-10 md:py-14">
        <p class="eyebrow text-accent">Desde {CLUB.foundedYear}</p>
        <h2 id="hacete-socio-title" class="heading-display mt-3 text-3xl sm:text-4xl">¿Todavía no sos socio?</h2>
        <span class="title-bar mt-4" aria-hidden="true" />
        <p class="mt-5 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
          El primer club de rugby de la ciudad. Formamos buenas personas que disfrutan del rugby, y los beneficios del portal son para toda la familia socia.
        </p>
      </div>
      <div class="flex flex-col justify-center gap-4 bg-accent px-6 py-10 text-primary sm:px-10 md:py-14">
        <p class="heading-display text-2xl sm:text-3xl">Siempre serás bienvenido.</p>
        <p class="max-w-md text-sm font-medium leading-relaxed sm:text-base">
          Escribinos por WhatsApp y te contamos cómo asociarte. Si ya sos socio, ingresá con tu DNI.
        </p>
        <div class="flex flex-wrap gap-3">
          <a href={href} target="_blank" rel="noopener" class="btn btn-dark">
            Hacete socio
            <span class="sr-only"> (WhatsApp, abre en una pestaña nueva)</span>
          </a>
          <Link href="/login/" class="btn btn-outline">
            Ya soy socio
          </Link>
        </div>
      </div>
    </section>
  );
});
