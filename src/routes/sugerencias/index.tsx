import { component$ } from "@builder.io/qwik";
import { routeAction$, routeLoader$, Form, type DocumentHead } from "@builder.io/qwik-city";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { saveSuggestion } from "~/server/club-content";
import { rateLimitByIp } from "~/server/rate-limit";
import { SUGGESTION_TYPES, isSuggestionType, validateSuggestion } from "~/utils/suggestions";

/** Prefills from links like /sugerencias/?tipo=Problema%20Comercio&comercio=X and from the session. */
export const useSuggestionDefaults = routeLoader$((event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  const tipo = event.url.searchParams.get("tipo") ?? "";
  return {
    tipo: isSuggestionType(tipo) ? tipo : "",
    comercio: (event.url.searchParams.get("comercio") ?? "").trim().slice(0, 120),
    nombre: user?.name ?? "",
    email: user?.email ?? "",
  };
});

export const useSubmitSuggestion = routeAction$(async (data, event) => {
  const { values, errors } = validateSuggestion(data);
  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  const limit = rateLimitByIp(event, "suggestion", 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return { success: false, message: "Ya enviaste varios mensajes. Probá de nuevo más tarde." };
  }

  try {
    await saveSuggestion(event, values);
    return { success: true };
  } catch (err) {
    console.error("Error saving suggestion:", err);
    return { success: false, message: "No pudimos guardar tu mensaje. Intentá de nuevo en unos minutos." };
  }
});

