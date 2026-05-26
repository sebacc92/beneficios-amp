import { component$, useSignal } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  Form,
  Link,
  type DocumentHead,
} from "@builder.io/qwik-city";
import { eq } from "drizzle-orm";
import { getDB } from "~/db";
import { users } from "~/db/schema";
import type { AuthenticatedUser } from "~/routes/plugin@auth";

// Check if user is authenticated
export const useCheckUserLoader = routeLoader$(async (event) => {
  const user = event.sharedMap.get("user") as AuthenticatedUser | undefined;
  if (!user) {
    throw event.redirect(302, "/login");
  }
  return user;
});

// Action to simulate successful payment and upgrade user to premium
export const usePaymentAction = routeAction$(async (_, requestEvent) => {
  try {
    const user = requestEvent.sharedMap.get("user") as AuthenticatedUser | undefined;
    if (!user) return requestEvent.fail(401, { message: "Sesión expirada." });

    const db = getDB(requestEvent);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days of premium

    await db
      .update(users)
      .set({
        role: "premium",
        premiumExpiresAt: expiresAt.toISOString(),
      })
      .where(eq(users.id, user.id));

    // Redirect to profile page
    throw requestEvent.redirect(302, "/perfil");
  } catch (e: any) {
    if (e.headers) throw e;
    console.error("Payment action error:", e);
    return requestEvent.fail(500, { message: "Error al procesar el pago ficticio." });
  }
});

export default component$(() => {
  const userLoader = useCheckUserLoader();
  const paymentAction = usePaymentAction();

  const user = userLoader.value;
  const cardNumber = useSignal("");
  const cardName = useSignal(user.name);
  const cardExpiry = useSignal("");
  const cardCvv = useSignal("");

  return (
    <div class="bg-slate-100 min-h-screen py-16 px-4 font-sans text-slate-800">
      <div class="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Payment Gateway Simulator (Left 2 cols) */}
        <div class="lg:col-span-2 space-y-6">
          
          {/* Header MP Branding */}
          <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <span class="text-3xl">💳</span>
              <div class="flex flex-col">
                <span class="text-xs font-bold tracking-widest text-[#009ee3] uppercase font-sans">
                  Mercado Pago
                </span>
                <span class="text-sm font-extrabold text-slate-800 leading-none">
                  Pasarela de Pago Segura
                </span>
              </div>
            </div>
            <span class="px-3 py-1 bg-blue-50 text-xs font-extrabold text-[#009ee3] rounded-full border border-blue-100 uppercase tracking-widest">
              Sandbox Activo
            </span>
          </div>

          {/* Card Form */}
          <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <h2 class="text-base font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-4">
              Detalle de la Tarjeta de Crédito
            </h2>

            {/* Simulated Credit Card Shape */}
            <div class="w-full aspect-[1.586/1] max-w-sm mx-auto rounded-2xl p-5 flex flex-col justify-between overflow-hidden shadow-lg bg-gradient-to-br from-[#00b1ea] to-[#007db9] text-white border border-[#009ee3]/20 relative select-none">
              <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none"></div>
              
              <div class="flex justify-between items-center relative z-10">
                <span class="text-lg font-extrabold tracking-wider">AMP+</span>
                <span class="text-[10px] font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded uppercase">MP Checkout</span>
              </div>

              <div class="font-mono text-lg tracking-widest relative z-10 mt-6 sm:mt-8">
                {cardNumber.value || "•••• •••• •••• ••••"}
              </div>

              <div class="flex justify-between items-end relative z-10">
                <div class="space-y-0.5">
                  <div class="text-[7px] font-bold text-slate-200 tracking-wider uppercase">Titular</div>
                  <div class="font-display font-bold text-xs uppercase truncate max-w-[150px]">
                    {cardName.value || "Nombre Completo"}
                  </div>
                </div>
                
                <div class="space-y-0.5">
                  <div class="text-[7px] font-bold text-slate-200 tracking-wider uppercase">Vto.</div>
                  <div class="font-bold text-xs tracking-wider">{cardExpiry.value || "MM/AA"}</div>
                </div>
              </div>
            </div>

            {/* Input fields */}
            <Form action={paymentAction} class="space-y-5">
              <div class="space-y-1">
                <label for="c-number" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                  Número de Tarjeta
                </label>
                <input
                  type="text"
                  id="c-number"
                  required
                  placeholder="4540 1234 5678 9012"
                  maxLength={19}
                  bind:value={cardNumber}
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-[#009ee3] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div class="space-y-1">
                <label for="c-name" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                  Nombre del Titular (como figura en la tarjeta)
                </label>
                <input
                  type="text"
                  id="c-name"
                  required
                  placeholder="DR. NOMBRE APELLIDO"
                  bind:value={cardName}
                  class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-[#009ee3] focus:bg-white focus:outline-none transition-all uppercase"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label for="c-expiry" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                    Vencimiento
                  </label>
                  <input
                    type="text"
                    id="c-expiry"
                    required
                    placeholder="MM/AA"
                    maxLength={5}
                    bind:value={cardExpiry}
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-[#009ee3] focus:bg-white focus:outline-none transition-all"
                  />
                </div>

                <div class="space-y-1">
                  <label for="c-cvv" class="text-xs font-bold text-slate-500 tracking-wider uppercase block">
                    Cód. de Seguridad (CVV)
                  </label>
                  <input
                    type="password"
                    id="c-cvv"
                    required
                    placeholder="•••"
                    maxLength={4}
                    bind:value={cardCvv}
                    class="w-full bg-slate-50 text-slate-800 text-sm px-4 py-3 rounded-2xl border border-slate-200 focus:border-[#009ee3] focus:bg-white focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Submit MP Payment */}
              <button
                type="submit"
                disabled={paymentAction.isRunning}
                class="w-full flex items-center justify-center py-4 px-6 rounded-2xl bg-[#009ee3] hover:bg-[#0081ba] disabled:bg-slate-300 text-white text-sm font-extrabold shadow-md transition-all duration-300 cursor-pointer"
              >
                {paymentAction.isRunning ? "Procesando pago..." : "Pagar $1.500 ARS"}
              </button>
            </Form>
          </div>
        </div>

        {/* Right Column: Checkout Summary details */}
        <div class="lg:col-span-1 space-y-6">
          <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
            <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-4">
              Resumen de Compra
            </h2>

            <div class="space-y-4 text-xs sm:text-sm font-semibold">
              <div class="flex justify-between">
                <span class="text-slate-400">Suscripción</span>
                <span class="text-slate-800">Plan Premium AMP+</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Periodo</span>
                <span class="text-slate-800">30 días (Renovación Manual)</span>
              </div>
              <div class="flex justify-between border-t border-slate-100 pt-4 text-slate-800">
                <span>Total a pagar</span>
                <span class="text-lg font-extrabold text-brand-green-dark">$1.500,00 ARS</span>
              </div>
            </div>

            <div class="rounded-2xl bg-slate-50 p-4 border border-slate-150 text-[10px] text-slate-500 font-semibold leading-relaxed">
              🔒 La transacción se procesa bajo el entorno seguro y cifrado de Mercado Pago Checkout. Los datos de prueba están protegidos por el Sandbox de desarrollo.
            </div>

            <Link
              href="/perfil"
              class="w-full flex items-center justify-center py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all shadow-sm"
            >
              Cancelar y volver
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Mercado Pago Checkout - Club de Beneficios AMP",
  meta: [
    {
      name: "description",
      content: "Simulador oficial de Mercado Pago para la suscripción Premium del Club de Beneficios AMP.",
    },
  ],
};
