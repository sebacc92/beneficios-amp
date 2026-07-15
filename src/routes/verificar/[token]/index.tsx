import { component$ } from "@builder.io/qwik";
import { routeLoader$, Link, type DocumentHead } from "@builder.io/qwik-city";
import { readCredentialToken } from "~/server/credential-token";
import { lookupPadron } from "~/server/membership";
import { maskDni } from "~/utils/mask";

// Página PÚBLICA de verificación de credencial. Se llega escaneando el QR del
// carnet: /verificar/<token cifrado>. El token se descifra y se revalida en
// tiempo real contra el padrón oficial de la AMP.
export const useVerification = routeLoader$(async (event) => {
  const payload = await readCredentialToken(event.env, event.params.token);
  const checkedAt = new Date().toISOString();

  if (!payload) {
    return { status: "invalid" as const, checkedAt };
  }

  const padron = await lookupPadron(event.env, payload.d);

  // El DNI nunca se expone completo al cliente: siempre enmascarado.
  if (padron.status === "found") {
    return {
      status: "valid" as const,
      name: padron.member.name,
      dni: maskDni(padron.member.dni),
      matricula: payload.m,
      origen: padron.member.origen,
      tipo: padron.member.tipo,
      checkedAt,
    };
  }

  if (padron.status === "not_found") {
    return {
      status: "notfound" as const,
      name: payload.n,
      dni: maskDni(payload.d),
      matricula: payload.m,
      checkedAt,
    };
  }

  // Padrón caído/inaccesible: no se puede confirmar en este momento.
  return {
    status: "unavailable" as const,
    name: payload.n,
    dni: maskDni(payload.d),
    matricula: payload.m,
    checkedAt,
  };
});

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default component$(() => {
  const v = useVerification();
  const data = v.value;
  const isValid = data.status === "valid";

  const theme =
    data.status === "valid"
      ? {
          ring: "from-brand-green-dark to-brand-green",
          badgeBg: "bg-emerald-50",
          badgeBorder: "border-emerald-200",
          badgeText: "text-emerald-700",
          icon: "text-emerald-600",
          title: "Credencial Válida",
          subtitle: "Verificada en tiempo real contra el padrón oficial de la AMP",
        }
      : data.status === "notfound"
        ? {
            ring: "from-red-700 to-red-600",
            badgeBg: "bg-red-50",
            badgeBorder: "border-red-200",
            badgeText: "text-red-700",
            icon: "text-red-600",
            title: "Credencial Inválida",
            subtitle: "El DNI no figura en el padrón de agremiados de la AMP",
          }
        : data.status === "unavailable"
          ? {
              ring: "from-amber-600 to-amber-500",
              badgeBg: "bg-amber-50",
              badgeBorder: "border-amber-200",
              badgeText: "text-amber-700",
              icon: "text-amber-600",
              title: "No se pudo verificar",
              subtitle: "El padrón de la AMP no respondió. Volvé a intentar en unos minutos",
            }
          : {
              ring: "from-slate-700 to-slate-600",
              badgeBg: "bg-slate-100",
              badgeBorder: "border-slate-200",
              badgeText: "text-slate-600",
              icon: "text-slate-500",
              title: "Enlace inválido",
              subtitle: "Este código de verificación no es válido o fue manipulado",
            };

  const showData = data.status !== "invalid";

  // Identificador principal: matrícula; si no tiene, el DNI (enmascarado).
  const matricula = (data as any).matricula as string | null | undefined;
  const dniMasked = (data as any).dni as string | undefined;
  const hasMatricula = !!(matricula && String(matricula).trim());
  const primaryLabel = hasMatricula ? "Matrícula" : "DNI";
  const primaryValue = hasMatricula ? String(matricula) : dniMasked || "—";

  return (
    <div class="min-h-[85vh] bg-slate-50 py-12 px-4 flex flex-col items-center justify-center font-sans">
      <div class="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
        {/* Encabezado de estado */}
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div class={`bg-gradient-to-br ${theme.ring} px-6 py-7 text-center text-white relative overflow-hidden`}>
            <div class="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div class="relative flex flex-col items-center gap-3">
              <div class="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg">
                {isValid ? (
                  <svg class={`w-9 h-9 ${theme.icon}`} fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : data.status === "unavailable" ? (
                  <svg class={`w-9 h-9 ${theme.icon}`} fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                ) : (
                  <svg class={`w-9 h-9 ${theme.icon}`} fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div class="space-y-1">
                <h1 class="text-2xl font-display font-extrabold tracking-tight leading-none">{theme.title}</h1>
                <p class="text-xs font-medium text-white/85 max-w-xs mx-auto leading-relaxed">{theme.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Datos de la credencial */}
          {showData && (
            <div class="p-6 space-y-4">
              <div class="flex items-center justify-center">
                <span class={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border ${theme.badgeBg} ${theme.badgeBorder} ${theme.badgeText}`}>
                  {isValid ? "Agremiado verificado" : data.status === "notfound" ? "No verificado" : "Verificación pendiente"}
                </span>
              </div>

              {/* Identificador principal destacado */}
              <div class="text-center py-2">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{primaryLabel}</div>
                <div class="text-3xl font-mono font-black text-slate-800 tracking-wider mt-0.5">{primaryValue}</div>
              </div>

              <dl class="divide-y divide-slate-100 rounded-2xl border border-slate-150 overflow-hidden">
                <div class="flex justify-between items-center px-4 py-3">
                  <dt class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nombre</dt>
                  <dd class="text-sm font-black text-slate-800 text-right">{(data as any).name || "—"}</dd>
                </div>
                {/* Si el principal es la matrícula, mostrar el DNI enmascarado como secundario */}
                {hasMatricula && (
                  <div class="flex justify-between items-center px-4 py-3">
                    <dt class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DNI</dt>
                    <dd class="text-sm font-mono font-bold text-slate-800 text-right">{dniMasked || "—"}</dd>
                  </div>
                )}
                {isValid && (data as any).origen && (
                  <div class="flex justify-between items-center px-4 py-3">
                    <dt class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Categoría</dt>
                    <dd class="text-sm font-bold text-slate-800 text-right capitalize">
                      {(data as any).tipo && (data as any).tipo !== "desconocido" ? (data as any).tipo : (data as any).origen}
                    </dd>
                  </div>
                )}
              </dl>

              <div class="flex items-start gap-2 rounded-2xl bg-slate-50 border border-slate-150 px-4 py-3">
                <svg class="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
                <p class="text-[10px] font-medium text-slate-500 leading-relaxed">
                  Verificación realizada el {formatDateTime(data.checkedAt)} hs. La validez se consulta en vivo contra el padrón oficial de la Agremiación Médica Platense.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Marca / pie */}
        <div class="text-center">
          <Link href="/" class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-brand-green transition-colors">
            <span class="font-display font-black text-brand-green-dark">
              AMP<span class="text-brand-gold">+</span>
            </span>
            <span>Club de Beneficios</span>
          </Link>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Verificación de Credencial - AMP+",
  meta: [
    { name: "robots", content: "noindex, nofollow" },
    {
      name: "description",
      content: "Verificación de credencial de agremiado de la Agremiación Médica Platense.",
    },
  ],
};
