import { component$ } from "@builder.io/qwik";
import { routeAction$, Link, type DocumentHead } from "@builder.io/qwik-city";
import { LuCalendarDays, LuGift, LuMapPin, LuMessageCircle, LuNavigation, LuPhone, LuTicket, LuUsers } from "@qwikest/icons/lucide";
import { HaceteSocio } from "~/components/hacete-socio/hacete-socio";
import { SectionHeading } from "~/components/section-heading/section-heading";
import { CLUB, WHATSAPP_MESSAGES, whatsappLink } from "~/utils/club";

// Kept so old forms posting here still get a clear answer: members are added by the club.
export const useRegisterAction = routeAction$(async (_, requestEvent) => {
  return requestEvent.fail(403, {
    message: "Las altas de socios las hace el club. Comunicate con la secretaría para que te habiliten.",
  });
});

const REASONS = [
  {
    icon: LuTicket,
    title: "Descuentos con tu DNI",
    text: "Cupones en los comercios adheridos al portal, desde tu celular.",
  },
  {
    icon: LuGift,
    title: "Sorteos para socios",
    text: "Premios que el club sortea entre sus socios, con bases publicadas.",
  },
  {
    icon: LuCalendarDays,
    title: "La vida del club",
    text: "Rugby, torneos, clínicas y encuentros en la sede de Gonnet.",
  },
  {
    icon: LuUsers,
    title: "Para toda la familia",
    text: "Los beneficios del portal alcanzan a toda la familia socia.",
  },
];

export default component$(() => {
  const joinHref = whatsappLink(WHATSAPP_MESSAGES.haceteSocio);

  return (
    <div class="bg-background">
      <section aria-labelledby="join-title" class="border-b-4 border-accent bg-primary text-white">
        <div class="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:px-8">
          <div class="flex flex-col gap-6 sm:flex-row sm:items-start">
            <img src="/lprc.avif" alt="" width={120} height={101} class="h-auto w-24 shrink-0 sm:w-32" />
            <SectionHeading as="h1" id="join-title" tone="dark" size="xl" eyebrow={`Desde ${CLUB.foundedYear}`} title="Hacete socio">
              <p class="mt-5 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
                {CLUB.name}, el primer club de rugby de la ciudad. Ser socio es ser parte de la familia amarilla, y el portal de beneficios es una de las cosas que vienen con eso.
              </p>
            </SectionHeading>
          </div>

          <div class="grid gap-px bg-secondary">
            <div class="bg-accent p-6 text-primary">
              <h2 class="heading-display text-2xl">¿Sos socio? Ya estás adentro</h2>
              <p class="mt-2 text-sm font-medium leading-relaxed">No hace falta registrarte: ingresá con tu DNI y listo.</p>
              <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/login/" class="btn btn-dark">
                  Ingresá con tu DNI
                </Link>
                <Link href="/ayuda-ingreso/" class="inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4">
                  Mi DNI no figura
                </Link>
              </div>
            </div>
            <div class="bg-secondary p-6">
              <h2 class="heading-display text-2xl">¿Todavía no? Sumate</h2>
              <p class="mt-2 text-sm leading-relaxed text-slate-300">Escribinos por WhatsApp y te contamos cómo asociarte.</p>
              <a href={joinHref} target="_blank" rel="noopener" class="btn btn-primary mt-4">
                <LuMessageCircle class="h-4 w-4" aria-hidden="true" />
                Quiero ser socio
                <span class="sr-only"> (WhatsApp, abre en una pestaña nueva)</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <div class="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <section aria-labelledby="why-join-title">
          <SectionHeading id="why-join-title" eyebrow="Por qué asociarte" title="Lo que te espera en el club" size="lg" />
          <ul class="mt-8 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {REASONS.map(({ icon: Icon, title, text }) => (
              <li key={title} class="bg-surface p-6">
                <Icon class="h-8 w-8 text-primary" aria-hidden="true" />
                <h3 class="heading-display mt-4 text-lg text-primary">{title}</h3>
                <p class="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="club-place-title" class="grid border border-line bg-surface md:grid-cols-[1fr_auto]">
          <div class="p-6 sm:p-8">
            <SectionHeading id="club-place-title" eyebrow="Dónde estamos" title="Vení a conocernos" size="md" />
            <address class="mt-5 space-y-2 text-sm not-italic leading-relaxed text-slate-700">
              <p class="flex gap-2">
                <LuMapPin class="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <strong class="text-primary">{CLUB.address}</strong>
                  <br />
                  {CLUB.locality}
                  <br />
                  <span class="font-semibold text-amber-900">{CLUB.memberAccess}</span>
                </span>
              </p>
              <p class="flex gap-2">
                <LuPhone class="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Secretaría:{" "}
                  <a href={CLUB.phoneHref} class="font-bold text-primary underline underline-offset-4">
                    {CLUB.phoneDisplay}
                  </a>
                </span>
              </p>
            </address>
          </div>
          <div class="flex flex-col justify-center gap-3 border-t border-line p-6 sm:p-8 md:border-l md:border-t-0">
            <a href={CLUB.mapsUrl} target="_blank" rel="noopener" class="btn btn-dark">
              <LuNavigation class="h-4 w-4" aria-hidden="true" />
              Cómo llegar
              <span class="sr-only"> (Google Maps, abre en una pestaña nueva)</span>
            </a>
            <a href={CLUB.clubUrl} target="_blank" rel="noopener" class="btn btn-outline">
              Conocé el club
              <span class="sr-only"> (lprc.com.ar, abre en una pestaña nueva)</span>
            </a>
          </div>
        </section>
      </div>

      <HaceteSocio variant="band" />
    </div>
  );
});

export const head: DocumentHead = {
  title: "Hacete socio - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content:
        "Sumate a La Plata Rugby Club, el primer club de rugby de la ciudad. Si ya sos socio, ingresá al portal de beneficios con tu DNI.",
    },
  ],
};
