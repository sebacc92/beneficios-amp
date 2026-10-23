import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

interface AthleteProfileCardProps {
  user: AuthenticatedUser;
}

export const AthleteProfileCard = component$<AthleteProfileCardProps>(({ user }) => {
  const isPremium = user.role === "premium" || user.role === "admin";
  const statusLabel = isPremium ? "Socio Activo Premium" : "Socio Activo";

  // Format expiration date if available
  const formatExpiration = (dateStr: string | null) => {
    if (!dateStr) return "Sin Vencimiento";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Sin Vencimiento";
    return date.toLocaleDateString("es-AR", { month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
  };

  return (
    <div class="relative w-full max-w-sm mx-auto aspect-[1.6/1] rounded-[1.8rem] overflow-hidden select-none shadow-2xl transition-all duration-300 hover:scale-[1.02] border border-accent/30 group">

      {/* Background Gradients and Diagonal Design Stripe */}
      <div class="absolute inset-0 bg-gradient-to-br from-primary via-[#0B1526] to-secondary z-0"></div>

      {/* Yellow Sport Accent Lines */}
      <div class="absolute right-0 top-0 bottom-0 w-24 bg-accent/5 skew-x-12 origin-top transform translate-x-8 z-0"></div>
      <div class="absolute right-6 top-0 w-1 bg-accent/20 h-full skew-x-12 transform z-0"></div>
      <div class="absolute right-10 top-0 w-1.5 bg-accent/30 h-full skew-x-12 transform z-0"></div>

      {/* Card Content Wrapper */}
      <div class="relative z-10 p-6 sm:p-7 h-full flex flex-col justify-between text-white">

        {/* Header: Club Identity */}
        <div class="flex justify-between items-start">
          <div class="space-y-0.5 text-left">
            <span class="text-[11px] font-black text-accent tracking-[0.2em] uppercase leading-none block">
              Credencial Digital
            </span>
            <span class="font-display font-black text-lg sm:text-xl tracking-wide uppercase leading-none block text-white">
              La Plata Rugby Club
            </span>
          </div>
          {/* Mock Club Shield / Badge */}
          <div class="w-10 h-10 rounded-xl bg-accent flex items-center justify-center border border-accent/50 shadow-md">
            <span class="font-display font-black text-primary text-base">LPRC</span>
          </div>
        </div>

        {/* Middle: User Identity */}
        <div class="flex items-center space-x-4 my-auto text-left">
          {/* Avatar or Placeholder */}
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-accent shadow-md"
            />
          ) : (
            <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-secondary border-2 border-accent/40 flex items-center justify-center font-display font-bold text-accent text-lg shadow-inner">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div class="space-y-1 overflow-hidden">
            <h4 class="font-display font-black text-base sm:text-lg tracking-wide text-white leading-tight truncate">
              {user.name}
            </h4>
            <div class="flex items-center space-x-1.5">
              <span class={`inline-block w-1.5 h-1.5 rounded-full ${isPremium ? 'bg-accent' : 'bg-emerald-400'} animate-pulse`}></span>
              <span class="text-[11px] font-black uppercase tracking-wider text-slate-400">
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Footer: Metadata and the real, scannable credential */}
        <div class="flex justify-between items-end border-t border-slate-800/80 pt-3">
          <div class="space-y-1 text-left">
            <div>
              <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">N° de Socio</span>
              <span class="font-mono font-black text-accent text-sm leading-none">
                {user.numeroSocio || "------"}
              </span>
            </div>
            {isPremium && (
              <div>
                <span class="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block">Validez</span>
                <span class="text-[11px] font-bold text-slate-300 leading-none">
                  {formatExpiration(user.premiumExpiresAt)}
                </span>
              </div>
            )}
          </div>

          <Link
            href="/perfil/?credencial=1"
            class="inline-flex min-h-11 items-center rounded-xl border border-accent/50 px-3 py-2 text-xs font-black uppercase tracking-wider text-accent hover:bg-accent hover:text-primary transition-colors"
          >
            Mostrar QR
          </Link>

        </div>

      </div>
    </div>
  );
});
