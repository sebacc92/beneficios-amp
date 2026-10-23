import { component$ } from "@builder.io/qwik";

type ActionResult = {
  success?: boolean;
  failed?: boolean;
  message?: string;
  formErrors?: string[];
};

interface ActionFeedbackProps {
  /** An action's `value`: a failure always shows, success only when `success` text is given. */
  value: unknown;
  success?: string;
}

/** Result banner for admin actions, so no failure is silent. */
export const ActionFeedback = component$<ActionFeedbackProps>((props) => {
  const result = props.value as ActionResult | undefined;
  if (!result) return null;

  if (result.failed || result.success === false) {
    return (
      <div role="alert" class="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-xs font-bold text-red-700 shadow-sm">
        {result.message || result.formErrors?.[0] || "No se pudo completar la acción. Intentá de nuevo."}
      </div>
    );
  }

  if (!props.success) return null;
  return (
    <div role="status" class="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-xs font-bold text-emerald-800 shadow-sm">
      {props.success}
    </div>
  );
});
