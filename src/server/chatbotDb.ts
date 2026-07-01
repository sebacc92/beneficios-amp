import type { RequestEventBase } from "@builder.io/qwik-city";
import { eq, desc, asc, sql } from "drizzle-orm";
import { getDB } from "~/db";
import { siteSettings, chatSessions, chatMessages } from "~/db/schema";

export interface ChatbotSettings {
  id: number;
  aiEnabled: boolean;
  aiTone: string;
  aiInstructions: string;
  aiKnowledge: string;
  aiInitialGreeting: string;
  aiCallToAction: string;
  whatsappNumber: string;
  aiAvatarUrl: string | null;
  popupActive: boolean;
  popupTitle: string | null;
  popupDescription: string | null;
  popupImageUrl: string | null;
  popupButtonText: string | null;
  popupButtonLink: string | null;
  campaignActive: boolean;
  campaignTitle: string | null;
  campaignSubtitle: string | null;
  campaignEmoji: string | null;
  campaignTag: string | null;
  campaignQuery: string | null;
  campaignBenefitIds: string | null;
  updatedAt: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  createdAt: string;
  lastActive: string;
  messages: ChatMessage[];
}

const DEFAULT_SETTINGS: ChatbotSettings = {
  id: 1,
  aiEnabled: true,
  aiTone: "Amigable, profesional, servicial y enfocado en la comunidad médica.",
  aiInstructions:
    "1. TRATO NEUTRO Y RESPETUOSO: Dirígete cordialmente como colega o prestador (médicos agremiados).\n2. CERO ALUCINACIONES: Si un usuario consulta por un beneficio que no está en la base de datos o por información confidencial de la AMP, invítalo amablemente a comunicarse con soporte o revisar las secciones oficiales de la web.",
  aiKnowledge:
    "- Identidad: Somos el Portal de Beneficios de la Agremiación Médica Platense (AMP). Our portal offers benefits exclusively to the members of the AMP.\n- Credencial Digital: Para usar los beneficios se debe presentar la credencial digital médica a través de la app oficial de la AMP.",
  aiInitialGreeting:
    "¡Hola! Soy el asistente virtual del Club de Beneficios de la Agremiación Médica Platense. ¿En qué puedo ayudarte hoy?",
  aiCallToAction:
    "Para más consultas sobre tu credencial digital AMP+ o el estado de tu agremiación, recordá que podés escribirnos al WhatsApp oficial:",
  whatsappNumber: "542214391300",
  aiAvatarUrl: null,
  popupActive: false,
  popupTitle: null,
  popupDescription: null,
  popupImageUrl: null,
  popupButtonText: null,
  popupButtonLink: null,
  campaignActive: true,
  campaignTitle: "Cafecitos & Desayunos",
  campaignSubtitle: "Disfrutá del mejor aroma a café, desayunos premium y meriendas increíbles con tu credencial digital AMP+.",
  campaignEmoji: "☕",
  campaignTag: "SELECCIÓN GOURMET",
  campaignQuery: "cafe,café,desayuno,factura,gastronomia,gastro",
  campaignBenefitIds: null,
  updatedAt: null,
};

