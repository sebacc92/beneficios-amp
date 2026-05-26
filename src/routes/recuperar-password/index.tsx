import { component$, useSignal } from "@builder.io/qwik";
import {
  routeAction$,
  Form,
  Link,
  z,
  zod$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";

export const useRecoveryAction = routeAction$(
  async (data, requestEvent) => {
    try {
      const db = getDB(requestEvent);
      const email = data.email.toLowerCase().trim();

      // Find user to verify email exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return requestEvent.fail(404, {
          message: "El correo electrónico ingresado no corresponde a ningún médico registrado.",
        });
      }

      // If user exists, we return success (mocking automatic SMTP email dispatch)
      return { success: true };
    } catch (e: any) {
      console.error("Recovery error:", e);
      return requestEvent.fail(500, {
        message: "Ocurrió un error inesperado al procesar tu solicitud.",
      });
    }
  },
  zod$({
    email: z.string().email("Ingresá un correo electrónico válido."),
  })
);

export default component$(() => {
  const recoveryAction = useRecoveryAction();
  const emailInput = useSignal("");

  return (
    <div class="bg-slate-50 min-h-[80vh] py-16 px-4 flex flex-col justify-center items-center font-sans">
      <div class="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
        
        {/* Header branding */}
        <div class="text-center space-y-2">
          <div class="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 mx-auto text-xl">
            📧
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none mt-3">
            Recuperar Contraseña
          </h1>
          <p class="text-xs sm:text-sm text-slate-400 font-medium">
            Ingresá tu correo para recibir un enlace de restauración.
          </p>
        </div>

        {/* Action success state */}
        {recoveryAction.value?.success ? (
          <div class="space-y-6 text-center animate-fade-in">
            <div class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs sm:text-sm font-semibold text-emerald-800 shadow-sm leading-relaxed">
              ✓ ¡Correo de recuperación enviado con éxito! Revisá tu casilla institucional en unos minutos y seguí las instrucciones.
            </div>
            
            <Link
              href="/login"
              class="w-full flex items-center justify-center py-3.5 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light text-white text-sm font-bold shadow-md transition-all duration-300"
            >
              Volver al Inicio de Sesión
            </Link>
          </div>
        ) : (
          <div class="space-y-5">
            {/* Global Error message */}
            {recoveryAction.value?.failed && (
              <div class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 animate-fade-in shadow-sm">
                ✗ {recoveryAction.value.message || "Error al procesar la solicitud."}
              </div>
            )}

            {/* Form */}
            <Form action={recoveryAction} class="space-y-5">
              <div class="space-y-1">
                <label for="email" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  placeholder="ejemplo@amepla.org.ar"
                  bind:value={emailInput}
                  class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={recoveryAction.isRunning}
                class="w-full flex items-center justify-center py-3.5 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
              >
                {recoveryAction.isRunning ? "Enviando correo..." : "Enviar Correo"}
              </button>
            </Form>

            {/* Foot links */}
            <div class="pt-6 border-t border-slate-100 text-center">
              <p class="text-xs sm:text-sm text-slate-400 font-semibold">
                ¿Te acordaste?{" "}
                <Link href="/login" class="text-brand-green hover:underline">
                  Iniciá sesión
                </Link>
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Recuperar Contraseña - Club de Beneficios AMP",
  meta: [
    {
      name: "description",
      content: "Recuperá la contraseña de tu cuenta médica del Club de Beneficios de la Agremiación Médica Platense.",
    },
  ],
};
