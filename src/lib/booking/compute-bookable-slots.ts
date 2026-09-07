import type { Db, ObjectId } from "mongodb";
import { ObjectId as ObjectIdCtor } from "mongodb";

import { buildCapGetterForDate } from "@/lib/booking/agenda-blocks";
import { getAvailableTimesForDate, filterSlotsServiceEndsOnOrBeforeClose } from "@/lib/booking/salon-availability";
import { getPublicBookableTimeSlots } from "@/lib/booking/public-slot-lead";
import {
  filterSlotsByMarceloSoloStartGap,
  isMarceloSoloTreatmentId,
  loadMarceloSoloStartMs,
  treatmentIdsRequireMarceloSoloStartGap,
} from "@/lib/booking/marcelo-solo-start-gap";
import { marceloWorkUnavailableOnDate } from "@/lib/booking/marcelo-work";
import { KERATINA_ONLY_TIME_LOCAL, filterPublicSlotsByTreatmentRules } from "@/lib/booking/treatment-slot-rules";
import { filterSlotsBySalonCapacity, loadBusyIntervalsMs } from "@/lib/booking/slot-overlap";
import { findCatalogTreatmentById } from "@/lib/treatments/catalog";

export type BookingSlotScope = "public" | "panel";

/**
 * Horarios elegibles para un día y tratamiento (plantilla + reglas de servicio + solapes con DB).
 */
export async function computeBookableSlots(
  db: Db,
  params: {
    dateKey: string;
    treatmentId: string;
    now: Date;
    scope: BookingSlotScope;
    /** Al reprogramar, excluir esta reserva del cómputo de ocupación. */
    excludeReservationHexId?: string | null;
  },
): Promise<string[]> {
  const treatment = findCatalogTreatmentById(params.treatmentId.trim());
  if (!treatment) return [];
  if (marceloWorkUnavailableOnDate(params.dateKey, [treatment.id])) return [];

  let excludeId: ObjectId | undefined;
  const ex = params.excludeReservationHexId?.trim();
  if (ex && /^[a-f0-9]{24}$/i.test(ex)) {
    try {
      excludeId = new ObjectIdCtor(ex);
    } catch {
      excludeId = undefined;
    }
  }

  let slots =
    params.scope === "public"
      ? getPublicBookableTimeSlots(params.dateKey, params.now)
      : getAvailableTimesForDate(params.dateKey);

  slots = filterSlotsServiceEndsOnOrBeforeClose(slots, treatment.durationMinutes);
  slots = filterPublicSlotsByTreatmentRules(treatment.id, slots, params.dateKey);
  const busy = await loadBusyIntervalsMs(db, params.dateKey, excludeId);
  const capGetter = await buildCapGetterForDate(db, params.dateKey);
  slots = filterSlotsBySalonCapacity(slots, params.dateKey, treatment.durationMinutes, busy, capGetter);
  if (isMarceloSoloTreatmentId(treatment.id)) {
    const soloStarts = await loadMarceloSoloStartMs(db, params.dateKey, excludeId);
    slots = filterSlotsByMarceloSoloStartGap(slots, params.dateKey, soloStarts);
  }
  return slots;
}

/**
 * Horarios elegibles para combo de servicios (duración total y reglas por servicio).
 */
export async function computeBookableSlotsForTreatmentIds(
  db: Db,
  params: {
    dateKey: string;
    treatmentIds: string[];
    now: Date;
    scope: BookingSlotScope;
    excludeReservationHexId?: string | null;
  },
): Promise<string[]> {
  function pad2(n: number) {
    return String(n).padStart(2, "0");
  }
  function hhmmToMinutes(hhmm: string) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  const ids = params.treatmentIds.map((v) => v.trim()).filter(Boolean);
  if (ids.length === 0) return [];
  const treatments = ids
    .map((id) => findCatalogTreatmentById(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  if (treatments.length !== ids.length) return [];
  if (marceloWorkUnavailableOnDate(params.dateKey, ids)) return [];
  const totalDuration = treatments.reduce((acc, t) => acc + t.durationMinutes, 0);

  let excludeId: ObjectId | undefined;
  const ex = params.excludeReservationHexId?.trim();
  if (ex && /^[a-f0-9]{24}$/i.test(ex)) {
    try {
      excludeId = new ObjectIdCtor(ex);
    } catch {
      excludeId = undefined;
    }
  }

  let slots =
    params.scope === "public"
      ? getPublicBookableTimeSlots(params.dateKey, params.now)
      : getAvailableTimesForDate(params.dateKey);
  slots = filterSlotsServiceEndsOnOrBeforeClose(slots, totalDuration);
  const keratinaIdx = treatments.findIndex((t) => t.id === "keratina");
  if (params.scope === "public" && keratinaIdx >= 0) {
    // En combos públicos, keratina debe quedar al final y empezar a las 15:00.
    if (keratinaIdx !== treatments.length - 1) return [];
    const beforeDuration = treatments.slice(0, keratinaIdx).reduce((acc, t) => acc + t.durationMinutes, 0);
    const [h, m] = KERATINA_ONLY_TIME_LOCAL.split(":").map(Number);
    const startMins = h * 60 + m - beforeDuration;
    if (startMins < 0 || startMins >= 24 * 60) return [];
    const startAt = `${pad2(Math.floor(startMins / 60))}:${pad2(startMins % 60)}`;
    if (slots.length === 0) return [];
    const dayOpenMins = hhmmToMinutes(slots[0]);
    if (startMins < dayOpenMins) return [];
    slots = [startAt];
    for (const t of treatments) {
      if (t.id === "keratina") continue;
      slots = filterPublicSlotsByTreatmentRules(t.id, slots, params.dateKey);
    }
  } else {
    for (const t of treatments) {
      slots = filterPublicSlotsByTreatmentRules(t.id, slots, params.dateKey);
    }
  }
  const busy = await loadBusyIntervalsMs(db, params.dateKey, excludeId);
  const capGetter = await buildCapGetterForDate(db, params.dateKey);
  slots = filterSlotsBySalonCapacity(slots, params.dateKey, totalDuration, busy, capGetter);
  if (treatmentIdsRequireMarceloSoloStartGap(ids)) {
    const soloStarts = await loadMarceloSoloStartMs(db, params.dateKey, excludeId);
    slots = filterSlotsByMarceloSoloStartGap(slots, params.dateKey, soloStarts);
  }
  return slots;
}
