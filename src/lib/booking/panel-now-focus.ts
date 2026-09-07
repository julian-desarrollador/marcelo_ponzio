import { formatInTimeZone } from "date-fns-tz";

import { RESERVATION_TZ, argentinaTodayDateKey } from "@/lib/booking/public-slot-lead";
import { findCatalogTreatmentById } from "@/lib/treatments/catalog";

export function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Minutos desde medianoche en Argentina para el instante `now`. */
export function argentinaNowMinutes(now = new Date()): number {
  const hhmm = formatInTimeZone(now, RESERVATION_TZ, "HH:mm");
  return hhmmToMinutes(hhmm) ?? 0;
}

/**
 * Franja actual (redondeada al bloque de 30 min) y la anterior.
 * Ej. 13:15 → 13:00 y 12:30.
 */
export function getPanelFocusSlotMinutes(now = new Date()): [number, number] {
  const nowM = argentinaNowMinutes(now);
  const h = Math.floor(nowM / 60);
  const m = nowM % 60;
  const slotStart = m < 30 ? 0 : 30;
  const current = h * 60 + slotStart;
  const previous = current - 30;
  return [current, previous];
}

export function isReservationTimeFocused(
  timeLocal: string,
  selectedDateKey: string,
  now = new Date(),
): boolean {
  if (selectedDateKey !== argentinaTodayDateKey(now)) return false;
  const startM = hhmmToMinutes(timeLocal);
  if (startM === null) return false;
  const [current, previous] = getPanelFocusSlotMinutes(now);
  return startM === current || (previous >= 0 && startM === previous);
}

/** Turno “en curso” si hoy, enfocado y ya pasó la hora de inicio (hasta fin estimado). */
export function isReservationInProgress(
  timeLocal: string,
  treatmentId: string,
  selectedDateKey: string,
  now = new Date(),
): boolean {
  if (!isReservationTimeFocused(timeLocal, selectedDateKey, now)) return false;
  const startM = hhmmToMinutes(timeLocal);
  if (startM === null) return false;
  const nowM = argentinaNowMinutes(now);
  if (nowM < startM) return false;
  const t = findCatalogTreatmentById(treatmentId);
  const duration = t?.durationMinutes ?? 60;
  return nowM < startM + duration;
}

/** Id del turno al que conviene hacer scroll (franja actual, no la de 30 min antes). */
export function pickScrollToReservationId(
  reservations: Array<{ id: string; dateKey: string; timeLocal: string }>,
  selectedDateKey: string,
  now = new Date(),
): string | null {
  if (selectedDateKey !== argentinaTodayDateKey(now)) return null;
  const [current] = getPanelFocusSlotMinutes(now);
  const match = reservations.find((r) => {
    if (r.dateKey !== selectedDateKey) return false;
    return hhmmToMinutes(r.timeLocal) === current;
  });
  if (match) return match.id;
  const [, previous] = getPanelFocusSlotMinutes(now);
  if (previous < 0) return null;
  const prev = reservations.find((r) => r.dateKey === selectedDateKey && hhmmToMinutes(r.timeLocal) === previous);
  return prev?.id ?? null;
}
