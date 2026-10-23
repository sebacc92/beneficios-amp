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

/** What `events.kind` can hold; anything else (or empty) shows no badge. */
export const EVENT_KINDS = ["torneo", "clinica", "social", "partido", "otro"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const eventKindLabels: Record<EventKind, string> = {
  torneo: "Torneo",
  clinica: "Clínica",
  social: "Social",
  partido: "Partido",
  otro: "Actividad",
};

export function eventKindLabel(kind: string | null | undefined): string | null {
  return EVENT_KINDS.includes(kind as EventKind) ? eventKindLabels[kind as EventKind] : null;
}

/** `DD/MM/YYYY` of an instant in Buenos Aires, as lprc.com.ar prints event dates. */
export function formatEventDate(iso: string): string {
  return formatCalendarDay(buenosAiresDay(iso));
}

/** Whole days from today in Buenos Aires to a `YYYY-MM-DD` day: 0 is today, negative is past. */
export function daysUntilCalendarDay(day: string, now: Date = new Date()): number {
  const target = Date.parse(`${day}T00:00:00Z`);
  const today = Date.parse(`${buenosAiresDay(now)}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}

export function drawCountdownLabel(daysLeft: number): string {
  if (daysLeft <= 0) return "Se sortea hoy";
  if (daysLeft === 1) return "Se sortea mañana";
  return `Se sortea en ${daysLeft} días`;
}

export interface CalendarEventInput {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
}

// Events only store when they start, so calendars get a two-hour slot.
const EVENT_CALENDAR_DURATION_MS = 2 * 60 * 60 * 1000;

function calendarSpan(iso: string): [string, string] | null {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [stamp(start), stamp(new Date(start.getTime() + EVENT_CALENDAR_DURATION_MS))];
}

/** "Agregar a Google Calendar" link (the public event template URL, no API key involved). */
export function googleCalendarUrl(event: CalendarEventInput): string | null {
  const span = calendarSpan(event.date);
  if (!span) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${span[0]}/${span[1]}`,
    details: event.description,
    location: event.location,
    ctz: CLUB_TIME_ZONE,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[;,]/g, (char) => `\\${char}`);
}

const utf8 = new TextEncoder();

// RFC 5545 caps lines at 75 octets (continuations start with a space), never splitting a character.
function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = utf8.encode(char).length;
    const limit = parts.length ? 74 : 75;
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** A one-event iCalendar file (Apple Calendar, Outlook and others). */
export function eventIcs(event: CalendarEventInput, now: Date = new Date()): string | null {
  const span = calendarSpan(event.date);
  if (!span) return null;
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Plata Rugby Club//Club de Beneficios//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@beneficios.lprc`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${span[0]}`,
    `DTEND:${span[1]}`,
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(event.description)}`,
    `LOCATION:${icsText(event.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** `data:` link for the .ics, so the download works without JavaScript or a server round trip. */
export function eventIcsDataUri(event: CalendarEventInput, now: Date = new Date()): string | null {
  const ics = eventIcs(event, now);
  return ics ? `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}` : null;
}

// Places that only make sense at the club's own grounds.
const CLUB_VENUE = /\b(lprc|la plata rugby|sede|quincho|gonnet|del club|en el club|cancha \d+)\b/i;

/** Maps link for an event location: the club's pin for its own grounds, a search otherwise. */
export function eventMapsUrl(location: string, clubMapsUrl: string): string {
  const place = location.trim();
  if (!place || CLUB_VENUE.test(place)) return clubMapsUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place}, La Plata`)}`;
}
