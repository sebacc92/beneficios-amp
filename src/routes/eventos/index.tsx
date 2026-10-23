import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link, type DocumentHead } from "@builder.io/qwik-city";
import { LuArrowRight, LuCalendar, LuCalendarPlus, LuDownload, LuExternalLink, LuMapPin } from "@qwikest/icons/lucide";
import { SectionHeading } from "~/components/section-heading/section-heading";
import { getAgenda, type ClubEvent } from "~/server/club-content";
import { CLUB } from "~/utils/club";
import {
  eventIcsDataUri,
  eventKindLabel,
  eventMapsUrl,
  formatEventDate,
  formatEventParts,
  googleCalendarUrl,
} from "~/utils/club-content";

interface AgendaItem extends ClubEvent {
  googleCalendar: string | null;
  icsHref: string | null;
}

// Only plain web links become an "Inscribirme" button.
const safeExternalUrl = (url: string | null | undefined) => (url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null);

export const useEventsLoader = routeLoader$(async (event) => {
  try {
    const { upcoming, past } = await getAgenda(event);
    const now = new Date();
    return {
      upcoming: upcoming.map<AgendaItem>((item) => ({
        ...item,
        registrationUrl: safeExternalUrl(item.registrationUrl),
        googleCalendar: googleCalendarUrl(item),
        icsHref: eventIcsDataUri(item, now),
      })),
      past,
    };
  } catch (err) {
    console.error("Failed to load events:", err);
    return { upcoming: [] as AgendaItem[], past: [] as ClubEvent[] };
  }
});

const icsFileName = (title: string) =>
  `${title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "evento"}.ics`;

