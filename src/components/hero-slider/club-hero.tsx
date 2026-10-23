import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { CLUB } from "~/utils/club";
import { COUPONS_ITEM } from "~/components/site-header/nav-items";
import { HeroSlider, type HeroSlide } from "./hero-slider";

interface ClubHeroProps {
  /** Shown as "Hola, <nombre>" for members with a session. */
  memberName?: string | null;
  loggedIn: boolean;
  benefitCount: number;
  categoryCount: number;
  /** Merchant slides from /admin/slides, shown beside (desktop) or below (mobile) the club block. */
  slides: HeroSlide[];
}

/**
 * Home cover in lprc.com.ar style: the club crest, the page title and the main buttons
 * stay fixed, while the merchant carousel rotates next to them.
 */
export const ClubHero = component$<ClubHeroProps>(({ memberName, loggedIn, benefitCount, categoryCount, slides }) => {
  const hasSlides = slides.length > 0;
  const firstName = memberName?.trim().split(/\s+/)[0];

  return (
    <section class="bg-primary text-white" aria-labelledby="home-title">
      <div class={hasSlides ? "grid lg:grid-cols-12" : ""}>
        <div
          class={`flex flex-col justify-center border-b-4 border-accent px-5 py-8 sm:px-8 sm:py-12 lg:border-b-0 lg:py-12 lg:pr-12 lg:pl-[max(2rem,calc((100vw-90rem)/2+2rem))] ${hasSlides ? "lg:col-span-5" : "mx-auto max-w-[90rem] lg:px-8"}`}
        >
          <div class="flex items-center gap-4">
            <img src="/lprc.avif" alt="" width={120} height={101} class="h-auto w-12 shrink-0 sm:w-16" />
            <p class="eyebrow text-accent">
              {CLUB.name}
              <span class="block text-slate-300">Desde {CLUB.foundedYear}</span>
            </p>
          </div>
          <h1 id="home-title" class="heading-display mt-5 text-4xl text-white sm:text-5xl xl:text-[3.1rem]">
            Beneficios para la familia amarilla
          </h1>
          <span class="title-bar mt-5" aria-hidden="true" />
          <p class="mt-5 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
            {loggedIn
              ? `Hola${firstName ? `, ${firstName}` : ""}. Elegí un beneficio, generá tu cupón y mostralo en el comercio antes de pagar.`
              : "Descuentos en comercios adheridos, actividades en el club y sorteos para socios. Ingresá con tu DNI, generá tu cupón y mostralo antes de pagar."}
          </p>
          <div class="mt-7 grid gap-3 sm:flex sm:flex-wrap">
            <Link href="/beneficios/" class="btn btn-primary">
              Ver beneficios
            </Link>
            {loggedIn ? (
              <Link href={COUPONS_ITEM.href} class="btn btn-outline-light">
                Mis cupones
              </Link>
            ) : (
              <Link href="/login/" class="btn btn-outline-light">
                Ingresar con DNI
              </Link>
            )}
          </div>
          {benefitCount > 0 && (
            <p class="eyebrow mt-6 text-slate-300 sm:mt-8">
              <span class="text-accent">{benefitCount}</span> {benefitCount === 1 ? "beneficio vigente" : "beneficios vigentes"}
              {categoryCount > 1 && (
                <>
                  {" · "}
                  <span class="text-accent">{categoryCount}</span> rubros
                </>
              )}
            </p>
          )}
        </div>
        {hasSlides && (
          <div class="lg:col-span-7">
            <HeroSlider slides={slides} compact />
          </div>
        )}
      </div>
    </section>
  );
});
