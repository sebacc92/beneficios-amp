import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link, type DocumentHead } from "@builder.io/qwik-city";
import { LuCalendar, LuMapPin } from "@qwikest/icons/lucide";
import { getAgenda, type ClubEvent } from "~/server/club-content";
import { formatEventParts } from "~/utils/club-content";

export const useEventsLoader = routeLoader$(async (event) => {
  try {
    return await getAgenda(event);
  } catch (err) {
    console.error("Failed to load events:", err);
    return { upcoming: [] as ClubEvent[], past: [] as ClubEvent[] };
  }
});

const EventCard = component$<{ eventItem: ClubEvent; past?: boolean }>(({ eventItem, past }) => {
  const { day, month, weekday, time } = formatEventParts(eventItem.date);
  return (
    <article
      class={[
        "bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm transition-all duration-300 flex flex-col md:flex-row group",
        past ? "opacity-75" : "hover:shadow-md",
      ]}
    >
      {/* Left Calendar Block & Image */}
      <div class="md:w-1/3 relative bg-slate-100 flex flex-col justify-center items-center py-8 px-6 md:py-0 overflow-hidden">
        {eventItem.image ? (
          <img
            src={eventItem.image}
            alt=""
            width={400}
            height={240}
            loading="lazy"
            class={[
              "absolute inset-0 object-cover w-full h-full transition-transform duration-500 opacity-20 md:opacity-40",
              past ? "grayscale" : "group-hover:scale-105",
            ]}
          />
        ) : null}

        {/* Floating Date Badge */}
        <div class="relative z-10 w-20 h-20 bg-brand-navy text-white rounded-2xl flex flex-col items-center justify-center shadow-lg border border-brand-navy-light">
          <span class="text-3xl font-display font-extrabold leading-none">{day}</span>
          <span class="text-xs font-bold tracking-widest leading-none mt-1.5 uppercase text-brand-gold">{month}</span>
        </div>

        <div class="relative z-10 mt-3 text-xs font-bold text-slate-600 capitalize">
          {weekday} · {time} hs
        </div>
      </div>

      {/* Right Content */}
      <div class="p-8 flex flex-col justify-between flex-grow md:w-2/3 space-y-4">
        <div class="space-y-3">
          <h3 class="text-xl sm:text-2xl font-display font-extrabold text-slate-800 leading-tight group-hover:text-brand-navy transition-colors duration-300">
            {eventItem.title}
          </h3>
          <p class="text-slate-600 text-sm sm:text-base leading-relaxed whitespace-pre-line">
            {eventItem.description}
          </p>
          <div class="flex items-center gap-1.5 text-xs font-bold text-slate-500 pt-2">
            <LuMapPin class="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>{eventItem.location}</span>
          </div>
        </div>

        {!past && (
          <div class="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
            <span class="text-slate-500">La Plata Rugby Club</span>
            <Link
              href="/beneficios/"
              class="text-brand-navy hover:text-brand-navy-light flex items-center gap-1 transition-colors"
            >
              Ver Beneficios
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </div>
    </article>
  );
});

export default component$(() => {
  const agenda = useEventsLoader();
  const { upcoming, past } = agenda.value;

  return (
    <div class="bg-slate-50 min-h-screen py-16 px-4 sm:px-6 lg:px-8 font-sans">
      <div class="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div class="text-center space-y-4">
          <div class="inline-flex items-center space-x-1.5 bg-amber-50 text-amber-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-100">
            <LuCalendar class="w-3.5 h-3.5" />
            <span>Agenda Oficial</span>
          </div>
          <h1 class="text-4xl sm:text-5xl font-display font-extrabold text-brand-navy-dark tracking-tight leading-none">
            Eventos & Actividades
          </h1>
          <p class="text-slate-500 max-w-xl mx-auto text-sm sm:text-base font-medium">
            Programá tu agenda y participá de los torneos, clínicas y actividades organizadas por La Plata Rugby Club.
          </p>
        </div>

        {/* Upcoming events */}
        <section aria-labelledby="upcoming-events-title" class="space-y-8">
          <h2 id="upcoming-events-title" class="sr-only">Próximos eventos</h2>
          {upcoming.length === 0 ? (
            <div class="text-center bg-white border border-slate-200 rounded-3xl p-12 shadow-sm space-y-3">
              <LuCalendar class="w-12 h-12 text-slate-400 mx-auto" aria-hidden="true" />
              <div>
                <p class="text-lg font-bold text-slate-800">No hay eventos agendados</p>
                <p class="text-slate-500 text-sm mt-1">
                  Cuando el club publique torneos, clínicas o actividades, los vas a ver acá.
                </p>
              </div>
              <Link href="/beneficios/" class="inline-flex mt-2 text-sm font-bold text-brand-navy hover:text-brand-navy-light">
                Mientras tanto, mirá los beneficios →
              </Link>
            </div>
          ) : (
            upcoming.map((eventItem) => <EventCard key={eventItem.id} eventItem={eventItem} />)
          )}
        </section>

        {past.length > 0 && (
          <details class="group/past space-y-6">
            <summary class="cursor-pointer list-none text-sm font-bold text-slate-600 hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-navy rounded-lg w-fit mx-auto">
              <span class="group-open/past:hidden">Ver eventos anteriores ({past.length})</span>
              <span class="hidden group-open/past:inline">Ocultar eventos anteriores</span>
            </summary>
            <div class="space-y-6 pt-6">
              <h2 class="text-lg font-display font-extrabold text-slate-700">Eventos anteriores</h2>
              {past.map((eventItem) => <EventCard key={eventItem.id} eventItem={eventItem} past />)}
            </div>
          </details>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Eventos & Actividades - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content: "Calendario y agenda de torneos, clínicas, y actividades deportivas de La Plata Rugby Club.",
    },
  ],
};
