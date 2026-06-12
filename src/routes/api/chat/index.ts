import { type RequestHandler } from "@builder.io/qwik-city";
import OpenAI from "openai";
import { getSettings, addMessageToSession } from "~/server/chatbotDb";
import { getBenefits } from "~/server/cache";

// ---- Configurable safety limits ----
const MAX_BODY_BYTES = 8 * 1024; // 8 KB request body cap
const MAX_MESSAGES_PER_REQUEST = 12; // Outgoing conversation turns sent to OpenAI
const MAX_MESSAGE_CHARS = 1200; // Per-message length cap
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 15; // Per IP per window
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{6,64}$/;

// ---- In-memory rate limiter (per isolate) ----
// Adequate for low-medium traffic on Vercel Edge. For multi-isolate consistency
// a shared store (Upstash, etc.) would be needed; documented in the README.
interface RateBucket {
  count: number;
  resetAt: number;
}
const rateState = globalThis as unknown as { __ampChatRate?: Map<string, RateBucket> };
if (!rateState.__ampChatRate) rateState.__ampChatRate = new Map();
const rateMap = rateState.__ampChatRate;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(ip: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = rateMap.get(ip);
  if (!bucket || bucket.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}

// Opportunistically prune stale buckets so the map can't grow unbounded.
function pruneRateMap() {
  if (rateMap.size < 500) return;
  const now = Date.now();
  for (const [k, v] of rateMap) {
    if (v.resetAt < now) rateMap.delete(k);
  }
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
  const { request, json } = requestEvent;

  // 1. Rate limiting
  pruneRateMap();
  const ip = clientIp(request);
  const rate = checkRateLimit(ip);
  if (!rate.ok) {
    requestEvent.headers.set("Retry-After", String(rate.retryAfter));
    json(429, { error: "Demasiadas consultas. Esperá unos segundos e intentá de nuevo." });
    return;
  }

  try {
    // 2. Bound the request body to prevent OpenAI bill abuse
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      json(413, { error: "Mensaje demasiado grande." });
      return;
    }

    const settings = await getSettings(requestEvent);
    if (!settings.aiEnabled) {
      json(403, { error: "El Chatbot se encuentra deshabilitado actualmente." });
      return;
    }

    // 3. Parse + validate body
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      json(413, { error: "Mensaje demasiado grande." });
      return;
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      json(400, { error: "Cuerpo de la petición inválido." });
      return;
    }

    const payload = body as { messages?: unknown; sessionId?: unknown };
    if (!payload || !Array.isArray(payload.messages) || payload.messages.length === 0) {
      json(400, { error: "Faltan mensajes en la petición." });
      return;
    }

    // Truncate + sanitize messages
    const safeMessages = payload.messages
      .slice(-MAX_MESSAGES_PER_REQUEST)
      .map((m) => m as { role?: unknown; content?: unknown })
      .filter((m) => typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: String(m.content).slice(0, MAX_MESSAGE_CHARS),
      }));

    if (safeMessages.length === 0) {
      json(400, { error: "Los mensajes recibidos no son válidos." });
      return;
    }

    const sessionId =
      typeof payload.sessionId === "string" && SESSION_ID_PATTERN.test(payload.sessionId)
        ? payload.sessionId
        : null;

    // 4. Persist user message
    if (sessionId) {
      const last = safeMessages[safeMessages.length - 1];
      if (last.role === "user") {
        try {
          await addMessageToSession(requestEvent, sessionId, "user", last.content);
        } catch (dbErr) {
          console.error("Error saving user message:", dbErr);
        }
      }
    }

    // 5. Build benefits context for the system prompt
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

    const systemPrompt = `Eres el Asistente de Inteligencia Artificial oficial de la Agremiación Médica Platense (AMP).
Tu propósito es ayudar a los médicos agremiados a encontrar beneficios, descuentos y comercios adheridos de manera amigable y eficiente.

INFORMACIÓN GENERAL DE LA AMP (CONOCIMIENTO OBLIGATORIO):
${settings.aiKnowledge || "- Identidad: Somos la Agremiación Médica Platense (AMP). Ofrecemos un club de beneficios exclusivo para nuestros médicos asociados."}

REGLAS DE COMPORTAMIENTO Y TONO:
- Tono: ${settings.aiTone || "Amigable, profesional, servicial y corporativo"}.
- Instrucciones:
${settings.aiInstructions || "1. TRATO NEUTRO Y RESPETUOSO: Dirígete cordialmente a los usuarios.\n2. CERO ALUCINACIONES: Si un usuario consulta por un descuento que no existe, dile amablemente que no está registrado."}

CATÁLOGO DE BENEFICIOS ADHERIDOS:
${formattedBenefitsList}

REGLA DE ENLACES:
Cuando recomiendes un beneficio de la lista, incluye SIEMPRE su enlace en el formato markdown exacto, por ejemplo: [Ver beneficio de NombreComercio](/beneficio/url-comercio).

CIERRE Y LLAMADO A LA ACCIÓN (CTA):
${settings.aiCallToAction || "Si necesitás asistencia adicional sobre tu credencial médica digital AMP+, podés contactarnos por WhatsApp:"} ${settings.whatsappNumber || "542214391300"}`;

    // 6. Call OpenAI
    const openaiApiKey = requestEvent.env.get("OPENAI_API_KEY") || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("Missing OPENAI_API_KEY env variable.");
      json(500, { error: "La API Key de OpenAI no está configurada en el servidor." });
      return;
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...safeMessages],
        max_tokens: 450,
        temperature: 0.4,
      });

      const replyText =
        response.choices[0]?.message?.content ||
        "Lo lamento, en este momento tuve un inconveniente para procesar tu consulta. ¿Podrías intentar de nuevo?";

      if (sessionId) {
        try {
          await addMessageToSession(requestEvent, sessionId, "assistant", replyText);
        } catch (dbErr) {
          console.error("Error saving assistant reply:", dbErr);
        }
      }

      json(200, { reply: { role: "assistant", content: replyText } });
    } catch (openaiErr: any) {
      console.error("OpenAI Error:", openaiErr);
      json(502, { error: "Error de comunicación con el servicio de Inteligencia Artificial." });
    }
  } catch (err: any) {
    console.error("Chatbot unexpected error:", err);
    requestEvent.json(500, { error: "Error inesperado en el servidor de chat." });
  }
};
