import { component$, useSignal } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: "¿Quiénes pueden utilizar los beneficios del portal?",
    answer: "Todos los médicos agremiados activos en la Agremiación Médica Platense, así como los empleados de la institución y sus respectivos grupos familiares directos."
  },
  {
    question: "¿Es necesario imprimir algún cupón?",
    answer: "No, en absoluto. Toda la cartilla funciona de manera digital. Solo tenés que mostrar tu credencial digital activa desde la app oficial MI AMEPLA o tu DNI para acreditar tu condición al momento de la compra."
  },
  {
    question: "¿Los descuentos son acumulables con otras promociones?",
    answer: "Por lo general, los descuentos no se acumulan con otras promociones vigentes en el comercio, a menos que el detalle del beneficio especifique lo contrario (como en el caso de NINI Mayorista)."
  },
  {
    question: "¿Qué hago si un comercio no quiere aplicar el descuento?",
    answer: "Podés reportar la situación de inmediato a través de nuestra sección de Sugerencias en esta web, detallando el nombre del comercio y el día del inconveniente. Nos comunicaremos con el local a la brevedad."
  },
  {
    question: "¿Cómo puedo sumar mi comercio al club de beneficios?",
    answer: "Si tenés un local o servicio y querés ofrecer descuentos a la comunidad médica platense, completá el formulario en la pestaña de Sugerencias con la opción 'Sugerir Comercio'. Nos pondremos en contacto con vos para coordinar el convenio."
  }
];

