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
          class={`flex flex-col justify-center border-b-4 border-accent px-4 py-5 sm:px-8 sm:py-12 lg:border-b-0 lg:py-12 lg:pr-12 lg:pl-[max(2rem,calc((100vw-90rem)/2+2rem))] ${hasSlides ? "lg:col-span-5" : "mx-auto max-w-[90rem] lg:px-8"}`}
        >
          <div class="hidden items-center gap-4 sm:flex">
            <img src="/lprc.avif" alt="" width={120} height={101} class="h-auto w-12 shrink-0 sm:w-16" />
            <p class="eyebrow text-accent">
              {CLUB.name}
              <span class="block text-slate-300">Desde {CLUB.foundedYear}</span>
            </p>
          </div>
          <h1 id="home-title" class="heading-display text-3xl text-white sm:mt-5 sm:text-5xl xl:text-[3.1rem]">
            Beneficios para la familia amarilla
          </h1>
          <span class="title-bar mt-3 sm:mt-5" aria-hidden="true" />
          <p class="mt-3 max-w-md text-sm leading-relaxed text-slate-300 sm:mt-5 sm:text-base">
            {loggedIn
              ? `Hola${firstName ? `, ${firstName}` : ""}. Elegí un beneficio, generá tu cupón y mostralo en el comercio antes de pagar.`
              : "Elegí un beneficio, generá tu cupón con tu DNI y mostralo en el comercio antes de pagar."}
          </p>
          <div class="mt-4 grid grid-cols-2 gap-2 sm:mt-7 sm:flex sm:flex-wrap sm:gap-3">
            <Link href="/beneficios/" class="btn btn-primary px-3 sm:px-6">
              Ver beneficios
            </Link>
            {loggedIn ? (
              <Link href={COUPONS_ITEM.href} class="btn btn-outline-light px-3 sm:px-6">
                Mis cupones
              </Link>
            ) : (
              <Link href="/login/" class="btn btn-outline-light px-3 sm:px-6">
                Ingresar con DNI
              </Link>
            )}
          </div>
          {benefitCount > 0 && (
            <p class="eyebrow mt-4 tracking-wider text-slate-300 sm:mt-8 sm:tracking-[0.18em]">
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
