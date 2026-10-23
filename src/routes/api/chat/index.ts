import { type RequestHandler } from "@builder.io/qwik-city";
import OpenAI from "openai";
import { getSettings, addMessageToSession, type ChatbotSettings } from "~/server/chatbotDb";
import { isAdmin } from "~/server/auth";
import { CLUB } from "~/utils/club";
import { getBenefits } from "~/server/cache";
import { rateLimitByIp } from "~/server/rate-limit";

// This endpoint spends money on every call, so the payload is bounded on all axes.
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 1500;
const MAX_TOTAL_CHARS = 8000;
// Per IP, per instance. See src/server/rate-limit.ts for the caveats.
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 5 * 60 * 1000;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

/** Rejects anything that is not a small, well-formed chat transcript. */
function parseMessages(raw: unknown): { ok: true; messages: IncomingMessage[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "Faltan mensajes en la petición." };
  }
  if (raw.length > MAX_MESSAGES) {
    return { ok: false, error: "La conversación es demasiado larga. Actualizá la página para reiniciarla." };
  }

  const messages: IncomingMessage[] = [];
  let totalChars = 0;

  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Formato de mensaje inválido." };
    }
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (typeof content !== "string" || content.trim().length === 0) {
      return { ok: false, error: "Formato de mensaje inválido." };
    }
    if (content.length > MAX_MESSAGE_CHARS) {
      return { ok: false, error: "El mensaje es demasiado largo." };
    }
    totalChars += content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return { ok: false, error: "La conversación es demasiado larga. Actualizá la página para reiniciarla." };
    }
    // Only user/assistant turns are accepted: a client-supplied "system" message
    // would let anyone rewrite the assistant's instructions.
    messages.push({ role: role === "assistant" ? "assistant" : "user", content });
  }

  return { ok: true, messages };
}

const PREVIEW_FIELDS = ["aiTone", "aiInstructions", "aiKnowledge", "aiCallToAction", "whatsappNumber"] as const;
const MAX_PREVIEW_FIELD_CHARS = 20000;

/**
 * "Probar" in /admin/ai sends the unsaved form values. Only an admin session may
 * override the prompt, and those test turns are never stored in the audit.
 */
function parsePreviewSettings(raw: unknown): Partial<Pick<ChatbotSettings, (typeof PREVIEW_FIELDS)[number]>> | null {
  if (!raw || typeof raw !== "object") return null;
  const preview: Partial<Record<(typeof PREVIEW_FIELDS)[number], string>> = {};
  for (const field of PREVIEW_FIELDS) {
    const value = (raw as Record<string, unknown>)[field];
    if (typeof value === "string") preview[field] = value.slice(0, MAX_PREVIEW_FIELD_CHARS);
  }
  return preview;
}

export const onGet: RequestHandler = async (requestEvent) => {
  try {
    const settings = await getSettings(requestEvent);
    requestEvent.json(200, {
      aiEnabled: settings.aiEnabled,
      aiAvatarUrl: settings.aiAvatarUrl,
      aiInitialGreeting: settings.aiInitialGreeting,
      whatsappNumber: settings.whatsappNumber,
    });
  } catch (err) {
    console.error("Error in chatbot GET endpoint:", err);
    requestEvent.json(500, { error: "Error al obtener la configuración." });
  }
};

