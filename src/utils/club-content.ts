/**
 * Dates for the Agenda, Sorteos and Solicitudes pages. Workers run in UTC, so every
 * calendar decision and every label is computed in Buenos Aires time explicitly.
 */
export const CLUB_TIME_ZONE = "America/Argentina/Buenos_Aires";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLUB_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const localFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLUB_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `YYYY-MM-DD` of an instant in Buenos Aires. */
export function buenosAiresDay(instant: Date | string = new Date()): string {
  return dayFormatter.format(typeof instant === "string" ? new Date(instant) : instant);
}

/** A raffle is current until its draw day in Buenos Aires is over. */
export function isRaffleActive(drawDate: string, now: Date = new Date()): boolean {
  return drawDate >= buenosAiresDay(now);
}

/** Converts a `datetime-local` value typed in Buenos Aires (UTC-3, no DST since 2009). */
export function buenosAiresLocalToIso(local: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(local.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2]}:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The `datetime-local` value that shows an instant in Buenos Aires. */
export function isoToBuenosAiresLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(localFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Events stay "upcoming" for their whole day; the next ones come first, the latest past ones first. */
export function splitEventsByDay<T extends { date: string }>(events: T[], now: Date = new Date()) {
  const today = buenosAiresDay(now);
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const event of events) {
    if (Number.isNaN(Date.parse(event.date))) continue;
    (buenosAiresDay(event.date) >= today ? upcoming : past).push(event);
  }
  upcoming.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  past.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return { upcoming, past };
}

export function splitRafflesByDrawDate<T extends { drawDate: string }>(raffles: T[], now: Date = new Date()) {
  const active = raffles.filter((raffle) => isRaffleActive(raffle.drawDate, now));
  const past = raffles.filter((raffle) => !isRaffleActive(raffle.drawDate, now));
  active.sort((a, b) => a.drawDate.localeCompare(b.drawDate));
  past.sort((a, b) => b.drawDate.localeCompare(a.drawDate));
  return { active, past };
}

export function formatEventParts(iso: string) {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString("es-AR", { timeZone: CLUB_TIME_ZONE, day: "2-digit" }),
    month: date.toLocaleDateString("es-AR", { timeZone: CLUB_TIME_ZONE, month: "short" }).replace(".", "").toUpperCase(),
    weekday: date.toLocaleDateString("es-AR", { timeZone: CLUB_TIME_ZONE, weekday: "long" }),
    time: date.toLocaleTimeString("es-AR", { timeZone: CLUB_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  };
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-AR", {
    timeZone: CLUB_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** `YYYY-MM-DD` → `DD/MM/YYYY`, without going through Date (it is already a calendar day). */
export function formatCalendarDay(day: string): string {
  const [year, month, date] = day.split("-");
  return year && month && date ? `${date}/${month}/${year}` : day;
}

export const MERCHANT_REQUEST_STATUSES = ["pending", "contacted", "discarded"] as const;
export type MerchantRequestStatus = (typeof MERCHANT_REQUEST_STATUSES)[number];

export const merchantRequestStatusLabels: Record<MerchantRequestStatus, string> = {
  pending: "Pendiente",
  contacted: "Contactado",
  discarded: "Descartado",
};

export function isMerchantRequestStatus(value: unknown): value is MerchantRequestStatus {
  return MERCHANT_REQUEST_STATUSES.includes(value as MerchantRequestStatus);
}
