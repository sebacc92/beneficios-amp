import { component$, Slot, type PropFunction } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

interface LPRCButtonProps {
  href?: string;
  onClick$?: PropFunction<() => any>;
  variant?: "primary" | "secondary" | "accent";
  class?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

export const LPRCButton = component$<LPRCButtonProps>(({
  href,
  onClick$,
  variant = "primary",
  class: customClass = "",
  type = "button",
  disabled = false,
}) => {
  // Rectangular, uppercase Oswald button like lprc.com.ar ("VER FIXTURE", "HACETE SOCIO").
  const variantClass = variant === "accent" ? "btn-primary" : variant === "secondary" ? "btn-outline" : "btn-dark";
  const combinedClasses = `btn ${variantClass} ${customClass}`;

  if (href) {
    return (
      <Link href={href} class={combinedClasses}>
        <Slot />
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick$={onClick$}
      disabled={disabled}
      class={combinedClasses}
    >
      <Slot />
    </button>
  );
});
