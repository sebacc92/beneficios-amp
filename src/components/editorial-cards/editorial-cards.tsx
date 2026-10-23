import { component$, useSignal } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import { LuSmartphone, LuGift, LuStore } from "@qwikest/icons/lucide";
import { submitMerchantRequest } from "~/routes/index";

export const EditorialCards = component$(() => {
  const merchantDialog = useSignal<HTMLDialogElement>();
  const merchantBusinessName = useSignal("");
  const merchantCategory = useSignal("");
  const merchantContactName = useSignal("");
  const merchantEmail = useSignal("");
  const merchantPhone = useSignal("");
  const merchantProposal = useSignal("");
  const isMerchantSubmitting = useSignal(false);
  const merchantSubmitSuccess = useSignal(false);
  const merchantSubmitError = useSignal("");

  const cardBase = "rounded-3xl border border-line bg-surface p-7 lg:p-10 text-left shadow-sm hover:border-accent hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent";
  const ctaBase = "mt-6 inline-flex items-center justify-center w-fit px-5 py-2.5 rounded-full border border-line bg-surface-muted group-hover:border-accent group-hover:bg-accent group-hover:text-primary text-primary text-xs font-black uppercase tracking-wider transition-all duration-300";
  const labelClass = "text-xs font-bold text-slate-600 uppercase tracking-wider";
  const fieldClass = "w-full bg-slate-50 border border-slate-200 focus:border-brand-navy focus:bg-white text-slate-800 text-base sm:text-sm p-3 rounded-xl focus:outline-none transition-all font-semibold";

  return (
    <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-14 print:hidden text-left">
      <div class="border-t border-line pt-12 mb-10 space-y-2 animate-fade-in-up">
        <p class="text-[11px] font-black tracking-widest text-slate-600 uppercase">Beneficios y Novedades</p>
        <h2 class="text-3xl sm:text-4xl font-display font-extrabold text-primary tracking-tight leading-none">
          Tu espacio Club LPRC<span class="text-accent">+</span>
        </h2>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {/* The real credential (with its scannable QR) lives in /perfil; login returns here. */}
        <Link href="/perfil/?credencial=1" class={cardBase}>
          <div>
            <LuSmartphone class="w-12 h-12 text-primary mb-6 stroke-[1.75] group-hover:scale-110 transition-transform duration-300" />
            <h3 class="text-xl sm:text-[22px] font-display font-black text-primary leading-tight transition-colors duration-200">Credencial Digital</h3>
            <p class="text-[15px] text-slate-600 mt-3.5 leading-relaxed font-medium">Tu credencial digital integrada. Presentala en los comercios para validar tus descuentos al instante.</p>
          </div>
          <div class={ctaBase}><span>Ver Credencial</span><span class="ml-1.5 transform group-hover:translate-x-1 transition-transform duration-300">&rarr;</span></div>
        </Link>

        {/* Raffles are managed in /admin/sorteos; the page always shows the current ones. */}
        <Link href="/sorteos/" class={cardBase}>
          <div>
            <LuGift class="w-12 h-12 text-primary mb-6 stroke-[1.75] group-hover:scale-110 transition-transform duration-300" />
            <h3 class="text-xl sm:text-[22px] font-display font-black text-primary leading-tight transition-colors duration-200">Sorteos</h3>
            <p class="text-[15px] text-slate-600 mt-3.5 leading-relaxed font-medium">Mirá los sorteos vigentes, sus bases y condiciones y los ganadores anteriores.</p>
          </div>
          <div class={ctaBase}><span>Ver Sorteos</span><span class="ml-1.5 transform group-hover:translate-x-1 transition-transform duration-300">&rarr;</span></div>
        </Link>

        <button type="button" onClick$={() => merchantDialog.value?.showModal()} class={cardBase}>
          <div>
            <LuStore class="w-12 h-12 text-primary mb-6 stroke-[1.75] group-hover:scale-110 transition-transform duration-300" />
            <h3 class="text-xl sm:text-[22px] font-display font-black text-primary leading-tight transition-colors duration-200">Sumate al Club</h3>
            <p class="text-[15px] text-slate-600 mt-3.5 leading-relaxed font-medium">¿Querés sumar tu comercio o empresa al Club LPRC? Envianos tu solicitud y propuesta comercial al instante.</p>
          </div>
          <div class={ctaBase}><span>Sumar mi Comercio</span><span class="ml-1.5 transform group-hover:translate-x-1 transition-transform duration-300">&rarr;</span></div>
        </button>
      </div>

      {/* Modal: Merchant */}
      <dialog
        ref={merchantDialog}
        aria-labelledby="merchant-dialog-title"
        class="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto rounded-[2rem] border border-slate-100 bg-white p-8 text-left text-slate-800 shadow-2xl backdrop:bg-slate-900/60 backdrop:backdrop-blur-md"
        onClose$={() => { merchantSubmitSuccess.value = false; merchantSubmitError.value = ""; }}
        onClick$={(event, element) => {
          // A click on the backdrop lands on the <dialog> itself.
          if (event.target === element) element.close();
        }}
      >
        <button type="button" onClick$={() => merchantDialog.value?.close()} aria-label="Cerrar formulario" class="absolute top-3 right-3 w-11 h-11 rounded-full bg-slate-50 border border-slate-100 text-slate-600 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <span aria-hidden="true">✕</span>
        </button>
        {merchantSubmitSuccess.value ? (
          <div role="status" class="flex flex-col items-center justify-center py-10 space-y-4 text-center">
            <div class="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-100"><svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg></div>
            <h2 id="merchant-dialog-title" class="text-xl font-bold text-slate-800">¡Propuesta Recibida!</h2>
            <p class="text-slate-600 text-sm max-w-sm font-medium">Recibimos la propuesta para incorporar a <strong class="text-slate-800">{merchantBusinessName.value}</strong> al Club de Beneficios.</p>
            <p class="text-slate-600 text-xs max-w-xs leading-relaxed">Nuestro equipo la va a analizar y te va a escribir a <strong>{merchantEmail.value}</strong> dentro de las próximas 48 horas hábiles.</p>
            <div class="pt-4"><button type="button" onClick$={() => merchantDialog.value?.close()} class="px-8 py-3 bg-brand-navy hover:bg-brand-navy-dark text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer">Entendido</button></div>
          </div>
        ) : (
          <div class="space-y-5">
            <div class="flex items-center space-x-3 mb-2 pr-10"><div class="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-brand-navy"><LuStore class="w-5 h-5 stroke-[2]" /></div><div><span class="text-[11px] font-black text-slate-600 uppercase tracking-widest leading-none">Comercios adheridos</span><h2 id="merchant-dialog-title" class="text-xl font-display font-black text-slate-800 mt-0.5 leading-none">Sumate al Club</h2></div></div>
            <p class="text-[13px] text-slate-600 leading-relaxed font-medium">Ofrecé descuentos y beneficios a una red exclusiva de más de 4.000 socios en la región y potenciá la visibilidad de tu negocio.</p>
            <form onSubmit$={async (e) => {
              e.preventDefault();
              if (!merchantBusinessName.value || !merchantCategory.value || !merchantContactName.value || !merchantEmail.value || !merchantPhone.value || !merchantProposal.value) { merchantSubmitError.value = "Por favor, completá todos los campos del formulario."; return; }
              merchantSubmitError.value = ""; isMerchantSubmitting.value = true;
              try {
                const res = await submitMerchantRequest({ businessName: merchantBusinessName.value, category: merchantCategory.value, contactName: merchantContactName.value, email: merchantEmail.value, phone: merchantPhone.value, proposal: merchantProposal.value });
                if (res.success) { merchantSubmitSuccess.value = true; } else { merchantSubmitError.value = res.message; }
              } catch { merchantSubmitError.value = "Ocurrió un error inesperado al enviar el formulario."; } finally { isMerchantSubmitting.value = false; }
            }} class="space-y-4 pt-1">
              {merchantSubmitError.value && (<div role="alert" class="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold">{merchantSubmitError.value}</div>)}
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
              <div class="pt-2"><button type="submit" disabled={isMerchantSubmitting.value} class="w-full bg-brand-navy hover:bg-brand-navy-dark text-white py-3.5 px-6 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-55 flex items-center justify-center space-x-2 cursor-pointer"><span>{isMerchantSubmitting.value ? "Enviando..." : "Enviar Propuesta"}</span></button></div>
            </form>
          </div>
        )}
      </dialog>
    </section>
  );
});