export default component$((() => {
  const activeFaqIdx = useSignal<number | null>(null);

  const steps = [
    {
      num: "01",
      title: "Descargá MI AMEPLA",
      desc: "Instalá la aplicación oficial de la AMP desde Google Play Store o Apple App Store en tu dispositivo móvil e iniciá sesión con tus credenciales habituales.",
      icon: (
        <svg class="w-6 h-6 text-brand-green-light" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        </svg>
      )
    },
    {
      num: "02",
      title: "Explorá la Cartilla",
      desc: "Filtrá los más de 250 comercios del portal por categoría, descuento o ubicación. Podés buscar desde hoteles en Bariloche hasta locales gastronómicos en La Plata.",
      icon: (
        <svg class="w-6 h-6 text-brand-green-light" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    {
      num: "03",
      title: "Acreditá tu Condición",
      desc: "Al momento del pago en el comercio, abrí la app MI AMEPLA y presentá tu credencial digital médica en pantalla, o informá tu DNI para verificar tu afiliación.",
      icon: (
        <svg class="w-6 h-6 text-brand-green-light" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h3.75v3.75H5.25V7.5z" />
        </svg>
      )
    },
    {
      num: "04",
      title: "Disfrutá del Ahorro",
      desc: "El comercio aplicará el descuento correspondiente sobre el total de tu factura. ¡Así de fácil! Ahorrá en indumentaria, turismo, servicios y más.",
      icon: (
        <svg class="w-6 h-6 text-brand-green-light" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125H3.75a1.125 1.125 0 01-1.125-1.125V5.625C2.625 5.004 3.129 4.5 3.75 4.5zM9 10.5h.008v.008H9V10.5zm3 0h.008v.008H12V10.5z" />
        </svg>
      )
    }
  ];

  return (
    <div class="relative min-h-screen py-16 bg-slate-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        
        {/* 1. Header Banner */}
        <section class="text-center space-y-4 max-w-2xl mx-auto">
          <span class="inline-flex items-center px-3.5 py-1.5 rounded-full text-[11px] font-extrabold bg-brand-gold/15 text-brand-gold border border-brand-gold/25 uppercase tracking-widest">
            Guía Práctica
          </span>
          <h1 class="text-3xl sm:text-5xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
            ¿Cómo Funciona el Portal?
          </h1>
          <p class="text-slate-500 text-sm sm:text-base leading-relaxed">
            Ahorrar con el club de beneficios de la Agremiación Médica Platense es muy simple. Seguí estos 4 pasos básicos.
          </p>
        </section>

        {/* 2. Infographic Steps Grid */}
        <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, idx) => (
            <div
              key={idx}
              class="group relative glass-card border rounded-2xl p-6 bg-white shadow-sm flex flex-col justify-between space-y-6 pt-10"
            >
              {/* Floating step number bubble */}
              <div class="absolute -top-5 left-6 w-11 h-11 rounded-full bg-brand-green-dark text-brand-gold border-2 border-white flex items-center justify-center font-display font-black text-sm shadow-md group-hover:scale-110 transition-transform">
                {step.num}
              </div>

              <div class="space-y-3">
                <div class="w-12 h-12 rounded-xl bg-brand-green-light/5 border border-brand-green-light/10 flex items-center justify-center">
                  {step.icon}
                </div>
                <h3 class="text-base font-display font-extrabold text-brand-green-dark">
                  {step.title}
                </h3>
                <p class="text-xs text-slate-500 leading-relaxed">
                  {step.desc}
                </p>
              </div>

              <div class="pt-4 border-t border-slate-100 flex items-center text-[10px] font-extrabold uppercase tracking-widest text-brand-gold-dark">
                Paso Completado
              </div>
            </div>
          ))}
        </section>

        {/* 3. Call to Action panel */}
        <section class="p-8 sm:p-12 rounded-3xl bg-brand-green text-white shadow-lg border border-brand-gold/20 relative overflow-hidden">
          {/* Backdrop details */}
          <div class="absolute right-0 top-0 w-80 h-full bg-brand-green-dark/40 skew-x-12 z-0" />
          
          <div class="relative grid grid-cols-1 lg:grid-cols-3 gap-8 items-center z-10">
            <div class="lg:col-span-2 space-y-3">
              <h2 class="text-2xl sm:text-3xl font-display font-extrabold text-white">
                ¿Todavía no tenés la app MI AMEPLA?
              </h2>
              <p class="text-slate-200 text-sm leading-relaxed max-w-xl">
                Descargala gratis hoy mismo y llevá tu credencial digital médica a todos lados. Accedé a autorizaciones, cartilla de prestadores, noticias y todos los beneficios al instante.
              </p>
            </div>
            <div class="flex flex-wrap gap-3.5 lg:justify-end">
              <a
                href="https://play.google.com/store/apps/details?id=ar.org.amepla.miamepla"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center space-x-2 py-3 px-5 rounded-xl bg-white text-brand-green-dark hover:bg-slate-50 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md cursor-pointer"
              >
                <span>Google Play</span>
              </a>
              <a
                href="https://apps.apple.com/ar/app/mi-amepla/id1527712398"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center space-x-2 py-3 px-5 rounded-xl bg-white text-brand-green-dark hover:bg-slate-50 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-md cursor-pointer"
              >
                <span>App Store</span>
              </a>
            </div>
          </div>
        </section>

        {/* 4. Interactive Accordion FAQ Section */}
        <section class="max-w-3xl mx-auto space-y-6">
          <div class="text-center space-y-2">
            <h2 class="text-2xl sm:text-3xl font-display font-extrabold text-brand-green-dark">
              Preguntas Frecuentes
            </h2>
            <p class="text-slate-500 text-xs sm:text-sm">
              Despejá tus dudas operativas de forma rápida.
            </p>
          </div>

          <div class="space-y-4">
            {FAQS.map((faq, idx) => {
              const isOpen = activeFaqIdx.value === idx;
              return (
                <div
                  key={idx}
                  class="glass-card border rounded-2xl overflow-hidden shadow-sm bg-white"
                >
                  <button
                    onClick$={() => (activeFaqIdx.value = isOpen ? null : idx)}
                    class="w-full flex items-center justify-between p-5 text-left font-display font-bold text-sm sm:text-base text-brand-green-dark focus:outline-none cursor-pointer hover:bg-slate-50/50"
                  >
                    <span>{faq.question}</span>
                    <svg
                      class={`w-5 h-5 text-brand-gold transform transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  <div
                    class={`transition-all duration-300 overflow-hidden ${
                      isOpen ? "max-h-48 opacity-100 border-t border-slate-100" : "max-h-0 opacity-0"
                    }`}
                  >
                    <p class="p-5 text-xs sm:text-sm text-slate-500 leading-relaxed bg-slate-50/20">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}));

export const head: DocumentHead = {
  title: "Cómo Funciona - Club de Beneficios AMP",
  meta: [
    {
      name: "description",
      content: "Ahorrá con el club de beneficios médicos en 4 simples pasos. Guía de acreditación con credencial digital y preguntas frecuentes."
    }
  ]
};
