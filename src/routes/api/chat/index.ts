import { type RequestHandler } from "@builder.io/qwik-city";
import OpenAI from "openai";
import { getSettings, addMessageToSession } from "~/server/chatbotDb";
import { getBenefits } from "~/server/cache";

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

    // 1. Get Chatbot Settings
    const settings = await getSettings(requestEvent);
    if (!settings.aiEnabled) {
      json(403, {
        error: "El Chatbot se encuentra deshabilitado actualmente.",
      });
      return;
    }

    // 2. Parse Request Body
    const body = await request.json();
    if (!body || !body.messages) {
      json(400, { error: "Faltan mensajes en la petición." });
      return;
    }

    const { messages, sessionId } = body;

    // 3. Save User Message to History
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

    // 4. Fetch Real-time Benefits from Cache for Context
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

    // 5. Build system prompt using custom settings + benefits context
    const systemPrompt = `Eres el Asistente de Inteligencia Artificial oficial de la Agremiación Médica Platense (AMP).
Tu propósito es ayudar a los médicos agremiados a encontrar beneficios, descuentos y comercios adheridos de manera amigable y eficiente.

INFORMACIÓN GENERAL DE LA AMP (CONOCIMIENTO OBLIGATORIO):
${settings.aiKnowledge || "- Identidad: Somos la Agremiación Médica Platense (AMP). Ofrecemos un club de beneficios exclusivo para nuestros médicos asociados."}

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
${settings.aiCallToAction || "Si necesitás asistencia adicional o soporte sobre tu credencial médica digital AMP+, podés contactarnos por WhatsApp:"} ${settings.whatsappNumber || "542214391300"}`;

    // 6. Init OpenAI API
    const openaiApiKey = requestEvent.env.get("OPENAI_API_KEY") || process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error("Missing OPENAI_API_KEY env variable.");
      json(500, { error: "La API Key de OpenAI no está configurada en el servidor." });
      return;
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // 7. Execute AI Query
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((msg: any) => ({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
          })),
        ],
        max_tokens: 450,
        temperature: 0.4,
      });

      const replyText =
        response.choices[0]?.message?.content ||
        "Lo lamento, en este momento tuve un inconveniente para procesar tu consulta. ¿Podrías intentar de nuevo?";

      // 8. Save Assistant Reply to History
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
