import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { Benefit } from "~/server/cache";
import { formatDiscount } from "~/utils/home-benefits";

export interface CampaignSpotlightProps {
  tag: string;
  title: string;
  subtitle: string;
  /** Optional: lprc.com.ar headings do not use emojis, so an empty value shows none. */
  emoji?: string | null;
  benefits: Benefit[];
  /** Disables links in the admin preview. */
  preview?: boolean;
}

function imageUrl(imagen: string) {
  return imagen.startsWith("http") || imagen.startsWith("/") ? imagen : `https://beneficios.lprc.ar/files/${imagen}`;
}

/** Home campaign block, also rendered as-is by /admin/campana as its preview. */
export const CampaignSpotlight = component$<CampaignSpotlightProps>(({ tag, title, subtitle, emoji, benefits, preview = false }) => {
  return (
    <section class="mx-auto max-w-[90rem] px-4 py-10 text-left print:hidden sm:px-6 lg:px-8" aria-labelledby="campaign-title">
      <div class="grid grid-cols-1 lg:grid-cols-4">
        <div class="flex flex-col justify-center gap-4 border-b-4 border-accent bg-primary p-7 text-white md:p-10 lg:border-b-0 lg:border-l-4">
          <p class="eyebrow text-accent">{tag}</p>
          <h2 id="campaign-title" class="heading-display text-3xl md:text-4xl lg:text-3xl xl:text-4xl [overflow-wrap:anywhere]">
            {emoji ? `${emoji} ` : ""}
            {title}
          </h2>
          <span class="title-bar" aria-hidden="true" />
          <p class="text-sm leading-relaxed text-slate-300">{subtitle}</p>
          <div class="pt-2">
            {preview ? (
              <span class="btn btn-primary btn-sm">Ver todos</span>
            ) : (
              <Link href="/beneficios/?campana=1" class="btn btn-primary btn-sm">
                Ver todos
                <span class="sr-only"> los beneficios de {title}</span>
              </Link>
            )}
          </div>
        </div>
        <div class="border border-line bg-surface p-5 md:p-8 lg:col-span-3 lg:flex lg:items-center lg:border-l-0">
          <ul class="grid w-full grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {benefits.map((benefit) => {
              const body = (
                <>
                  <div class="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-primary">
                    {benefit.imagen ? (
                      <img
                        src={imageUrl(benefit.imagen)}
                        alt=""
                        class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        width={200}
                        height={150}
                        loading="lazy"
                      />
                    ) : (
                      <img src="/lprc.avif" alt="" width={120} height={101} class="h-14 w-auto opacity-90" loading="lazy" />
                    )}
                    <span class="badge badge-accent absolute bottom-2 left-2 max-w-[calc(100%-1rem)] whitespace-normal text-left leading-tight">
                      {formatDiscount(benefit.resumen)}
                    </span>
                  </div>
                  <p class="eyebrow mt-3 truncate text-[11px] text-amber-900">{benefit.categorias[0]?.descripcion || "Beneficio"}</p>
                  <h3 class="heading-display mt-1 line-clamp-2 text-base text-primary group-hover:underline">{benefit.titulo}</h3>
                </>
              );
              return (
                <li key={`campaign-${benefit.id}`}>
                  {preview ? (
                    <div class="group block">{body}</div>
                  ) : (
                    <Link
                      href={`/beneficio/${benefit.url}`}
                      class="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                    >
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
});
