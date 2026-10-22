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
  // Base classes for the sports-themed button
  const baseClasses = "relative inline-flex items-center justify-center font-display font-bold uppercase tracking-wider text-sm py-3 px-8 transition-all duration-300 active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none";

  // Custom styles for each variant
  let variantClasses = "";
  if (variant === "primary") {
    variantClasses = "bg-primary text-white border border-accent/20 hover:border-accent hover:shadow-[0_0_15px_rgba(245,200,0,0.15)]";
  } else if (variant === "secondary") {
    variantClasses = "bg-secondary text-slate-200 border border-slate-700 hover:border-slate-500 hover:text-white";
  } else if (variant === "accent") {
    variantClasses = "bg-accent text-primary font-black hover:bg-accent-hover hover:shadow-[0_0_20px_rgba(245,200,0,0.3)]";
  }

  const combinedClasses = `${baseClasses} ${variantClasses} ${customClass}`;

  // Cut-corner clip-path for athletic aesthetic
  const buttonStyle = {
    clipPath: "polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)",
  };

  if (href) {
    return (
      <Link href={href} class={combinedClasses} style={buttonStyle}>
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
      style={buttonStyle}
    >
      <Slot />
    </button>
  );
});
