import { component$ } from "@builder.io/qwik";
import { routeAction$, routeLoader$, Form, Link, type DocumentHead } from "@builder.io/qwik-city";
import { LuArrowRight, LuCheckCircle, LuMessageCircle, LuPhone, LuStore } from "@qwikest/icons/lucide";
import { SectionHeading } from "~/components/section-heading/section-heading";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { saveSuggestion } from "~/server/club-content";
import { isPlaceholderEmail } from "~/server/member-dni";
import { rateLimitByIp } from "~/server/rate-limit";
import { CLUB, WHATSAPP_MESSAGES, whatsappLink } from "~/utils/club";
import { SUGGESTION_TYPES, SUGGESTION_TYPES_WITH_COMMERCE, isSuggestionType, validateSuggestion } from "~/utils/suggestions";

/**
 * Prefills from links like /sugerencias/?tipo=Problema%20Comercio&comercio=X (the 404 page
 * also sends `mensaje` with the broken address) and from the session.
 */
export const useSuggestionDefaults = routeLoader$((event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  const tipo = event.url.searchParams.get("tipo") ?? "";
  return {
    tipo: isSuggestionType(tipo) ? tipo : "",
    comercio: (event.url.searchParams.get("comercio") ?? "").trim().slice(0, 120),
    mensaje: (event.url.searchParams.get("mensaje") ?? "").trim().slice(0, 1000),
    nombre: user?.name ?? "",
    email: user && !isPlaceholderEmail(user.email) ? user.email : "",
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

type FieldName = "nombre" | "email" | "telefono" | "tipo" | "comercio" | "mensaje";

const errorClass = "mt-1.5 block text-xs font-semibold text-red-700";


export default component$(() => {
  const action = useSubmitSuggestion();
  const defaults = useSuggestionDefaults();
  // After a failed submit keep what was typed; before that, use the prefilled values.
  const fieldValue = (name: FieldName) => {
    const sent = action.formData?.get(name);
    if (sent !== undefined && sent !== null) return sent.toString();
    return name in defaults.value ? defaults.value[name as keyof typeof defaults.value] : "";
  };
  const errors = action.value?.errors as Record<string, string> | undefined;
  const selectedType = fieldValue("tipo");

  return (
    <div class="bg-background">
      <section class="border-b-4 border-accent bg-primary text-white">
        <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
          <SectionHeading as="h1" tone="dark" size="xl" eyebrow="Escribinos" title="Sugerencias y consultas">
            <p class="mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Recomendá un comercio, contanos si algo no funcionó o dejanos tu consulta. El equipo del club lee cada mensaje.
            </p>
          </SectionHeading>
        </div>
      </section>

      <div class="mx-auto grid max-w-6xl items-start gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:px-8">
        {action.value?.success ? (
          <div role="status" class="card border-t-4 border-t-accent p-6 sm:p-10">
            <p class="flex items-center gap-2 text-sm font-bold text-green-800">
              <LuCheckCircle class="h-5 w-5" aria-hidden="true" />
              Mensaje enviado
            </p>
            <h2 class="heading-display mt-3 text-3xl text-primary">¡Gracias por escribirnos!</h2>
            <p class="mt-3 max-w-lg text-sm leading-relaxed text-slate-600">
              Recibimos tu mensaje. El equipo del club lo va a revisar y, si hace falta, te responde por mail o WhatsApp.
            </p>
            <div class="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/" class="btn btn-dark">
                Volver al inicio
              </Link>
              <a href="/sugerencias/" class="btn btn-outline">
                Enviar otro mensaje
              </a>
            </div>
          </div>
        ) : (
          <div class="card p-5 sm:p-8">
            <Form action={action} aria-busy={action.isRunning} class="group/form space-y-8">
              {action.value?.message && (
                <p role="alert" class="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                  {action.value.message}
                </p>
              )}

              <fieldset aria-describedby={errors?.tipo ? "tipo-error" : undefined}>
                <legend class="heading-display text-xl text-primary">
                  <span class="text-amber-900">1.</span> ¿Sobre qué nos escribís? <span class="sr-only">(obligatorio)</span>
                </legend>
                <p class="mt-2 text-sm text-slate-600">
                  ¿Tenés un comercio y querés sumarte?{" "}
                  <a href="#comercios" class="font-bold text-primary underline underline-offset-4">
                    Mirá cómo
                  </a>
                </p>
                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  {SUGGESTION_TYPES.map((type, index) => (
                    <label
                      key={type.value}
                      for={`tipo-${index}`}
                      class="flex min-h-11 cursor-pointer gap-3 border border-slate-300 bg-white p-4 transition-colors hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-amber-50 has-[:checked]:shadow-[inset_4px_0_0_var(--color-accent)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
                    >
                      <input
                        id={`tipo-${index}`}
                        type="radio"
                        name="tipo"
                        value={type.value}
                        required
                        checked={selectedType === type.value}
                        class={[
                          "mt-0.5 h-4 w-4 shrink-0 accent-primary focus:outline-none",
                          SUGGESTION_TYPES_WITH_COMMERCE.includes(type.value) && "needs-commerce",
                        ]}
                      />
                      <span>
                        <span class="block text-sm font-bold text-primary">{type.title}</span>
                        <span class="mt-1 block text-xs leading-relaxed text-slate-600">{type.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {errors?.tipo && (
                  <span id="tipo-error" role="alert" class={errorClass}>
                    {errors.tipo}
                  </span>
                )}
              </fieldset>

              <fieldset class="space-y-5">
                <legend class="heading-display text-xl text-primary">
                  <span class="text-amber-900">2.</span> Tu mensaje
                </legend>
                <p class="text-xs text-slate-600">Los campos con * son obligatorios.</p>

                <div class="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label for="nombre" class="field-label">
                      Nombre y apellido *
                    </label>
                    <input
                      id="nombre"
                      name="nombre"
                      type="text"
                      autocomplete="name"
                      minLength={3}
                      required
                      value={fieldValue("nombre")}
                      aria-invalid={!!errors?.nombre}
                      aria-describedby={errors?.nombre ? "nombre-error" : undefined}
                      class="field text-base sm:text-sm"
                    />
                    {errors?.nombre && (
                      <span id="nombre-error" role="alert" class={errorClass}>
                        {errors.nombre}
                      </span>
                    )}
                  </div>
                  <div>
                    <label for="email" class="field-label">
                      Correo electrónico *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autocomplete="email"
                      required
                      value={fieldValue("email")}
                      aria-invalid={!!errors?.email}
                      aria-describedby={errors?.email ? "email-error" : undefined}
                      class="field text-base sm:text-sm"
                    />
                    {errors?.email && (
                      <span id="email-error" role="alert" class={errorClass}>
                        {errors.email}
                      </span>
                    )}
                  </div>
                </div>

                <div class="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label for="telefono" class="field-label">
                      Teléfono (opcional)
                    </label>
                    <input
                      id="telefono"
                      name="telefono"
                      type="tel"
                      autocomplete="tel"
                      value={fieldValue("telefono")}
                      aria-invalid={!!errors?.telefono}
                      aria-describedby={errors?.telefono ? "telefono-error" : "telefono-help"}
                      class="field text-base sm:text-sm"
                    />
                    <span id="telefono-help" class="mt-1.5 block text-xs text-slate-600">
                      Si preferís que te respondamos por WhatsApp.
                    </span>
                    {errors?.telefono && (
                      <span id="telefono-error" role="alert" class={errorClass}>
                        {errors.telefono}
                      </span>
                    )}
                  </div>
                  {/* The shop name only matters for some reasons; CSS reveals it on selection, even before Qwik wakes up. */}
                  <div class="hidden group-has-[.needs-commerce:checked]/form:block">
                    <label for="comercio" class="field-label">
                      Nombre del comercio (opcional)
                    </label>
                    <input
                      id="comercio"
                      name="comercio"
                      type="text"
                      autocomplete="organization"
                      maxLength={120}
                      value={fieldValue("comercio")}
                      aria-invalid={!!errors?.comercio}
                      aria-describedby={errors?.comercio ? "comercio-error" : undefined}
                      class="field text-base sm:text-sm"
                    />
                    {errors?.comercio && (
                      <span id="comercio-error" role="alert" class={errorClass}>
                        {errors.comercio}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label for="mensaje" class="field-label">
                    Mensaje *
                  </label>
                  <textarea
                    id="mensaje"
                    name="mensaje"
                    minLength={10}
                    maxLength={4000}
                    required
                    rows={6}
                    value={fieldValue("mensaje")}
                    aria-invalid={!!errors?.mensaje}
                    aria-describedby={errors?.mensaje ? "mensaje-error" : undefined}
                    class="field resize-y text-base sm:text-sm"
                  />
                  {errors?.mensaje && (
                    <span id="mensaje-error" role="alert" class={errorClass}>
                      {errors.mensaje}
                    </span>
                  )}
                </div>
              </fieldset>

              <div class="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-xs text-slate-600">Te respondemos por mail o WhatsApp.</p>
                <button type="submit" disabled={action.isRunning} class="btn btn-dark w-full sm:w-auto">
                  {action.isRunning ? "Enviando…" : "Enviar mensaje"}
                  {!action.isRunning && <LuArrowRight class="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </Form>
          </div>
        )}

        <aside class="space-y-6" aria-label="Otros canales">
          <section aria-labelledby="direct-channels-title" class="card p-6">
            <h2 id="direct-channels-title" class="heading-display text-xl text-primary">
              ¿Preferís hablar directo?
            </h2>
            <span class="title-bar mt-3" aria-hidden="true" />
            <p class="mt-4 text-sm leading-relaxed text-slate-600">
              Escribinos al WhatsApp del club o llamá a la secretaría al {CLUB.phoneDisplay}.
            </p>
            <div class="mt-5 flex flex-col gap-3">
              <a href={whatsappLink(WHATSAPP_MESSAGES.consulta)} target="_blank" rel="noopener" class="btn btn-dark">
                <LuMessageCircle class="h-4 w-4" aria-hidden="true" />
                WhatsApp del club
                <span class="sr-only"> (abre en una pestaña nueva)</span>
              </a>
              <a href={CLUB.phoneHref} class="btn btn-outline">
                <LuPhone class="h-4 w-4" aria-hidden="true" />
                Llamar a secretaría
              </a>
            </div>
            <p class="mt-5 border-t border-line pt-4 text-sm text-slate-600">
              ¿No podés ingresar con tu DNI?{" "}
              <Link href="/ayuda-ingreso/" class="font-bold text-primary underline underline-offset-4">
                Mirá la ayuda para ingresar
              </Link>
            </p>
          </section>

          <section id="comercios" aria-labelledby="merchant-join-title" class="scroll-mt-40 border-t-4 border-accent bg-primary p-6 text-white">
            <LuStore class="h-8 w-8 text-accent" aria-hidden="true" />
            <p class="eyebrow mt-4 text-accent">Para comercios</p>
            <h2 id="merchant-join-title" class="heading-display mt-2 text-xl">
              Soy comercio y quiero sumarme
            </h2>
            <p class="mt-3 text-sm leading-relaxed text-slate-300">
              Este formulario es para socios. Si tenés un comercio y querés ofrecer un beneficio, completá la solicitud «Sumate al Club» del inicio.
            </p>
            <div class="mt-5 flex flex-col gap-3">
              <Link href="/#sumar-comercio" class="btn btn-primary">
                Sumar mi comercio
              </Link>
              <a href={whatsappLink(WHATSAPP_MESSAGES.comercio)} target="_blank" rel="noopener" class="btn btn-outline-light btn-sm">
                Ayuda para validar cupones
                <span class="sr-only"> (WhatsApp, abre en una pestaña nueva)</span>
              </a>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Sugerencias y consultas - Club de Beneficios LPRC",
  meta: [
    {
      name: "description",
      content:
        "Recomendá un comercio, reportá un problema con un beneficio o dejanos tu consulta. El equipo de La Plata Rugby Club te responde por mail o WhatsApp.",
    },
  ],
};
