import { component$ } from "@builder.io/qwik";
import { routeAction$, Form, type DocumentHead } from "@builder.io/qwik-city";

// Server action to process form submission with robust programmatic validation
export const useSubmitSuggestion = routeAction$(async (data) => {
  const nombre = String(data.nombre || "").trim();
  const email = String(data.email || "").trim();
  const telefono = String(data.telefono || "").trim();
  const tipo = String(data.tipo || "").trim();
  const comercio = String(data.comercio || "").trim();
  const mensaje = String(data.mensaje || "").trim();

  // Error bag
  const errors: Record<string, string> = {};

  if (!nombre) {
    errors.nombre = "El nombre es obligatorio.";
  } else if (nombre.length < 3) {
    errors.nombre = "El nombre debe tener al menos 3 caracteres.";
  }

  if (!email) {
    errors.email = "El correo electrónico es obligatorio.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "El formato de correo electrónico no es válido.";
  }

  if (telefono && !/^[0-9\s\-+()]{7,15}$/.test(telefono)) {
    errors.telefono = "El número de teléfono no es válido.";
  }

  if (!tipo) {
    errors.tipo = "Por favor selecciona el motivo de tu mensaje.";
  }

  if (!mensaje) {
    errors.mensaje = "El mensaje es obligatorio.";
  } else if (mensaje.length < 10) {
    errors.mensaje = "El mensaje debe tener al menos 10 caracteres.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      errors
    };
  }

  // Visual simulation of a database save or forwarding to official API
  console.log("[Suggestion Action] New submission received:", {
    nombre,
    email,
    telefono,
    tipo,
    comercio,
    mensaje,
    submittedAt: new Date().toISOString()
  });

  // Delay slightly to simulate server processing for satisfying loading spinner animations
  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    success: true
  };
});

export default component$(() => {
  const action = useSubmitSuggestion();

  return (
    <div class="relative min-h-screen overflow-hidden py-12 sm:py-16 bg-slate-50 text-slate-800 flex items-center justify-center">
      {/* Decorative backdrop shapes */}
      <div class="absolute w-[400px] h-[400px] bg-brand-green-light/5 rounded-full blur-3xl -top-20 -left-20" />
      <div class="absolute w-[400px] h-[400px] bg-brand-gold/5 rounded-full blur-3xl -bottom-20 -right-20" />

      <div class="relative w-full max-w-2xl px-4 z-10">
        
        {/* Breadcrumb / Title */}
        <div class="text-center mb-10 space-y-3">
          <h1 class="text-3xl sm:text-4xl font-display font-extrabold text-brand-green-dark tracking-tight">
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
              <h2 class="text-2xl font-display font-extrabold text-brand-green-dark">
                ¡Sugerencia Enviada!
              </h2>
              <p class="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                Agradecemos mucho tu tiempo. Tu mensaje ha sido registrado y será analizado por la Mesa Directiva de la LPRC para seguir mejorando el portal.
              </p>
            </div>

            <div class="pt-6 border-t border-slate-100">
              <a
                href="/"
                class="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
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
                    value={action.formData?.get("nombre")?.toString() || ""}
                    class={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:bg-white focus:ring-1 transition-all ${
                      action.value?.errors?.nombre
                        ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                        : "border-slate-200 focus:ring-brand-green-light focus:border-brand-green-light"
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
                    value={action.formData?.get("email")?.toString() || ""}
                    class={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:bg-white focus:ring-1 transition-all ${
                      action.value?.errors?.email
                        ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                        : "border-slate-200 focus:ring-brand-green-light focus:border-brand-green-light"
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
                    value={action.formData?.get("telefono")?.toString() || ""}
                    class={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:bg-white focus:ring-1 transition-all ${
                      action.value?.errors?.telefono
                        ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                        : "border-slate-200 focus:ring-brand-green-light focus:border-brand-green-light"
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
                    value={action.formData?.get("comercio")?.toString() || ""}
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-brand-green-light focus:border-brand-green-light transition-all"
                  />
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
                      : "border-slate-200 focus:ring-brand-green-light focus:border-brand-green-light"
                  }`}
                >
                  <option value="" disabled selected={!action.formData?.get("tipo")}>
                    Selecciona una opción...
                  </option>
                  <option value="Sugerir Comercio" selected={action.formData?.get("tipo")?.toString() === "Sugerir Comercio"}>
                    Recomendar un nuevo comercio adherido
                  </option>
                  <option value="Problema Comercio" selected={action.formData?.get("tipo")?.toString() === "Problema Comercio"}>
                    Reportar un inconveniente con un beneficio o descuento
                  </option>
                  <option value="Consulta General" selected={action.formData?.get("tipo")?.toString() === "Consulta General"}>
                    Consulta o duda general sobre el club
                  </option>
                  <option value="Otro" selected={action.formData?.get("tipo")?.toString() === "Otro"}>
                    Otro motivo
                  </option>
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
                  aria-invalid={!!action.value?.errors?.mensaje}
                  aria-describedby={
                    action.value?.errors?.mensaje ? "mensaje-error" : undefined
                  }
                  required
                  rows={5}
                  value={action.formData?.get("mensaje")?.toString() || ""}
                  class={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:bg-white focus:ring-1 transition-all resize-y ${
                    action.value?.errors?.mensaje
                      ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                      : "border-slate-200 focus:ring-brand-green-light focus:border-brand-green-light"
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
                  class={`inline-flex w-full sm:w-auto items-center justify-center space-x-2 py-3.5 px-8 rounded-xl bg-brand-green hover:bg-brand-green-light text-white text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none`}
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
