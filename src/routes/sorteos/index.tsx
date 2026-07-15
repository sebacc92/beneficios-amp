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
    image: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/23-PHOTO-2026-05-05-16-00-15.jpg",
    status: "active",
    drawDate: "2026-07-15",
    prizeDetail: "3 noches en Finca Los Cauquenes",
    terms: "Participan automáticamente todos los médicos agremiados activos al día 30/06/2026. No requiere inscripción previa. El sorteo se realizará ante escribano público en la sede central de la AMP y será transmitido en vivo por nuestro canal oficial de YouTube."
  },
  {
    id: 2,
    title: "Sorteo Día del Médico",
    description: "Queremos premiar tu dedicación constante. Sorteamos 5 vouchers de compras de $150.000 cada uno para ser utilizados en NINI Mayorista La Plata.",
    image: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/26-0e3e1eaa-1394-4eed-a06e-da739f49e404.jpg",
    status: "active",
    drawDate: "2026-12-03",
    prizeDetail: "5 Vouchers de $150.000 en NINI",
    terms: "Válido para médicos agremiados y empleados de la AMP. Cada afiliado participa con su número de matrícula médica o legajo. Los ganadores serán contactados telefónicamente y publicados en este portal y redes sociales."
  },
  {
    id: 3,
    title: "Sorteo Especial de Pascua",
    description: "Celebrá Pascua con un set premium de Chocolates Artesanales de la Patagonia y un almuerzo completo para la familia en Restaurante Mercado 55.",
    image: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/24-23-930289de-f986-4060-b33c-2858b5b7ddef.jpg",
    status: "past",
    drawDate: "2026-04-12",
    prizeDetail: "Canasta de Chocolates + Almuerzo en M55",
    winner: "Dra. Laura Silvana Fontana (Mat. 119854)",
    terms: "Finalizado. El sorteo se realizó mediante bolillero digital el día 12/04/2026."
  },
  {
    id: 4,
    title: "Sorteo Fin de Año",
    description: "Despedimos el año a lo grande. Sorteamos un fin de semana completo de Relax, Estética y Spa en Pausa La Plata para recargar energías.",
    image: "https://lzvshzkth0usbwli.public.blob.vercel-storage.com/27-PHOTO-2025-11-03-12-09-52.jpg",
    status: "past",
    drawDate: "2025-12-28",
    prizeDetail: "Día de Spa Completo en Pausa",
    winner: "Dr. Esteban Gabriel Ramos (Mat. 113429)",
    terms: "Finalizado. Entregado en la sede central de la AMP el día 30/12/2025."
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

        {/* 2. Active Raffles Section */}
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
                  <img
                    src={raffle.image}
                    alt={raffle.title}
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    width={600}
                    height={224}
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-brand-green-dark/80 via-transparent to-transparent" />
                  
                  {/* Floating Date Badge */}
                  <div class="absolute top-4 left-4">
                    <span class="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-extrabold bg-brand-gold text-brand-green-dark shadow-md tracking-wider uppercase border border-brand-gold">
                      Sortea: {formatDate(raffle.drawDate)}
                    </span>
                  </div>
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
                    <p class="text-xs sm:text-sm text-slate-500 leading-relaxed">
                      {raffle.description}
                    </p>
                  </div>

                  {/* Highlights & Actions */}
                  <div class="pt-6 border-t border-slate-100 space-y-4">
                    <div class="flex items-center justify-between text-xs font-bold text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span>Premio:</span>
                      <span class="text-brand-green-light">{raffle.prizeDetail}</span>
                    </div>

                    <div class="flex items-center gap-3">
                      <button
                        onClick$={() => (selectedTerms.value = raffle.terms)}
                        class="flex-grow py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs shadow-sm hover:shadow-md transition-all active:scale-95 text-center cursor-pointer"
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
                    src={raffle.image}
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

                  {/* Winner Display Badge */}
                  <div class="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl flex items-center space-x-2 text-[10px] sm:text-xs">
                    <span class="text-emerald-500 font-bold uppercase tracking-wider">Ganador/a:</span>
                    <span class="font-extrabold text-brand-green-dark">{raffle.winner}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Terms Popup Modal Dialog Overlay */}
        {selectedTerms.value && (
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div class="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 animate-pulse-slow">
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
