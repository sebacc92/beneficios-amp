import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead, server$ } from "@builder.io/qwik-city";
import { getSessionUser } from "~/server/auth";
import { validateCoupon } from "~/server/coupons";

const PIN_STORAGE_KEY = "lprc_validator_pin";

// Admins already carry an authenticated session, so they do not need the PIN.
export const useIsAdminLoader = routeLoader$((event) => {
  return getSessionUser(event)?.role === "admin";
});

export const useCouponCode = routeLoader$((event) => {
  const code = event.url.searchParams.get("code")?.trim().toUpperCase() || "";
  return /^[A-Z0-9]{4,8}$/.test(code) ? code : "";
});

// Server-side coupon validation. Authorization, throttling and the atomic
// redemption live in ~/server/coupons so this page and /api/coupons/validate
// enforce exactly the same rules.
const validateCouponServer = server$(async function (code: string, numeroSocio: string, pin: string) {
  return validateCoupon(this, { code, numeroSocio, pin });
});

export default component$(() => {
  const isAdmin = useIsAdminLoader();
  const initialCode = useCouponCode();
  const socioInput = useSignal("");
  const codeInput = useSignal(initialCode.value);
  const pinInput = useSignal("");
  const isSubmitting = useSignal(false);
  const result = useSignal<{
    ok: boolean;
    message?: string;
    coupon?: { code: string; benefitTitle: string; userName: string; numeroSocio: string | null };
  } | null>(null);

  // Remember the shop PIN on the device so staff type it once, not per coupon.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    pinInput.value = localStorage.getItem(PIN_STORAGE_KEY) ?? "";
  });

  const handleValidate = $(async () => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;
    result.value = null;

    try {
      const res = await validateCouponServer(codeInput.value, socioInput.value, pinInput.value);
      result.value = res;
      if (res.ok && pinInput.value) {
        localStorage.setItem(PIN_STORAGE_KEY, pinInput.value);
      }
    } catch {
      result.value = { ok: false, message: "Error de conexión. Intentá de nuevo." };
    } finally {
      isSubmitting.value = false;
    }
  });

  const handleReset = $(() => {
    result.value = null;
    socioInput.value = "";
    codeInput.value = "";
  });

  return (
    <div class="min-h-dvh bg-[#040811] flex flex-col items-center justify-center px-4 py-8">
      {/* Logo / Header */}
      <div class="mb-10 text-center">
        <p class="font-display font-black text-5xl uppercase tracking-tight text-white">
          LA PLATA <span class="text-accent">RUGBY</span>
        </p>
        <p class="font-sans text-xs uppercase tracking-[0.3em] text-slate-400 mt-1">
          VALIDACIÓN DE BENEFICIOS
        </p>
      </div>

      {/* Card de validación */}
      <div class="w-full max-w-sm bg-primary border border-secondary p-6 shadow-xl">
        {result.value?.ok ? (
          /* ✅ Éxito */
          <div class="text-center animate-scale-in">
            <div class="text-5xl mb-4">✅</div>
            <p class="font-display font-bold text-2xl text-white uppercase mb-1">
              CUPÓN VÁLIDO
            </p>
            <p class="font-mono text-xl text-accent font-bold tracking-widest mb-4">
              {result.value.coupon?.code}
            </p>
            <p class="font-sans text-sm text-slate-300">
              {result.value.coupon?.benefitTitle}
            </p>
            <p class="font-sans text-xs text-slate-400 mt-2">
              Socio: {result.value.coupon?.userName}
            </p>
            {/* Success bar animation */}
            <div class="mt-6 h-1 bg-accent animate-fade-in-up" />

            <button
              type="button"
              onClick$={handleReset}
              class="mt-6 w-full py-3 bg-secondary text-white font-display font-bold text-sm uppercase tracking-widest hover:bg-accent hover:text-primary transition-colors duration-200 cursor-pointer"
            >
              VALIDAR OTRO CUPÓN
            </button>
          </div>
        ) : result.value?.ok === false ? (
          /* ❌ Error */
          <div class="text-center mb-6 animate-scale-in">
            <div class="text-4xl mb-3">❌</div>
            <p class="font-display font-bold text-xl text-red-400 uppercase mb-4">
              {result.value.message}
            </p>
            <button
              type="button"
              onClick$={handleReset}
              class="w-full py-3 bg-secondary text-white font-display font-bold text-sm uppercase tracking-widest hover:bg-accent hover:text-primary transition-colors duration-200 cursor-pointer"
            >
              REINTENTAR
            </button>
          </div>
        ) : (
          /* Formulario */
          <div class="flex flex-col gap-4">
            {!isAdmin.value && (
              <div>
                <label class="font-sans text-xs uppercase tracking-widest text-slate-400 block mb-2">
                  PIN del comercio
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  autocomplete="off"
                  placeholder="••••"
                  bind:value={pinInput}
                  class="w-full bg-[#040811] border border-secondary text-white font-mono text-lg px-4 py-3 outline-none focus:border-accent transition-colors duration-200 tracking-widest"
                />
              </div>
            )}
            <div>
              <label class="font-sans text-xs uppercase tracking-widest text-slate-400 block mb-2">
                N° de Socio / DNI
              </label>
              <input
                type="text"
                inputMode="numeric"
                autocomplete="off"
                placeholder="00847"
                bind:value={socioInput}
                class="w-full bg-[#040811] border border-secondary text-white font-mono text-lg px-4 py-3 outline-none focus:border-accent transition-colors duration-200 tracking-widest"
              />
            </div>
            <div>
              <label class="font-sans text-xs uppercase tracking-widest text-slate-400 block mb-2">
                Código de Cupón
              </label>
              <input
                type="text"
                inputMode="text"
                autocomplete="off"
                placeholder="7X4K2M"
                maxLength={8}
                bind:value={codeInput}
                onKeyDown$={(ev) => {
                  if (ev.key === "Enter") handleValidate();
                }}
                class="w-full bg-[#040811] border border-secondary text-accent font-mono text-3xl px-4 py-4 outline-none focus:border-accent transition-colors duration-200 tracking-[0.4em] uppercase text-center"
              />
            </div>
            <button
              type="button"
              onClick$={handleValidate}
              disabled={isSubmitting.value}
              class="w-full bg-accent text-primary font-display font-bold text-xl uppercase tracking-widest py-4 hover:bg-accent-hover transition-colors duration-200 disabled:opacity-50 disabled:cursor-wait cursor-pointer"
            >
              {isSubmitting.value ? (
                <span class="flex items-center justify-center gap-3">
                  <span class="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  VALIDANDO...
                </span>
              ) : (
                "VALIDAR BENEFICIO"
              )}
            </button>
          </div>
        )}
      </div>

      <p class="font-sans text-xs text-slate-500 mt-8 text-center">
        Solo para uso autorizado de comercios aliados LPRC
      </p>
    </div>
  );
});

export const head: DocumentHead = {
  title: "Validar Cupón — Beneficios LPRC",
  meta: [
    {
      name: "description",
      content: "Interfaz de validación de cupones de beneficios para comercios aliados de La Plata Rugby Club.",
    },
  ],
};
