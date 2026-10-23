export type PopupAudience = "all" | "members" | "guests";

export const POPUP_AUDIENCES: { value: PopupAudience; label: string }[] = [
  { value: "all", label: "Todos los visitantes" },
  { value: "members", label: "Solo socios con sesión iniciada" },
  { value: "guests", label: "Solo visitantes sin sesión" },
];

interface PopupSchedule {
  popupActive: boolean;
  popupStartsAt?: string | null;
  popupEndsAt?: string | null;
  popupAudience?: PopupAudience | null;
}

/** Active, inside its optional date window and meant for this visitor. */
export function shouldShowPopup(settings: PopupSchedule, { loggedIn, now = new Date() }: { loggedIn: boolean; now?: Date }): boolean {
  if (!settings.popupActive) return false;
  const time = now.getTime();
  const starts = settings.popupStartsAt ? Date.parse(settings.popupStartsAt) : NaN;
  const ends = settings.popupEndsAt ? Date.parse(settings.popupEndsAt) : NaN;
  if (!Number.isNaN(starts) && time < starts) return false;
  if (!Number.isNaN(ends) && time > ends) return false;
  const audience = settings.popupAudience ?? "all";
  if (audience === "members") return loggedIn;
  if (audience === "guests") return !loggedIn;
  return true;
}
