import { component$, useSignal } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { asc } from "drizzle-orm";
import { getDB } from "~/db";
import { raffles as rafflesTable } from "~/db/schema";
import { ensureRafflesTable } from "~/server/cache";
import { sanitizeRichText } from "~/utils/sanitize-html";
import { RaffleCountdown } from "~/components/raffle-countdown/raffle-countdown";

type RafflePrize = { prize: string; winner: string };

export const useRafflesLoader = routeLoader$(async (event) => {
  try {
    const db = getDB(event);
    await ensureRafflesTable(db);
    const rows = await db.select().from(rafflesTable).orderBy(asc(rafflesTable.orderIndex));
    return rows.map((r) => {
      let prizesList: RafflePrize[] = [];
      try {
        const parsed = JSON.parse(r.prizes || "[]");
        if (Array.isArray(parsed)) {
          prizesList = parsed
            .map((p: any) =>
              typeof p === "string" ? { prize: p, winner: "" } : { prize: String(p?.prize || ""), winner: String(p?.winner || "") }
            )
            .filter((p) => p.prize.trim());
        }
      } catch { /* queda vacío */ }
      return { ...r, prizesList };
    });
  } catch (err) {
    console.error("Failed to load raffles:", err);
    return [];
  }
});

export default component$(() => {
  const rafflesLoader = useRafflesLoader();
  const selectedTerms = useSignal<string | null>(null);

  const activeRaffles = rafflesLoader.value.filter((r) => r.isActive === 1);
  const pastRaffles = rafflesLoader.value.filter((r) => r.isActive !== 1);

  const formatDate = (dateStr: string) => {
    const parts = (dateStr || "").split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div class="relative min-h-screen py-16 bg-slate-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

        {/* 1. Header Section */}
        <section class="text-center space-y-4 max-w-2xl mx-auto">
          <span class="inline-flex items-center px-3.5 py-1.5 rounded-full text-[11px] font-extrabold bg-brand-gold/15 text-brand-gold border border-brand-gold/25 uppercase tracking-widest animate-pulse-slow">
            Exclusivo Afiliados
          </span>
          <h1 class="text-3xl sm:text-5xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            Sorteos & Promociones
          </h1>
          <p class="text-slate-500 text-sm sm:text-base leading-relaxed">
            Tu credencial médica digital AMP+ es también tu pase para sorteos increíbles a lo largo de todo el año. ¡Descubrí los sorteos activos!
          </p>
        </section>

        {activeRaffles.length === 0 && pastRaffles.length === 0 && (
          <section class="text-center py-16 text-slate-400 font-semibold text-sm">
            Por el momento no hay sorteos publicados. ¡Volvé a visitarnos pronto!
          </section>
        )}

        {/* 2. Active Raffles Section */}
        {activeRaffles.length > 0 && (
          <section class="space-y-8">
            <h2 class="text-xl sm:text-2xl font-display font-extrabold text-brand-green-dark border-l-4 border-brand-gold pl-3">
              Sorteos Vigentes
            </h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              {activeRaffles.map((raffle) => (
                <div
                  key={raffle.id}
                  class="group flex flex-col glass-card border rounded-3xl overflow-hidden shadow-md bg-white"
                >
                  {/* Image */}
                  <div class="relative h-56 bg-brand-green-dark overflow-hidden border-b border-slate-100">
                    <picture>
                      {raffle.imageMobile && <source media="(max-width: 640px)" srcset={raffle.imageMobile} />}
                      <img
                        src={raffle.imageUrl}
                        alt={raffle.title}
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        width={600}
                        height={224}
                      />
                    </picture>
                    <div class="absolute inset-0 bg-gradient-to-t from-brand-green-dark/80 via-transparent to-transparent" />

                    {/* Floating Date Badge */}
                    <div class="absolute top-4 left-4">
                      <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-extrabold bg-brand-gold text-brand-green-dark shadow-md tracking-wider uppercase border border-brand-gold">
                        Sortea: {formatDate(raffle.drawDate)}
                      </span>
                    </div>
                  </div>

                  {/* Countdown Bar */}
                  <div class="flex items-center justify-between gap-3 bg-brand-green-dark px-4 sm:px-6 py-3">
                    <span class="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-white/70 flex-shrink-0">
                      Sortea en
                    </span>
                    <RaffleCountdown drawDate={raffle.drawDate} />
                  </div>

                  {/* Content */}
                  <div class="p-6 sm:p-8 flex-grow flex flex-col justify-between space-y-6">
                    <div class="space-y-3">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase tracking-widest">
                        Inscripción Automática
                      </span>
                      <h3 class="text-xl font-display font-extrabold text-brand-green-dark leading-snug">
                        {raffle.title}
                      </h3>
                      <div
                        dangerouslySetInnerHTML={sanitizeRichText(raffle.description)}
                        class="text-xs sm:text-sm text-slate-500 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-brand-green [&_a]:underline"
                      />
                    </div>

                    {/* Highlights & Actions */}
                    <div class="pt-6 border-t border-slate-100 space-y-4">
                      {raffle.prizesList.length > 0 && (
                        <div class="text-xs font-bold text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                          <span class="block text-[9px] uppercase tracking-widest text-slate-400 font-black">
                            {raffle.prizesList.length > 1 ? "Premios" : "Premio"}
                          </span>
                          <ul class="space-y-1.5">
                            {raffle.prizesList.map((prize, i) => (
                              <li key={i} class="flex items-start gap-1.5">
                                <span class="mt-px">🎁</span>
                                <span class="text-brand-green-light">
                                  {prize.prize}
                                  {prize.winner && (
                                    <span class="block text-emerald-700 font-black normal-case">
                                      Ganador/a: {prize.winner}
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {raffle.terms && (
                        <div class="flex items-center gap-3">
                          <button
                            onClick$={() => (selectedTerms.value = raffle.terms)}
                            class="flex-grow py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shadow-sm hover:shadow-md transition-all active:scale-95 text-center cursor-pointer"
                          >
                            Bases y Condiciones
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. Past Raffles Section */}
        {pastRaffles.length > 0 && (
          <section class="space-y-8">
            <h2 class="text-xl sm:text-2xl font-display font-extrabold text-brand-green-dark border-l-4 border-slate-300 pl-3">
              Sorteos Anteriores
            </h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pastRaffles.map((raffle) => (
                <div
                  key={raffle.id}
                  class="flex flex-col sm:flex-row glass-card border rounded-2xl overflow-hidden shadow-sm bg-white"
                >
                  {/* Side Image */}
                  <div class="relative w-full sm:w-44 h-40 bg-brand-green-dark flex-shrink-0">
                    <img
                      src={raffle.imageUrl}
                      alt={raffle.title}
                      class="w-full h-full object-cover filter grayscale opacity-75"
                      width={176}
                      height={160}
                    />
                    <div class="absolute inset-0 bg-black/10" />
                  </div>

                  {/* Content */}
                  <div class="p-5 flex-grow flex flex-col justify-between space-y-3">
                    <div class="space-y-1">
                      <div class="flex items-center justify-between">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-bold bg-slate-100 text-slate-400 border border-slate-200 uppercase tracking-widest">
                          Finalizado
                        </span>
                        <span class="text-[10px] font-semibold text-slate-400">
                          {formatDate(raffle.drawDate)}
                        </span>
                      </div>
                      <h4 class="text-sm sm:text-base font-display font-extrabold text-slate-700 leading-snug">
                        {raffle.title}
                      </h4>
                    </div>

                    {/* Winners Display: uno por premio */}
                    {raffle.prizesList.some((p) => p.winner) && (
                      <div class="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl space-y-1 text-[10px] sm:text-xs">
                        {raffle.prizesList.filter((p) => p.winner).map((p, i) => (
                          <div key={i} class="flex items-start gap-1.5">
                            <span class="text-emerald-500 font-bold uppercase tracking-wider flex-shrink-0">
                              {raffle.prizesList.length > 1 ? `${p.prize}:` : "Ganador/a:"}
                            </span>
                            <span class="font-extrabold text-brand-green-dark">{p.winner}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 4. Terms Popup Modal Dialog Overlay */}
        {selectedTerms.value && (
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div class="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 animate-scale-in">
              <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 class="text-lg font-display font-extrabold text-brand-green-dark uppercase tracking-wide">
                  Bases y Condiciones
                </h3>
                <button
                  onClick$={() => (selectedTerms.value = null)}
                  class="text-slate-400 hover:text-brand-green font-extrabold text-2xl cursor-pointer"
                >
                  &times;
                </button>
              </div>
              <p class="text-xs sm:text-sm text-slate-500 leading-relaxed pr-2">
                {selectedTerms.value}
              </p>
              <div class="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick$={() => (selectedTerms.value = null)}
                  class="py-3 px-6 rounded-xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Sorteos Exclusivos - Club de Beneficios AMP",
  meta: [
    {
      name: "description",
      content: "Participá de sorteos increíbles con tu credencial médica digital AMP+. Estadías en hoteles, vouchers de compra y experiencias premium."
    }
  ]
};
