import { component$, Slot, useSignal, $ } from "@builder.io/qwik";
import { LuEye, LuEyeOff, LuAlertTriangle } from "@qwikest/icons/lucide";

/** Navy page with the club crest and a white card: the admin login and the forced password change. */
export const AdminAuthShell = component$<{ title: string; subtitle: string }>(({ title, subtitle }) => (
  <div class="min-h-dvh bg-primary px-4 py-10 font-sans flex flex-col items-center justify-center">
    <div class="w-full max-w-md space-y-6">
      <div class="flex items-center justify-center gap-3 text-left">
        <img src="/lprc.avif" alt="" width={120} height={101} class="h-auto w-16 shrink-0 object-contain" />
        <div class="flex flex-col gap-1">
          <span class="font-display text-2xl font-bold leading-tight text-white">Club de Beneficios</span>
          <span class="text-[11px] font-bold tracking-[0.06em] text-accent">LA PLATA RUGBY CLUB</span>
        </div>
      </div>

      <div class="card border-t-4 border-t-accent p-6 sm:p-8 space-y-6 shadow-xl">
        <div class="space-y-3">
          <h1 class="heading-display text-3xl text-primary">{title}</h1>
          <span class="title-bar" aria-hidden="true" />
          <p class="text-sm text-slate-600">{subtitle}</p>
        </div>
        <Slot />
      </div>

      <Slot name="footer" />
    </div>
  </div>
));

interface PasswordFieldProps {
  id: string;
  name: string;
  label: string;
  autocomplete: "current-password" | "new-password";
  error?: string;
  hint?: string;
  minLength?: number;
}

/** Password input with show/hide and a Caps Lock warning, the two usual causes of "wrong password". */
export const PasswordField = component$<PasswordFieldProps>((props) => {
  const visible = useSignal(false);
  const capsLock = useSignal(false);
  const errorId = `${props.id}-error`;
  const hintId = `${props.id}-hint`;
  const capsId = `${props.id}-caps`;
  const describedBy = [props.hint && hintId, capsLock.value && capsId, props.error && errorId].filter(Boolean).join(" ") || undefined;

  const trackCapsLock = $((event: KeyboardEvent) => {
    if (typeof event.getModifierState === "function") capsLock.value = event.getModifierState("CapsLock");
  });

  return (
    <div>
      <label for={props.id} class="field-label">{props.label}</label>
      <div class="relative">
        <input
          id={props.id}
          name={props.name}
          type={visible.value ? "text" : "password"}
          required
          minLength={props.minLength}
          autoComplete={props.autocomplete}
          autoCapitalize="off"
          spellcheck={false}
          aria-invalid={props.error ? "true" : undefined}
          aria-describedby={describedBy}
          onKeyDown$={trackCapsLock}
          onKeyUp$={trackCapsLock}
          onBlur$={() => (capsLock.value = false)}
          class="field pr-14 text-base sm:text-sm"
        />
        <button
          type="button"
          onClick$={() => (visible.value = !visible.value)}
          aria-pressed={visible.value}
          aria-controls={props.id}
          class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-600 hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary cursor-pointer"
        >
          {visible.value ? <LuEyeOff class="h-5 w-5" aria-hidden="true" /> : <LuEye class="h-5 w-5" aria-hidden="true" />}
          <span class="sr-only">Mostrar contraseña</span>
        </button>
      </div>
      {props.hint && <p id={hintId} class="mt-1.5 text-xs text-slate-600">{props.hint}</p>}
      {capsLock.value && (
        <p id={capsId} class="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900">
          <LuAlertTriangle class="h-4 w-4" aria-hidden="true" />
          Tenés activado Bloq Mayús.
        </p>
      )}
      {props.error && <p id={errorId} class="mt-1.5 text-xs font-semibold text-red-700">{props.error}</p>}
    </div>
  );
});
