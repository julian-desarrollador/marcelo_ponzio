/**
 * Servicios que solo hace Marcelo. Vacía desde oct 2026: Lucas puede hacer todo,
 * también durante el viaje del 10 al 25. Las fechas de ausencia siguen en las
 * constantes de abajo (aviso de vacaciones), no para sacar cupos.
 */
export const MARCELO_TREATMENT_IDS = new Set<string>([]);

/** Último día de trabajo: viernes 9 oct. Ausente inclusive 10–25. El 26 es lunes (cerrado). Vuelve el martes 27. */
export const MARCELO_AWAY_FROM_DATE_KEY = "2026-10-10";
export const MARCELO_AWAY_UNTIL_DATE_KEY = "2026-10-25";

export function isMarceloTreatmentId(treatmentId: string): boolean {
  return MARCELO_TREATMENT_IDS.has(treatmentId.trim());
}

export function treatmentIdsIncludeMarceloWork(treatmentIds: string[]): boolean {
  return treatmentIds.some((id) => isMarceloTreatmentId(id));
}

export function isMarceloAwayDateKey(dateKey: string): boolean {
  return dateKey >= MARCELO_AWAY_FROM_DATE_KEY && dateKey <= MARCELO_AWAY_UNTIL_DATE_KEY;
}

/** Si el turno incluye un trabajo solo de Marcelo en una fecha de viaje, no hay cupo. Hoy la lista está vacía. */
export function marceloWorkUnavailableOnDate(dateKey: string, treatmentIds: string[]): boolean {
  return isMarceloAwayDateKey(dateKey) && treatmentIdsIncludeMarceloWork(treatmentIds);
}
