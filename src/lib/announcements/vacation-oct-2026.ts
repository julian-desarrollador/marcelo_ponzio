import { formatInTimeZone } from "date-fns-tz";

import { MARCELO_AWAY_UNTIL_DATE_KEY } from "@/lib/booking/marcelo-work";

export const VACATION_ANNOUNCEMENT_STORAGE_KEY = "mp_vacation_oct_2026";

const ARGENTINA_TZ = "America/Argentina/Buenos_Aires";

export function isVacationAnnouncementInDateRange(now = new Date()): boolean {
  return formatInTimeZone(now, ARGENTINA_TZ, "yyyy-MM-dd") <= MARCELO_AWAY_UNTIL_DATE_KEY;
}

export function hasSeenVacationAnnouncement(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(VACATION_ANNOUNCEMENT_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markVacationAnnouncementSeen(): void {
  try {
    window.localStorage.setItem(VACATION_ANNOUNCEMENT_STORAGE_KEY, "1");
  } catch {
    /* quota / private mode */
  }
}

/** Cliente: todavía hay que mostrarlo (fecha vigente y no visto). */
export function isVacationAnnouncementEligible(now = new Date()): boolean {
  if (typeof window === "undefined") return false;
  if (!isVacationAnnouncementInDateRange(now)) return false;
  return !hasSeenVacationAnnouncement();
}
