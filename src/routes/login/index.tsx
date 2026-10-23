import { component$, useSignal, $ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead, server$ } from "@builder.io/qwik-city";
import { createSession } from "~/server/auth";
import { findUsersByDni } from "~/server/member-dni";
import { rateLimitByIp } from "~/server/rate-limit";
import { LuLock } from "@qwikest/icons/lucide";
import { isValidDni, normalizeDni } from "~/utils/dni";
import { RETURN_PARAM, safeReturnPath } from "~/utils/return-path";

/** Where to go after logging in: the page that sent the member here, if it is ours. */
export const useReturnPath = routeLoader$((event) => safeReturnPath(event.url.searchParams.get(RETURN_PARAM)));

// Server-side login validation using server$
export const loginUserServer = server$(async function (dni: string) {
  // Members authenticate with DNI alone, so throttling is the only thing standing
  // between an attacker and enumerating the member base.
  const limit = rateLimitByIp(this, "member-login", 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return {
      success: false,
      error: `Demasiados intentos. Probá de nuevo en ${Math.ceil(limit.retryAfter / 60)} minuto(s).`,
    };
  }

  const cleanDni = normalizeDni(dni);
  if (!isValidDni(cleanDni)) {
    return {
      success: false,
      error:
        "Ingresá un DNI de 5 a 9 números. Podés incluir puntos o espacios.",
    };
  }
  const matches = await findUsersByDni(this, cleanDni);
  if (matches.length > 1) {
    return {
      success: false,
      error: "Hay más de una cuenta asociada a este DNI. Contactá a la administración del club.",
    };
  }
  const [user] = matches;

  if (!user) {
    return {
      success: false,
      error: "El DNI ingresado no se encuentra registrado.",
    };
  }

  // Admins must go through /admin/login with their password; a DNI alone is not
  // enough to obtain an administrator session.
  if (user.role === "admin") {
    return {
      success: false,
      adminAccount: true,
      error: "Las cuentas de administración ingresan con su contraseña.",
    };
  }

  await createSession(this, user.id);

  return { success: true };
});

export default component$(() => {
  const returnPath = useReturnPath();
  const dni = useSignal("");
  const errorMsg = useSignal("");
  const isAdminAccount = useSignal(false);
  const isSubmitting = useSignal(false);

  const handleSubmit = $(async () => {
    if (isSubmitting.value) return;
    errorMsg.value = "";
    isAdminAccount.value = false;
    const dniVal = normalizeDni(dni.value);
    if (!isValidDni(dniVal)) {
      errorMsg.value =
        "Ingresá un DNI de 5 a 9 números. Podés incluir puntos o espacios.";
      return;
    }

    isSubmitting.value = true;
    try {
      const res = await loginUserServer(dniVal);
      if (res.success) {
        // Full navigation so the header and every loader see the new session.
        window.location.href = returnPath.value ?? "/perfil/";
      } else {
        errorMsg.value = res.error || "El DNI ingresado no es válido.";
        isAdminAccount.value = "adminAccount" in res && Boolean(res.adminAccount);
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
            <LuLock class="w-5 h-5 text-brand-navy" />
          </div>
          <h1 class="text-3xl font-display font-extrabold text-brand-navy-dark tracking-tight leading-none mt-3">
            Iniciar Sesión
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 font-medium">
            {returnPath.value
              ? "Ingresá tu DNI para continuar. Después volvés a la página que estabas viendo."
              : "Ingresá tu DNI para acceder al portal de beneficios y credencial digital."}
          </p>
        </div>

        {/* Form */}
        <form class="space-y-5" preventdefault:submit onSubmit$={handleSubmit}>
          <div class="space-y-1">
            <label
              for="dni"
              class="text-xs font-bold text-slate-500 tracking-wider uppercase block"
            >
              DNI
            </label>
            <input
              type="text"
              inputMode="numeric"
              autocomplete="username"
              autoCapitalize="off"
              spellcheck={false}
              id="dni"
              bind:value={dni}
              required
              maxLength={20}
              placeholder="Ej.: 12.345.678"
              aria-invalid={!!errorMsg.value}
              aria-describedby={
                errorMsg.value ? "dni-help dni-error" : "dni-help"
              }
              class="w-full bg-slate-50 text-slate-800 placeholder-slate-400 text-base sm:text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-navy focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-navy transition-all font-mono font-bold text-center"
            />
            <p id="dni-help" class="text-xs text-slate-500 pt-1">
              Con o sin puntos y espacios.
            </p>
            {errorMsg.value && (
              <p
                id="dni-error"
                role="alert"
                class="text-xs font-semibold text-red-700 pt-1"
              >
                {errorMsg.value}
                {isAdminAccount.value && (
                  <>
                    {" "}
                    <a href="/admin/login/" class="underline underline-offset-2">
                      Ir al ingreso de administración
                    </a>
                  </>
                )}
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting.value}
            class="w-full flex items-center justify-center py-3.5 px-6 rounded-2xl bg-brand-navy hover:bg-brand-navy-light disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md transition-all duration-300 cursor-pointer"
          >
            {isSubmitting.value ? "Verificando..." : "Ingresar"}
          </button>
        </form>

        {/* Foot link */}
        <div class="pt-6 border-t border-slate-100 text-center">
          <p class="text-xs sm:text-sm text-slate-400 font-semibold leading-relaxed">
            ¿No estás registrado? <br />
            <span class="text-slate-500 font-bold block mt-1">
              El alta se gestiona a través de la administración de la LPRC.
            </span>
            <a
              href="https://lprc.com.ar"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-block mt-3 font-bold text-brand-navy underline underline-offset-4"
            >
              Contactar al club ↗
            </a>
          </p>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Iniciar Sesión - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content:
        "Ingresá con tu DNI al Club de Beneficios de la La Plata Rugby Club para descargar tus cupones y credencial digital.",
    },
  ],
};
