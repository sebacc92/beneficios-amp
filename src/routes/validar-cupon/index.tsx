import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead, server$ } from "@builder.io/qwik-city";
import { getSessionUser } from "~/server/auth";
import { checkCoupon, validateCoupon, type ValidationResult } from "~/server/coupons";
import { normalizeCouponCode } from "~/utils/coupon-code";

const PIN_STORAGE_KEY = "lprc_validator_pin";

// Admins already carry an authenticated session, so they do not need the PIN.
export const useIsAdminLoader = routeLoader$((event) => {
  return getSessionUser(event)?.role === "admin";
});

export const useCouponCode = routeLoader$((event) => {
  const code = normalizeCouponCode(event.url.searchParams.get("code"));
  return /^[A-Z0-9]{4,8}$/.test(code) ? code : "";
});

// Authorization, throttling and the atomic redemption live in ~/server/coupons so
// this page and /api/coupons/validate enforce exactly the same rules.
const checkCouponServer = server$(async function (code: string, numeroSocio: string, pin: string) {
  return checkCoupon(this, { code, numeroSocio, pin });
});
const validateCouponServer = server$(async function (code: string, numeroSocio: string, pin: string) {
  return validateCoupon(this, { code, numeroSocio, pin });
});

const labelClass = "font-sans text-xs uppercase tracking-widest text-slate-300 block mb-2";
const inputClass = "w-full bg-[#040811] border border-secondary text-white font-mono text-lg px-4 py-3 outline-none focus:border-accent transition-colors duration-200 tracking-widest aria-[invalid=true]:border-red-400";
const secondaryButton = "w-full py-3 bg-secondary text-white font-display font-bold text-sm uppercase tracking-widest hover:bg-accent hover:text-primary transition-colors duration-200 cursor-pointer disabled:opacity-50";

