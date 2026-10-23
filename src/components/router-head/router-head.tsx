import { component$ } from "@builder.io/qwik";
import { useDocumentHead, useLocation } from "@builder.io/qwik-city";

/**
 * The RouterHead component is placed inside of the document `<head>` element.
 */
export const RouterHead = component$(() => {
  const head = useDocumentHead();
  const loc = useLocation();

  // Link previews (WhatsApp, redes): pages may set their own og:* tags; these fill the gaps.
  const declared = (key: string) => head.meta.some((m) => m.property === key || m.name === key);
  const description = head.meta.find((m) => m.name === "description")?.content;
  const hasPageImage = declared("og:image");
  const shareDefaults = [
    { property: "og:site_name", content: "LPRC Beneficios" },
    { property: "og:locale", content: "es_AR" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: loc.url.href },
    { property: "og:title", content: head.title },
    { property: "og:description", content: description },
    { property: "og:image", content: new URL("/lprc-app-icon-512.png", loc.url.origin).href },
    { name: "twitter:card", content: hasPageImage ? "summary_large_image" : "summary" },
  ].filter((m) => m.content && !declared(m.property ?? m.name));

  return (
    <>
      <title>{head.title}</title>

      <link rel="canonical" href={loc.url.href} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="icon" type="image/svg+xml" sizes="any" href="/favicon.svg" />
      <link rel="shortcut icon" href="/favicon.ico" />
      <link rel="manifest" href="/manifest.json" />
      <meta name="theme-color" content="#0B1526" />

      {head.meta.map((m) => (
        <meta key={m.key} {...m} />
      ))}
      {shareDefaults.map((m) => (
        <meta key={m.property ?? m.name} {...m} />
      ))}

      {head.links.map((l) => (
        <link key={l.key} {...l} />
      ))}

      {head.styles.map((s) => (
        <style
          key={s.key}
          {...s.props}
          {...(s.props?.dangerouslySetInnerHTML
            ? {}
            : { dangerouslySetInnerHTML: s.style })}
        />
      ))}

      {head.scripts.map((s) => (
        <script
          key={s.key}
          {...s.props}
          {...(s.props?.dangerouslySetInnerHTML
            ? {}
            : { dangerouslySetInnerHTML: s.script })}
        />
      ))}
    </>
  );
});
