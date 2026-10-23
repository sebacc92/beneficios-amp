import { component$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import {
  LuArrowRight,
  LuPlus,
  LuSearch,
  LuSmartphone,
  LuTicket,
  LuUser,
} from "@qwikest/icons/lucide";

interface FAQItem {
  question: string;
  answer: string;
  link?: { href: string; label: string };
}

const FAQS: FAQItem[] = [
  {
    question: "¿Qué hago si mi DNI no está registrado?",
    answer:
      "Ingresá el DNI con el que te dieron de alta en el portal, con o sin puntos y espacios. Si no lo encuentra, comunicate con la administración del club para que revisen tu registro.",
    link: {
      href: "/sugerencias/?tipo=Consulta%20General",
      label: "Consultar al club",
    },
  },
  {
    question: "¿Dónde encuentro los cupones que ya generé?",
    answer:
      "En tu perfil, dentro de Mis cupones. Desde ahí podés volver a abrir el código y el QR, y consultar si el cupón está activo, utilizado o vencido.",
    link: { href: "/perfil/#mis-cupones", label: "Ir a Mis cupones" },
  },
  {
    question: "¿Tengo que imprimir el cupón?",
    answer:
      "No hace falta: podés mostrar el QR o el código desde tu celular. Si preferís llevarlo en papel, también tenés la opción de imprimir desde la página del cupón.",
  },
  {
    question: "¿Puedo usar el mismo cupón más de una vez?",
    answer:
      "Cada código permite un solo canje. Cuando el comercio lo valida, el cupón queda marcado como utilizado y ya no se puede volver a canjear.",
  },
  {
    question: "¿Los descuentos tienen condiciones?",
    answer:
      "Sí. Antes de generar el cupón, revisá la ficha del beneficio: puede tener una vigencia, días de uso, requisitos o restricciones. Consultá también si se puede combinar con otras promociones antes de pagar.",
  },
  {
    question: "¿Qué hago si un comercio no aplica el beneficio?",
    answer:
      "Contanos lo que pasó desde el formulario de sugerencias. Indicá el comercio, el beneficio y la fecha del inconveniente para que el equipo del club pueda revisarlo.",
    link: {
      href: "/sugerencias/?tipo=Problema%20Comercio",
      label: "Reportar un inconveniente",
    },
  },
  {
    question: "¿Cómo puedo proponer un comercio?",
    answer:
      "Podés recomendar un comercio desde el formulario de sugerencias. Si sos su titular, contanos qué beneficio querés ofrecer a los socios y dejá un medio de contacto.",
    link: {
      href: "/sugerencias/?tipo=Sugerir%20Comercio",
      label: "Proponer un comercio",
    },
  },
];

export default component$(() => {
  const steps = [
    {
      number: "01",
      title: "Elegí tu beneficio",
      description:
        "Explorá el catálogo por categoría, ubicación o descuento. Abrí el beneficio que te interesa y revisá sus condiciones.",
      icon: <LuSearch class="h-6 w-6" aria-hidden="true" />,
    },
    {
      number: "02",
      title: "Ingresá tu DNI",
      description:
        "Desde la ficha del beneficio, ingresá tu DNI registrado en el portal. Podés escribirlo con o sin puntos y espacios.",
      icon: <LuUser class="h-6 w-6" aria-hidden="true" />,
    },
    {
      number: "03",
      title: "Generá tu cupón",
      description:
        "Elegí la opción para obtener tu cupón. Vas a tener un código y un QR personal, que también quedan disponibles en Mis cupones.",
      icon: <LuTicket class="h-6 w-6" aria-hidden="true" />,
    },
    {
      number: "04",
      title: "Mostralo antes de pagar",
      description:
        "Presentá el QR o el código en el comercio, junto con tu DNI y la credencial que te soliciten. El comercio verifica y registra el canje.",
      icon: <LuSmartphone class="h-6 w-6" aria-hidden="true" />,
    },
  ];

  return (
    <div class="bg-background py-8 text-primary sm:py-12 lg:py-16">
      <div class="mx-auto max-w-7xl space-y-12 px-4 sm:space-y-16 sm:px-6 lg:px-8">
        <section
          aria-labelledby="how-it-works-title"
          class="grid gap-8 rounded-[2rem] border border-line bg-surface p-6 shadow-sm sm:p-10 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-12"
        >
          <div>
            <span class="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
              Guía para socios
            </span>
            <h1
              id="how-it-works-title"
              class="mt-5 max-w-xl font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
            >
              Disfrutá tus beneficios en 4 pasos.
            </h1>
            <p class="mt-5 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
              Elegí un beneficio, generá tu cupón y mostralo en el comercio.
              Todo desde tu celular.
            </p>
            <div class="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/beneficios/"
                class="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-accent px-4 py-3 text-sm font-extrabold text-primary transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:px-5"
              >
                Explorar beneficios
                <LuArrowRight class="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
              <Link
                href="/perfil/#mis-cupones"
                class="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:px-5"
              >
                <LuTicket class="h-4 w-4" aria-hidden="true" />
                Ver mis cupones
              </Link>
            </div>
            <p class="mt-4 text-xs leading-relaxed text-slate-600">
              Podés explorar el catálogo sin iniciar sesión.
            </p>
          </div>

          <aside
            aria-labelledby="before-you-start-title"
            class="rounded-3xl border border-line bg-surface-muted p-5 sm:p-7"
          >
            <div class="mb-5 flex items-center gap-3">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50">
                <LuSmartphone class="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 id="before-you-start-title" class="font-display text-xl font-bold">
                Lo que necesitás tener a mano
              </h2>
            </div>
            <ul class="space-y-5">
              <li class="border-t border-line pt-4">
                <p class="text-sm font-bold">Tu DNI registrado</p>
                <p class="mt-1 text-sm leading-relaxed text-slate-600">
                  Para ingresar y obtener tu cupón personal.
                </p>
              </li>
              <li>
                <p class="text-sm font-bold">El código o QR del cupón</p>
                <p class="mt-1 text-sm leading-relaxed text-slate-600">
                  Podés mostrarlo directamente desde el celular.
                </p>
              </li>
              <li>
                <p class="text-sm font-bold">Las condiciones del beneficio</p>
                <p class="mt-1 text-sm leading-relaxed text-slate-600">
                  Revisá la vigencia y los requisitos antes de usarlo.
                </p>
              </li>
            </ul>
          </aside>
        </section>

        <section aria-labelledby="steps-title">
          <div class="mb-6 max-w-2xl space-y-2">
            <h2 id="steps-title" class="font-display text-2xl font-extrabold sm:text-3xl">
              Del catálogo al comercio
            </h2>
            <p class="text-sm leading-relaxed text-slate-600">
              Un recorrido simple para aprovechar cada descuento.
            </p>
          </div>
          <ol class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <li key={step.number} class="rounded-3xl border border-line bg-surface p-6 shadow-sm">
                <div class="mb-5 flex items-center justify-between gap-3">
                  <span class="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50">
                    {step.icon}
                  </span>
                  <span aria-hidden="true" class="font-display text-3xl font-bold text-slate-500">
                    {step.number}
                  </span>
                </div>
                <h3 class="font-display text-lg font-bold leading-tight">{step.title}</h3>
                <p class="mt-3 text-sm leading-relaxed text-slate-600">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="faq-title" class="grid gap-6 lg:grid-cols-[1fr_2fr] lg:gap-12">
          <div>
            <h2 id="faq-title" class="font-display text-2xl font-extrabold sm:text-3xl">
              ¿Te quedó alguna duda?
            </h2>
            <p class="mt-3 text-sm leading-relaxed text-slate-600">
              Encontrá respuestas sobre el ingreso, los cupones y el uso de tus beneficios.
            </p>
            <Link
              href="/sugerencias/?tipo=Consulta%20General"
              class="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold underline decoration-line underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              Hacer una consulta
              <LuArrowRight class="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div class="space-y-3">
            {FAQS.map((faq) => (
              <details key={faq.question} class="group rounded-2xl border border-line bg-surface open:shadow-sm">
                <summary class="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-sm font-bold transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:text-base [&::-webkit-details-marker]:hidden">
                  <span>{faq.question}</span>
                  <LuPlus class="h-5 w-5 shrink-0 text-slate-600 transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden="true" />
                </summary>
                <div class="border-t border-line px-5 pb-5 pt-4">
                  <p class="text-sm leading-relaxed text-slate-600">{faq.answer}</p>
                  {faq.link && (
                    <Link
                      href={faq.link.href}
                      class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold underline decoration-line underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
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

        <section class="flex flex-col gap-5 rounded-3xl border border-line bg-surface px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <h2 class="font-display text-2xl font-extrabold">Tu próximo beneficio te espera.</h2>
            <p class="mt-2 text-sm leading-relaxed text-slate-600">
              Buscá un comercio y conocé lo que tiene para vos.
            </p>
          </div>
          <Link
            href="/beneficios/"
            class="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-extrabold text-primary transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Ver beneficios
            <LuArrowRight class="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Cómo funciona - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content:
        "Conocé cómo usar tus beneficios en 4 pasos: elegí un comercio, ingresá con tu DNI, generá tu cupón y mostralo antes de pagar. Respuestas a las preguntas frecuentes.",
    },
  ],
};
