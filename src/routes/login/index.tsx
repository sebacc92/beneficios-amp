import { component$, useSignal, $ } from "@builder.io/qwik";
import { Link, routeLoader$, type DocumentHead, server$ } from "@builder.io/qwik-city";
import { LuArrowRight, LuMessageCircle, LuTicket } from "@qwikest/icons/lucide";
import { createSession } from "~/server/auth";
import { getBenefitBySlug } from "~/server/cache";
import { findUsersByDni } from "~/server/member-dni";
import { rateLimitByIp } from "~/server/rate-limit";
import { CLUB, WHATSAPP_MESSAGES, dniHelpMessage, whatsappLink } from "~/utils/club";
import { isValidDni, normalizeDni } from "~/utils/dni";
import { RETURN_PARAM, safeReturnPath } from "~/utils/return-path";

/** Where to go after logging in: the page that sent the member here, if it is ours. */
export const useReturnPath = routeLoader$((event) => safeReturnPath(event.url.searchParams.get(RETURN_PARAM)));

/** Tells the member why we ask for the DNI: a coupon for a given benefit, a saved coupon, or nothing special. */
export const useReturnContext = routeLoader$(async (event) => {
  const path = await event.resolveValue(useReturnPath);
  if (!path) return null;
  const benefit = /^\/beneficio\/([^/?#]+)/.exec(path);
  if (benefit) {
    let title: string | null = null;
    try {
      const found = await getBenefitBySlug(decodeURIComponent(benefit[1]), event);
      if (found && found.isActive !== false) title = found.titulo;
    } catch {
      // A malformed slug or a cache miss only costs the benefit's name.
    }
    return { kind: "benefit" as const, title };
  }
  if (path.startsWith("/perfil/cupon")) return { kind: "coupon" as const, title: null };
  return { kind: "page" as const, title: null };
});

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
      notFound: true,
      error: "Hay más de una cuenta asociada a este DNI. Escribinos para que la revisemos.",
    };
  }
  const [user] = matches;

  if (!user) {
    return {
      success: false,
      notFound: true,
      error: "Ese DNI no figura en el portal.",
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
  const returnContext = useReturnContext();
  const dni = useSignal("");
  const errorMsg = useSignal("");
  const isAdminAccount = useSignal(false);
  const isNotFound = useSignal(false);
  const isSubmitting = useSignal(false);

  const handleSubmit = $(async () => {
    if (isSubmitting.value) return;
    errorMsg.value = "";
    isAdminAccount.value = false;
    isNotFound.value = false;
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
        isNotFound.value = "notFound" in res && Boolean(res.notFound);
        isSubmitting.value = false;
      }
    } catch (err) {
      console.error(err);
      errorMsg.value = "Ocurrió un error inesperado al iniciar sesión.";
      isSubmitting.value = false;
    }
  });

  const context = returnContext.value;
  const helpHref = whatsappLink(dniHelpMessage(dni.value));

  return (
    <div class="bg-background">
      <div class="mx-auto grid max-w-6xl lg:my-12 lg:grid-cols-2 lg:border lg:border-line">
        <section aria-labelledby="login-title" class="flex flex-col justify-center bg-primary px-6 py-10 text-white sm:px-10 lg:py-16">
          <div class="flex items-center gap-5 lg:block">
            <img src="/lprc.avif" alt="" width={120} height={101} class="h-auto w-20 shrink-0 sm:w-24 lg:w-40" />
            <div class="lg:mt-8">
              <p class="eyebrow text-accent">Socios de {CLUB.name}</p>
              <h1 id="login-title" class="heading-display mt-2 text-3xl sm:text-4xl lg:text-5xl">
                Ingresá con tu DNI
              </h1>
            </div>
          </div>
          <span class="title-bar mt-5" aria-hidden="true" />
          <p class="mt-5 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
            Sin contraseña: tu DNI es tu llave a la credencial digital, tus cupones y los beneficios de la familia amarilla.
          </p>
        </section>

        <section aria-label="Formulario de ingreso" class="bg-surface px-6 py-10 sm:px-10 lg:py-16">
          {context && (
            <div class="mb-6 border-l-4 border-accent bg-amber-50 px-4 py-3 text-sm text-primary">
              {context.kind === "benefit" ? (
                <p class="flex gap-2">
                  <LuTicket class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    <strong>Ingresá para obtener tu cupón</strong>
                    {context.title ? (
                      <>
                        {" "}de <strong>{context.title}</strong>.
                      </>
                    ) : (
                      "."
                    )}{" "}
                    Después volvés al beneficio.
                  </span>
                </p>
              ) : context.kind === "coupon" ? (
                <p>
                  <strong>Ingresá para ver tu cupón.</strong> Después volvés directo a él.
                </p>
              ) : (
                <p>Ingresá para continuar. Después volvés a la página que estabas viendo.</p>
              )}
            </div>
          )}

          <form class="space-y-5" preventdefault:submit onSubmit$={handleSubmit}>
            <div>
              <label for="dni" class="field-label">
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
                aria-describedby={errorMsg.value ? "dni-help dni-error" : "dni-help"}
                class="field text-base"
              />
              <p id="dni-help" class="mt-1.5 text-xs text-slate-600">
                Con o sin puntos y espacios.
              </p>
              {errorMsg.value && (
                <div id="dni-error" role="alert" class="mt-3 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <p class="font-semibold">{errorMsg.value}</p>
                  {isAdminAccount.value && (
                    <a href="/admin/login/" class="mt-1 inline-block font-bold underline underline-offset-2">
                      Ir al ingreso de administración
                    </a>
                  )}
                  {isNotFound.value && (
                    <p class="mt-1">
                      Si sos socio,{" "}
                      <a href={helpHref} target="_blank" rel="noopener" class="font-bold underline underline-offset-2">
                        escribinos por WhatsApp con tu DNI
                        <span class="sr-only"> (abre en una pestaña nueva)</span>
                      </a>{" "}
                      y lo revisamos.
                    </p>
                  )}
                </div>
              )}
            </div>

            <button type="submit" disabled={isSubmitting.value} class="btn btn-primary w-full text-base">
              {isSubmitting.value ? "Verificando…" : "Ingresar"}
            </button>
          </form>

          <p class="mt-5 text-sm">
            <Link href="/ayuda-ingreso/" class="inline-flex min-h-11 items-center gap-2 font-bold text-primary underline decoration-slate-300 underline-offset-4 hover:decoration-primary">
              ¿No podés ingresar?
              <LuArrowRight class="h-4 w-4" aria-hidden="true" />
            </Link>
          </p>

          <div class="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2">
            <div class="bg-surface-muted p-5">
              <h2 class="font-display text-base font-semibold uppercase tracking-wide text-primary">Soy socio y mi DNI no figura</h2>
              <p class="mt-2 text-sm leading-relaxed text-slate-600">
                Escribinos y revisamos tu alta{dni.value ? " con el DNI que tipeaste" : ""}.
              </p>
              <a href={helpHref} target="_blank" rel="noopener" class="btn btn-dark btn-sm mt-4 w-full">
                <LuMessageCircle class="h-4 w-4" aria-hidden="true" />
                WhatsApp del club
                <span class="sr-only"> (abre en una pestaña nueva)</span>
              </a>
            </div>
            <div class="bg-surface-muted p-5">
              <h2 class="font-display text-base font-semibold uppercase tracking-wide text-primary">No soy socio</h2>
              <p class="mt-2 text-sm leading-relaxed text-slate-600">Los beneficios son para socios. Sumate a la familia amarilla.</p>
              <a href={whatsappLink(WHATSAPP_MESSAGES.haceteSocio)} target="_blank" rel="noopener" class="btn btn-outline btn-sm mt-4 w-full">
                Hacete socio
                <span class="sr-only"> (WhatsApp, abre en una pestaña nueva)</span>
              </a>
              <Link href="/register/" class="mt-2 inline-flex min-h-11 items-center text-xs font-bold text-primary underline underline-offset-4">
                Por qué asociarte
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Ingresar - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content:
        "Ingresá con tu DNI al Club de Beneficios de La Plata Rugby Club para obtener tus cupones y tu credencial digital.",
    },
  ],
};
