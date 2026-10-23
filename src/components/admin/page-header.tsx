import { component$, Slot } from "@builder.io/qwik";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  /** Small tracked label above the title; the layout breadcrumb already names the section. */
  eyebrow?: string;
}

/** Page title block shared by the admin pages: Oswald title, yellow rule and an actions slot. */
export const AdminPageHeader = component$<AdminPageHeaderProps>((props) => (
  <header class="flex flex-col gap-5 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
    <div class="min-w-0 space-y-2 text-left">
      {props.eyebrow && <p class="eyebrow text-amber-900">{props.eyebrow}</p>}
      <h1 class="heading-display text-3xl text-primary sm:text-4xl">{props.title}</h1>
      <span class="title-bar" aria-hidden="true" />
      {props.description && <p class="max-w-2xl pt-1 text-sm text-slate-600">{props.description}</p>}
    </div>
    <div class="flex shrink-0 flex-wrap items-center gap-2">
      <Slot />
    </div>
  </header>
));
