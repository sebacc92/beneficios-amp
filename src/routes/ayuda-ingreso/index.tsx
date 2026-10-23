import { component$, useSignal } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { LuArrowRight, LuMapPin, LuMessageCircle, LuPhone } from "@qwikest/icons/lucide";
import { SectionHeading } from "~/components/section-heading/section-heading";
import { CLUB, dniHelpMessage, whatsappLink } from "~/utils/club";

interface Cause {
  title: string;
  why: string;
  fix: string;
}

const CAUSES: Cause[] = [
  {
    title: "Escribiste mal el DNI",
    why: "Un número de más o de menos alcanza para que no lo encuentre. Los puntos y espacios no importan: 12.345.678 y 12345678 funcionan igual.",
    fix: "Revisá los números y volvé a intentar.",
  },
  {
    title: "Te asociaste hace poco",
    why: "Las altas en el portal las carga la secretaría del club, así que un socio nuevo puede tardar en aparecer.",
    fix: "Escribinos por WhatsApp con tu DNI y revisamos tu alta.",
  },
  {
    title: "El DNI cargado es de otro integrante de tu familia",
    why: "En algunos grupos familiares la cuenta quedó con el DNI de otra persona del grupo, por ejemplo el titular.",
    fix: "Escribinos a secretaría con tu DNI para que revisemos tu cuenta y puedas ingresar con tus propios datos.",
  },
  {
    title: "El portal dice que hay más de una cuenta con tu DNI",
    why: "Pasa cuando el mismo DNI quedó cargado dos veces.",
    fix: "Escribinos y la secretaría deja una sola cuenta.",
  },
];

/** Members have no password, so "forgot my password" is really "my DNI is not accepted". */
export default component$(() => {
  const dni = useSignal("");

  return (
    <div class="bg-background">
      <section class="border-b-4 border-accent bg-primary text-white">
        <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
          <SectionHeading as="h1" tone="dark" size="xl" eyebrow="Ayuda para socios" title="¿No podés ingresar?">
            <p class="mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Los socios ingresan solo con su DNI, sin contraseña. Acá tenés las causas más comunes y cómo resolver cada una.
            </p>
          </SectionHeading>
          <Link href="/login/" class="btn btn-primary mt-7">
            Ingresar con mi DNI
            <LuArrowRight class="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div class="mx-auto grid max-w-6xl items-start gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:px-8">
        <section aria-labelledby="causes-title">
          <SectionHeading id="causes-title" eyebrow="Causas frecuentes" title="Qué puede estar pasando" size="md" />
          <ol class="mt-6 border-t border-line">
            {CAUSES.map((cause, index) => (
              <li key={cause.title} class="flex gap-4 border-b border-line bg-surface p-5 sm:gap-6 sm:p-6">
                <span class="font-display text-3xl font-bold leading-none text-primary" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 class="heading-display text-lg text-primary">{cause.title}</h3>
                  <p class="mt-2 text-sm leading-relaxed text-slate-600">{cause.why}</p>
                  <p class="mt-3 border-l-4 border-accent pl-3 text-sm font-semibold text-primary">
                    <span class="sr-only">Qué hacer: </span>
                    {cause.fix}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside class="space-y-6" aria-label="Canales de ayuda">
          <section aria-labelledby="help-channels-title" class="border-t-4 border-accent bg-primary p-6 text-white sm:p-8">
            <h2 id="help-channels-title" class="heading-display text-2xl">
              Escribinos y lo revisamos
            </h2>
            <p class="mt-3 text-sm leading-relaxed text-slate-300">
              Si tu DNI sigue sin funcionar, la secretaría del club revisa tu alta.
            </p>
            <label for="help-dni" class="mb-1.5 mt-6 block text-xs font-bold uppercase tracking-[0.06em] text-slate-200">
              Tu DNI (opcional)
            </label>
            <input
              id="help-dni"
              type="text"
              inputMode="numeric"
              autocomplete="off"
              maxLength={20}
              placeholder="Ej.: 12.345.678"
              bind:value={dni}
              aria-describedby="help-dni-hint"
              class="field text-base"
            />
            <p id="help-dni-hint" class="mt-1.5 text-xs text-slate-300">
              Lo sumamos al mensaje de WhatsApp para que lo revisemos más rápido.
            </p>
            <div class="mt-5 flex flex-col gap-3">
              <a href={whatsappLink(dniHelpMessage(dni.value))} target="_blank" rel="noopener" class="btn btn-primary">
                <LuMessageCircle class="h-4 w-4" aria-hidden="true" />
                Escribir por WhatsApp
                <span class="sr-only"> (abre en una pestaña nueva)</span>
              </a>
              <a href={CLUB.phoneHref} class="btn btn-outline-light">
                <LuPhone class="h-4 w-4" aria-hidden="true" />
                Llamar a secretaría
              </a>
            </div>
            <p class="mt-5 border-t border-white/15 pt-4 text-sm text-slate-300">
              Secretaría: <span class="whitespace-nowrap font-semibold text-white">{CLUB.phoneDisplay}</span>
              <br />
              WhatsApp: <span class="whitespace-nowrap font-semibold text-white">{CLUB.whatsappDisplay}</span>
            </p>
          </section>

          <section aria-labelledby="not-member-title" class="card p-6">
            <h2 id="not-member-title" class="heading-display text-xl text-primary">
              ¿Todavía no sos socio?
            </h2>
            <p class="mt-2 text-sm leading-relaxed text-slate-600">Los beneficios son para socios del club. Te contamos cómo sumarte.</p>
            <Link href="/register/" class="btn btn-outline mt-4">
              Hacete socio
            </Link>
          </section>

          <section aria-labelledby="club-address-title" class="card p-6">
            <h2 id="club-address-title" class="heading-display text-xl text-primary">
              En el club
            </h2>
            <p class="mt-3 flex gap-2 text-sm leading-relaxed text-slate-700">
              <LuMapPin class="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {CLUB.address}, {CLUB.locality}.
                <br />
                <span class="font-semibold text-amber-900">{CLUB.memberAccess}</span>
              </span>
            </p>
            <a href={CLUB.mapsUrl} target="_blank" rel="noopener" class="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-primary underline underline-offset-4">
              Ver en el mapa
              <span class="sr-only"> (abre en una pestaña nueva)</span>
            </a>
          </section>

          <p class="text-xs text-slate-600">
            ¿Sos administrador?{" "}
            <a href="/admin/login/" class="font-semibold underline underline-offset-2">
              Ingresá al panel
            </a>
          </p>
        </aside>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Ayuda para ingresar - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content:
        "¿Tu DNI no funciona en el portal de beneficios de La Plata Rugby Club? Causas frecuentes, qué hacer y cómo escribirle a la secretaría del club.",
    },
  ],
};