export async function getSettings(requestEvent: RequestEventBase): Promise<ChatbotSettings> {
  const db = getDB(requestEvent);
  
  // Try to alter table dynamically to ensure campaign columns exist in production Turso
  try {
    await db.run(sql`ALTER TABLE site_settings ADD COLUMN campaign_active INTEGER DEFAULT 1`);
  } catch (e) {}
  try {
    await db.run(sql`ALTER TABLE site_settings ADD COLUMN campaign_title TEXT DEFAULT 'Cafecitos & Desayunos'`);
  } catch (e) {}
  try {
    await db.run(sql`ALTER TABLE site_settings ADD COLUMN campaign_subtitle TEXT DEFAULT 'Disfrutá del mejor aroma a café, desayunos premium y meriendas increíbles con tu credencial digital AMP+.'`);
  } catch (e) {}
  try {
    await db.run(sql`ALTER TABLE site_settings ADD COLUMN campaign_emoji TEXT DEFAULT '☕'`);
  } catch (e) {}
  try {
    await db.run(sql`ALTER TABLE site_settings ADD COLUMN campaign_tag TEXT DEFAULT 'SELECCIÓN GOURMET'`);
  } catch (e) {}
  try {
    await db.run(sql`ALTER TABLE site_settings ADD COLUMN campaign_query TEXT DEFAULT 'cafe,café,desayuno,factura,gastronomia,gastro'`);
  } catch (e) {}
  try {
    await db.run(sql`ALTER TABLE site_settings ADD COLUMN campaign_benefit_ids TEXT`);
  } catch (e) {}

  try {
    const [settings] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
    if (!settings) {
      // If no settings exist in DB yet, create the default record
      const settingsToSave = { ...DEFAULT_SETTINGS, id: 1, updatedAt: new Date().toISOString() };
      await db.insert(siteSettings).values(settingsToSave);
      return settingsToSave;
    }
    return {
      id: settings.id,
      aiEnabled: settings.aiEnabled,
      aiTone: settings.aiTone || "",
      aiInstructions: settings.aiInstructions || "",
      aiKnowledge: settings.aiKnowledge || "",
      aiInitialGreeting: settings.aiInitialGreeting || "",
      aiCallToAction: settings.aiCallToAction || "",
      whatsappNumber: settings.whatsappNumber || "542214391300",
      aiAvatarUrl: settings.aiAvatarUrl,
      popupActive: settings.popupActive ?? false,
      popupTitle: settings.popupTitle,
      popupDescription: settings.popupDescription,
      popupImageUrl: settings.popupImageUrl,
      popupButtonText: settings.popupButtonText,
      popupButtonLink: settings.popupButtonLink,
      campaignActive: settings.campaignActive ?? true,
      campaignTitle: settings.campaignTitle || "Cafecitos & Desayunos",
      campaignSubtitle: settings.campaignSubtitle || "Disfrutá del mejor aroma a café, desayunos premium y meriendas increíbles con tu credencial digital AMP+.",
      campaignEmoji: settings.campaignEmoji || "☕",
      campaignTag: settings.campaignTag || "SELECCIÓN GOURMET",
      campaignQuery: settings.campaignQuery || "cafe,café,desayuno,factura,gastronomia,gastro",
      campaignBenefitIds: settings.campaignBenefitIds || null,
      updatedAt: settings.updatedAt,
    };
  } catch (err) {
    console.error("Drizzle: Failed to load settings, using memory fallback:", err);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(requestEvent: RequestEventBase, settings: ChatbotSettings): Promise<void> {
  const db = getDB(requestEvent);
  const settingsRow = {
    id: 1,
    aiEnabled: settings.aiEnabled,
    aiTone: settings.aiTone,
    aiInstructions: settings.aiInstructions,
    aiKnowledge: settings.aiKnowledge,
    aiInitialGreeting: settings.aiInitialGreeting,
    aiCallToAction: settings.aiCallToAction,
    whatsappNumber: settings.whatsappNumber,
    aiAvatarUrl: settings.aiAvatarUrl,
    popupActive: settings.popupActive,
    popupTitle: settings.popupTitle,
    popupDescription: settings.popupDescription,
    popupImageUrl: settings.popupImageUrl,
    popupButtonText: settings.popupButtonText,
    popupButtonLink: settings.popupButtonLink,
    campaignActive: settings.campaignActive,
    campaignTitle: settings.campaignTitle,
    campaignSubtitle: settings.campaignSubtitle,
    campaignEmoji: settings.campaignEmoji,
    campaignTag: settings.campaignTag,
    campaignQuery: settings.campaignQuery,
    campaignBenefitIds: settings.campaignBenefitIds,
    updatedAt: new Date().toISOString(),
  };

  const [existing] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  if (existing) {
    await db.update(siteSettings).set(settingsRow).where(eq(siteSettings.id, 1));
  } else {
    await db.insert(siteSettings).values(settingsRow);
  }
}

export async function getSessions(requestEvent: RequestEventBase): Promise<ChatSession[]> {
  const db = getDB(requestEvent);
  try {
    const sessions = await db.select().from(chatSessions).orderBy(desc(chatSessions.lastActive));
    const result: ChatSession[] = [];

    for (const s of sessions) {
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, s.id))
        .orderBy(asc(chatMessages.createdAt));

      result.push({
        id: s.id,
        createdAt: s.createdAt,
        lastActive: s.lastActive,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role as any,
          content: m.content,
          createdAt: m.createdAt,
        })),
      });
    }

    return result;
  } catch (err) {
    console.error("Drizzle: Failed to load sessions:", err);
    return [];
  }
}

export async function getSessionById(requestEvent: RequestEventBase, id: string): Promise<ChatSession | null> {
  const db = getDB(requestEvent);
  try {
    const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, id)).limit(1);
    if (!session) return null;

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, id))
      .orderBy(asc(chatMessages.createdAt));

    return {
      id: session.id,
      createdAt: session.createdAt,
      lastActive: session.lastActive,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role as any,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  } catch (err) {
    console.error(`Drizzle: Failed to find session ${id}:`, err);
    return null;
  }
}

export async function addSessionOrUpdateActive(requestEvent: RequestEventBase, id: string): Promise<ChatSession> {
  const db = getDB(requestEvent);
  const now = new Date().toISOString();

  const [existing] = await db.select().from(chatSessions).where(eq(chatSessions.id, id)).limit(1);
  if (!existing) {
    await db.insert(chatSessions).values({
      id,
      createdAt: now,
      lastActive: now,
    });
  } else {
    await db.update(chatSessions).set({ lastActive: now }).where(eq(chatSessions.id, id));
  }

  return (await getSessionById(requestEvent, id))!;
}

export async function addMessageToSession(
  requestEvent: RequestEventBase,
  sessionId: string,
  role: "user" | "assistant" | "system",
  content: string
): Promise<ChatMessage> {
  const db = getDB(requestEvent);
  const now = new Date().toISOString();

  // Ensure session exists
  await addSessionOrUpdateActive(requestEvent, sessionId);

  const messageId = "msg-" + Date.now().toString() + Math.floor(Math.random() * 1000).toString();
  const message = {
    id: messageId,
    sessionId,
    role,
    content,
    createdAt: now,
  };

  await db.insert(chatMessages).values(message);
  return {
    id: message.id,
    role,
    content,
    createdAt: now,
  };
}

export async function deleteSession(requestEvent: RequestEventBase, id: string): Promise<boolean> {
  const db = getDB(requestEvent);
  try {
    // Delete related messages first due to foreign key references
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, id));
    await db.delete(chatSessions).where(eq(chatSessions.id, id));
    return true;
  } catch (err) {
    console.error(`Drizzle: Failed to delete session ${id}:`, err);
    return false;
  }
}
