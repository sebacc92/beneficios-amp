import type { RequestEventBase } from "@builder.io/qwik-city";
import { eq, desc, asc, inArray } from "drizzle-orm";
import { getDB } from "~/db";
import { siteSettings, chatSessions, chatMessages } from "~/db/schema";
import { CLUB } from "~/utils/club";

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
  popupStartsAt: string | null;
  popupEndsAt: string | null;
  popupAudience: "all" | "members" | "guests";
  campaignActive: boolean;
  campaignTitle: string | null;
  campaignSubtitle: string | null;
  campaignEmoji: string | null;
  campaignTag: string | null;
  campaignQuery: string | null;
  /** Benefit slugs chosen by hand for the home campaign, in display order. */
  campaignBenefitSlugs: string[];
  updatedAt: string | null;
}

function parseSlugList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((slug): slug is string => typeof slug === "string" && slug.length > 0) : [];
  } catch {
    return [];
  }
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
  /** When an admin marked the conversation as reviewed in the audit. */
  reviewedAt?: string | null;
  messages: ChatMessage[];
}

const DEFAULT_SETTINGS: ChatbotSettings = {
  id: 1,
  aiEnabled: true,
  aiTone: "Amigable, profesional, servicial y enfocado en la comunidad rugbier.",
  aiInstructions:
    "1. TRATO NEUTRO Y RESPETUOSO: Dirígete cordialmente como socio.\n2. CERO ALUCINACIONES: Si un usuario consulta por un beneficio que no está en la base de datos o por información confidencial de la LPRC, invítalo amablemente a comunicarse con soporte o revisar las secciones oficiales de la web.",
  aiKnowledge:
    "- Identidad: Somos el Portal de Beneficios de La Plata Rugby Club (LPRC), el primer club de rugby de la ciudad (desde 1934). Los beneficios son para socios del club.\n- Cómo se usa un beneficio: el socio abre la ficha del beneficio, ingresa con su DNI, genera un cupón con código y QR y lo muestra en el comercio antes de pagar. Los cupones quedan en Mi perfil > Mis cupones. Guía completa en /como-funciona/.\n- Hacerse socio: por WhatsApp al club.",
  aiInitialGreeting:
    "¡Hola! Soy el asistente virtual del Club de Beneficios de la La Plata Rugby Club. ¿En qué puedo ayudarte hoy?",
  aiCallToAction:
    "Para más consultas sobre tu credencial digital LPRC o el estado de tu membresía del club, recordá que podés escribirnos al WhatsApp oficial:",
  whatsappNumber: CLUB.whatsappNumber,
  aiAvatarUrl: null,
  popupActive: false,
  popupTitle: null,
  popupDescription: null,
  popupImageUrl: null,
  popupButtonText: null,
  popupButtonLink: null,
  popupStartsAt: null,
  popupEndsAt: null,
  popupAudience: "all",
  campaignActive: true,
  // Empty campaign fields stay null; the home and the admin preview fall back to CAMPAIGN_DEFAULTS.
  campaignTitle: null,
  campaignSubtitle: null,
  campaignEmoji: null,
  campaignTag: null,
  campaignQuery: null,
  campaignBenefitSlugs: [],
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
      await db.insert(siteSettings).values({ ...settingsToSave, campaignBenefitSlugs: null });
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
      whatsappNumber: settings.whatsappNumber || CLUB.whatsappNumber,
      aiAvatarUrl: settings.aiAvatarUrl,
      popupActive: settings.popupActive ?? false,
      popupTitle: settings.popupTitle,
      popupDescription: settings.popupDescription,
      popupImageUrl: settings.popupImageUrl,
      popupButtonText: settings.popupButtonText,
      popupButtonLink: settings.popupButtonLink,
      popupStartsAt: settings.popupStartsAt || null,
      popupEndsAt: settings.popupEndsAt || null,
      popupAudience: settings.popupAudience === "members" || settings.popupAudience === "guests" ? settings.popupAudience : "all",
      campaignActive: settings.campaignActive ?? true,
      campaignTitle: settings.campaignTitle || null,
      campaignSubtitle: settings.campaignSubtitle || null,
      campaignEmoji: settings.campaignEmoji || null,
      campaignTag: settings.campaignTag || null,
      campaignQuery: settings.campaignQuery || null,
      campaignBenefitSlugs: parseSlugList(settings.campaignBenefitSlugs),
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
    popupStartsAt: settings.popupStartsAt,
    popupEndsAt: settings.popupEndsAt,
    popupAudience: settings.popupAudience,
    campaignActive: settings.campaignActive,
    campaignTitle: settings.campaignTitle,
    campaignSubtitle: settings.campaignSubtitle,
    campaignEmoji: settings.campaignEmoji,
    campaignTag: settings.campaignTag,
    campaignQuery: settings.campaignQuery,
    campaignBenefitSlugs: settings.campaignBenefitSlugs.length ? JSON.stringify(settings.campaignBenefitSlugs) : null,
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
      reviewedAt: s.reviewedAt,
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
      reviewedAt: session.reviewedAt,
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

/** Marks (or unmarks) a conversation as reviewed; false when it no longer exists. */
export async function setSessionReviewed(requestEvent: RequestEventBase, id: string, reviewed: boolean): Promise<boolean> {
  const updated = await getDB(requestEvent)
    .update(chatSessions)
    .set({ reviewedAt: reviewed ? new Date().toISOString() : null })
    .where(eq(chatSessions.id, id))
    .returning({ id: chatSessions.id });
  return updated.length > 0;
}

/** Neighbours in the audit list order (latest activity first), for "anterior / siguiente". */
export async function getSessionNeighbors(requestEvent: RequestEventBase, id: string) {
  const rows = await getDB(requestEvent)
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .orderBy(desc(chatSessions.lastActive), desc(chatSessions.id));
  const index = rows.findIndex((row) => row.id === id);
  return {
    newerId: index > 0 ? rows[index - 1].id : null,
    olderId: index >= 0 && index < rows.length - 1 ? rows[index + 1].id : null,
    position: index + 1,
    total: rows.length,
  };
}

/** The first thing the person asked: how the audit names a conversation instead of its id. */
export function firstUserMessage(messages: ChatMessage[]): string | null {
  return messages.find((message) => message.role === "user")?.content.trim() || null;
}

/**
 * Whether the assistant sent the person to WhatsApp: a wa.me / api.whatsapp link
 * or one of the given numbers (spaces and dashes ignored) in any reply.
 */
export function referredToWhatsapp(messages: ChatMessage[], numbers: string[]): boolean {
  const tails = numbers.map((number) => number.replace(/\D/g, "").slice(-10)).filter((tail) => tail.length >= 8);
  return messages.some((message) => {
    if (message.role !== "assistant") return false;
    if (/wa\.me\/|api\.whatsapp\.com|whatsapp\.com\/send/i.test(message.content)) return true;
    const digits = message.content.replace(/[\s().-]/g, "");
    return tails.some((tail) => digits.includes(tail));
  });
}

/** Appends a reviewed answer to the assistant's knowledge base ("Copiar a la base de conocimientos"). */
export async function appendToKnowledge(requestEvent: RequestEventBase, entry: string): Promise<void> {
  const settings = await getSettings(requestEvent);
  const current = settings.aiKnowledge.trim();
  const addition = entry.replace(/\r\n?/g, "\n").trim();
  await saveSettings(requestEvent, { ...settings, aiKnowledge: current ? `${current}\n${addition}` : addition });
}
