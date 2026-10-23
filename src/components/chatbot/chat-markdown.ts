/**
 * The light markdown the assistant writes (the system prompt asks for
 * `[Ver beneficio](/beneficio/slug)` links): paragraphs, "- " lists, **bold**,
 * links and bare URLs. Everything else stays plain text; nothing becomes HTML.
 */
export type ChatInline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string; external: boolean };

export type ChatBlock =
  | { type: "paragraph"; lines: ChatInline[][] }
  | { type: "list"; ordered: boolean; items: ChatInline[][] };

/** Only same-site paths and web, mail, phone links; never `javascript:` or protocol-relative URLs. */
export function safeChatHref(raw: string): { href: string; external: boolean } | null {
  const href = raw.trim();
  if (href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\")) return { href, external: false };
  if (/^https?:\/\/[^\s]+$/i.test(href)) return { href, external: true };
  if (/^(mailto|tel):[^\s]+$/i.test(href)) return { href, external: false };
  return null;
}

const INLINE = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?¿¡"'])/g;

export function parseChatInline(text: string): ChatInline[] {
  const parts: ChatInline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ type: "text", text: text.slice(last, index) });
    const [whole, label, target, bold, url] = match;
    if (label !== undefined && target !== undefined) {
      const safe = safeChatHref(target);
      parts.push(safe ? { type: "link", text: label, ...safe } : { type: "text", text: label });
    } else if (bold !== undefined) {
      parts.push({ type: "bold", text: bold });
    } else if (url !== undefined) {
      const safe = safeChatHref(url);
      parts.push(safe ? { type: "link", text: url, ...safe } : { type: "text", text: whole });
    }
    last = index + whole.length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

const LIST_ITEM = /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/;

export function parseChatMarkdown(content: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  for (const rawLine of content.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    const current = blocks.at(-1);
    if (!line.trim()) {
      // A blank line closes the paragraph or list in progress.
      if (current && !(current.type === "paragraph" && current.lines.length === 0)) blocks.push({ type: "paragraph", lines: [] });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      const ordered = item[2] !== undefined;
      const inline = parseChatInline(item[3]);
      if (current?.type === "list" && current.ordered === ordered) current.items.push(inline);
      else blocks.push({ type: "list", ordered, items: [inline] });
      continue;
    }
    if (current?.type === "paragraph") current.lines.push(parseChatInline(line.trim()));
    else blocks.push({ type: "paragraph", lines: [parseChatInline(line.trim())] });
  }
  return blocks.filter((block) => (block.type === "paragraph" ? block.lines.length > 0 : block.items.length > 0));
}
