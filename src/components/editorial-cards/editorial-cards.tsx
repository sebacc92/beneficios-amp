import { component$, useSignal } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { Signal } from "@builder.io/qwik";
import type { AuthenticatedUser } from "~/routes/plugin@auth";
import { LuSmartphone, LuGift, LuStore, LuCreditCard } from "@qwikest/icons/lucide";
import { submitMerchantRequest } from "~/routes/index";

interface EditorialCardsProps {
  user: Readonly<Signal<AuthenticatedUser | null>>;
}

export const EditorialCards = component$<EditorialCardsProps>(({ user }) => {
  const isCredentialModalOpen = useSignal(false);
  const isRaffleModalOpen = useSignal(false);
  const isMerchantModalOpen = useSignal(false);
  const merchantBusinessName = useSignal("");
  const merchantCategory = useSignal("");
  const merchantContactName = useSignal("");
  const merchantEmail = useSignal("");
  const merchantPhone = useSignal("");
  const merchantProposal = useSignal("");
  const isMerchantSubmitting = useSignal(false);
  const merchantSubmitSuccess = useSignal(false);
  const merchantSubmitError = useSignal("");

  const cardBase = "bg-white border border-slate-100 rounded-3xl p-10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col justify-between";
  const ctaBase = "mt-6 inline-flex items-center justify-center w-fit px-5 py-2.5 rounded-full border border-slate-200 bg-slate-50 group-hover:border-brand-green/30 group-hover:bg-brand-green/5 group-hover:text-brand-green text-slate-600 text-xs font-black uppercase tracking-wider transition-all duration-300";

  return (
    <section class="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-14 print:hidden text-left">
      <div class="border-t border-slate-200/80 pt-12 mb-10 space-y-2 animate-fade-in-up">
        <p class="text-[11px] font-black tracking-widest text-slate-400 uppercase">Beneficios y Novedades</p>
        <h2 class="text-3xl sm:text-4xl font-display font-extrabold text-brand-green-dark tracking-tight leading-none">
          Tu espacio Club AMP<span class="text-brand-gold">+</span>
        </h2>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        <div onClick$={() => isCredentialModalOpen.value = true} class={cardBase}>
          <div>
            <LuSmartphone class="w-12 h-12 text-brand-green mb-6 stroke-[1.75] group-hover:scale-110 transition-transform duration-300" />
            <h3 class="text-xl sm:text-[22px] font-display font-black text-slate-800 leading-tight group-hover:text-brand-green transition-colors duration-200">Credencial Digital</h3>
            <p class="text-[15px] text-slate-500 mt-3.5 leading-relaxed font-medium">Tu credencial digital médica integrada. Presentala en los comercios para validar tus descuentos al instante.</p>
          </div>
          <div class={ctaBase}><span>Ver Credencial</span><span class="ml-1.5 transform group-hover:translate-x-1 transition-transform duration-300">&rarr;</span></div>
        </div>

        <div onClick$={() => isRaffleModalOpen.value = true} class={cardBase}>
          <div>
            <LuGift class="w-12 h-12 text-brand-green mb-6 stroke-[1.75] group-hover:scale-110 transition-transform duration-300" />
            <h3 class="text-xl sm:text-[22px] font-display font-black text-slate-800 leading-tight group-hover:text-brand-green transition-colors duration-200">Sorteos de Fin de Mes</h3>
            <p class="text-[15px] text-slate-500 mt-3.5 leading-relaxed font-medium">Visualizá los sorteos activos, el mecanismo oficial de participación y conocé a los ganadores previos.</p>
          </div>
          <div class={ctaBase}><span>Ver Sorteos</span><span class="ml-1.5 transform group-hover:translate-x-1 transition-transform duration-300">&rarr;</span></div>
        </div>

        <div onClick$={() => isMerchantModalOpen.value = true} class={cardBase}>
          <div>
            <LuStore class="w-12 h-12 text-brand-green mb-6 stroke-[1.75] group-hover:scale-110 transition-transform duration-300" />
            <h3 class="text-xl sm:text-[22px] font-display font-black text-slate-800 leading-tight group-hover:text-brand-green transition-colors duration-200">Sumate al Club</h3>
            <p class="text-[15px] text-slate-500 mt-3.5 leading-relaxed font-medium">¿Querés sumar tu comercio o empresa al Club AMP+? Envianos tu solicitud y propuesta comercial al instante.</p>
          </div>
          <div class={ctaBase}><span>Sumar mi Comercio</span><span class="ml-1.5 transform group-hover:translate-x-1 transition-transform duration-300">&rarr;</span></div>
        </div>
      </div>

      {/* Modal: Credencial Digital */}
      {isCredentialModalOpen.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-backdrop-in">
          <div class="max-w-md w-full bg-white rounded-[2rem] p-8 shadow-2xl relative border border-slate-100 flex flex-col items-center text-center overflow-hidden animate-scale-in">
            <button onClick$={() => isCredentialModalOpen.value = false} class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer">✕</button>
            <div class="mb-6"><span class="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black bg-brand-green/10 text-brand-green border border-brand-green/20 uppercase tracking-widest leading-none">AMP+ Wallet</span></div>
            {user.value ? (
              <div class="w-full space-y-6">
                <div class="w-full h-52 bg-gradient-to-br from-brand-green-dark to-brand-green text-white rounded-2xl p-6 relative shadow-lg overflow-hidden flex flex-col justify-between text-left border border-emerald-400/25">
                  <div class="absolute right-0 top-0 w-36 h-36 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none"></div>
                  <div class="flex items-center justify-between">
                    <div class="flex flex-col"><span class="text-[9px] font-black text-brand-gold uppercase tracking-wider leading-none">Portal Oficial</span><span class="text-[13px] font-display font-black tracking-tight mt-0.5">Agremiación Médica Platense</span></div>
                    <LuCreditCard class="w-6 h-6 text-brand-gold/80 stroke-[2]" />
                  </div>
                  <div><span class="text-[8.5px] font-black text-emerald-300 uppercase tracking-widest leading-none">Médico Agremiado</span><h4 class="text-lg font-display font-extrabold tracking-wide truncate mt-0.5">{user.value.name}</h4><span class="text-[11px] font-mono bg-slate-900/30 px-2 py-0.5 rounded text-emerald-100 mt-1.5 inline-block">M.P. {user.value.matricula || "12345"}</span></div>
                  <div class="flex items-center justify-between border-t border-white/10 pt-2.5 mt-1">
                    <span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[8.5px] font-black bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 tracking-widest uppercase leading-none"><span class="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span><span>Socio Activo</span></span>
                    <span class="text-[9px] font-black text-brand-gold uppercase tracking-widest leading-none">{user.value.role === "admin" ? "ADMIN" : user.value.role === "premium" ? "SOCIO PREMIUM" : "MIEMBRO"}</span>
                  </div>
                </div>
                <div class="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-100 rounded-2xl space-y-4">
                  <svg class="w-32 h-32 text-slate-800" viewBox="0 0 100 100" fill="currentColor"><rect x="0" y="0" width="25" height="25"/><rect x="3" y="3" width="19" height="19" fill="white"/><rect x="7" y="7" width="11" height="11"/><rect x="75" y="0" width="25" height="25"/><rect x="78" y="3" width="19" height="19" fill="white"/><rect x="82" y="7" width="11" height="11"/><rect x="0" y="75" width="25" height="25"/><rect x="3" y="78" width="19" height="19" fill="white"/><rect x="7" y="82" width="11" height="11"/><rect x="70" y="70" width="10" height="10"/><rect x="72" y="72" width="6" height="6" fill="white"/><rect x="74" y="74" width="2" height="2"/><rect x="35" y="5" width="5" height="5"/><rect x="45" y="0" width="5" height="10"/><rect x="60" y="10" width="10" height="5"/><rect x="30" y="20" width="15" height="5"/><rect x="50" y="20" width="5" height="15"/><rect x="5" y="35" width="10" height="5"/><rect x="20" y="30" width="5" height="10"/><rect x="0" y="45" width="15" height="5"/><rect x="25" y="45" width="10" height="10"/><rect x="35" y="35" width="30" height="5"/><rect x="40" y="45" width="5" height="15"/><rect x="55" y="45" width="15" height="5"/><rect x="35" y="60" width="15" height="5"/><rect x="75" y="35" width="10" height="10"/><rect x="90" y="40" width="5" height="15"/><rect x="80" y="55" width="15" height="5"/><rect x="35" y="75" width="5" height="15"/><rect x="45" y="85" width="15" height="5"/><rect x="60" y="75" width="5" height="20"/><rect x="50" y="70" width="5" height="5"/></svg>
                  <div class="text-center space-y-1"><span class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Código Dinámico de Validación</span><p class="text-sm font-mono font-bold text-slate-700">AMP-{user.value.matricula || "12345"}-{Math.floor(Date.now() / 1000000)}</p><p class="text-[11px] text-slate-400 font-medium">Presentá este código o QR en caja para recibir tu beneficio.</p></div>
                </div>
              </div>
            ) : (
              <div class="flex flex-col items-center py-6 space-y-5">
                <div class="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-400"><svg class="w-8 h-8 text-brand-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></div>
                <div class="space-y-2"><h4 class="text-lg font-display font-extrabold text-slate-800">Credencial Protegida</h4><p class="text-slate-500 text-[13.5px] leading-relaxed max-w-xs font-medium">Tu credencial digital es un beneficio exclusivo y personalizado para médicos pertenecientes a la AMP.</p></div>
                <div class="pt-2 w-full"><Link href="/login" class="w-full block bg-brand-green hover:bg-brand-green-dark text-white py-3.5 px-6 rounded-2xl font-extrabold text-sm uppercase tracking-wider transition-all shadow-md shadow-brand-green/20">Iniciar Sesión</Link></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Sorteos */}
      {isRaffleModalOpen.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-backdrop-in">
          <div class="max-w-xl w-full bg-white rounded-[2rem] p-8 shadow-2xl relative border border-slate-100 flex flex-col overflow-y-auto max-h-[85vh] text-left text-slate-800 animate-scale-in">
            <button onClick$={() => isRaffleModalOpen.value = false} class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer">✕</button>
            <div class="flex items-center space-x-3 mb-6"><div class="w-10 h-10 rounded-xl bg-amber-50 border border-brand-gold/20 flex items-center justify-center text-brand-gold"><LuGift class="w-5 h-5 stroke-[2]" /></div><div><span class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Club AMP+ Especial</span><h3 class="text-xl font-display font-black text-slate-800 mt-0.5 leading-none">Sorteos de Fin de Mes</h3></div></div>
            <div class="space-y-6">
              <div class="space-y-3 bg-slate-50 border border-slate-100 p-5 rounded-2xl"><h4 class="text-xs font-black text-slate-400 uppercase tracking-widest leading-none border-b border-slate-200/60 pb-2">Premios Activos - Sorteo de Junio</h4><div class="space-y-3 pt-1"><div class="flex items-start space-x-3"><span class="text-xl">🏆</span><div><p class="text-sm font-bold text-slate-800">1° Premio: Escapada Soñada a Bariloche</p><p class="text-xs text-slate-500 font-medium">Estadía de 3 noches para 2 personas en <strong>Finca Los Cauquenes</strong> con aéreos incluidos + 1 Cena Gourmet en <strong>Mercado 55</strong>.</p></div></div><div class="flex items-start space-x-3"><span class="text-xl">🍷</span><div><p class="text-sm font-bold text-slate-800">2° Premio: Set de Degustación Los Cauquenes</p><p class="text-xs text-slate-500 font-medium">Caja de madera premium con Vinos de Selección Exclusiva y fiambres ahumados artesanales.</p></div></div><div class="flex items-start space-x-3"><span class="text-xl">💪</span><div><p class="text-sm font-bold text-slate-800">3° Premio: Bienestar & Supermercado</p><p class="text-xs text-slate-500 font-medium">1 Membresía VIP Anual en <strong>Tred Gimnasio</strong> + Orden de Compra de $150.000 en <strong>Nini Supermercado</strong>.</p></div></div></div></div>
              <div class="space-y-2"><h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest">¿Cómo se realiza el sorteo?</h4><p class="text-[13px] text-slate-600 leading-relaxed font-medium"><strong>¡Participación 100% Automática!</strong> Todos los médicos agremiados con la cuota social al día participan de forma directa con los <strong>últimos 4 dígitos de su Matrícula Provincial (M.P.)</strong>.</p><p class="text-[13px] text-slate-600 leading-relaxed font-medium">El sorteo se determina utilizando los números ganadores del <strong>Sorteo Nocturno de la Lotería de la Provincia de Buenos Aires</strong> el último viernes de cada mes.</p></div>
              <div class="space-y-3"><h4 class="text-[11px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100">Médicos Ganadores Recientes</h4><div class="space-y-2"><div class="flex justify-between items-center text-xs font-semibold bg-emerald-50/50 border border-emerald-100/50 px-4 py-2.5 rounded-xl"><div class="flex items-center space-x-2"><span class="text-base">🎉</span><span class="text-slate-800 font-bold">Dr. Hugo Gómez (M.P. 51849)</span></div><span class="text-brand-green font-bold">Escapada en Dazzler (Mayo)</span></div><div class="flex justify-between items-center text-xs font-semibold bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl"><div class="flex items-center space-x-2"><span>🎁</span><span class="text-slate-700 font-bold">Dra. Marina Rossi (M.P. 44621)</span></div><span class="text-slate-500 font-bold">Degustación Cauquenes (Abril)</span></div><div class="flex justify-between items-center text-xs font-semibold bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-xl"><div class="flex items-center space-x-2"><span>🎁</span><span class="text-slate-700 font-bold">Dr. Esteban Benítez (M.P. 39912)</span></div><span class="text-slate-500 font-bold">Pase Tred & Nini (Marzo)</span></div></div></div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Merchant */}
      {isMerchantModalOpen.value && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-backdrop-in">
          <div class="max-w-lg w-full bg-white rounded-[2rem] p-8 shadow-2xl relative border border-slate-100 flex flex-col overflow-y-auto max-h-[90vh] text-left text-slate-800 animate-scale-in">
            <button onClick$={() => { isMerchantModalOpen.value = false; merchantSubmitSuccess.value = false; }} class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all cursor-pointer">✕</button>
            {merchantSubmitSuccess.value ? (
              <div class="flex flex-col items-center justify-center py-10 space-y-4 text-center">
                <div class="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-100 animate-bounce"><svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg></div>
                <h3 class="text-xl font-bold text-slate-800">¡Propuesta Recibida!</h3>
                <p class="text-slate-500 text-sm max-w-sm font-medium">Hemos recibido con éxito la propuesta para incorporar a <strong class="text-slate-800">{merchantBusinessName.value}</strong> al Club de Beneficios.</p>
                <p class="text-slate-400 text-xs max-w-xs leading-relaxed">Nuestro equipo comercial analizará la oferta y se pondrá en contacto al correo <strong>{merchantEmail.value}</strong> dentro de las próximas 48 horas hábiles.</p>
                <div class="pt-4"><button onClick$={() => { isMerchantModalOpen.value = false; merchantSubmitSuccess.value = false; }} class="px-8 py-3 bg-brand-green hover:bg-brand-green-dark text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer">Entendido</button></div>
              </div>
            ) : (
              <div class="space-y-5">
                <div class="flex items-center space-x-3 mb-2"><div class="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-brand-green"><LuStore class="w-5 h-5 stroke-[2]" /></div><div><span class="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Club AMP+ Partners</span><h3 class="text-xl font-display font-black text-slate-800 mt-0.5 leading-none">Sumate al Club</h3></div></div>
                <p class="text-[13px] text-slate-500 leading-relaxed font-medium">Ofrecé descuentos y beneficios a una red exclusiva de más de 4.000 médicos agremiados en la región y potenciá la visibilidad de tu negocio.</p>
                <form onSubmit$={async (e) => {
                  e.preventDefault();
                  if (!merchantBusinessName.value || !merchantCategory.value || !merchantContactName.value || !merchantEmail.value || !merchantPhone.value || !merchantProposal.value) { merchantSubmitError.value = "Por favor, completá todos los campos del formulario."; return; }
                  merchantSubmitError.value = ""; isMerchantSubmitting.value = true;
                  try {
                    const res = await submitMerchantRequest({ businessName: merchantBusinessName.value, category: merchantCategory.value, contactName: merchantContactName.value, email: merchantEmail.value, phone: merchantPhone.value, proposal: merchantProposal.value });
                    if (res.success) { merchantSubmitSuccess.value = true; } else { merchantSubmitError.value = res.message; }
                  } catch { merchantSubmitError.value = "Ocurrió un error inesperado al enviar el formulario."; } finally { isMerchantSubmitting.value = false; }
                }} class="space-y-4 pt-1">
                  {merchantSubmitError.value && (<div class="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold">⚠️ {merchantSubmitError.value}</div>)}
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-1"><label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre del Comercio / Empresa</label><input type="text" required placeholder="Ej: Café Plaza" bind:value={merchantBusinessName} class="w-full bg-slate-50 border border-slate-200 focus:border-brand-green focus:bg-white text-slate-800 text-xs p-3 rounded-xl focus:outline-none transition-all font-semibold" /></div>
                    <div class="space-y-1"><label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rubro / Categoría</label><select required bind:value={merchantCategory} class="w-full bg-slate-50 border border-slate-200 focus:border-brand-green focus:bg-white text-slate-800 text-xs p-3 rounded-xl focus:outline-none transition-all font-semibold"><option value="">Seleccionar rubro...</option><option value="Gastronomía">Gastronomía</option><option value="Turismo">Turismo & Hotelería</option><option value="Indumentaria">Moda & Calzado</option><option value="Salud & Estética">Salud, Belleza & Estética</option><option value="Deportes">Deportes & Bienestar</option><option value="Otros">Otros Servicios</option></select></div>
                  </div>
                  <div class="space-y-1"><label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre del Contacto</label><input type="text" required placeholder="Ej: Juan Pérez" bind:value={merchantContactName} class="w-full bg-slate-50 border border-slate-200 focus:border-brand-green focus:bg-white text-slate-800 text-xs p-3 rounded-xl focus:outline-none transition-all font-semibold" /></div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="space-y-1"><label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Correo Electrónico</label><input type="email" required placeholder="Ej: contacto@empresa.com" bind:value={merchantEmail} class="w-full bg-slate-50 border border-slate-200 focus:border-brand-green focus:bg-white text-slate-800 text-xs p-3 rounded-xl focus:outline-none transition-all font-semibold" /></div>
                    <div class="space-y-1"><label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Teléfono / WhatsApp</label><input type="tel" required placeholder="Ej: 2215555555" bind:value={merchantPhone} class="w-full bg-slate-50 border border-slate-200 focus:border-brand-green focus:bg-white text-slate-800 text-xs p-3 rounded-xl focus:outline-none transition-all font-semibold" /></div>
                  </div>
                  <div class="space-y-1"><label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Detalle del Beneficio Propuesto</label><textarea required rows={3} placeholder="Ej: 15% de descuento los días lunes y martes abonando en efectivo o transferencia..." bind:value={merchantProposal} class="w-full bg-slate-50 border border-slate-200 focus:border-brand-green focus:bg-white text-slate-800 text-xs p-3 rounded-xl focus:outline-none transition-all font-semibold resize-none" /></div>
                  <div class="pt-2"><button type="submit" disabled={isMerchantSubmitting.value} class="w-full bg-brand-green hover:bg-brand-green-dark text-white py-3.5 px-6 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-55 flex items-center justify-center space-x-2 cursor-pointer"><span>{isMerchantSubmitting.value ? "Enviando..." : "Enviar Propuesta"}</span></button></div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
});
