import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { LuSmartphone, LuGift, LuStore } from "@qwikest/icons/lucide";
import { submitMerchantRequest } from "~/routes/index";
import { SectionHeading } from "~/components/section-heading/section-heading";

export const EditorialCards = component$(() => {
  const merchantDialog = useSignal<HTMLDialogElement>();

  // /como-funciona and /sugerencias link to /#sumar-comercio to open the form directly.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (window.location.hash === "#sumar-comercio") merchantDialog.value?.showModal();
  });
  const merchantBusinessName = useSignal("");
  const merchantCategory = useSignal("");
  const merchantContactName = useSignal("");
  const merchantEmail = useSignal("");
  const merchantPhone = useSignal("");
  const merchantProposal = useSignal("");
  const isMerchantSubmitting = useSignal(false);
  const merchantSubmitSuccess = useSignal(false);
  const merchantSubmitError = useSignal("");

  const cardBase = "card group flex flex-col justify-between p-6 text-left transition-[border-color,box-shadow] hover:border-primary hover:shadow-md cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent lg:p-8";
  const iconBox = "mb-5 flex h-12 w-12 items-center justify-center bg-accent text-primary";
  const ctaBase = "mt-6 inline-flex items-center gap-1 text-sm font-semibold text-secondary group-hover:underline";
  const labelClass = "field-label";
  const fieldClass = "field text-base sm:text-sm";

  return (
    <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-12 print:hidden text-left">
      <SectionHeading eyebrow="Además del catálogo" title="Tu espacio en el portal" class="mb-8" />

      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
        {/* The real credential (with its scannable QR) lives in /perfil; login returns here. */}
        <Link href="/perfil/?credencial=1" class={cardBase}>
          <div>
            <span class={iconBox}><LuSmartphone class="h-6 w-6 stroke-2" aria-hidden="true" /></span>
            <h3 class="heading-display text-xl text-primary">Credencial digital</h3>
            <p class="mt-3 text-sm leading-relaxed text-slate-600">Tenela a mano en el celular y mostrala en el comercio junto con tu cupón.</p>
          </div>
          <span class={ctaBase}>Ver credencial <span aria-hidden="true">&rarr;</span></span>
        </Link>

        {/* Raffles are managed in /admin/sorteos; the page always shows the current ones. */}
        <Link href="/sorteos/" class={cardBase}>
          <div>
            <span class={iconBox}><LuGift class="h-6 w-6 stroke-2" aria-hidden="true" /></span>
            <h3 class="heading-display text-xl text-primary">Sorteos</h3>
            <p class="mt-3 text-sm leading-relaxed text-slate-600">Mirá los sorteos vigentes, sus bases y condiciones y los ganadores anteriores.</p>
          </div>
          <span class={ctaBase}>Ver sorteos <span aria-hidden="true">&rarr;</span></span>
        </Link>

        <button id="sumar-comercio" type="button" onClick$={() => merchantDialog.value?.showModal()} class={`${cardBase} scroll-mt-40`}>
          <div>
            <span class={iconBox}><LuStore class="h-6 w-6 stroke-2" aria-hidden="true" /></span>
            <h3 class="heading-display text-xl text-primary">Sumá tu comercio</h3>
            <p class="mt-3 text-sm leading-relaxed text-slate-600">¿Tenés un comercio o empresa? Proponé un beneficio para los socios del club y te contactamos.</p>
          </div>
          <span class={ctaBase}>Sumar mi comercio <span aria-hidden="true">&rarr;</span></span>
        </button>
      </div>

      {/* Modal: Merchant */}
      <dialog
        ref={merchantDialog}
        aria-labelledby="merchant-dialog-title"
        class="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto border-t-4 border-accent bg-white p-6 text-left text-slate-800 shadow-2xl backdrop:bg-brand-ink/70 sm:p-8"
        onClose$={() => { merchantSubmitSuccess.value = false; merchantSubmitError.value = ""; }}
        onClick$={(event, element) => {
          // A click on the backdrop lands on the <dialog> itself.
          if (event.target === element) element.close();
        }}
      >
        <button type="button" onClick$={() => merchantDialog.value?.close()} aria-label="Cerrar formulario" class="absolute top-3 right-3 flex h-11 w-11 items-center justify-center border border-line text-slate-600 transition-colors hover:border-primary hover:text-primary cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span aria-hidden="true">✕</span>
        </button>
        {merchantSubmitSuccess.value ? (
          <div role="status" class="flex flex-col items-center justify-center py-10 space-y-4 text-center">
            <div class="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-700 border border-emerald-200"><svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg></div>
            <h2 id="merchant-dialog-title" class="heading-display text-2xl text-primary">¡Propuesta recibida!</h2>
            <p class="text-slate-600 text-sm max-w-sm font-medium">Recibimos la propuesta para incorporar a <strong class="text-slate-800">{merchantBusinessName.value}</strong> al Club de Beneficios.</p>
            <p class="text-slate-600 text-xs max-w-xs leading-relaxed">El equipo del club la va a revisar y te va a escribir a <strong>{merchantEmail.value}</strong>.</p>
            <div class="pt-4"><button type="button" onClick$={() => merchantDialog.value?.close()} class="btn btn-dark">Entendido</button></div>
          </div>
        ) : (
          <div class="space-y-5">
            <div class="flex items-center gap-3 mb-2 pr-12"><div class="flex h-11 w-11 shrink-0 items-center justify-center bg-accent text-primary"><LuStore class="w-5 h-5 stroke-[2]" aria-hidden="true" /></div><div><p class="eyebrow text-amber-900">Comercios adheridos</p><h2 id="merchant-dialog-title" class="heading-display text-2xl text-primary mt-1">Sumá tu comercio</h2></div></div>
            <p class="text-sm text-slate-600 leading-relaxed">Ofrecé un beneficio a los socios de La Plata Rugby Club y sumá tu comercio al portal. Contanos tu propuesta y te contactamos.</p>
            <form onSubmit$={async (e) => {
              e.preventDefault();
              if (!merchantBusinessName.value || !merchantCategory.value || !merchantContactName.value || !merchantEmail.value || !merchantPhone.value || !merchantProposal.value) { merchantSubmitError.value = "Por favor, completá todos los campos del formulario."; return; }
              merchantSubmitError.value = ""; isMerchantSubmitting.value = true;
              try {
                const res = await submitMerchantRequest({ businessName: merchantBusinessName.value, category: merchantCategory.value, contactName: merchantContactName.value, email: merchantEmail.value, phone: merchantPhone.value, proposal: merchantProposal.value });
                if (res.success) { merchantSubmitSuccess.value = true; } else { merchantSubmitError.value = res.message; }
              } catch { merchantSubmitError.value = "Ocurrió un error inesperado al enviar el formulario."; } finally { isMerchantSubmitting.value = false; }
            }} class="space-y-4 pt-1">
              {merchantSubmitError.value && (<div role="alert" class="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold">{merchantSubmitError.value}</div>)}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1"><label for="merchant-business" class={labelClass}>Nombre del Comercio / Empresa</label><input id="merchant-business" type="text" required autocomplete="organization" placeholder="Ej: Café Plaza" bind:value={merchantBusinessName} class={fieldClass} /></div>
                <div class="space-y-1"><label for="merchant-category" class={labelClass}>Rubro / Categoría</label><select id="merchant-category" required bind:value={merchantCategory} class={fieldClass}><option value="">Seleccionar rubro...</option><option value="Gastronomía">Gastronomía</option><option value="Turismo">Turismo & Hotelería</option><option value="Indumentaria">Moda & Calzado</option><option value="Salud & Estética">Salud, Belleza & Estética</option><option value="Deportes">Deportes & Bienestar</option><option value="Otros">Otros Servicios</option></select></div>
              </div>
              <div class="space-y-1"><label for="merchant-contact" class={labelClass}>Nombre del Contacto</label><input id="merchant-contact" type="text" required autocomplete="name" placeholder="Ej: Juan Pérez" bind:value={merchantContactName} class={fieldClass} /></div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1"><label for="merchant-email" class={labelClass}>Correo Electrónico</label><input id="merchant-email" type="email" required autocomplete="email" placeholder="Ej: contacto@empresa.com" bind:value={merchantEmail} class={fieldClass} /></div>
                <div class="space-y-1"><label for="merchant-phone" class={labelClass}>Teléfono / WhatsApp</label><input id="merchant-phone" type="tel" required autocomplete="tel" inputMode="tel" placeholder="Ej: 2215555555" bind:value={merchantPhone} class={fieldClass} /></div>
              </div>
              <div class="space-y-1"><label for="merchant-proposal" class={labelClass}>Detalle del Beneficio Propuesto</label><textarea id="merchant-proposal" required rows={3} placeholder="Ej: 15% de descuento los días lunes y martes abonando en efectivo o transferencia..." bind:value={merchantProposal} class={`${fieldClass} resize-none`} /></div>
              <div class="pt-2"><button type="submit" disabled={isMerchantSubmitting.value} class="btn btn-dark w-full">{isMerchantSubmitting.value ? "Enviando..." : "Enviar propuesta"}</button></div>
            </form>
          </div>
        )}
      </dialog>
    </section>
  );
});
