import type { Db, ObjectId } from "mongodb";
import { formatInTimeZone } from "date-fns-tz";

import { RESERVATION_TZ } from "@/lib/booking/public-slot-lead";
import { findCatalogTreatmentById } from "@/lib/treatments/catalog";

const COLLECTION = "reservations";
const ACTIVE_STATUSES = ["confirmed"] as const;

/** Inicio/fin (minutos desde medianoche ART) con hasta 3 turnos simultáneos. Inclusive 11:30. */
const DOUBLE_CAPACITY_START_MIN = 9 * 60;
const DOUBLE_CAPACITY_END_MIN = 11 * 60 + 30;

export type IntervalMs = { startMs: number; endMs: number };

export function intervalsOverlap(a: IntervalMs, b: IntervalMs): boolean {
  return a.startMs < b.endMs && a.endMs > b.startMs;
}

/** Inicio/fin del turno en epoch ms (misma convención que `computeStartsAtUtc`, ART -03:00). */
export function slotIntervalMs(
  dateKey: string,
  timeLocal: string,
  durationMinutes: number,
): IntervalMs | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^\d{2}:\d{2}$/.test(timeLocal)) {
    return null;
  }
  const d = new Date(`${dateKey}T${timeLocal}:00-03:00`);
  if (Number.isNaN(d.getTime())) return null;
  const startMs = d.getTime();
  const endMs = startMs + durationMinutes * 60_000;
  return { startMs, endMs };
}

/** Capacidad del salón en ese instante: 3 entre 9:00 y 11:30 (ART, mismo dateKey), 2 fuera. */
export function salonConcurrentCapAtInstant(dateKey: string, instantMs: number): number {
  const dayKey = formatInTimeZone(new Date(instantMs), RESERVATION_TZ, "yyyy-MM-dd");
  if (dayKey !== dateKey) return 1;
  const hm = formatInTimeZone(new Date(instantMs), RESERVATION_TZ, "HH:mm");
  const [h, m] = hm.split(":").map(Number);
  const mins = h * 60 + m;
  if (mins >= DOUBLE_CAPACITY_START_MIN && mins <= DOUBLE_CAPACITY_END_MIN) return 3;
  return 2;
}

export function reservationDurationMinutesFromDoc(r: {
  durationMinutes?: unknown;
  treatmentId?: unknown;
}): number {
  if (typeof r.durationMinutes === "number" && Number.isFinite(r.durationMinutes) && r.durationMinutes > 0) {
    return r.durationMinutes;
  }
  const tid = String(r.treatmentId ?? "").trim();
  return findCatalogTreatmentById(tid)?.durationMinutes ?? 60;
}

function durationForReservationRow(r: {
  durationMinutes?: unknown;
  treatmentId?: unknown;
  startsAt?: unknown;
}): number {
  return reservationDurationMinutesFromDoc(r);
}

export async function loadBusyIntervalsMs(
  db: Db,
  dateKey: string,
  excludeReservationId?: ObjectId,
): Promise<IntervalMs[]> {
  const filter: Record<string, unknown> = {
    dateKey,
    reservationStatus: { $in: [...ACTIVE_STATUSES] },
  };
  if (excludeReservationId) {
    filter._id = { $ne: excludeReservationId };
  }
  const rows = await db
    .collection(COLLECTION)
    .find(filter, { projection: { startsAt: 1, durationMinutes: 1, treatmentId: 1 } })
    .toArray();

  return rows.map((r) => {
    const startsAt = r.startsAt instanceof Date ? r.startsAt : new Date(String(r.startsAt));
    const startMs = startsAt.getTime();
    const dur = durationForReservationRow(r as { durationMinutes?: unknown; treatmentId?: unknown });
    return { startMs, endMs: startMs + dur * 60_000 };
  });
}

function capacityBoundaryInstantsMs(dateKey: string): number[] {
  return [
    new Date(`${dateKey}T09:00:00-03:00`).getTime(),
    new Date(`${dateKey}T11:31:00-03:00`).getTime(),
  ];
}

/**
 * ¿Se puede agregar este intervalo sin superar la capacidad por franja?
 * Entre 9:00 y 11:30 ART pueden convivir hasta 3 turnos que se solapen; fuera, 2.
 * `getEffectiveCap` permite reducir cupos por bloqueos de agenda (silla / salón).
 */
export function canPlaceReservationSlot(
  dateKey: string,
  candidate: IntervalMs,
  busy: IntervalMs[],
  getEffectiveCap?: (instantMs: number) => number,
): boolean {
  const relevant = busy.filter((b) => intervalsOverlap(b, candidate));
  const points = new Set<number>([candidate.startMs, candidate.endMs]);
  for (const b of relevant) {
    const s = Math.max(b.startMs, candidate.startMs);
    const e = Math.min(b.endMs, candidate.endMs);
    if (s < e) {
      points.add(s);
      points.add(e);
    }
  }
  for (const bt of capacityBoundaryInstantsMs(dateKey)) {
    if (bt > candidate.startMs && bt < candidate.endMs) {
      points.add(bt);
    }
  }

  const sorted = [...points].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length - 1; i++) {
    const t0 = sorted[i];
    const t1 = sorted[i + 1];
    if (t1 <= t0) continue;
    const lo = Math.max(t0, candidate.startMs);
    const hi = Math.min(t1, candidate.endMs);
    if (hi <= lo) continue;
    const mid = (lo + hi) / 2;
    const cap = getEffectiveCap ? getEffectiveCap(mid) : salonConcurrentCapAtInstant(dateKey, mid);
    let depth = 0;
    for (const b of relevant) {
      if (b.startMs < hi && b.endMs > lo) depth++;
    }
    if (depth + 1 > cap) return false;
  }
  return true;
}

export function filterSlotsBySalonCapacity(
  slots: string[],
  dateKey: string,
  durationMinutes: number,
  busy: IntervalMs[],
  getEffectiveCap?: (instantMs: number) => number,
): string[] {
  return slots.filter((timeLocal) => {
    const slot = slotIntervalMs(dateKey, timeLocal, durationMinutes);
    if (!slot) return false;
    return canPlaceReservationSlot(dateKey, slot, busy, getEffectiveCap);
  });
}

export async function reservationWouldExceedSalonCapacity(
  db: Db,
  dateKey: string,
  candidate: IntervalMs,
  getEffectiveCap?: (instantMs: number) => number,
  excludeReservationId?: ObjectId,
): Promise<boolean> {
  const busy = await loadBusyIntervalsMs(db, dateKey, excludeReservationId);
  return !canPlaceReservationSlot(dateKey, candidate, busy, getEffectiveCap);
}
