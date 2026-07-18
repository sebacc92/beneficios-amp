import { component$ } from "@builder.io/qwik";
import {
  routeAction$,
  Link,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { LuShield } from "@qwikest/icons/lucide";

export const useRegisterAction = routeAction$(
  async (_, requestEvent) => {
    return requestEvent.fail(403, {
      message: "El registro público de cuentas médicas está deshabilitado. Por favor, comunícate con la administración de AMP+ para solicitar el alta.",
    });
  }
);

export default component$(() => {
  return (
    <div class="bg-slate-50 min-h-[90vh] py-16 px-4 flex flex-col justify-center items-center font-sans">
      <div class="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm space-y-7 animate-in fade-in slide-in-from-bottom-6 duration-500 text-center">
        
        {/* Header Title */}
        <div class="space-y-2">
          <div class="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 mx-auto">
            <LuShield class="w-6 h-6 text-amber-600" />
          </div>
          <h1 class="text-2xl font-display font-extrabold text-brand-green-dark tracking-tight leading-tight mt-3">
            Registro Médico Inhabilitado
          </h1>
          <p class="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed">
            El registro público de cuentas agremiadas se encuentra inhabilitado desde este portal de forma temporal.
          </p>
        </div>

        {/* Dynamic Warning Alert Box */}
        <div class="rounded-2xl border border-amber-150 bg-amber-50/50 p-5 text-left text-xs font-medium text-amber-800 leading-relaxed shadow-sm space-y-2">
          <p class="font-bold uppercase tracking-wider text-[10px] text-amber-700">Aviso a Profesionales</p>
          <p>
            Para garantizar la seguridad e integridad del padrón, todas las altas y habilitaciones de matrícula son gestionadas directamente por el personal administrativo de la <strong>Agremiación Médica Platense</strong>.
          </p>
          <p class="pt-1.5 border-t border-amber-200/50 font-semibold">
            Por favor, ponete en contacto con la administración de la AMP para solicitar tu alta de usuario.
          </p>
          <p class="pt-1.5">
            Para consultas sobre tu agremiación escribí a{" "}
            <a href="mailto:info@amepla.org.ar" class="font-bold text-brand-green hover:text-brand-green-dark underline">
              info@amepla.org.ar
            </a>
          </p>
        </div>

        {/* Action Link to Login */}
        <div class="pt-4 border-t border-slate-100 flex flex-col gap-3">
          <Link
            href="/login"
            class="w-full flex items-center justify-center py-3.5 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all duration-300 cursor-pointer"
          >
            Volver a Iniciar Sesión
          </Link>
          <Link
            href="/"
            class="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-wider"
          >
            Volver a la Home
          </Link>
        </div>

      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Registro Médico - Club de Beneficios AMP",
  meta: [
    {
      name: "description",
      content: "El registro público de cuentas médicas está inhabilitado. Contacte a la administración para el alta.",
    },
  ],
};
