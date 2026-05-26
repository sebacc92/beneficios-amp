import { component$, useSignal } from "@builder.io/qwik";
import {
  routeAction$,
  Link,
  z,
  zod$,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import { hashPassword } from "~/utils/crypto";

export const useLoginAction = routeAction$(
  async (data, requestEvent) => {
    try {
      const db = getDB(requestEvent);
      const email = data.email.toLowerCase().trim();

      // Find user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return requestEvent.fail(401, {
          message: "El correo electrónico ingresado no se encuentra registrado.",
        });
      }

      // Verify password hash
      const hashedInput = await hashPassword(data.password);
      if (user.passwordHash !== hashedInput) {
        return requestEvent.fail(401, {
          message: "La contraseña ingresada es incorrecta.",
        });
      }

      // Set cookie session (expires in 30 days)
      requestEvent.cookie.set("session_token", user.id, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      // Redirect user to their profile
      throw requestEvent.redirect(302, "/perfil");
    } catch (e: any) {
      if (e.headers) throw e; // Pass redirect exception
      console.error("Login error:", e);
      return requestEvent.fail(500, {
        message: e.message || "Ocurrió un error inesperado al iniciar sesión.",
      });
    }
  },
  zod$({
    email: z.string().email("Por favor ingresá un correo electrónico válido."),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  })
);

export default component$(() => {
  const loginAction = useLoginAction();
  const showPassword = useSignal(false);

  return (
    <div class="bg-slate-50 min-h-[85vh] py-16 px-4 flex flex-col justify-center items-center font-sans">
      <div class="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
        
        {/* Title branding */}
        <div class="text-center space-y-2">
          <div class="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 mx-auto text-xl">
            🔐
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none mt-3">
            Iniciar Sesión
          </h1>
          <p class="text-xs sm:text-sm text-slate-400 font-medium">
            Accedé a tu panel personalizado y credencial digital médica.
          </p>
        </div>

        {/* Global Error message */}
        {loginAction.value?.failed && (
          <div class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 animate-fade-in shadow-sm">
            ✗ {loginAction.value.message || "Error al iniciar sesión."}
          </div>
        )}

        {/* Form */}
        <form method="post" action="/login/" class="space-y-5">
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
              class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
            />
            {loginAction.value?.fieldErrors?.email && (
              <p class="text-[10px] font-bold text-red-600 mt-1">{loginAction.value.fieldErrors.email[0]}</p>
            )}
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label for="password" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                Contraseña
              </label>
              <Link href="/recuperar-password" class="text-xs font-bold text-brand-green hover:underline">
                ¿La olvidaste?
              </Link>
            </div>
            <div class="relative">
              <input
                type={showPassword.value ? "text" : "password"}
                id="password"
                name="password"
                required
                placeholder="Mínimo 6 caracteres"
                class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-green pr-10 transition-all"
              />
              <button
                type="button"
                onClick$={() => (showPassword.value = !showPassword.value)}
                class="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 focus:outline-none text-xs font-bold"
              >
                {showPassword.value ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            {loginAction.value?.fieldErrors?.password && (
              <p class="text-[10px] font-bold text-red-600 mt-1">{loginAction.value.fieldErrors.password[0]}</p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loginAction.isRunning}
            class="w-full flex items-center justify-center py-3.5 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
          >
            {loginAction.isRunning ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        {/* Foot link */}
        <div class="pt-6 border-t border-slate-100 text-center">
          <p class="text-xs sm:text-sm text-slate-400 font-semibold">
            ¿No tenés una cuenta médica?{" "}
            <Link href="/register" class="text-brand-green hover:underline">
              Registrate ahora
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Iniciar Sesión - Club de Beneficios AMP",
  meta: [
    {
      name: "description",
      content: "Ingresá a tu cuenta del Club de Beneficios de la Agremiación Médica Platense para descargar tus cupones y credencial digital.",
    },
  ],
};
