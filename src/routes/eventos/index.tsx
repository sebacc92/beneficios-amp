import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link, type DocumentHead } from "@builder.io/qwik-city";
import { asc } from "drizzle-orm";
import { getDB } from "~/db";
import { events as eventsTable } from "~/db/schema";

export interface MedicalEvent {
  id: string;
  title: string;
  description: string;
  date: string; // ISO or string
  location: string;
  image: string | null;
}

export const useEventsLoader = routeLoader$(async (event) => {
  try {
    const db = getDB(event);
    const dbEvents = await db
      .select()
      .from(eventsTable)
      .orderBy(asc(eventsTable.date));

    if (dbEvents.length === 0) {
      // Mock events when DB table is empty
      return [
        {
          id: "event-1",
          title: "XXXVI Jornadas de Capacitación y Actualización Pediátrica",
          description: "Gran encuentro anual de especialistas en pediatría de la provincia de Buenos Aires. En este congreso contaremos con la participación de destacados expositores nacionales e internacionales que abordarán los desafíos actuales en salud infantil, medicina integrativa y neumonología pediátrica.",
          date: "2026-06-15T09:00:00Z",
          location: "Salón Auditorio AMP, Calle 6 Nro 1118, La Plata",
          image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80",
        },
        {
          id: "event-2",
          title: "Taller Práctico de Soporte Vital Cardiovascular Avanzado (ACLS)",
          description: "Curso teórico-práctico de certificación internacional destinado exclusivamente a médicos matriculados agremiados. Cupos estrictamente limitados para asegurar una capacitación intensiva y de excelencia con simuladores de última tecnología médica.",
          date: "2026-06-22T08:30:00Z",
          location: "Centro de Simulación Médica AMP, Calle 5 Nro 820, La Plata",
          image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&auto=format&fit=crop&q=80",
        },
      ] as MedicalEvent[];
    }

    return dbEvents.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      date: e.date,
      location: e.location,
      image: e.image,
    })) as MedicalEvent[];
  } catch (err) {
    console.error("Failed to load events:", err);
    return [];
  }
});

export default component$(() => {
  const events = useEventsLoader();

  return (
    <div class="bg-slate-50 min-h-screen py-16 px-4 sm:px-6 lg:px-8 font-sans">
      <div class="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div class="text-center space-y-4">
          <div class="inline-flex items-center space-x-2 bg-amber-50 text-amber-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-100">
            <span>📅 Agenda Oficial</span>
          </div>
          <h1 class="text-4xl sm:text-5xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Eventos & Conferencias
          </h1>
          <p class="text-slate-500 max-w-xl mx-auto text-sm sm:text-base font-medium">
            Programá tu agenda y participá de las actividades científicas, charlas y seminarios organizados por la Agremiación Médica Platense.
          </p>
        </div>

        {/* Events Grid */}
        <div class="space-y-8">
          {events.value.length === 0 ? (
            <div class="text-center bg-white border border-slate-200 rounded-3xl p-12 shadow-sm">
              <span class="text-4xl">🗓️</span>
              <h3 class="text-lg font-bold text-slate-800 mt-4">No hay eventos agendados</h3>
              <p class="text-slate-500 text-sm mt-1">Próximamente publicaremos el calendario científico completo.</p>
            </div>
          ) : (
            events.value.map((eventItem) => {
              const eventDate = new Date(eventItem.date);
              const day = eventDate.toLocaleDateString("es-AR", { day: "2-digit" });
              const monthName = eventDate.toLocaleDateString("es-AR", { month: "short" }).replace(".", "").toUpperCase();
              
              return (
                <div
                  key={eventItem.id}
                  class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row group"
                >
                  {/* Left Calendar Block & Image */}
                  <div class="md:w-1/3 relative bg-slate-100 flex flex-col justify-center items-center py-8 px-6 md:py-0 overflow-hidden">
                    {eventItem.image ? (
                      <img
                        src={eventItem.image}
                        alt={eventItem.title}
                        width={400}
                        height={240}
                        class="absolute inset-0 object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 opacity-20 md:opacity-40"
                      />
                    ) : null}
                    
                    {/* Floating Date Badge */}
                    <div class="relative z-10 w-20 h-20 bg-brand-green text-white rounded-2xl flex flex-col items-center justify-center shadow-lg border border-brand-green-light">
                      <span class="text-3xl font-display font-extrabold leading-none">{day}</span>
                      <span class="text-[10px] font-bold tracking-widest leading-none mt-1.5 uppercase text-brand-gold">{monthName}</span>
                    </div>
                    
                    <div class="relative z-10 mt-3 text-xs font-bold text-slate-500">
                      {eventDate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} hs
                    </div>
                  </div>

                  {/* Right Content */}
                  <div class="p-8 flex flex-col justify-between flex-grow md:w-2/3 space-y-4">
                    <div class="space-y-3">
                      <h2 class="text-xl sm:text-2xl font-display font-extrabold text-slate-800 leading-tight group-hover:text-brand-green transition-colors duration-300">
                        {eventItem.title}
                      </h2>
                      <p class="text-slate-600 text-sm sm:text-base leading-relaxed">
                        {eventItem.description}
                      </p>
                      <div class="flex items-center gap-2 text-xs font-bold text-slate-500 pt-2">
                        <span>📍</span>
                        <span>{eventItem.location}</span>
                      </div>
                    </div>

                    <div class="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                      <span class="text-slate-400">Certificación Académica AMP</span>
                      <Link
                        href="/"
                        class="text-brand-green hover:text-brand-green-light flex items-center gap-1 transition-colors"
                      >
                        Ver Beneficios
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Eventos & Conferencias - Club de Beneficios AMP",
  meta: [
    {
      name: "description",
      content: "Calendario y agenda de actividades científicas, charlas y jornadas médicas de la Agremiación Médica Platense.",
    },
  ],
};
