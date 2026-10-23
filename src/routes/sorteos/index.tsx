import { component$ } from "@builder.io/qwik";
import { Link, routeLoader$, type DocumentHead } from "@builder.io/qwik-city";
import { LuBell, LuFileText, LuGift, LuTrophy } from "@qwikest/icons/lucide";
import { SectionHeading } from "~/components/section-heading/section-heading";
import { getRaffleBoard, type Raffle } from "~/server/club-content";
import { daysUntilCalendarDay, drawCountdownLabel, formatCalendarDay } from "~/utils/club-content";
import { loginUrl } from "~/utils/return-path";

type ActiveRaffle = Raffle & { daysLeft: number };

export const useRafflesLoader = routeLoader$(async (event) => {
  const isMember = Boolean(event.sharedMap.get("user"));
  try {
    const { active, past } = await getRaffleBoard(event);
    // Counted here, in Buenos Aires time, so the label never depends on the visitor's clock.
    const now = new Date();
    return {
      isMember,
      active: active.map<ActiveRaffle>((raffle) => ({ ...raffle, daysLeft: daysUntilCalendarDay(raffle.drawDate, now) })),
      past,
    };
  } catch (err) {
    console.error("Failed to load raffles:", err);
    return { isMember, active: [] as ActiveRaffle[], past: [] as Raffle[] };
  }
});

const GENERAL_REQUIREMENTS = "Participan los socios del club con su DNI registrado en el portal. No tenés que anotarte en ningún lado, salvo que las bases del sorteo indiquen otra cosa.";

const NOTIFICATIONS_PATH = "/perfil/#avisos-del-club";

/** `wide` lays a lone raffle out side by side instead of leaving half the row empty. */
const RaffleCard = component$<{ raffle: ActiveRaffle; wide?: boolean }>(({ raffle, wide }) => {
  const titleId = `raffle-${raffle.id}-title`;
  return (
    <article aria-labelledby={titleId} class={["flex flex-col border border-line bg-surface", wide && "md:grid md:grid-cols-2"]}>
      <div class={["relative aspect-[16/9] bg-secondary", wide && "md:aspect-auto md:min-h-80"]}>
        {raffle.image ? (
          <img src={raffle.image} alt="" width={640} height={360} class="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div class="absolute inset-0 flex items-center justify-center">
            <LuGift class="h-16 w-16 text-accent" aria-hidden="true" />
          </div>
        )}
        <span class="badge badge-accent absolute left-3 top-3">Vigente</span>
      </div>

      <div class="flex flex-grow flex-col">
        <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b-4 border-accent bg-primary px-5 py-4 text-white">
          <p class="font-display text-2xl font-bold uppercase leading-none tracking-wide text-accent">{drawCountdownLabel(raffle.daysLeft)}</p>
          <p class="eyebrow text-slate-200">
            Sorteo: <time dateTime={raffle.drawDate}>{formatCalendarDay(raffle.drawDate)}</time>
          </p>
        </div>

        <div class="flex flex-grow flex-col gap-5 p-5 sm:p-6">
          <div>
            <h3 id={titleId} class="heading-display text-2xl text-primary">
              {raffle.title}
            </h3>
            <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{raffle.description}</p>
          </div>

          <dl class="grid gap-px border border-line bg-line text-sm">
            <div class="bg-surface-muted p-4">
              <dt class="eyebrow text-amber-900">Premio</dt>
              <dd class="mt-1 font-semibold text-primary">{raffle.prizeDetail}</dd>
            </div>
            <div class="bg-surface p-4">
              <dt class="eyebrow text-amber-900">Quiénes participan</dt>
              <dd class="mt-1 whitespace-pre-line leading-relaxed text-slate-700">{raffle.requirements?.trim() || GENERAL_REQUIREMENTS}</dd>
            </div>
          </dl>

          <details class="group mt-auto border-t border-line pt-3">
            <summary class="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-primary underline decoration-accent decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
              <LuFileText class="h-4 w-4" aria-hidden="true" />
              <span class="group-open:hidden">Ver bases y condiciones</span>
              <span class="hidden group-open:inline">Ocultar bases y condiciones</span>
            </summary>
            <p class="mt-3 whitespace-pre-line border-l-4 border-accent pl-4 text-sm leading-relaxed text-slate-700">{raffle.terms}</p>
          </details>
        </div>
      </div>
    </article>
  );
});