export default component$(() => {
  const action = useSubmitSuggestion();
  const defaults = useSuggestionDefaults();
  // After a failed submit keep what was typed; before that, use the prefilled values.
  const fieldValue = (name: "nombre" | "email" | "telefono" | "tipo" | "comercio" | "mensaje") => {
    const sent = action.formData?.get(name);
    if (sent !== undefined && sent !== null) return sent.toString();
    return name in defaults.value ? defaults.value[name as keyof typeof defaults.value] : "";
  };

  return (
    <div class="relative min-h-screen overflow-hidden py-12 sm:py-16 bg-slate-50 text-slate-800 flex items-center justify-center">
      {/* Decorative backdrop shapes */}
      <div class="absolute w-[400px] h-[400px] bg-brand-navy-light/5 rounded-full blur-3xl -top-20 -left-20" />
      <div class="absolute w-[400px] h-[400px] bg-brand-gold/5 rounded-full blur-3xl -bottom-20 -right-20" />

      <div class="relative w-full max-w-2xl px-4 z-10">
        
        {/* Breadcrumb / Title */}
        <div class="text-center mb-10 space-y-3">
          <h1 class="text-3xl sm:text-4xl font-display font-extrabold text-brand-navy-dark tracking-tight">
            ¿Tenés alguna sugerencia?
          </h1>
          <p class="text-slate-500 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            Tu opinión nos ayuda a crecer. Proponé nuevos comercios, reportá inconvenientes o dejanos tus dudas.
          </p>
        </div>

        {action.value?.success ? (
          /* C. Success Screen state */
          <div
            role="status"
            class="border border-slate-200 rounded-3xl p-8 sm:p-12 text-center shadow-lg bg-white space-y-6"
          >
            <div class="w-20 h-20 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-500 shadow-sm">
              <svg class="w-10 h-10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <div class="space-y-2">
              <h2 class="text-2xl font-display font-extrabold text-brand-navy-dark">
                ¡Gracias por escribirnos!
              </h2>
              <p class="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                Recibimos tu mensaje. El equipo del club lo va a revisar y, si hace falta, te va a contactar por correo.
              </p>
            </div>

            <div class="pt-6 border-t border-slate-100">
              <a
                href="/"
                class="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                Volver al Portal
              </a>
            </div>
          </div>
        ) : (
          /* D. Main Interactive Suggestions Form */
          <div class="border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-lg bg-white">
            <Form action={action} aria-busy={action.isRunning} class="space-y-6">
              <p class="text-xs text-slate-600">Los campos con * son obligatorios.</p>
              {action.value?.message && (
                <p role="alert" class="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {action.value.message}
                </p>
              )}
              
              {/* Row 1: Nombre & Correo */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Nombre */}
                <div class="relative">
                  <label
                    for="nombre"
                    class="mb-2 block text-xs font-bold text-slate-600"
                  >
                    Nombre Completo *
                  </label>
                  <input
                    id="nombre"
                    name="nombre"
                    aria-invalid={!!action.value?.errors?.nombre}
                    aria-describedby={
                      action.value?.errors?.nombre ? "nombre-error" : undefined
                    }
                    type="text"
                    autocomplete="name"
                    minLength={3}
                    required
                    value={fieldValue("nombre")}
                    class={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:bg-white focus:ring-1 transition-all ${
                      action.value?.errors?.nombre
                        ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                        : "border-slate-200 focus:ring-brand-navy-light focus:border-brand-navy-light"
                    }`}
                  />
                  {action.value?.errors?.nombre && (
                    <span id="nombre-error" role="alert" class="text-xs text-red-700 font-semibold mt-1.5 block pl-1">
                      {action.value.errors.nombre}
                    </span>
                  )}
                </div>

                {/* Email */}
                <div class="relative">
                  <label
                    for="email"
                    class="mb-2 block text-xs font-bold text-slate-600"
                  >
                    Correo Electrónico *
                  </label>
                  <input
                    id="email"
                    name="email"
                    aria-invalid={!!action.value?.errors?.email}
                    aria-describedby={
                      action.value?.errors?.email ? "email-error" : undefined
                    }
                    type="email"
                    autocomplete="email"
                    required
                    value={fieldValue("email")}
                    class={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:bg-white focus:ring-1 transition-all ${
                      action.value?.errors?.email
                        ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                        : "border-slate-200 focus:ring-brand-navy-light focus:border-brand-navy-light"
                    }`}
                  />
                  {action.value?.errors?.email && (
                    <span id="email-error" role="alert" class="text-xs text-red-700 font-semibold mt-1.5 block pl-1">
                      {action.value.errors.email}
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: Teléfono & Comercio */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Teléfono */}
                <div class="relative">
                  <label
                    for="telefono"
                    class="mb-2 block text-xs font-bold text-slate-600"
                  >
                    Teléfono de contacto (opcional)
                  </label>
                  <input
                    id="telefono"
                    name="telefono"
                    aria-invalid={!!action.value?.errors?.telefono}
                    aria-describedby={
                      action.value?.errors?.telefono ? "telefono-error" : undefined
                    }
                    type="tel"
                    autocomplete="tel"
                    value={fieldValue("telefono")}
                    class={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:bg-white focus:ring-1 transition-all ${
                      action.value?.errors?.telefono
                        ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                        : "border-slate-200 focus:ring-brand-navy-light focus:border-brand-navy-light"
                    }`}
                  />
                  {action.value?.errors?.telefono && (
                    <span id="telefono-error" role="alert" class="text-xs text-red-700 font-semibold mt-1.5 block pl-1">
                      {action.value.errors.telefono}
                    </span>
                  )}
                </div>

                {/* Comercio */}
                <div class="relative">
                  <label
                    for="comercio"
                    class="mb-2 block text-xs font-bold text-slate-600"
                  >
                    Nombre del comercio (opcional)
                  </label>
                  <input
                    id="comercio"
                    name="comercio"
                    type="text"
                    autocomplete="organization"
                    maxLength={120}
                    value={fieldValue("comercio")}
                    aria-invalid={!!action.value?.errors?.comercio}
                    aria-describedby={action.value?.errors?.comercio ? "comercio-error" : undefined}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-brand-navy-light focus:border-brand-navy-light transition-all"
                  />
                  {action.value?.errors?.comercio && (
                    <span id="comercio-error" role="alert" class="text-xs text-red-700 font-semibold mt-1.5 block pl-1">
                      {action.value.errors.comercio}
                    </span>
                  )}
                </div>
              </div>

              {/* Subject Category Motivo Selector */}
              <div class="space-y-2">
                <label for="tipo" class="text-xs font-bold uppercase tracking-wider text-slate-500 pl-1">
                  Motivo de la Sugerencia *
                </label>
                <select
                  id="tipo"
                  name="tipo"
                  aria-invalid={!!action.value?.errors?.tipo}
                  aria-describedby={
                    action.value?.errors?.tipo ? "tipo-error" : undefined
                  }
                  required
                  class={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:bg-white focus:ring-1 transition-all cursor-pointer ${
                    action.value?.errors?.tipo
                      ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                      : "border-slate-200 focus:ring-brand-navy-light focus:border-brand-navy-light"
                  }`}
                >
                  <option value="" disabled selected={!fieldValue("tipo")}>
                    Elegí una opción...
                  </option>
                  {SUGGESTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value} selected={fieldValue("tipo") === type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                {action.value?.errors?.tipo && (
                  <span id="tipo-error" role="alert" class="text-xs text-red-700 font-semibold mt-1.5 block pl-1">
                    {action.value.errors.tipo}
                  </span>
                )}
              </div>

              {/* Mensaje Textarea */}
              <div class="relative">
                <label
                  for="mensaje"
                  class="mb-2 block text-xs font-bold text-slate-600"
                >
                  Mensaje o Sugerencia *
                </label>
                <textarea
                  id="mensaje"
                  name="mensaje"
                  minLength={10}
                  maxLength={4000}
                  aria-invalid={!!action.value?.errors?.mensaje}
                  aria-describedby={
                    action.value?.errors?.mensaje ? "mensaje-error" : undefined
                  }
                  required
                  rows={5}
                  value={fieldValue("mensaje")}
                  class={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:bg-white focus:ring-1 transition-all resize-y ${
                    action.value?.errors?.mensaje
                      ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                      : "border-slate-200 focus:ring-brand-navy-light focus:border-brand-navy-light"
                  }`}
                />
                {action.value?.errors?.mensaje && (
                  <span id="mensaje-error" role="alert" class="text-xs text-red-700 font-semibold mt-1.5 block pl-1">
                    {action.value.errors.mensaje}
                  </span>
                )}
              </div>

              {/* Submit Button */}
              <div class="pt-4 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={action.isRunning}
                  class={`inline-flex w-full sm:w-auto items-center justify-center space-x-2 py-3.5 px-8 rounded-xl bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none`}
                >
                  {action.isRunning ? (
                    <>
                      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <span>Enviar Mensaje</span>
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

            </Form>
          </div>
        )}

      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Sugerencias y Dudas - Portal de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content: "¿Tenés un comercio para recomendarnos? ¿Tuviste problemas con algún beneficio? Escribinos y responderemos a la brevedad."
    }
  ]
};
