import { component$, noSerialize, useSignal, useVisibleTask$, $, type NoSerialize } from "@builder.io/qwik";
import { routeLoader$, type DocumentHead, server$ } from "@builder.io/qwik-city";
import { LuMessageCircle, LuScanLine, LuX } from "@qwikest/icons/lucide";
import { getSessionUser } from "~/server/auth";
import { checkCoupon, validateCoupon, type ValidationResult } from "~/server/coupons";
import { WHATSAPP_MESSAGES, whatsappLink } from "~/utils/club";
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

const COUPON_CODE = /^[A-Z0-9]{4,8}$/;

/** The coupon QR holds `https://<site>/validar-cupon/?code=XXXXXX`; a bare code is accepted too. */
function couponCodeFromQr(raw: string): string | null {
  try {
    const code = normalizeCouponCode(new URL(raw).searchParams.get("code"));
    return COUPON_CODE.test(code) ? code : null;
  } catch {
    const code = normalizeCouponCode(raw);
    return COUPON_CODE.test(code) ? code : null;
  }
}

// Minimal shape of the Shape Detection API, which TypeScript's DOM types do not ship yet.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

const labelClass = "mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-300";
const inputClass = "w-full border border-secondary bg-brand-ink px-4 py-3 font-mono text-lg tracking-widest text-white outline-none transition-colors duration-200 placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500 focus:border-accent focus:shadow-[0_0_0_3px_rgb(255_215_0/0.35)] aria-[invalid=true]:border-red-400";

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
  const submitRef = useSignal<HTMLButtonElement>();

  // Camera scanning only where the browser can read QR codes itself (Chrome on Android, mostly).
  const canScan = useSignal(false);
  const scanDialog = useSignal<HTMLDialogElement>();
  const videoRef = useSignal<HTMLVideoElement>();
  const scanStream = useSignal<NoSerialize<MediaStream>>();
  const scanTimer = useSignal<number>();
  const scanMessage = useSignal("");

  const stopScan = $(() => {
    window.clearTimeout(scanTimer.value);
    scanStream.value?.getTracks().forEach((track) => track.stop());
    scanStream.value = undefined;
    if (videoRef.value) videoRef.value.srcObject = null;
  });

  // Remember the shop PIN on the device so staff type it once, not per coupon.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    try {
      pinInput.value = localStorage.getItem(PIN_STORAGE_KEY) ?? "";
      hasStoredPin.value = Boolean(pinInput.value);
    } catch {
      // Storage can be blocked; the PIN is then typed each time.
    }
    canScan.value = "BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia);
    // Never leave the camera on when the page goes away.
    cleanup(() => stopScan());
  });

  const startScan = $(async () => {
    scanMessage.value = "Apuntá la cámara al QR del socio.";
    scanDialog.value?.showModal();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (!scanDialog.value?.open) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      scanStream.value = noSerialize(stream);
      const video = videoRef.value!;
      video.srcObject = stream;
      await video.play();
      const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
      const detector = new Detector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!scanStream.value) return;
        try {
          const found = await detector.detect(video);
          const code = found.map((item) => couponCodeFromQr(item.rawValue)).find(Boolean);
          if (code) {
            codeInput.value = code;
            error.value = null;
            scanDialog.value?.close();
            requestAnimationFrame(() => (socioInput.value ? submitRef.value : dniRef.value)?.focus());
            return;
          }
          if (found.length) scanMessage.value = "Ese QR no es de un cupón del club. Probá con el del socio o tipeá el código.";
        } catch {
          // A frame that cannot be read yet; try the next one.
        }
        scanTimer.value = window.setTimeout(tick, 250);
      };
      await tick();
    } catch (err) {
      await stopScan();
      scanMessage.value =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "El navegador no dio permiso para usar la cámara. Habilitalo en los permisos del sitio o tipeá el código."
          : "No pudimos abrir la cámara. Tipeá el código que figura debajo del QR.";
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
    requestAnimationFrame(() => codeRef.value?.focus());
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
    <div class="flex flex-col items-center px-4 py-8 sm:py-12">
      <div class="w-full max-w-md">
        {step.value === "done" && checked.value ? (
          <div role="status" class="animate-scale-in border border-secondary border-t-4 border-t-emerald-500 bg-primary p-6">
            <p class="badge mb-4 bg-emerald-500 text-brand-ink">Canje confirmado</p>
            <h1 ref={doneHeadingRef} tabIndex={-1} class="heading-display text-2xl text-white outline-none">
              Aplicá el descuento
            </h1>
            <p class="heading-display mt-4 break-words text-5xl text-accent sm:text-6xl">{checked.value.benefitResumen}</p>
            <p class="mt-2 font-display text-lg font-semibold uppercase tracking-wide text-white">{checked.value.benefitTitle}</p>
            <dl class="mt-5 space-y-1 border-t border-secondary pt-4 text-sm text-slate-300">
              <div><dt class="inline">Socio: </dt><dd class="inline font-bold text-white">{checked.value.userName}</dd></div>
              <div><dt class="inline">DNI: </dt><dd class="inline font-mono">{checked.value.maskedDni}</dd></div>
              <div><dt class="inline">Código: </dt><dd class="inline font-mono tracking-[0.3em]">{checked.value.code}</dd></div>
            </dl>
            <button type="button" onClick$={startOver} class="btn btn-outline-light mt-6 w-full">
              Validar otro cupón
            </button>
          </div>
        ) : step.value === "confirm" && checked.value ? (
          <div class="animate-scale-in border border-secondary border-t-4 border-t-accent bg-primary p-6">
            <p class="eyebrow text-slate-300">Todavía no se canjeó</p>
            <h1 ref={confirmHeadingRef} tabIndex={-1} class="heading-display mt-1 text-2xl text-white outline-none">
              Cupón válido
            </h1>
            <p class="eyebrow mt-5 text-accent">Descuento a aplicar</p>
            <p class="heading-display mt-1 break-words text-5xl text-accent sm:text-6xl">{checked.value.benefitResumen}</p>
            <p class="mt-2 font-display text-lg font-semibold uppercase tracking-wide text-white">{checked.value.benefitTitle}</p>
            <dl class="mt-5 space-y-1 border-t border-secondary pt-4 text-sm text-slate-300">
              <div><dt class="inline">Socio: </dt><dd class="inline font-bold text-white">{checked.value.userName}</dd></div>
              <div><dt class="inline">DNI: </dt><dd class="inline font-mono">{checked.value.maskedDni}</dd></div>
              <div><dt class="inline">Código: </dt><dd class="inline font-mono tracking-[0.3em]">{checked.value.code}</dd></div>
            </dl>
            {error.value && (
              <p role="alert" class="mt-4 text-sm font-semibold text-red-300">{error.value.message}</p>
            )}
            <div class="mt-6 flex flex-col gap-3">
              <button type="button" onClick$={handleRedeem} disabled={isSubmitting.value} class="btn btn-primary min-h-14 w-full disabled:cursor-wait">
                {isSubmitting.value ? "Canjeando…" : "Confirmar canje"}
              </button>
              <button type="button" onClick$={backToForm} disabled={isSubmitting.value} class="btn btn-outline-light w-full">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 class="heading-display text-3xl text-white sm:text-4xl">Validar cupón</h1>
            <span class="title-bar mt-3" aria-hidden="true" />
            <p class="mt-3 text-sm leading-relaxed text-slate-300">
              Verificá el cupón del socio antes de cobrar. Verificar no lo canjea: el canje se confirma en el paso siguiente.
            </p>

            <form preventdefault:submit onSubmit$={handleCheck} class="mt-6 flex flex-col gap-5 border border-secondary bg-primary p-6" noValidate>
              {!isAdmin.value && (
                <div>
                  <div class="mb-2 flex items-center justify-between">
                    <label for="validator-pin" class="text-xs font-bold uppercase tracking-[0.12em] text-slate-300">
                      PIN del comercio
                    </label>
                    {hasStoredPin.value && (
                      <button type="button" onClick$={forgetPin} class="min-h-11 cursor-pointer text-xs text-slate-300 underline hover:text-accent">
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
                    placeholder="El que te dio el club"
                    bind:value={pinInput}
                    aria-invalid={error.value?.field === "pin"}
                    aria-describedby={error.value?.field === "pin" ? "validator-error" : undefined}
                    class={inputClass}
                  />
                </div>
              )}
              <div>
                <div class="mb-2 flex items-end justify-between gap-3">
                  <label for="validator-code" class="text-xs font-bold uppercase tracking-[0.12em] text-slate-300">
                    Código del cupón
                  </label>
                  {canScan.value && (
                    <button type="button" onClick$={startScan} class="btn btn-outline-light btn-sm">
                      <LuScanLine class="h-4 w-4" aria-hidden="true" />
                      Escanear QR
                    </button>
                  )}
                </div>
                <input
                  ref={codeRef}
                  id="validator-code"
                  type="text"
                  inputMode="text"
                  autocomplete="off"
                  autoCapitalize="characters"
                  spellcheck={false}
                  placeholder="Ej.: 7X4K2M"
                  maxLength={8}
                  value={codeInput.value}
                  onInput$={(_, el) => {
                    // Codes are often typed as printed ("7X4 K2M"); spaces and hyphens do not count.
                    const normalized = normalizeCouponCode(el.value);
                    codeInput.value = normalized;
                    if (el.value !== normalized) el.value = normalized;
                  }}
                  aria-invalid={error.value?.field === "code"}
                  aria-describedby={error.value?.field === "code" ? "validator-error validator-code-hint" : "validator-code-hint"}
                  class="w-full border border-secondary bg-brand-ink px-4 py-4 text-center font-mono text-3xl uppercase tracking-[0.4em] text-white outline-none transition-colors duration-200 placeholder:font-sans placeholder:text-lg placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500 focus:border-accent focus:shadow-[0_0_0_3px_rgb(255_215_0/0.35)] aria-[invalid=true]:border-red-400"
                />
                <p id="validator-code-hint" class="mt-2 text-xs leading-relaxed text-slate-400">
                  {canScan.value
                    ? "Son 6 caracteres y figuran debajo del QR. Si el escáner no lo toma, tipealos."
                    : "Son 6 caracteres y figuran debajo del QR. También podés escanear el QR con la cámara del celular: se abre esta página con el código cargado."}
                </p>
              </div>
              <div>
                <label for="validator-dni" class={labelClass}>DNI del socio</label>
                <input
                  ref={dniRef}
                  id="validator-dni"
                  type="text"
                  inputMode="numeric"
                  autocomplete="off"
                  placeholder="Ej.: 12.345.678"
                  bind:value={socioInput}
                  aria-invalid={error.value?.field === "dni"}
                  aria-describedby={error.value?.field === "dni" ? "validator-error" : undefined}
                  class={inputClass}
                />
              </div>
              {error.value && (
                <p id="validator-error" role="alert" class="border-l-4 border-red-400 bg-red-950/40 px-3 py-2 text-sm font-bold text-red-200">
                  {error.value.message}
                </p>
              )}
              <button ref={submitRef} type="submit" disabled={isSubmitting.value} class="btn btn-primary min-h-14 w-full disabled:cursor-wait">
                {isSubmitting.value ? (
                  <span class="flex items-center justify-center gap-3">
                    <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
                    Verificando…
                  </span>
                ) : (
                  "Verificar cupón"
                )}
              </button>
            </form>

            <section aria-labelledby="cashier-help-title" class="mt-8 border-l-4 border-accent bg-secondary/60 p-5">
              <h2 id="cashier-help-title" class="eyebrow text-accent">Cómo validar</h2>
              <ol class="mt-3 space-y-3 text-sm leading-relaxed text-slate-200">
                <li class="flex gap-3">
                  <span class="font-display text-xl font-bold leading-none text-accent" aria-hidden="true">1</span>
                  <span>Pedile al socio el QR o el código del cupón, y su DNI.</span>
                </li>
                <li class="flex gap-3">
                  <span class="font-display text-xl font-bold leading-none text-accent" aria-hidden="true">2</span>
                  <span>Cargá el código y el DNI y tocá «Verificar cupón».</span>
                </li>
                <li class="flex gap-3">
                  <span class="font-display text-xl font-bold leading-none text-accent" aria-hidden="true">3</span>
                  <span>Aplicá el descuento que aparece y tocá «Confirmar canje». Cada cupón se usa una sola vez.</span>
                </li>
              </ol>
              <a href={whatsappLink(WHATSAPP_MESSAGES.comercio)} target="_blank" rel="noopener" class="btn btn-outline-light btn-sm mt-5 w-full">
                <LuMessageCircle class="h-4 w-4" aria-hidden="true" />
                Soporte por WhatsApp
                <span class="sr-only"> (abre en una pestaña nueva)</span>
              </a>
            </section>
          </>
        )}

        <p class="mt-8 text-center text-xs text-slate-400">Solo para uso autorizado de comercios adheridos a La Plata Rugby Club.</p>
      </div>

      <dialog
        ref={scanDialog}
        aria-labelledby="scan-title"
        onClose$={stopScan}
        class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md border-t-4 border-accent bg-primary p-5 text-white backdrop:bg-brand-ink/90"
      >
        <div class="flex items-center justify-between gap-4">
          <h2 id="scan-title" class="heading-display text-xl">
            Escanear QR del cupón
          </h2>
          <button
            type="button"
            onClick$={() => scanDialog.value?.close()}
            aria-label="Cerrar el escáner"
            class="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-secondary text-slate-200 hover:border-accent hover:text-accent"
          >
            <LuX class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <video ref={videoRef} muted playsInline class="mt-4 aspect-square w-full bg-brand-ink object-cover" />
        <p role="status" aria-live="polite" class="mt-3 text-sm text-slate-300">
          {scanMessage.value}
        </p>
      </dialog>
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