export default component$(() => {
  const isAdmin = useIsAdminLoader();
  const initialCode = useCouponCode();
  const socioInput = useSignal("");
  const codeInput = useSignal(initialCode.value);
  const pinInput = useSignal("");
  const hasStoredPin = useSignal(false);
  const isSubmitting = useSignal(false);
  // form -> confirm (checked, nothing redeemed yet) -> done (redeemed)
  const step = useSignal<"form" | "confirm" | "done">("form");
  const checked = useSignal<ValidationResult["coupon"] | null>(null);
  const error = useSignal<{ message: string; field: "pin" | "dni" | "code" | null } | null>(null);

  const pinRef = useSignal<HTMLInputElement>();
  const dniRef = useSignal<HTMLInputElement>();
  const codeRef = useSignal<HTMLInputElement>();
  const confirmHeadingRef = useSignal<HTMLHeadingElement>();
  const doneHeadingRef = useSignal<HTMLHeadingElement>();

  // Remember the shop PIN on the device so staff type it once, not per coupon.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    try {
      pinInput.value = localStorage.getItem(PIN_STORAGE_KEY) ?? "";
      hasStoredPin.value = Boolean(pinInput.value);
    } catch {
      // Storage can be blocked; the PIN is then typed each time.
    }
  });

  const showError = $((result: ValidationResult) => {
    const message = result.message || "No se pudo validar el cupón. Intentá de nuevo.";
    const field =
      result.reason === "dni_mismatch" ? "dni"
      : result.reason ? "code"
      : /PIN/.test(message) ? "pin"
      : null;
    error.value = { message, field };
    const target = field === "pin" ? pinRef.value : field === "dni" ? dniRef.value : field === "code" ? codeRef.value : null;
    target?.focus();
    target?.select();
  });

  const handleCheck = $(async () => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;
    error.value = null;
    try {
      const res = await checkCouponServer(codeInput.value, socioInput.value, pinInput.value);
      if (!res.ok || !res.coupon) {
        await showError(res);
        return;
      }
      if (pinInput.value) {
        try {
          localStorage.setItem(PIN_STORAGE_KEY, pinInput.value);
          hasStoredPin.value = true;
        } catch {
          // Ignore: the PIN simply is not remembered.
        }
      }
      checked.value = res.coupon;
      step.value = "confirm";
      requestAnimationFrame(() => confirmHeadingRef.value?.focus());
    } catch {
      error.value = { message: "Error de conexión. Intentá de nuevo.", field: null };
    } finally {
      isSubmitting.value = false;
    }
  });

  const handleRedeem = $(async () => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;
    error.value = null;
    try {
      const res = await validateCouponServer(codeInput.value, socioInput.value, pinInput.value);
      if (!res.ok || !res.coupon) {
        // Back to the form with everything still typed, so the cashier can correct it.
        step.value = "form";
        requestAnimationFrame(() => showError(res));
        return;
      }
      checked.value = res.coupon;
      step.value = "done";
      requestAnimationFrame(() => doneHeadingRef.value?.focus());
    } catch {
      error.value = { message: "Error de conexión. El cupón no se canjeó; intentá de nuevo.", field: null };
    } finally {
      isSubmitting.value = false;
    }
  });

  const backToForm = $(() => {
    step.value = "form";
    checked.value = null;
    requestAnimationFrame(() => codeRef.value?.focus());
  });

  const startOver = $(() => {
    step.value = "form";
    checked.value = null;
    error.value = null;
    socioInput.value = "";
    codeInput.value = "";
    requestAnimationFrame(() => dniRef.value?.focus());
  });

  const forgetPin = $(() => {
    try {
      localStorage.removeItem(PIN_STORAGE_KEY);
    } catch {
      // Nothing stored.
    }
    pinInput.value = "";
    hasStoredPin.value = false;
    pinRef.value?.focus();
  });

  return (
    <div class="min-h-dvh bg-[#040811] flex flex-col items-center justify-center px-4 py-8">
      <div class="mb-10 text-center">
        <p class="font-display font-black text-5xl uppercase tracking-tight text-white">
          LA PLATA <span class="text-accent">RUGBY</span>
        </p>
        <p class="font-sans text-xs uppercase tracking-[0.3em] text-slate-300 mt-1">
          Validación de beneficios
        </p>
      </div>

      <div class="w-full max-w-sm bg-primary border border-secondary p-6 shadow-xl">
        {step.value === "done" && checked.value ? (
          <div role="status" class="text-center animate-scale-in">
            <p class="inline-block bg-emerald-500 text-[#040811] font-sans text-xs font-black uppercase tracking-widest px-3 py-1 mb-4">
              Canje confirmado
            </p>
            <h1 ref={doneHeadingRef} tabIndex={-1} class="font-display font-bold text-2xl text-white uppercase mb-2 outline-none">
              Aplicá el beneficio
            </h1>
            <p class="font-display font-black text-4xl text-accent mb-2">{checked.value.benefitResumen}</p>
            <p class="font-sans text-sm text-slate-200">{checked.value.benefitTitle}</p>
            <dl class="mt-4 space-y-1 font-sans text-sm text-slate-300">
              <div><dt class="inline">Socio: </dt><dd class="inline font-bold text-white">{checked.value.userName}</dd></div>
              <div><dt class="inline">DNI: </dt><dd class="inline font-mono">{checked.value.maskedDni}</dd></div>
              <div><dt class="inline">Código: </dt><dd class="inline font-mono tracking-[0.3em]">{checked.value.code}</dd></div>
            </dl>
            <button type="button" onClick$={startOver} class={`${secondaryButton} mt-6`}>
              Validar otro cupón
            </button>
          </div>
        ) : step.value === "confirm" && checked.value ? (
          <div class="text-center animate-scale-in">
            <p class="font-sans text-xs uppercase tracking-widest text-slate-300 mb-2">Cupón válido · todavía no se canjeó</p>
            <h1 ref={confirmHeadingRef} tabIndex={-1} class="font-display font-bold text-xl text-white uppercase outline-none">
              {checked.value.benefitTitle}
            </h1>
            <p class="font-sans text-xs uppercase tracking-widest text-slate-300 mt-4">Descuento a aplicar</p>
            <p class="font-display font-black text-4xl text-accent">{checked.value.benefitResumen}</p>
            <dl class="mt-4 space-y-1 font-sans text-sm text-slate-300">
              <div><dt class="inline">Socio: </dt><dd class="inline font-bold text-white">{checked.value.userName}</dd></div>
              <div><dt class="inline">DNI: </dt><dd class="inline font-mono">{checked.value.maskedDni}</dd></div>
              <div><dt class="inline">Código: </dt><dd class="inline font-mono tracking-[0.3em]">{checked.value.code}</dd></div>
            </dl>
            {error.value && (
              <p role="alert" class="mt-4 font-sans text-sm text-red-300">{error.value.message}</p>
            )}
            <div class="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick$={handleRedeem}
                disabled={isSubmitting.value}
                class="w-full bg-accent text-primary font-display font-bold text-xl uppercase tracking-widest py-4 hover:bg-accent-hover transition-colors duration-200 disabled:opacity-50 disabled:cursor-wait cursor-pointer"
              >
                {isSubmitting.value ? "Canjeando..." : "Confirmar canje"}
              </button>
              <button type="button" onClick$={backToForm} disabled={isSubmitting.value} class={secondaryButton}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <form preventdefault:submit onSubmit$={handleCheck} class="flex flex-col gap-4" noValidate>
            {!isAdmin.value && (
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label for="validator-pin" class="font-sans text-xs uppercase tracking-widest text-slate-300">
                    PIN del comercio
                  </label>
                  {hasStoredPin.value && (
                    <button type="button" onClick$={forgetPin} class="font-sans text-xs text-slate-300 underline hover:text-accent cursor-pointer">
                      Olvidar PIN
                    </button>
                  )}
                </div>
                <input
                  ref={pinRef}
                  id="validator-pin"
                  type="password"
                  inputMode="numeric"
                  autocomplete="off"
                  placeholder="••••"
                  bind:value={pinInput}
                  aria-invalid={error.value?.field === "pin"}
                  aria-describedby={error.value?.field === "pin" ? "validator-error" : undefined}
                  class={inputClass}
                />
              </div>
            )}
            <div>
              <label for="validator-dni" class={labelClass}>DNI del socio</label>
              <input
                ref={dniRef}
                id="validator-dni"
                type="text"
                inputMode="numeric"
                autocomplete="off"
                placeholder="12.345.678"
                bind:value={socioInput}
                aria-invalid={error.value?.field === "dni"}
                aria-describedby={error.value?.field === "dni" ? "validator-error" : undefined}
                class={inputClass}
              />
            </div>
            <div>
              <label for="validator-code" class={labelClass}>Código de cupón</label>
              <input
                ref={codeRef}
                id="validator-code"
                type="text"
                inputMode="text"
                autocomplete="off"
                autoCapitalize="characters"
                spellcheck={false}
                placeholder="7X4K2M"
                maxLength={8}
                value={codeInput.value}
                onInput$={(_, el) => {
                  // Codes are often typed as printed ("7X4 K2M"); spaces and hyphens do not count.
                  const normalized = normalizeCouponCode(el.value);
                  codeInput.value = normalized;
                  if (el.value !== normalized) el.value = normalized;
                }}
                aria-invalid={error.value?.field === "code"}
                aria-describedby={error.value?.field === "code" ? "validator-error" : undefined}
                class="w-full bg-[#040811] border border-secondary text-accent font-mono text-3xl px-4 py-4 outline-none focus:border-accent transition-colors duration-200 tracking-[0.4em] uppercase text-center aria-[invalid=true]:border-red-400"
              />
            </div>
            {error.value && (
              <p id="validator-error" role="alert" class="font-sans text-sm font-bold text-red-300">
                {error.value.message}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting.value}
              class="w-full bg-accent text-primary font-display font-bold text-xl uppercase tracking-widest py-4 hover:bg-accent-hover transition-colors duration-200 disabled:opacity-50 disabled:cursor-wait cursor-pointer"
            >
              {isSubmitting.value ? (
                <span class="flex items-center justify-center gap-3">
                  <span class="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Verificando...
                </span>
              ) : (
                "Verificar cupón"
              )}
            </button>
            <p class="font-sans text-xs text-slate-300 text-center">
              Verificar no canjea el cupón: vas a ver el descuento y confirmar en el paso siguiente.
            </p>
          </form>
        )}
      </div>

      <p class="font-sans text-xs text-slate-400 mt-8 text-center">
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
