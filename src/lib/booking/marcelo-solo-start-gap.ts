import type { Db, ObjectId } from "mongodb";

import { slotIntervalMs } from "@/lib/booking/slot-overlap";

const COLLECTION = "reservations";
const ACTIVE_STATUSES = ["confirmed"] as const;

/**
 * Servicios con 60 minutos entre un inicio y el siguiente.
 * Vacía desde oct 2026: Lucas también hace reflejos de papel, así que
 * el cupo del salón alcanza y no hace falta esa espera extra.
 */
export const MARCELO_SOLO_TREATMENT_IDS = new Set<string>([]);

export const MARCELO_SOLO_MIN_START_GAP_MINUTES = 60;

const GAP_MS = MARCELO_SOLO_MIN_START_GAP_MINUTES * 60_000;

export function isMarceloSoloTreatmentId(treatmentId: string): boolean {
  return MARCELO_SOLO_TREATMENT_IDS.has(treatmentId.trim());
}

export function treatmentIdsRequireMarceloSoloStartGap(treatmentIds: string[]): boolean {
  return treatmentIds.some((id) => isMarceloSoloTreatmentId(id));
}

export function reservationDocRequiresMarceloSoloStartGap(r: {
  treatmentId?: unknown;
  serviceItems?: Array<{ treatmentId?: unknown }> | null;
}): boolean {
  if (isMarceloSoloTreatmentId(String(r.treatmentId ?? ""))) return true;
  const items = r.serviceItems;
  if (!Array.isArray(items)) return false;
  return items.some((s) => isMarceloSoloTreatmentId(String(s?.treatmentId ?? "")));
}

/** ¿El inicio candidato respeta ≥60 min respecto de los inicios ya ocupados? */
export function canPlaceMarceloSoloStart(candidateStartMs: number, busyStartsMs: number[]): boolean {
  for (const other of busyStartsMs) {
    if (Math.abs(candidateStartMs - other) < GAP_MS) return false;
  }
  return true;
}

export function filterSlotsByMarceloSoloStartGap(
  slots: string[],
  dateKey: string,
  busyStartsMs: number[],
): string[] {
  return slots.filter((timeLocal) => {
    const interval = slotIntervalMs(dateKey, timeLocal, 1);
    if (!interval) return false;
    return canPlaceMarceloSoloStart(interval.startMs, busyStartsMs);
  });
}

/**
 * Inicios (epoch ms) de reservas confirmadas del día que incluyen
 * un servicio de MARCELO_SOLO_TREATMENT_IDS.
 */
export async function loadMarceloSoloStartMs(
  db: Db,
  dateKey: string,
  excludeReservationId?: ObjectId,
): Promise<number[]> {
  const filter: Record<string, unknown> = {
    dateKey,
    reservationStatus: { $in: [...ACTIVE_STATUSES] },
    $or: [
      { treatmentId: { $in: [...MARCELO_SOLO_TREATMENT_IDS] } },
      { "serviceItems.treatmentId": { $in: [...MARCELO_SOLO_TREATMENT_IDS] } },
    ],
  };
  if (excludeReservationId) {
    filter._id = { $ne: excludeReservationId };
  }

  const rows = await db
    .collection(COLLECTION)
    .find(filter, { projection: { startsAt: 1, timeLocal: 1 } })
    .toArray();

  const starts: number[] = [];
  for (const r of rows) {
    if (r.startsAt instanceof Date && !Number.isNaN(r.startsAt.getTime())) {
      starts.push(r.startsAt.getTime());
      continue;
    }
    const timeLocal = String(r.timeLocal ?? "").trim();
    const iv = slotIntervalMs(dateKey, timeLocal, 1);
    if (iv) starts.push(iv.startMs);
  }
  return starts;
}

export async function reservationWouldViolateMarceloSoloStartGap(
  db: Db,
  dateKey: string,
  candidateStartMs: number,
  excludeReservationId?: ObjectId,
): Promise<boolean> {
  const busy = await loadMarceloSoloStartMs(db, dateKey, excludeReservationId);
  return !canPlaceMarceloSoloStart(candidateStartMs, busy);
}
