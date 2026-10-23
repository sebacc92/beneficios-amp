import { component$, Slot } from "@builder.io/qwik";

interface SectionHeadingProps {
  title: string;
  eyebrow?: string;
  /** Heading level; pages use "h1" once, sections "h2". */
  as?: "h1" | "h2" | "h3";
  align?: "left" | "center";
  /** "dark" for navy or photo backgrounds. */
  tone?: "light" | "dark";
  size?: "md" | "lg" | "xl";
  id?: string;
  class?: string;
}

const SIZES = {
  md: "text-2xl sm:text-3xl",
  lg: "text-3xl sm:text-4xl",
  xl: "text-4xl sm:text-5xl",
};

/** Eyebrow, uppercase Oswald title and the short yellow rule lprc.com.ar puts under headings. */
export const SectionHeading = component$<SectionHeadingProps>(({ title, eyebrow, as = "h2", align = "left", tone = "light", size = "lg", id, class: extraClass = "" }) => {
  const Tag = as;
  const centered = align === "center";
  return (
    <div class={`${centered ? "text-center" : "text-left"} ${extraClass}`}>
      {eyebrow && <p class={`eyebrow mb-2 ${tone === "dark" ? "text-accent" : "text-amber-900"}`}>{eyebrow}</p>}
      <Tag id={id} class={`heading-display ${SIZES[size]} ${tone === "dark" ? "text-white" : "text-primary"}`}>
        {title}
      </Tag>
      <span class={`title-bar mt-3 ${centered ? "mx-auto" : ""}`} aria-hidden="true" />
      <Slot />
    </div>
  );
});
