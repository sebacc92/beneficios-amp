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
      class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-left text-slate-800 shadow-xl backdrop:bg-slate-950/50"
      preventdefault:cancel
      onCancel$={() => { if (!props.pending) props.open.value = false; }}
      onClose$={() => { props.open.value = false; }}
    >
      <div class="space-y-5">
        <h2 id={titleId} class="text-lg font-bold text-brand-navy-dark">{props.title}</h2>
        <div class="space-y-3 text-sm text-slate-600">
          <Slot />
        </div>
        {props.error && <p role="alert" class="text-sm text-red-600">{props.error}</p>}
        <div class="flex justify-end gap-3">
          <button type="button" disabled={props.pending} onClick$={() => { props.open.value = false; }} class="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold disabled:opacity-50 cursor-pointer">
            Cancelar
          </button>
          <button type="button" disabled={props.pending} onClick$={props.onConfirm$} class="rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer">
            {props.pending ? props.pendingLabel ?? "Eliminando..." : props.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
});
