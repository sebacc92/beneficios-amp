import type { RequestEventBase } from "@builder.io/qwik-city";
import { asc, count, desc, eq } from "drizzle-orm";
import { getDB } from "~/db";
import { events, merchantRequests, raffles, suggestions } from "~/db/schema";
import {
  isMerchantRequestStatus,
  splitEventsByDay,
  splitRafflesByDrawDate,
  type MerchantRequestStatus,
} from "~/utils/club-content";
import { isSuggestionStatus, type SuggestionInput, type SuggestionStatus } from "~/utils/suggestions";

export type ClubEvent = typeof events.$inferSelect;
export type ClubEventInput = Omit<ClubEvent, "id" | "createdAt">;
export type RaffleInput = Omit<typeof raffles.$inferSelect, "id" | "createdAt">;
export type Raffle = typeof raffles.$inferSelect;
export type MerchantRequest = typeof merchantRequests.$inferSelect;
export type Suggestion = typeof suggestions.$inferSelect;

export async function getAgenda(event: RequestEventBase, now = new Date()) {
  const rows = await getDB(event).select().from(events).orderBy(asc(events.date));
  return splitEventsByDay(rows, now);
}

export async function getRaffleBoard(event: RequestEventBase, now = new Date()) {
  const rows = await getDB(event).select().from(raffles).orderBy(asc(raffles.drawDate));
  return splitRafflesByDrawDate(rows, now);
}

export async function countPendingMerchantRequests(event: RequestEventBase): Promise<number> {
  const [row] = await getDB(event)
    .select({ total: count() })
    .from(merchantRequests)
    .where(eq(merchantRequests.status, "pending"));
  return row?.total ?? 0;
}

/** What the admin sidebar badge shows: everything still waiting for an answer. */
export async function countPendingInbox(event: RequestEventBase): Promise<number> {
  const [merchants, members] = await Promise.all([
    countPendingMerchantRequests(event),
    countPendingSuggestions(event),
  ]);
  return merchants + members;
}

export async function countPendingSuggestions(event: RequestEventBase): Promise<number> {
  const [row] = await getDB(event)
    .select({ total: count() })
    .from(suggestions)
    .where(eq(suggestions.status, "pending"));
  return row?.total ?? 0;
}

