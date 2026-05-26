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

export const useRegisterAction = routeAction$(
  async (data, requestEvent) => {
    try {
      const db = getDB(requestEvent);
      const email = data.email.toLowerCase().trim();

      // Check if password and confirmation match
      if (data.password !== data.confirmPassword) {
        return requestEvent.fail(400, {
          message: "Las contraseñas ingresadas no coinciden.",
        });
      }

      // Check if email already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        return requestEvent.fail(409, {
          message: "El correo electrónico ingresado ya se encuentra registrado.",
        });
      }

      // Hash password
      const passwordHash = await hashPassword(data.password);
      const userId = "usr-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();

      // Insert user (default role: member)
      await db.insert(users).values({
        id: userId,
        email,
        passwordHash,
        name: data.name.trim(),
        matricula: data.matricula ? data.matricula.trim() : null,
        role: "member",
        createdAt: new Date().toISOString(),
      });

      // Set cookie session (auto login)
      requestEvent.cookie.set("session_token", userId, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });

      throw requestEvent.redirect(302, "/perfil");
    } catch (e: any) {
      if (e.headers) throw e; // Pass redirect exception
      console.error("Registration error:", e);
      return requestEvent.fail(500, {
        message: e.message || "Ocurrió un error inesperado al crear la cuenta.",
      });
    }
  },
  zod$({
    name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
    email: z.string().email("Ingresá un correo electrónico válido."),
    matricula: z.string().min(2, "Por favor ingresá tu número de matrícula provincial."),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
    confirmPassword: z.string().min(6),
  })
);

export default component$(() => {
  const registerAction = useRegisterAction();
  const showPassword = useSignal(false);

  return (
    <div class="bg-slate-50 min-h-[90vh] py-16 px-4 flex flex-col justify-center items-center font-sans">
      <div class="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm space-y-7 animate-in fade-in slide-in-from-bottom-6 duration-500">
        
        {/* Header Title */}
        <div class="text-center space-y-2">
          <div class="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 mx-auto text-xl">
            🩺
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none mt-3">
            Registro Médico
          </h1>
          <p class="text-xs sm:text-sm text-slate-400 font-medium">
            Creá tu cuenta institucional del Portal de Beneficios AMP.
          </p>
        </div>

        {/* Global error */}
        {registerAction.value?.failed && (
          <div class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 animate-fade-in shadow-sm">
            ✗ {registerAction.value.message || "Error al registrar la cuenta."}
          </div>
        )}

        {/* Form */}
        <form method="post" action="/register/" class="space-y-4 text-left">
          <div class="space-y-1">
            <label for="name" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
              Nombre Completo
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              placeholder="Dr. o Dra. Nombre Apellido"
              class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
            />
            {registerAction.value?.fieldErrors?.name && (
              <p class="text-[10px] font-bold text-red-600 mt-1">{registerAction.value.fieldErrors.name[0]}</p>
            )}
          </div>

          <div class="space-y-1">
            <label for="matricula" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
              Matrícula Provincial
            </label>
            <input
              type="text"
              id="matricula"
              name="matricula"
              required
              placeholder="Ej: 12345"
              class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all"
            />
            {registerAction.value?.fieldErrors?.matricula && (
              <p class="text-[10px] font-bold text-red-600 mt-1">{registerAction.value.fieldErrors.matricula[0]}</p>
            )}
          </div>

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
            {registerAction.value?.fieldErrors?.email && (
              <p class="text-[10px] font-bold text-red-600 mt-1">{registerAction.value.fieldErrors.email[0]}</p>
            )}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1">
              <label for="password" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                Contraseña
              </label>
              <div class="relative">
                <input
                  type={showPassword.value ? "text" : "password"}
                  id="password"
                  name="password"
                  required
                  placeholder="Min 6 carac."
                  class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none pr-8 transition-all"
                />
              </div>
              {registerAction.value?.fieldErrors?.password && (
                <p class="text-[10px] font-bold text-red-600 mt-1">{registerAction.value.fieldErrors.password[0]}</p>
              )}
            </div>

            <div class="space-y-1">
              <label for="confirmPassword" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                Confirmar
              </label>
              <input
                type={showPassword.value ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                required
                placeholder="Repetir..."
                class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none transition-all"
              />
            </div>
          </div>

          <div class="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="show-pass"
              onClick$={() => (showPassword.value = !showPassword.value)}
              class="rounded border-slate-300 text-brand-green focus:ring-brand-green h-4 w-4"
            />
            <label for="show-pass" class="text-xs font-semibold text-slate-500 cursor-pointer">
              Mostrar contraseñas
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={registerAction.isRunning}
            class="w-full flex items-center justify-center py-3.5 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md transition-all duration-300 cursor-pointer mt-4"
          >
            {registerAction.isRunning ? "Registrando cuenta..." : "Crear Cuenta"}
          </button>
        </form>

        {/* Foot link */}
        <div class="pt-6 border-t border-slate-100 text-center">
          <p class="text-xs sm:text-sm text-slate-400 font-semibold">
            ¿Ya tenés una cuenta médica?{" "}
            <Link href="/login" class="text-brand-green hover:underline">
              Iniciá sesión
            </Link>
          </p>
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
      content: "Creá tu cuenta profesional para acceder a los descuentos exclusivos de la Agremiación Médica Platense.",
    },
  ],
};