export const onPost: RequestHandler = async (requestEvent) => {
  try {
    const { request, json } = requestEvent;

    // 1. Throttle before doing any work: this endpoint bills to our OpenAI key.
    const limit = rateLimitByIp(requestEvent, "chat", RATE_LIMIT, RATE_WINDOW_MS);
    if (!limit.allowed) {
      requestEvent.headers.set("Retry-After", String(limit.retryAfter));
      json(429, { error: "Estás enviando mensajes muy rápido. Esperá un momento e intentá de nuevo." });
      return;
    }

    // 2. Parse the request body and the admin-only preview settings
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      json(400, { error: "Petición inválida." });
      return;
    }
    const preview = isAdmin(requestEvent) ? parsePreviewSettings((body as { preview?: unknown }).preview) : null;

    // 3. Get Chatbot Settings (admins can test while the public assistant is off)
    const settings = { ...(await getSettings(requestEvent)), ...preview };
    if (!settings.aiEnabled && !preview) {
      json(403, {
        error: "El Chatbot se encuentra deshabilitado actualmente.",
      });
      return;
    }

    const parsed = parseMessages((body as { messages?: unknown }).messages);
    if (!parsed.ok) {
      json(400, { error: parsed.error });
      return;
    }
    const messages = parsed.messages;

    const rawSessionId = (body as { sessionId?: unknown }).sessionId;
    const sessionId =
      !preview && typeof rawSessionId === "string" && rawSessionId.length <= 64 ? rawSessionId : null;

    // 4. Save User Message to History
    if (sessionId) {
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage && lastUserMessage.role === "user") {
        try {
          await addMessageToSession(requestEvent, sessionId, "user", lastUserMessage.content);
        } catch (dbErr) {
          console.error("Error saving user message to JSON history:", dbErr);
        }
      }
    }

    // 5. Fetch Real-time Benefits from Cache for Context
    let formattedBenefitsList = "No hay beneficios disponibles actualmente.";
    try {
      const allBenefits = await getBenefits();
      if (allBenefits && allBenefits.length > 0) {
        formattedBenefitsList = allBenefits
          .map((b) => {
            const categories = b.categorias.map((c) => c.descripcion).join(", ");
            const locations = b.ubicacion.map((u) => u.descripcion).join(", ");
            return `- ${b.titulo} [Categorías: ${categories}]: ${b.resumen.trim()} (Ubicación: ${locations}) | Enlace: /beneficio/${b.url}`;
          })
          .join("\n");
      }
    } catch (cacheErr) {
      console.error("Error loading benefits cache for AI context:", cacheErr);
    }

    // 6. Build system prompt using custom settings + benefits context
    const systemPrompt = `Eres el Asistente de Inteligencia Artificial oficial de la La Plata Rugby Club (LPRC).
Tu propósito es ayudar a los socios a encontrar beneficios, descuentos y comercios adheridos de manera amigable y eficiente.

INFORMACIÓN GENERAL DE LA LPRC (CONOCIMIENTO OBLIGATORIO):
${settings.aiKnowledge || "- Identidad: Somos la La Plata Rugby Club (LPRC). Ofrecemos un club de beneficios exclusivo para nuestros socios."}

REGLAS DE COMPORTAMIENTO Y TONO:
- Tono: ${settings.aiTone || "Amigable, profesional, servicial y corporativo"}.
- Instrucciones:
${settings.aiInstructions || "1. TRATO NEUTRO Y RESPETUOSO: Dirígete cordialmente a los usuarios.\n2. CERO ALUCINACIONES: Si un usuario consulta por un descuento que no existe, dile amablemente que no está registrado."}

CATÁLOGO DE BENEFICIOS ADHERIDOS (EN TIEMPO REAL):
A continuación tienes la lista oficial y completa de comercios y sus descuentos activos. Usa esta información para responder con total precisión. Si te preguntan por descuentos en un área (ej: gimnasios, hoteles, indumentaria), busca en esta lista y menciónales las opciones disponibles con sus descuentos y cómo llegar (puedes recomendarles hacer clic en el enlace del beneficio para ver la ubicación en mapa y contactos directos).
${formattedBenefitsList}

REGLA DE ENLACES:
Cuando recomiendes un beneficio de la lista, incluye SIEMPRE su enlace en el formato markdown exacto, por ejemplo: [Ver beneficio de NombreComercio](/beneficio/url-comercio). Esto le permite al usuario hacer clic e ir directo a la ficha del comercio.

CIERRE Y LLAMADO A LA ACCIÓN (CTA):
${settings.aiCallToAction || "Si necesitás asistencia adicional o soporte sobre tu credencial digital LPRC, podés contactarnos por WhatsApp:"} ${settings.whatsappNumber || CLUB.whatsappNumber}`;

    // 7. Init OpenAI API
    const openaiApiKey = requestEvent.env.get("OPENAI_API_KEY") || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("Missing OPENAI_API_KEY env variable.");
      json(500, { error: "La API Key de OpenAI no está configurada en el servidor." });
      return;
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // 8. Execute AI Query
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 450,
        temperature: 0.4,
      });

      const replyText =
        response.choices[0]?.message?.content ||
        "Lo lamento, en este momento tuve un inconveniente para procesar tu consulta. ¿Podrías intentar de nuevo?";

      // 9. Save Assistant Reply to History
      if (sessionId) {
        try {
          await addMessageToSession(requestEvent, sessionId, "assistant", replyText);
        } catch (dbErr) {
          console.error("Error saving assistant reply to JSON history:", dbErr);
        }
      }

      json(200, { reply: { role: "assistant", content: replyText } });
    } catch (openaiErr: any) {
      console.error("OpenAI Error:", openaiErr);
      json(500, { error: "Error de comunicación con el servicio de Inteligencia Artificial." });
    }
  } catch (err: any) {
    console.error("Chatbot unexpected error:", err);
    requestEvent.json(500, { error: "Error inesperado en el servidor de chat." });
  }
};