export default component$(() => {
  const board = useRafflesLoader();
  const { isMember, active, past } = board.value;
  const notificationsHref = isMember ? NOTIFICATIONS_PATH : loginUrl(NOTIFICATIONS_PATH);

  return (
    <div class="bg-background">
      <section class="border-b-4 border-accent bg-primary text-white">
        <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
          <SectionHeading as="h1" tone="dark" size="xl" eyebrow="Exclusivo socios" title="Sorteos del club">
            <p class="mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Premios para la familia socia de La Plata Rugby Club. Mirá los sorteos vigentes, quiénes participan, sus bases y los ganadores de los anteriores.
            </p>
          </SectionHeading>
        </div>
      </section>

      <div class="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <section aria-labelledby="active-raffles-title" class="space-y-6">
          <SectionHeading id="active-raffles-title" eyebrow="Para participar" title="Sorteos vigentes" size="md" />

          {active.length === 0 ? (
            <div class="grid border border-line bg-surface md:grid-cols-[1.4fr_1fr]">
              <div class="p-6 sm:p-8">
                <LuGift class="h-10 w-10 text-primary" aria-hidden="true" />
                <p class="heading-display mt-4 text-2xl text-primary">No hay sorteos vigentes</p>
                <p class="mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
                  Cuando el club lance uno nuevo lo vas a ver acá.{" "}
                  {past.length > 0 ? "Mientras tanto, mirá quiénes ganaron los anteriores más abajo." : ""}
                </p>
              </div>
              <div class="flex flex-col justify-center gap-4 bg-primary p-6 text-white sm:p-8">
                <LuBell class="h-8 w-8 text-accent" aria-hidden="true" />
                <p class="text-sm leading-relaxed text-slate-300">
                  Activá los avisos del club en tu perfil para recibir en este dispositivo las novedades que envíe el club.
                </p>
                <Link href={notificationsHref} class="btn btn-primary">
                  Activá las notificaciones
                </Link>
              </div>
            </div>
          ) : (
            <div class={["grid gap-6", active.length > 1 && "md:grid-cols-2"]}>
              {active.map((raffle) => (
                <RaffleCard key={raffle.id} raffle={raffle} wide={active.length === 1} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="how-to-join-title" class="space-y-6">
          <SectionHeading id="how-to-join-title" eyebrow="Requisitos" title="Cómo participo" size="md" />
          <div class="grid gap-px border border-line bg-line md:grid-cols-3">
            <div class="bg-surface p-5 sm:p-6">
              <p class="font-display text-3xl font-bold leading-none text-primary" aria-hidden="true">01</p>
              <h3 class="heading-display mt-3 text-lg">Tené tu DNI registrado</h3>
              <p class="mt-2 text-sm leading-relaxed text-slate-600">
                Los sorteos son para socios con su DNI cargado en el portal. Si podés ingresar, no tenés que anotarte aparte.
              </p>
            </div>
            <div class="bg-surface p-5 sm:p-6">
              <p class="font-display text-3xl font-bold leading-none text-primary" aria-hidden="true">02</p>
              <h3 class="heading-display mt-3 text-lg">Revisá quiénes participan</h3>
              <p class="mt-2 text-sm leading-relaxed text-slate-600">
                Cada sorteo indica sus requisitos y sus bases y condiciones. Leelas antes de la fecha del sorteo.
              </p>
            </div>
            <div class="bg-surface p-5 sm:p-6">
              <p class="font-display text-3xl font-bold leading-none text-primary" aria-hidden="true">03</p>
              <h3 class="heading-display mt-3 text-lg">Mirá si ganaste</h3>
              <p class="mt-2 text-sm leading-relaxed text-slate-600">
                Al terminar cada sorteo publicamos los ganadores en esta página. Cómo se entrega el premio figura en sus bases.
              </p>
            </div>
          </div>
        </section>

        {past.length > 0 && (
          <section aria-labelledby="past-raffles-title" class="space-y-6">
            <SectionHeading id="past-raffles-title" eyebrow="Ganadores" title="Sorteos finalizados" size="md" />
            <ul class="grid gap-4 md:grid-cols-2">
              {past.map((raffle) => (
                <li key={raffle.id} class="flex border border-line bg-surface">
                  <div class="relative hidden w-36 shrink-0 bg-secondary sm:block">
                    {raffle.image ? (
                      <img src={raffle.image} alt="" width={144} height={144} loading="lazy" class="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div class="absolute inset-0 flex items-center justify-center">
                        <LuTrophy class="h-9 w-9 text-accent" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div class="flex flex-grow flex-col gap-3 p-5">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="badge badge-muted">Finalizado</span>
                      <span class="text-xs font-semibold text-slate-600">
                        <time dateTime={raffle.drawDate}>{formatCalendarDay(raffle.drawDate)}</time>
                      </span>
                    </div>
                    <h3 class="heading-display text-lg text-primary">{raffle.title}</h3>
                    <div class="border-l-4 border-accent bg-surface-muted px-3 py-2 text-sm">
                      <p class="eyebrow text-amber-900">Ganador/es</p>
                      <p class="mt-1 whitespace-pre-line font-semibold text-primary">{raffle.winners || "Resultado a confirmar"}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {active.length > 0 && (
          <section class="flex flex-col gap-5 border-l-4 border-accent bg-primary px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <div>
              <h2 class="heading-display text-2xl">Que no se te pase el próximo</h2>
              <p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                Activá los avisos del club en tu perfil para recibir en este dispositivo las novedades que envíe el club.
              </p>
            </div>
            <Link href={notificationsHref} class="btn btn-primary shrink-0">
              Activá las notificaciones
            </Link>
          </section>
        )}
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Sorteos - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content:
        "Sorteos para socios de La Plata Rugby Club: los vigentes, quiénes participan, sus bases y condiciones y los ganadores de los sorteos anteriores.",
    },
  ],
};
