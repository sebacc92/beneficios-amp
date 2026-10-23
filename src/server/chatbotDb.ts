import type { RequestEventBase } from "@builder.io/qwik-city";
import { eq, desc, asc, inArray } from "drizzle-orm";
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
  aiTone: "Amigable, profesional, servicial y enfocado en la comunidad rugbier.",
  aiInstructions:
    "1. TRATO NEUTRO Y RESPETUOSO: Dirígete cordialmente como socio.\n2. CERO ALUCINACIONES: Si un usuario consulta por un beneficio que no está en la base de datos o por información confidencial de la LPRC, invítalo amablemente a comunicarse con soporte o revisar las secciones oficiales de la web.",
  aiKnowledge:
    "- Identidad: Somos el Portal de Beneficios de la La Plata Rugby Club (LPRC). Our portal offers benefits exclusively to the members of the LPRC.\n- Credencial Digital: Para usar los beneficios se debe presentar la credencial digital a través de la app oficial de la LPRC.",
  aiInitialGreeting:
    "¡Hola! Soy el asistente virtual del Club de Beneficios de la La Plata Rugby Club. ¿En qué puedo ayudarte hoy?",
  aiCallToAction:
    "Para más consultas sobre tu credencial digital LPRC o el estado de tu membresía del club, recordá que podés escribirnos al WhatsApp oficial:",
  whatsappNumber: "5492214895777",
  aiAvatarUrl: null,
  popupActive: false,
  popupTitle: null,
  popupDescription: null,
  popupImageUrl: null,
  popupButtonText: null,
  popupButtonLink: null,
  campaignActive: true,
  // Empty campaign fields stay null; the home and the admin preview fall back to CAMPAIGN_DEFAULTS.
  campaignTitle: null,
  campaignSubtitle: null,
  campaignEmoji: null,
  campaignTag: null,
  campaignQuery: null,
  updatedAt: null,
};

const SETTINGS_KEY = "__site_settings";

/**
 * Site settings, memoized per request.
 *
 * The schema migration (six ALTER TABLE statements for the campaign columns) used
 * to run here on every single call — i.e. on every homepage render and on every
 * chatbot bootstrap. It now lives in scripts/migrate.mjs; run `pnpm migrate` once
 * per environment.
 */
export async function getSettings(requestEvent: RequestEventBase): Promise<ChatbotSettings> {
  const memoized = requestEvent.sharedMap.get(SETTINGS_KEY) as ChatbotSettings | undefined;
  if (memoized) return memoized;

  const db = getDB(requestEvent);

  try {
    const [settings] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
    if (!settings) {
      // If no settings exist in DB yet, create the default record
      const settingsToSave = { ...DEFAULT_SETTINGS, id: 1, updatedAt: new Date().toISOString() };
      await db.insert(siteSettings).values(settingsToSave);
      requestEvent.sharedMap.set(SETTINGS_KEY, settingsToSave);
      return settingsToSave;
    }
    const resolved: ChatbotSettings = {
      id: settings.id,
      aiEnabled: settings.aiEnabled,
      aiTone: settings.aiTone || "",
      aiInstructions: settings.aiInstructions || "",
      aiKnowledge: settings.aiKnowledge || "",
      aiInitialGreeting: settings.aiInitialGreeting || "",
      aiCallToAction: settings.aiCallToAction || "",
      whatsappNumber: settings.whatsappNumber || "5492214895777",
      aiAvatarUrl: settings.aiAvatarUrl,
      popupActive: settings.popupActive ?? false,
      popupTitle: settings.popupTitle,
      popupDescription: settings.popupDescription,
      popupImageUrl: settings.popupImageUrl,
      popupButtonText: settings.popupButtonText,
      popupButtonLink: settings.popupButtonLink,
      campaignActive: settings.campaignActive ?? true,
      campaignTitle: settings.campaignTitle || null,
      campaignSubtitle: settings.campaignSubtitle || null,
      campaignEmoji: settings.campaignEmoji || null,
      campaignTag: settings.campaignTag || null,
      campaignQuery: settings.campaignQuery || null,
      updatedAt: settings.updatedAt,
    };
    requestEvent.sharedMap.set(SETTINGS_KEY, resolved);
    return resolved;
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
    updatedAt: new Date().toISOString(),
  };

  const [existing] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
  if (existing) {
    await db.update(siteSettings).set(settingsRow).where(eq(siteSettings.id, 1));
  } else {
    await db.insert(siteSettings).values(settingsRow);
  }

  // Drop the per-request memo so a read after this write sees the new values.
  requestEvent.sharedMap.delete(SETTINGS_KEY);
}

export async function getSessions(requestEvent: RequestEventBase): Promise<ChatSession[]> {
  const db = getDB(requestEvent);
  try {
    const sessions = await db.select().from(chatSessions).orderBy(desc(chatSessions.lastActive));
    if (sessions.length === 0) return [];

    // Two queries total instead of one per session (the old loop was an N+1 that
    // made /admin/ai and /admin/stats scale linearly with conversation count).
    const messages = await db
      .select()
      .from(chatMessages)
      .where(inArray(chatMessages.sessionId, sessions.map((s) => s.id)))
      .orderBy(asc(chatMessages.createdAt));

    const messagesBySession = new Map<string, ChatMessage[]>();
    for (const m of messages) {
      const bucket = messagesBySession.get(m.sessionId);
      const message: ChatMessage = {
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      };
      if (bucket) bucket.push(message);
      else messagesBySession.set(m.sessionId, [message]);
    }

    return sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      lastActive: s.lastActive,
      messages: messagesBySession.get(s.id) ?? [],
    }));
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
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  } catch (err) {
    console.error(`Drizzle: Failed to find session ${id}:`, err);
    return null;
  }
}

/**
 * Creates the session row if missing, otherwise bumps `lastActive`.
 *
 * Single upsert: the previous version did a SELECT, then an INSERT/UPDATE, then
 * re-read the whole session with all its messages just to throw the result away.
 */
export async function addSessionOrUpdateActive(requestEvent: RequestEventBase, id: string): Promise<void> {
  const db = getDB(requestEvent);
  const now = new Date().toISOString();

  await db
    .insert(chatSessions)
    .values({ id, createdAt: now, lastActive: now })
    .onConflictDoUpdate({ target: chatSessions.id, set: { lastActive: now } });
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
