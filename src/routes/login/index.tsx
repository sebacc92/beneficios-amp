import { component$, useSignal, $ } from "@builder.io/qwik";
import {
  type DocumentHead,
  server$,
} from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import { LuLock } from "@qwikest/icons/lucide";

// Server-side login validation using server$
export const loginUserServer = server$(async function(dni: string) {
  const db = getDB(this);
  const cleanDni = dni.trim();

  // Find user by DNI (stored in matricula field)
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.matricula, cleanDni))
    .limit(1);

  if (!user) {
    return { success: false, error: "El DNI ingresado no se encuentra registrado." };
  }

  // Set cookie session (expires in 30 days)
  this.cookie.set("session_token", user.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return { success: true };
});

export default component$(() => {
  const dni = useSignal("");
  const errorMsg = useSignal("");
  const isSubmitting = useSignal(false);

  const handleSubmit = $(async () => {
    errorMsg.value = "";
    const dniVal = dni.value.trim();
    if (dniVal.length < 5) {
      errorMsg.value = "El DNI debe tener al menos 5 caracteres.";
      return;
    }

    isSubmitting.value = true;
    try {
      const res = await loginUserServer(dniVal);
      if (res.success) {
        window.location.href = "/perfil";
      } else {
        errorMsg.value = res.error || "El DNI ingresado no es válido.";
        isSubmitting.value = false;
      }
    } catch (err) {
      console.error(err);
      errorMsg.value = "Ocurrió un error inesperado al iniciar sesión.";
      isSubmitting.value = false;
    }
  });

  return (
    <div class="bg-slate-50 min-h-[85vh] py-16 px-4 flex flex-col justify-center items-center font-sans">
      <div class="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">

        {/* Title branding */}
        <div class="text-center space-y-2">
          <div class="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100 mx-auto">
            <LuLock class="w-5 h-5 text-brand-green" />
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none mt-3">
            Iniciar Sesión
          </h1>
          <p class="text-xs sm:text-sm text-slate-400 font-medium">
            Ingresá tu DNI para acceder al portal de beneficios y credencial digital.
          </p>
        </div>

        {/* Global Error message */}
        {errorMsg.value && (
          <div class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 animate-fade-in shadow-sm">
            ✗ {errorMsg.value}
          </div>
        )}

        {/* Form */}
        <div class="space-y-5">
          <div class="space-y-1">
            <label for="dni" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
              DNI / Identificación
            </label>
            <input
              type="text"
              id="dni"
              bind:value={dni}
              required
              placeholder="Ingresá tu número de DNI"
              onKeyDown$={async (ev) => {
                if (ev.key === "Enter") {
                  await handleSubmit();
                }
              }}
              class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-green transition-all font-mono font-bold text-center"
            />
          </div>

          {/* Submit button */}
          <button
            type="button"
            onClick$={handleSubmit}
            disabled={isSubmitting.value}
            class="w-full flex items-center justify-center py-3.5 px-6 rounded-2xl bg-brand-green hover:bg-brand-green-light disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
          >
            {isSubmitting.value ? "Verificando..." : "Ingresar"}
          </button>
        </div>

        {/* Foot link */}
        <div class="pt-6 border-t border-slate-100 text-center">
          <p class="text-xs sm:text-sm text-slate-400 font-semibold leading-relaxed">
            ¿No estás registrado? <br />
            <span class="text-slate-500 font-bold block mt-1">El alta se gestiona a través de la administración de la AMP.</span>
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
      content: "Ingresá con tu DNI al Club de Beneficios de la Agremiación Médica Platense para descargar tus cupones y credencial digital.",
    },
  ],
};
