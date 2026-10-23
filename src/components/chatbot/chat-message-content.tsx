import type { JSXOutput } from "@builder.io/qwik";
import { parseChatMarkdown, type ChatInline } from "./chat-markdown";

interface ChatMessageContentProps {
  content: string;
  /** "dark" inside the navy user bubble, so links keep their contrast. */
  tone?: "light" | "dark";
}

function renderInline(parts: ChatInline[], tone: "light" | "dark"): JSXOutput[] {
  const linkClass =
    tone === "dark"
      ? "font-semibold text-accent underline underline-offset-2"
      : "font-semibold text-primary underline decoration-accent decoration-2 underline-offset-2 hover:decoration-primary";
  return parts.map((part, index) => {
    if (part.type === "bold") return <strong key={index} class="font-bold">{part.text}</strong>;
    if (part.type === "link") {
      return part.external ? (
        <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" class={`${linkClass} break-words`}>
          {part.text}
          <span class="sr-only"> (se abre en otra pestaña)</span>
        </a>
      ) : (
        <a key={index} href={part.href} class={`${linkClass} break-words`}>{part.text}</a>
      );
    }
    return <span key={index}>{part.text}</span>;
  });
}

/**
 * Assistant replies as the public chatbot shows them: clickable links, bold and
 * lists. The admin audit renders saved conversations with this same function.
 */
export function ChatMessageContent({ content, tone = "light" }: ChatMessageContentProps) {
  const blocks = parseChatMarkdown(content);
  return (
    <div class="space-y-2">
      {blocks.map((block, index) =>
        block.type === "list" ? (
          block.ordered ? (
            <ol key={index} class="list-decimal space-y-1 pl-5">
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, tone)}</li>)}
            </ol>
          ) : (
            <ul key={index} class="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, tone)}</li>)}
            </ul>
          )
        ) : (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line, tone)}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
