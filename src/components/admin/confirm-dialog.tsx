import { component$, Slot, useId, useSignal, useTask$, type QRL, type Signal } from "@builder.io/qwik";
import { isBrowser } from "@builder.io/qwik/build";

interface ConfirmDialogProps {
  /** Opens and closes the native modal; the dialog also resets it on Escape or Cancelar. */
  open: Signal<boolean>;
  title: string;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  error?: string;
  onConfirm$: QRL<() => void | Promise<void>>;
}

/** Destructive confirmation shared by the admin pages, in place of window.confirm(). */
export const ConfirmDialog = component$<ConfirmDialogProps>((props) => {
  const dialog = useSignal<HTMLDialogElement>();
  const titleId = useId();

  useTask$(({ track }) => {
    const open = track(() => props.open.value);
    if (!isBrowser || !dialog.value) return;
    if (open && !dialog.value.open) dialog.value.showModal();
    if (!open && dialog.value.open) dialog.value.close();
  });

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md border-t-4 border-red-600 bg-white p-6 text-left text-slate-800 shadow-xl backdrop:bg-brand-ink/60"
      preventdefault:cancel
      onCancel$={() => { if (!props.pending) props.open.value = false; }}
      onClose$={() => { props.open.value = false; }}
    >
      <div class="space-y-5">
        <h2 id={titleId} class="heading-display text-xl text-primary">{props.title}</h2>
        <div class="space-y-3 text-sm text-slate-600">
          <Slot />
        </div>
        {props.error && <p role="alert" class="text-sm font-semibold text-red-700">{props.error}</p>}
        <div class="flex flex-wrap justify-end gap-3">
          <button type="button" disabled={props.pending} onClick$={() => { props.open.value = false; }} class="btn btn-outline btn-sm">
            Cancelar
          </button>
          <button
            type="button"
            disabled={props.pending}
            onClick$={props.onConfirm$}
            class="btn btn-sm border-red-700 bg-red-700 text-white hover:bg-red-800"
          >
            {props.pending ? props.pendingLabel ?? "Eliminando..." : props.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
});
