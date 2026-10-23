import { component$, Slot } from "@builder.io/qwik";

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

const base = "border-l-4 px-5 py-4 text-sm font-semibold";

/** Success line with the ActionFeedback look, for notices that do not come from an action. */
export const Notice = component$(() => (
  <div role="status" class={`${base} border-green-700 bg-green-50 text-green-900`}>
    <Slot />
  </div>
));

/** Result banner for admin actions, so no failure is silent. */
export const ActionFeedback = component$<ActionFeedbackProps>((props) => {
  const result = props.value as ActionResult | undefined;
  if (!result) return null;

  if (result.failed || result.success === false) {
    return (
      <div role="alert" class={`${base} border-red-600 bg-red-50 text-red-800`}>
        {result.message || result.formErrors?.[0] || "No se pudo completar la acción. Intentá de nuevo."}
      </div>
    );
  }

  if (!props.success) return null;
  return <Notice>{props.success}</Notice>;
});