const EventCard = component$<{ eventItem: AgendaItem; expanded: boolean }>(({ eventItem, expanded }) => {
  const { weekday, time } = formatEventParts(eventItem.date);
  const kind = eventKindLabel(eventItem.kind);
  const titleId = `event-${eventItem.id}-title`;
  return (
    <article aria-labelledby={titleId} class="grid border border-line bg-surface md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div class="relative aspect-[16/9] bg-secondary md:aspect-auto md:min-h-72">
        {eventItem.image ? (
          <img src={eventItem.image} alt="" width={640} height={360} loading="lazy" class="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div class="absolute inset-0 flex items-center justify-center">
            <img src="/lprc.avif" alt="" width={120} height={101} class="w-24 opacity-90" />
          </div>
        )}
        <div class="absolute left-3 top-3 flex flex-wrap gap-2">
          <span class="badge badge-accent">Próximo</span>
          {kind && <span class="badge badge-dark">{kind}</span>}
        </div>
      </div>

      <div class="flex flex-col">
        <div class="flex flex-wrap items-end gap-x-4 gap-y-1 border-b-4 border-accent bg-primary px-5 py-4 text-white sm:px-6">
          <p class="font-display text-3xl font-bold leading-none tracking-wide text-accent sm:text-4xl">
            <time dateTime={eventItem.date}>{formatEventDate(eventItem.date)}</time>
          </p>
          <p class="eyebrow pb-0.5 text-slate-200">
            {weekday} · {time} hs
          </p>
        </div>

        <div class="flex flex-grow flex-col gap-4 p-5 sm:p-6">
          <h3 id={titleId} class="heading-display text-2xl text-primary sm:text-3xl">
            {eventItem.title}
          </h3>
          <a
            href={eventMapsUrl(eventItem.location, CLUB.mapsUrl)}
            target="_blank"
            rel="noopener"
            class="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-primary"
          >
            <LuMapPin class="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {eventItem.location}
            <span class="sr-only"> (ver en el mapa, abre en una pestaña nueva)</span>
          </a>

          <details open={expanded} class="group border-t border-line pt-3">
            <summary class="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
              <span class="group-open:hidden">Ver detalles</span>
              <span class="hidden group-open:inline">Ocultar detalles</span>
              <LuArrowRight class="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden="true" />
            </summary>
            <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600 sm:text-base">{eventItem.description}</p>
          </details>

          <div class="mt-auto flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:flex-wrap sm:items-center">
            {eventItem.registrationUrl && (
              <a href={eventItem.registrationUrl} target="_blank" rel="noopener" class="btn btn-primary">
                Inscribirme
                <LuExternalLink class="h-4 w-4" aria-hidden="true" />
                <span class="sr-only"> (abre en una pestaña nueva)</span>
              </a>
            )}
            {eventItem.googleCalendar && (
              <a href={eventItem.googleCalendar} target="_blank" rel="noopener" class="btn btn-outline btn-sm">
                <LuCalendarPlus class="h-4 w-4" aria-hidden="true" />
                Google Calendar
                <span class="sr-only"> (agregar «{eventItem.title}», abre en una pestaña nueva)</span>
              </a>
            )}
            {eventItem.icsHref && (
              <a href={eventItem.icsHref} download={icsFileName(eventItem.title)} class="btn btn-outline btn-sm">
                <LuDownload class="h-4 w-4" aria-hidden="true" />
                Calendario (.ics)
                <span class="sr-only"> para Apple, Outlook y otros: «{eventItem.title}»</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
});

const AgendaLinkBand = component$<{ hasEvents: boolean }>(({ hasEvents }) => (
  <section aria-labelledby="club-agenda-title" class="flex flex-col gap-6 border-l-4 border-accent bg-primary px-6 py-8 text-white sm:px-10 md:flex-row md:items-center md:justify-between">
    <div>
      <p class="eyebrow text-accent">lprc.com.ar</p>
      <h2 id="club-agenda-title" class="heading-display mt-2 text-2xl sm:text-3xl">
        {hasEvents ? "Toda la agenda del club" : "La agenda completa está en el sitio del club"}
      </h2>
      <p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
        Partidos, fixture y todas las actividades de {CLUB.name}, en el sitio oficial.
      </p>
    </div>
    <a href={CLUB.agendaUrl} target="_blank" rel="noopener" class="btn btn-primary shrink-0">
      Ver la agenda del club en lprc.com.ar
      <LuExternalLink class="h-4 w-4" aria-hidden="true" />
      <span class="sr-only"> (abre en una pestaña nueva)</span>
    </a>
  </section>
));

export default component$(() => {
  const agenda = useEventsLoader();
  const { upcoming, past } = agenda.value;

  return (
    <div class="bg-background">
      <section class="border-b-4 border-accent bg-primary text-white">
        <div class="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
          <SectionHeading as="h1" tone="dark" size="xl" eyebrow="Torneos, clínicas y encuentros" title="Agenda del club">
            <p class="mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Las actividades que el club publica en el portal. Agendalas en tu calendario y, si piden inscripción, anotate desde acá.
            </p>
          </SectionHeading>
        </div>
      </section>

      <div class="mx-auto max-w-5xl space-y-14 px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <section aria-labelledby="upcoming-events-title" class="space-y-6">
          <h2 id="upcoming-events-title" class="sr-only">
            Próximas actividades
          </h2>
          {upcoming.length === 0 ? (
            <div class="border border-line bg-surface p-8 sm:p-10">
              <LuCalendar class="h-10 w-10 text-primary" aria-hidden="true" />
              <p class="heading-display mt-4 text-2xl text-primary">Por ahora no hay actividades en el portal</p>
              <p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                Cuando el club publique torneos, clínicas o encuentros, los vas a ver acá. La agenda completa, con partidos y fixture, ya está en el sitio del club.
              </p>
              <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href={CLUB.agendaUrl} target="_blank" rel="noopener" class="btn btn-primary">
                  Ver la agenda del club en lprc.com.ar
                  <LuExternalLink class="h-4 w-4" aria-hidden="true" />
                  <span class="sr-only"> (abre en una pestaña nueva)</span>
                </a>
                <Link href="/beneficios/" class="btn btn-outline">
                  Mirá los beneficios
                </Link>
              </div>
            </div>
          ) : (
            upcoming.map((eventItem) => <EventCard key={eventItem.id} eventItem={eventItem} expanded={upcoming.length === 1} />)
          )}
        </section>

        {upcoming.length > 0 && <AgendaLinkBand hasEvents />}

        {past.length > 0 && (
          <section aria-labelledby="past-events-title" class="space-y-6">
            <SectionHeading id="past-events-title" eyebrow="Ya pasaron" title="Momentos del club" size="md" />
            <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {past.map((eventItem) => (
                <li key={eventItem.id} class="border border-line bg-surface">
                  <div class="relative aspect-[4/3] bg-secondary">
                    {eventItem.image ? (
                      <img src={eventItem.image} alt="" width={320} height={240} loading="lazy" class="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div class="absolute inset-0 flex items-center justify-center">
                        <img src="/lprc.avif" alt="" width={120} height={101} loading="lazy" class="w-14 opacity-80" />
                      </div>
                    )}
                  </div>
                  <div class="p-3">
                    <p class="text-xs font-semibold text-slate-600">
                      <time dateTime={eventItem.date}>{formatEventDate(eventItem.date)}</time>
                    </p>
                    <h3 class="heading-display mt-1 text-sm leading-snug text-primary sm:text-base">{eventItem.title}</h3>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Agenda del club - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content: "Torneos, clínicas y encuentros de La Plata Rugby Club: fechas, lugar, inscripción y cómo agendarlos en tu calendario.",
    },
  ],
};
