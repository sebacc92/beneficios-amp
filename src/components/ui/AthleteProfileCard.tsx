import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

interface AthleteProfileCardProps {
  user: AuthenticatedUser;
}

/** The signed-in member's credential, as a flat navy block with the club crest (no mockups). */
export const AthleteProfileCard = component$<AthleteProfileCardProps>(({ user }) => {
  const isPremium = user.role === "premium" || user.role === "admin";
  // Same labels as the credential in /perfil.
  const statusLabel = user.role === "premium" ? "Socio Gold" : user.role === "admin" ? "Administrador" : "Socio del club";

  const formatExpiration = (dateStr: string | null) => {
    if (!dateStr) return "Sin vencimiento";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Sin vencimiento";
    return date.toLocaleDateString("es-AR", { month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
  };

  return (
    <section aria-label="Tu credencial digital" class="w-full border-l-4 border-accent bg-primary text-white">
      <div class="flex items-start justify-between gap-4 px-5 pt-5">
        <div>
          <p class="eyebrow text-accent">Credencial digital</p>
          <p class="heading-display mt-1 text-xl">La Plata Rugby Club</p>
        </div>
        <img src="/lprc.avif" alt="" width={40} height={44} class="h-11 w-10 shrink-0 object-contain" />
      </div>

      <div class="mt-4 flex items-center gap-4 px-5">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            width={52}
            height={52}
            class="h-13 w-13 shrink-0 border-2 border-accent object-cover"
          />
        ) : (
          <div class="flex h-13 w-13 shrink-0 items-center justify-center border-2 border-accent bg-secondary font-display text-xl font-bold text-accent" aria-hidden="true">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div class="min-w-0">
          <p class="heading-display truncate text-lg">{user.name}</p>
          <p class="mt-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <span class="inline-block h-2 w-2 bg-accent" aria-hidden="true" />
            {statusLabel}
          </p>
        </div>
      </div>

      <div class="mt-5 flex items-end justify-between gap-3 border-t border-secondary px-5 py-4">
        <dl class="space-y-1 text-left">
          <div>
            <dt class="text-[11px] font-bold uppercase tracking-wider text-slate-400">N° de socio</dt>
            <dd class="font-mono text-sm font-bold text-accent">{user.numeroSocio || "Sin informar"}</dd>
          </div>
          {isPremium && (
            <div>
              <dt class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Validez</dt>
              <dd class="text-xs font-semibold text-slate-200">{formatExpiration(user.premiumExpiresAt)}</dd>
            </div>
          )}
        </dl>
        <Link href="/perfil/?credencial=1" class="btn btn-outline-light btn-sm">
          Mostrar QR
        </Link>
      </div>
    </section>
  );
});
