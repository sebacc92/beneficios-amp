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
      message: "Las altas de socios las hace el club. Comunicate con la secretaría para que te habiliten.",
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
          <h1 class="text-2xl font-display font-extrabold text-brand-navy-dark tracking-tight leading-tight mt-3">
            Las altas las hace el club
          </h1>
          <p class="text-sm text-slate-600 font-medium leading-relaxed">
            No hace falta registrarte: si sos socio de La Plata Rugby Club, ingresás con tu DNI.
          </p>
        </div>

        {/* Dynamic Warning Alert Box */}
        <div class="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 text-left text-sm font-medium text-amber-900 leading-relaxed shadow-sm space-y-2">
          <p class="font-bold">¿Tu DNI no funciona?</p>
          <p>
            La secretaría del club da de alta a los socios en el portal. Si todavía no te habilitaron, llamá al{" "}
            <a href="tel:+542214895777" class="font-bold underline">(0221) 489-5777</a> y pedí que te sumen.
          </p>
        </div>

        {/* Action Link to Login */}
        <div class="pt-4 border-t border-slate-100 flex flex-col gap-3">
          <Link
            href="/login"
            class="w-full flex items-center justify-center py-3.5 px-6 rounded-2xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all duration-300 cursor-pointer"
          >
            Ingresar con mi DNI
          </Link>
          <Link
            href="/"
            class="text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase tracking-wider"
          >
            Volver al inicio
          </Link>
        </div>

      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Registro de Socio - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content: "Los socios de La Plata Rugby Club ingresan con su DNI; las altas las hace la secretaría del club.",
    },
  ],
};
