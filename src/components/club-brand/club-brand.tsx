import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

export const ClubBrand = component$(() => (
  <Link
    href="/"
    aria-label="Club de Beneficios - LA PLATA RUGBY CLUB. Inicio"
    class="inline-flex min-w-0 items-center gap-2.5 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:gap-3"
  >
    <img
      src="/lprc.avif"
      alt=""
      width={120}
      height={101}
      class="h-auto w-[52px] shrink-0 object-contain drop-shadow-md sm:w-[72px] xl:w-[88px]"
    />
    <span class="flex min-w-0 flex-col gap-1">
      <span class="font-display text-[20px] leading-tight font-bold text-white sm:text-[24px] xl:text-[26px]">
        Club de Beneficios
      </span>
      <span class="sr-only"> - </span>
      <span class="text-[11px] leading-snug font-bold tracking-[0.06em] text-accent sm:text-[11px] xl:text-[11px]">
        LA PLATA RUGBY CLUB
      </span>
    </span>
  </Link>
));
