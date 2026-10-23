import { component$, useSignal } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { LuGift, LuX } from "@qwikest/icons/lucide";
import { getRaffleBoard, type Raffle } from "~/server/club-content";
import { formatCalendarDay } from "~/utils/club-content";

export const useRafflesLoader = routeLoader$(async (event) => {
  try {
    return await getRaffleBoard(event);
  } catch (err) {
    console.error("Failed to load raffles:", err);
    return { active: [] as Raffle[], past: [] as Raffle[] };
  }
});

export default component$(() => {
  const board = useRafflesLoader();
  const { active: activeRaffles, past: pastRaffles } = board.value;
  const selectedRaffle = useSignal<Pick<Raffle, "title" | "terms"> | null>(null);
  const termsDialog = useSignal<HTMLDialogElement>();

  return (
    <div class="relative min-h-screen py-16 bg-[#040811]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* 1. Header Section */}
        <section class="text-center space-y-4 max-w-2xl mx-auto">
          <span class="inline-flex items-center px-3.5 py-1.5 rounded-full text-[11px] font-extrabold bg-accent/15 text-accent border border-accent/25 uppercase tracking-widest animate-pulse-slow">
            Exclusivo Socios
          </span>
          <h1 class="text-3xl sm:text-5xl font-display font-extrabold text-white tracking-tight leading-none">
            Sorteos & Promociones
          </h1>
          <p class="text-slate-400 text-sm sm:text-base leading-relaxed">
            Tu credencial digital LPRC es también tu pase para sorteos increíbles a lo largo de todo el año. ¡Descubrí los sorteos activos!
          </p>
        </section>

        {/* 2. Active Raffles Section */}
        <section class="space-y-8">
          <h2 class="text-xl sm:text-2xl font-display font-extrabold text-white border-l-4 border-accent pl-3">
            Sorteos Vigentes
          </h2>

          {activeRaffles.length === 0 && (
            <div class="glass-card rounded-3xl p-10 text-center space-y-3">
              <LuGift class="w-10 h-10 text-accent mx-auto" aria-hidden="true" />
              <p class="text-lg font-display font-extrabold text-white">No hay sorteos vigentes</p>
              <p class="text-sm text-slate-400 max-w-md mx-auto">
                Cuando el club lance un nuevo sorteo lo vas a ver acá. Participás automáticamente con tu credencial de socio.
              </p>
            </div>
          )}

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            {activeRaffles.map((raffle) => (
              <div
                key={raffle.id}
                class="group flex flex-col glass-card rounded-3xl overflow-hidden"
              >
                {/* Image */}
                <div class="relative h-56 bg-primary overflow-hidden">
                  {raffle.image ? (
                    <img
                      src={raffle.image}
                      alt=""
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      width={600}
                      height={224}
                    />
                  ) : (
                    <div class="flex h-full w-full items-center justify-center bg-secondary/40">
                      <LuGift class="w-16 h-16 text-accent/60" aria-hidden="true" />
                    </div>
                  )}
                  <div class="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent" />
                  
                  {/* Floating Date Badge */}
                  <div class="absolute top-4 left-4">
                    <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-extrabold bg-accent text-primary shadow-md tracking-wider uppercase border border-accent/50">
                      Sortea: {formatCalendarDay(raffle.drawDate)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div class="p-6 sm:p-8 flex-grow flex flex-col justify-between space-y-6">
                  <div class="space-y-3">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accent/10 text-accent border border-accent/20 uppercase tracking-widest">
                      Inscripción Automática
                    </span>
                    <h3 class="text-xl font-display font-extrabold text-white leading-snug">
                      {raffle.title}
                    </h3>
                    <p class="text-xs sm:text-sm text-slate-400 leading-relaxed whitespace-pre-line">
                      {raffle.description}
                    </p>
                  </div>

                  {/* Highlights & Actions */}
                  <div class="pt-6 border-t border-secondary space-y-4">
                    <div class="flex items-center justify-between text-xs font-bold text-slate-300 bg-primary/60 p-3 rounded-xl border border-secondary">
                      <span>Premio:</span>
                      <span class="text-accent">{raffle.prizeDetail}</span>
                    </div>

                    <div class="flex items-center gap-3">
                      <button
                        type="button"
                        onClick$={() => {
                          selectedRaffle.value = { title: raffle.title, terms: raffle.terms };
                          termsDialog.value?.showModal();
                        }}
                        class="flex-grow py-3 px-4 rounded-xl bg-secondary/60 hover:bg-secondary text-slate-300 hover:text-white font-bold text-xs shadow-sm hover:shadow-md transition-all active:scale-95 text-center cursor-pointer border border-secondary"
                      >
                        Bases y Condiciones
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Past Raffles Section */}
        {pastRaffles.length > 0 && (
        <section class="space-y-8">
          <h2 class="text-xl sm:text-2xl font-display font-extrabold text-white border-l-4 border-secondary pl-3">
            Sorteos Anteriores
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pastRaffles.map((raffle) => (
              <div
                key={raffle.id}
                class="flex flex-col sm:flex-row rounded-2xl overflow-hidden shadow-sm bg-primary border border-secondary"
              >
                {/* Side Image */}
                <div class="relative w-full sm:w-44 h-40 bg-primary flex-shrink-0">
                  {raffle.image ? (
                    <img
                      src={raffle.image}
                      alt=""
                      class="w-full h-full object-cover filter grayscale opacity-50"
                      width={176}
                      height={160}
                      loading="lazy"
                    />
                  ) : (
                    <div class="flex h-full w-full items-center justify-center bg-secondary/40">
                      <LuGift class="w-10 h-10 text-slate-500" aria-hidden="true" />
                    </div>
                  )}
                  <div class="absolute inset-0 bg-primary/30" />
                </div>

                {/* Content */}
                <div class="p-5 flex-grow flex flex-col justify-between space-y-3">
                  <div class="space-y-1">
                    <div class="flex items-center justify-between">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-secondary/60 text-slate-400 border border-secondary uppercase tracking-widest">
                        Finalizado
                      </span>
                      <span class="text-xs font-semibold text-slate-400">
                        {formatCalendarDay(raffle.drawDate)}
                      </span>
                    </div>
                    <h4 class="text-sm sm:text-base font-display font-extrabold text-white leading-snug">
                      {raffle.title}
                    </h4>
                  </div>

                  {/* Winner Display Badge */}
                  <div class="bg-accent/10 border border-accent/20 p-2.5 rounded-xl flex items-start gap-2 text-xs">
                    <span class="text-accent font-bold uppercase tracking-wider shrink-0">Ganador/es:</span>
                    <span class="font-extrabold text-white whitespace-pre-line">
                      {raffle.winners || "Resultado a confirmar"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* 4. Terms dialog: native <dialog> gives Escape, focus handling and an inert page */}
        <dialog
          ref={termsDialog}
          aria-labelledby="raffle-terms-title"
          onClose$={() => (selectedRaffle.value = null)}
          class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg bg-primary rounded-3xl border border-secondary shadow-2xl p-6 sm:p-8 text-left backdrop:bg-black/70"
        >
          <div class="space-y-6">
            <div class="flex items-start justify-between gap-4 border-b border-secondary pb-3">
              <div>
                <h2 id="raffle-terms-title" class="text-lg font-display font-extrabold text-accent uppercase tracking-wide">
                  Bases y Condiciones
                </h2>
                {selectedRaffle.value && (
                  <p class="text-sm font-bold text-white mt-1">{selectedRaffle.value.title}</p>
                )}
              </div>
              <button
                type="button"
                aria-label="Cerrar bases y condiciones"
                onClick$={() => termsDialog.value?.close()}
                class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-secondary hover:text-white cursor-pointer transition-colors"
              >
                <LuX class="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p class="text-sm text-slate-300 leading-relaxed pr-2 whitespace-pre-line">
              {selectedRaffle.value?.terms}
            </p>
            <div class="pt-4 border-t border-secondary flex justify-end">
              <button
                type="button"
                onClick$={() => termsDialog.value?.close()}
                class="py-3 px-6 rounded-xl bg-accent hover:bg-accent-hover text-primary text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </dialog>

      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Sorteos Exclusivos - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content: "Participá de sorteos increíbles con tu credencial digital LPRC. Estadías en hoteles, vouchers de compra y experiencias premium."
    }
  ]
};
