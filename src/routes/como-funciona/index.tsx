import { component$, type FunctionComponent } from "@builder.io/qwik";
import { Link, routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { LuArrowRight, LuMessageCircle, LuPlus, LuScanLine, LuStore } from "@qwikest/icons/lucide";
import { HaceteSocio } from "~/components/hacete-socio/hacete-socio";
import { SectionHeading } from "~/components/section-heading/section-heading";
import { CLUB, WHATSAPP_MESSAGES, whatsappLink } from "~/utils/club";

/** Members get "Ver mis cupones"; visitors are invited to log in instead. */
export const useHowItWorksSession = routeLoader$((event) => Boolean(event.sharedMap.get("user")));

interface FAQItem {
  question: string;
  answer: string;
  link?: { href: string; label: string };
  /** The questions members ask the most start expanded. */
  open?: boolean;
}

const FAQS: FAQItem[] = [
  {
    question: "¿Qué hago si mi DNI no está registrado?",
    answer:
      "Probá con o sin puntos y revisá que sea el DNI con el que te asociaste. Si el portal igual no lo reconoce, en la ayuda para ingresar tenés las causas más comunes y cómo escribirnos para que revisemos tu alta.",
    link: { href: "/ayuda-ingreso/", label: "Ver la ayuda para ingresar" },
    open: true,
  },
  {
    question: "¿Dónde encuentro los cupones que ya generé?",
    answer:
      "En tu perfil, dentro de Mis cupones. Desde ahí podés volver a abrir el código y el QR, y ver si el cupón está activo, canjeado o vencido.",
    link: { href: "/perfil/#mis-cupones", label: "Ir a Mis cupones" },
    open: true,
  },
  {
    question: "¿Tengo que imprimir el cupón?",
    answer:
      "No hace falta: podés mostrar el QR o el código desde tu celular. Si preferís llevarlo en papel, también podés imprimirlo desde la página del cupón.",
  },
  {
    question: "¿Puedo usar el mismo cupón más de una vez?",
    answer:
      "Cada código permite un solo canje. Cuando el comercio lo valida, el cupón queda marcado como canjeado y no se puede volver a usar.",
  },
  {
    question: "¿Los descuentos tienen condiciones?",
    answer:
      "Sí. Antes de generar el cupón, revisá la ficha del beneficio: puede tener vigencia, días de uso, requisitos o restricciones. Consultá también si se combina con otras promociones antes de pagar.",
  },
  {
    question: "¿Qué hago si un comercio no aplica el beneficio?",
    answer:
      "Contanos lo que pasó desde el formulario de sugerencias. Indicá el comercio, el beneficio y la fecha para que el equipo del club pueda revisarlo.",
    link: { href: "/sugerencias/?tipo=Problema%20Comercio", label: "Reportar un inconveniente" },
  },
  {
    question: "¿Cómo puedo proponer un comercio?",
    answer:
      "Si sos socio, recomendalo desde el formulario de sugerencias. Si sos el titular, más abajo en «Para comercios» tenés cómo sumarte.",
    link: { href: "/sugerencias/?tipo=Sugerir%20Comercio", label: "Recomendar un comercio" },
  },
];

// A QR-looking pattern for the step 4 illustration: three finder squares plus fixed noise.
const QR_SIZE = 21;
const QR_PATH = (() => {
  const inFinder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= QR_SIZE - 8 && y < 8) || (x < 8 && y >= QR_SIZE - 8);
  let d = "";
  for (const [fx, fy] of [[0, 0], [QR_SIZE - 7, 0], [0, QR_SIZE - 7]]) {
    d += `M${fx} ${fy}h7v7h-7zM${fx + 1} ${fy + 1}v5h5v-5zM${fx + 2} ${fy + 2}h3v3h-3z`;
  }
  for (let y = 0; y < QR_SIZE; y++) {
    for (let x = 0; x < QR_SIZE; x++) {
      if (!inFinder(x, y) && (x * 7 + y * 13 + x * y) % 5 < 2) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
})();

const BenefitMock = () => (
  <div class="w-44 border border-line bg-white shadow-sm">
    <div class="relative h-16 bg-secondary">
      <span class="badge badge-accent absolute left-2 top-2">20% OFF</span>
    </div>
    <div class="space-y-1.5 p-2.5">
      <p class="font-display text-xs font-semibold uppercase tracking-wide text-primary">Comercio adherido</p>
      <span class="block h-1.5 w-28 bg-slate-200" />
      <span class="block h-1.5 w-20 bg-slate-200" />
    </div>
  </div>
);

const DniMock = () => (
  <div class="w-48 space-y-2">
    <p class="text-[11px] font-bold uppercase tracking-wider text-slate-700">DNI</p>
    <div class="border border-primary bg-white px-3 py-2 text-sm text-primary shadow-[0_0_0_3px_rgb(255_215_0/0.55)]">
      12.345.678
    </div>
    <div class="bg-accent py-2 text-center font-display text-[11px] font-semibold uppercase tracking-wider text-primary">
      Obtener mi cupón
    </div>
  </div>
);

const CouponMock = () => (
  <div class="w-48 border-2 border-dashed border-primary bg-white px-3 py-4 text-center">
    <p class="eyebrow text-[10px] text-amber-900">Tu cupón</p>
    <p class="mt-1 font-display text-2xl font-bold tracking-[0.2em] text-primary">7X4K2M</p>
    <p class="mt-1 text-[11px] text-slate-600">Un canje por cupón</p>
  </div>
);

const QrMock = () => (
  <div class="flex items-end gap-3">
    <div class="w-28 border-[5px] border-primary bg-primary">
      <div class="bg-white p-2">
        <svg viewBox={`-1 -1 ${QR_SIZE + 2} ${QR_SIZE + 2}`} class="block h-auto w-full" fill-rule="evenodd">
          <path d={QR_PATH} fill="#0a1128" />
        </svg>
      </div>
      <p class="py-1 text-center font-display text-[9px] font-semibold uppercase tracking-wider text-accent">7X4K2M</p>
    </div>
    <span class="mb-1 bg-primary px-2 py-1 font-display text-[10px] font-semibold uppercase tracking-wider text-white">En caja</span>
  </div>
);

interface Step {
  number: string;
  title: string;
  description: string;
  Visual: FunctionComponent;
}

const STEPS: Step[] = [
  {
    number: "01",
    title: "Elegí tu beneficio",
    description:
      "Buscá en el catálogo por categoría, zona o descuento. Abrí el beneficio que te interesa y revisá sus condiciones.",
    Visual: BenefitMock,
  },
  {
    number: "02",
    title: "Ingresá con tu DNI",
    description:
      "En la ficha del beneficio, escribí tu DNI registrado (con o sin puntos). Si ya ingresaste, este paso se saltea.",
    Visual: DniMock,
  },
  {
    number: "03",
    title: "Generá tu cupón",
    description:
      "Tocá «Obtener mi cupón»: vas a tener un código y un QR personales, que también quedan guardados en Mis cupones.",
    Visual: CouponMock,
  },
  {
    number: "04",
    title: "Mostralo antes de pagar",
    description:
      "Mostrá el QR o el código en el comercio junto con tu DNI. El comercio lo valida y registra el canje: cada cupón se usa una sola vez.",
    Visual: QrMock,
  },
];

export default component$(() => {
  const isMember = useHowItWorksSession();

  return (
    <div class="bg-background text-primary">
      <section aria-labelledby="how-it-works-title" class="border-b-4 border-accent bg-primary text-white">
        <div class="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:px-8">
          <div>
            <SectionHeading as="h1" id="how-it-works-title" tone="dark" size="xl" eyebrow="Guía para socios" title="Tus beneficios en 4 pasos">
              <p class="mt-5 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Elegí un beneficio, ingresá con tu DNI, generá tu cupón y mostralo en el comercio. Todo desde tu celular.
              </p>
            </SectionHeading>
            <div class="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/beneficios/" class="btn btn-primary">
                Explorar beneficios
                <LuArrowRight class="h-4 w-4" aria-hidden="true" />
              </Link>
              {isMember.value ? (
                <Link href="/perfil/#mis-cupones" class="btn btn-outline-light">
                  Ver mis cupones
                </Link>
              ) : (
                <Link href="/login/" class="btn btn-outline-light">
                  Ingresar con DNI
                </Link>
              )}
            </div>
            {!isMember.value && (
              <p class="mt-4 text-xs leading-relaxed text-slate-300">
                Podés recorrer el catálogo sin ingresar: el DNI te lo pedimos recién al obtener un cupón.
              </p>
            )}
          </div>

          <aside aria-labelledby="before-you-start-title" class="border-l-4 border-accent bg-secondary p-6 sm:p-7">
            <h2 id="before-you-start-title" class="heading-display text-xl">
              Lo que necesitás
            </h2>
            <ul class="mt-4 divide-y divide-white/15">
              <li class="py-3">
                <p class="text-sm font-bold">Tu DNI registrado</p>
                <p class="mt-1 text-sm leading-relaxed text-slate-300">Para ingresar y obtener tu cupón personal.</p>
              </li>
              <li class="py-3">
                <p class="text-sm font-bold">El celular con el cupón</p>
                <p class="mt-1 text-sm leading-relaxed text-slate-300">El comercio lee el QR o tipea el código.</p>
              </li>
              <li class="pt-3">
                <p class="text-sm font-bold">Las condiciones del beneficio</p>
                <p class="mt-1 text-sm leading-relaxed text-slate-300">Revisá vigencia y requisitos antes de usarlo.</p>
              </li>
            </ul>
          </aside>
        </div>
      </section>

      <div class="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:space-y-20 sm:px-6 sm:py-16 lg:px-8">
        <section aria-labelledby="steps-title">
          <SectionHeading id="steps-title" eyebrow="Paso a paso" title="Del catálogo al comercio" size="lg">
            <p class="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
              Así se usa un beneficio, de punta a punta.
            </p>
          </SectionHeading>
          <ol class="mt-8 grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ Visual, ...step }) => (
              <li key={step.number} class="flex flex-col bg-surface">
                <div aria-hidden="true" class="flex h-40 items-center justify-center border-b border-line bg-surface-muted px-4 sm:h-48">
                  <Visual />
                </div>
                <div class="p-6">
                  <p class="font-display text-4xl font-bold leading-none text-primary">
                    <span class="sr-only">Paso </span>
                    {step.number}
                  </p>
                  <span class="title-bar mt-3" aria-hidden="true" />
                  <h3 class="heading-display mt-4 text-xl">{step.title}</h3>
                  <p class="mt-3 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="merchants-title" class="grid border border-line lg:grid-cols-2">
          <div class="bg-primary p-6 text-white sm:p-10">
            <SectionHeading id="merchants-title" tone="dark" eyebrow="Para comercios" title="Cómo validar un cupón" size="md" />
            <ol class="mt-6 space-y-4 text-sm leading-relaxed text-slate-300">
              <li class="flex gap-4">
                <span class="font-display text-2xl font-bold leading-none text-accent" aria-hidden="true">1</span>
                <span>
                  Escaneá el QR del socio con la cámara del celular (se abre la validación con el código cargado) o entrá a{" "}
                  <strong class="text-white">Validar cupón</strong> y tipealo.
                </span>
              </li>
              <li class="flex gap-4">
                <span class="font-display text-2xl font-bold leading-none text-accent" aria-hidden="true">2</span>
                <span>Ingresá el DNI del socio y el PIN que te dio el club, y tocá «Verificar cupón».</span>
              </li>
              <li class="flex gap-4">
                <span class="font-display text-2xl font-bold leading-none text-accent" aria-hidden="true">3</span>
                <span>Aplicá el descuento que muestra la pantalla y confirmá el canje. Cada cupón se usa una sola vez.</span>
              </li>
            </ol>
            <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/validar-cupon/" class="btn btn-primary">
                <LuScanLine class="h-4 w-4" aria-hidden="true" />
                Validar un cupón
              </Link>
              <a href={whatsappLink(WHATSAPP_MESSAGES.comercio)} target="_blank" rel="noopener" class="btn btn-outline-light">
                <LuMessageCircle class="h-4 w-4" aria-hidden="true" />
                Ayuda por WhatsApp
                <span class="sr-only"> (abre en una pestaña nueva)</span>
              </a>
            </div>
          </div>
          <div class="flex flex-col justify-center bg-surface p-6 sm:p-10">
            <LuStore class="h-9 w-9 text-primary" aria-hidden="true" />
            <h3 class="heading-display mt-4 text-2xl">¿Querés sumar tu comercio?</h3>
            <p class="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
              Ofrecé un beneficio a la familia de {CLUB.name}. Completá la solicitud «Sumate al Club» del inicio y el equipo del club se pone en contacto.
            </p>
            <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/#sumar-comercio" class="btn btn-dark">
                Sumar mi comercio
              </Link>
              <Link href="/sugerencias/?tipo=Sugerir%20Comercio" class="btn btn-outline">
                Soy socio: recomendar uno
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="faq-title" class="grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-12">
          <div>
            <SectionHeading id="faq-title" eyebrow="Ayuda" title="¿Te quedó alguna duda?" size="md">
              <p class="mt-4 text-sm leading-relaxed text-slate-600">
                Respuestas sobre el ingreso, los cupones y el uso de tus beneficios. Si no está acá, escribinos.
              </p>
            </SectionHeading>
            <div class="mt-6 flex flex-col gap-3 sm:flex-row lg:max-w-xs lg:flex-col">
              <Link href="/sugerencias/?tipo=Consulta%20General" class="btn btn-outline">
                Hacer una consulta
              </Link>
              <a href={whatsappLink(WHATSAPP_MESSAGES.consulta)} target="_blank" rel="noopener" class="btn btn-dark">
                <LuMessageCircle class="h-4 w-4" aria-hidden="true" />
                WhatsApp del club
                <span class="sr-only"> (abre en una pestaña nueva)</span>
              </a>
            </div>
          </div>
          <div class="border-t border-line">
            {FAQS.map((faq) => (
              <details key={faq.question} open={faq.open} class="group border-b border-line bg-surface">
                <summary class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-bold transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:text-base [&::-webkit-details-marker]:hidden">
                  <span>{faq.question}</span>
                  <LuPlus class="h-5 w-5 shrink-0 text-slate-600 transition-transform group-open:rotate-45" aria-hidden="true" />
                </summary>
                <div class="border-l-4 border-accent px-5 pb-5 pt-1">
                  <p class="text-sm leading-relaxed text-slate-600">{faq.answer}</p>
                  {faq.link && (
                    <Link
                      href={faq.link.href}
                      class="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-bold underline decoration-slate-300 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {faq.link.label}
                      <LuArrowRight class="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>

        {isMember.value && (
          <section class="flex flex-col gap-5 border-l-4 border-accent bg-primary px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <div>
              <h2 class="heading-display text-2xl sm:text-3xl">Tu próximo beneficio te espera</h2>
              <p class="mt-2 text-sm leading-relaxed text-slate-300">Buscá un comercio y mirá lo que tiene para vos.</p>
            </div>
            <Link href="/beneficios/" class="btn btn-primary shrink-0">
              Ver beneficios
              <LuArrowRight class="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        )}
      </div>

      {!isMember.value && <HaceteSocio variant="band" />}
    </div>
  );
});

export const head: DocumentHead = {
  title: "Cómo funciona - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content:
        "Cómo usar tus beneficios en 4 pasos: elegí un comercio, ingresá con tu DNI, generá tu cupón y mostralo antes de pagar. Cómo validan los comercios y preguntas frecuentes.",
    },
  ],
};