export async function saveSuggestion(event: RequestEventBase, values: SuggestionInput): Promise<void> {
  await getDB(event).insert(suggestions).values({
    id: crypto.randomUUID(),
    nombre: values.nombre,
    email: values.email,
    telefono: values.telefono || null,
    tipo: values.tipo,
    comercio: values.comercio || null,
    mensaje: values.mensaje,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}

export async function getSuggestionInbox(event: RequestEventBase, status: SuggestionStatus | "all") {
  const db = getDB(event);
  const [rows, totals] = await Promise.all([
    status === "all"
      ? db.select().from(suggestions).orderBy(desc(suggestions.createdAt))
      : db.select().from(suggestions).where(eq(suggestions.status, status)).orderBy(desc(suggestions.createdAt)),
    db.select({ status: suggestions.status, total: count() }).from(suggestions).groupBy(suggestions.status),
  ]);
  const counts = { pending: 0, reviewed: 0, discarded: 0, all: 0 };
  for (const row of totals) {
    if (isSuggestionStatus(row.status)) counts[row.status] = row.total;
    counts.all += row.total;
  }
  return { suggestions: rows, counts };
}

export async function setSuggestionStatus(event: RequestEventBase, id: string, status: string): Promise<boolean> {
  if (!isSuggestionStatus(status)) return false;
  const updated = await getDB(event)
    .update(suggestions)
    .set({ status })
    .where(eq(suggestions.id, id))
    .returning({ id: suggestions.id });
  return updated.length > 0;
}

/** Newest first, plus the per-status totals the inbox tabs show. */
export async function getMerchantRequestInbox(event: RequestEventBase, status: MerchantRequestStatus | "all") {
  const db = getDB(event);
  const [rows, totals] = await Promise.all([
    status === "all"
      ? db.select().from(merchantRequests).orderBy(desc(merchantRequests.createdAt))
      : db.select().from(merchantRequests).where(eq(merchantRequests.status, status)).orderBy(desc(merchantRequests.createdAt)),
    db.select({ status: merchantRequests.status, total: count() }).from(merchantRequests).groupBy(merchantRequests.status),
  ]);
  const counts = { pending: 0, contacted: 0, discarded: 0, all: 0 };
  for (const row of totals) {
    if (isMerchantRequestStatus(row.status)) counts[row.status] = row.total;
    counts.all += row.total;
  }
  return { requests: rows, counts };
}

/** Returns false when the request no longer exists or the status is unknown. */
export async function setMerchantRequestStatus(event: RequestEventBase, id: string, status: string): Promise<boolean> {
  if (!isMerchantRequestStatus(status)) return false;
  const updated = await getDB(event)
    .update(merchantRequests)
    .set({ status })
    .where(eq(merchantRequests.id, id))
    .returning({ id: merchantRequests.id });
  return updated.length > 0;
}

const MAX_CLUB_IMAGE_BYTES = 5 * 1024 * 1024;

/** Message for an uploaded file the admin must replace, or null when it is fine or absent. */
export function clubImageError(file: unknown): string | null {
  if (!file || typeof file !== "object" || (file as Blob).size === 0) return null;
  const image = file as File;
  if (!image.type.startsWith("image/")) return "El archivo debe ser una imagen (JPG, PNG o WebP).";
  if (image.size > MAX_CLUB_IMAGE_BYTES) return "La imagen supera los 5 MB. Elegí una más liviana.";
  return null;
}

/** Inserts when `id` is missing; returns false when the event to update no longer exists. */
export async function saveClubEvent(event: RequestEventBase, values: ClubEventInput, id?: string): Promise<boolean> {
  const db = getDB(event);
  if (!id) {
    await db.insert(events).values({ id: crypto.randomUUID(), ...values, createdAt: new Date().toISOString() });
    return true;
  }
  const updated = await db.update(events).set(values).where(eq(events.id, id)).returning({ id: events.id });
  return updated.length > 0;
}

export async function saveRaffle(event: RequestEventBase, values: RaffleInput, id?: string): Promise<boolean> {
  const db = getDB(event);
  if (!id) {
    await db.insert(raffles).values({ id: crypto.randomUUID(), ...values, createdAt: new Date().toISOString() });
    return true;
  }
  const updated = await db.update(raffles).set(values).where(eq(raffles.id, id)).returning({ id: raffles.id });
  return updated.length > 0;
}

export async function deleteClubEvent(event: RequestEventBase, id: string): Promise<boolean> {
  const removed = await getDB(event).delete(events).where(eq(events.id, id)).returning({ id: events.id });
  return removed.length > 0;
}

export async function deleteRaffle(event: RequestEventBase, id: string): Promise<boolean> {
  const removed = await getDB(event).delete(raffles).where(eq(raffles.id, id)).returning({ id: raffles.id });
  return removed.length > 0;
}

export async function listClubEventsForAdmin(event: RequestEventBase) {
  return getDB(event).select().from(events).orderBy(desc(events.date));
}

export async function listRafflesForAdmin(event: RequestEventBase) {
  return getDB(event).select().from(raffles).orderBy(desc(raffles.drawDate));
}

export async function getClubEvent(event: RequestEventBase, id: string): Promise<ClubEvent | undefined> {
  const [row] = await getDB(event).select().from(events).where(eq(events.id, id)).limit(1);
  return row;
}

export async function getRaffle(event: RequestEventBase, id: string): Promise<Raffle | undefined> {
  const [row] = await getDB(event).select().from(raffles).where(eq(raffles.id, id)).limit(1);
  return row;
}
