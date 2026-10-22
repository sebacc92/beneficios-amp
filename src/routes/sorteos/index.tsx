import { component$, useSignal } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";

interface Raffle {
  id: number;
  title: string;
  description: string;
  image: string;
  status: "active" | "past";
  drawDate: string;
  prizeDetail: string;
  winner?: string;
  terms: string;
}

const RAFFLES: Raffle[] = [
  {
    id: 1,
    title: "Sorteo Especial de Invierno",
    description: "Participá por una estadía de 3 noches para 2 personas con desayuno incluido en Finca Los Cauquenes, Chascomús. Disfrutá de la paz de la laguna en un entorno premium.",
    image: "https://beneficios.lprc.ar/images/slider/23-PHOTO-2026-05-05-16-00-15.jpg",
    status: "active",
    drawDate: "2026-07-15",
    prizeDetail: "3 noches en Finca Los Cauquenes",
    terms: "Participan automáticamente todos los socios activos al día 30/06/2026. No requiere inscripción previa. El sorteo se realizará ante escribano público en la sede del club en Gonnet y será transmitido en vivo por nuestro canal oficial de YouTube."
  },
  {
    id: 2,
    title: "Sorteo Aniversario del Club",
    description: "Queremos premiar tu dedicación constante. Sorteamos 5 vouchers de compras de $150.000 cada uno para ser utilizados en NINI Mayorista La Plata.",
    image: "https://beneficios.lprc.ar/images/slider/26-0e3e1eaa-1394-4eed-a06e-da739f49e404.jpg",
    status: "active",
    drawDate: "2026-12-03",
    prizeDetail: "5 Vouchers de $150.000 en NINI",
    terms: "Válido para socios activos de LPRC. Cada socio participa con su número de socio. Los ganadores serán contactados telefónicamente y publicados en este portal y redes sociales."
  },
  {
    id: 3,
    title: "Sorteo Especial de Pascua",
    description: "Celebrá Pascua con un set premium de Chocolates Artesanales de la Patagonia y un almuerzo completo para la familia en Restaurante Mercado 55.",
    image: "https://beneficios.lprc.ar/images/slider/24-23-930289de-f986-4060-b33c-2858b5b7ddef.jpg",
    status: "past",
    drawDate: "2026-04-12",
    prizeDetail: "Canasta de Chocolates + Almuerzo en M55",
    winner: "Laura Silvana Fontana (Socio N° 3847)",
    terms: "Finalizado. El sorteo se realizó mediante bolillero digital el día 12/04/2026."
  },
  {
    id: 4,
    title: "Sorteo Fin de Año",
    description: "Despedimos el año a lo grande. Sorteamos un fin de semana completo de Relax, Estética y Spa en Pausa La Plata para recargar energías.",
    image: "https://beneficios.lprc.ar/images/slider/27-PHOTO-2025-11-03-12-09-52.jpg",
    status: "past",
    drawDate: "2025-12-28",
    prizeDetail: "Día de Spa Completo en Pausa",
    winner: "Esteban Gabriel Ramos (Socio N° 2915)",
    terms: "Finalizado. Entregado en la sede del club en Gonnet el día 30/12/2025."
  }
];

export default component$(() => {
  const selectedTerms = useSignal<string | null>(null);

  const activeRaffles = RAFFLES.filter(r => r.status === "active");
  const pastRaffles = RAFFLES.filter(r => r.status === "past");

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

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

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            {activeRaffles.map((raffle) => (
              <div
                key={raffle.id}
                class="group flex flex-col glass-card rounded-3xl overflow-hidden"
              >
                {/* Image */}
                <div class="relative h-56 bg-primary overflow-hidden">
                  <img
                    src={raffle.image}
                    alt={raffle.title}
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    width={600}
                    height={224}
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent" />
                  
                  {/* Floating Date Badge */}
                  <div class="absolute top-4 left-4">
                    <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-extrabold bg-accent text-primary shadow-md tracking-wider uppercase border border-accent/50">
                      Sortea: {formatDate(raffle.drawDate)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div class="p-6 sm:p-8 flex-grow flex flex-col justify-between space-y-6">
                  <div class="space-y-3">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-accent/10 text-accent border border-accent/20 uppercase tracking-widest">
                      Inscripción Automática
                    </span>
                    <h3 class="text-xl font-display font-extrabold text-white leading-snug">
                      {raffle.title}
                    </h3>
                    <p class="text-xs sm:text-sm text-slate-400 leading-relaxed">
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
                        onClick$={() => (selectedTerms.value = raffle.terms)}
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
                  <img
                    src={raffle.image}
                    alt={raffle.title}
                    class="w-full h-full object-cover filter grayscale opacity-50"
                    width={176}
                    height={160}
                  />
                  <div class="absolute inset-0 bg-primary/30" />
                </div>

                {/* Content */}
                <div class="p-5 flex-grow flex flex-col justify-between space-y-3">
                  <div class="space-y-1">
                    <div class="flex items-center justify-between">
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-bold bg-secondary/60 text-slate-400 border border-secondary uppercase tracking-widest">
                        Finalizado
                      </span>
                      <span class="text-[10px] font-semibold text-slate-500">
                        {formatDate(raffle.drawDate)}
                      </span>
                    </div>
                    <h4 class="text-sm sm:text-base font-display font-extrabold text-white leading-snug">
                      {raffle.title}
                    </h4>
                  </div>

                  {/* Winner Display Badge */}
                  <div class="bg-accent/10 border border-accent/20 p-2.5 rounded-xl flex items-center space-x-2 text-[10px] sm:text-xs">
                    <span class="text-accent font-bold uppercase tracking-wider">Ganador/a:</span>
                    <span class="font-extrabold text-white">{raffle.winner}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Terms Popup Modal Dialog Overlay */}
        {selectedTerms.value && (
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div class="w-full max-w-lg bg-primary rounded-3xl border border-secondary shadow-2xl p-6 sm:p-8 space-y-6 animate-scale-in">
              <div class="flex items-center justify-between border-b border-secondary pb-3">
                <h3 class="text-lg font-display font-extrabold text-accent uppercase tracking-wide">
                  Bases y Condiciones
                </h3>
                <button
                  onClick$={() => (selectedTerms.value = null)}
                  class="text-slate-400 hover:text-white font-extrabold text-2xl cursor-pointer transition-colors"
                >
                  &times;
                </button>
              </div>
              <p class="text-xs sm:text-sm text-slate-400 leading-relaxed pr-2">
                {selectedTerms.value}
              </p>
              <div class="pt-4 border-t border-secondary flex justify-end">
                <button
                  onClick$={() => (selectedTerms.value = null)}
                  class="py-3 px-6 rounded-xl bg-accent hover:bg-accent-hover text-primary text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md cursor-pointer"
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
  title: "Sorteos Exclusivos - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content: "Participá de sorteos increíbles con tu credencial digital LPRC. Estadías en hoteles, vouchers de compra y experiencias premium."
    }
  ]
};
