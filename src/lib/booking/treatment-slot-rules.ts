/**
 * Reglas de agenda indicadas por el salón.
 *
 * Trabajos técnicos (martes a viernes):
 *   → No pueden empezar después de las 14:00 (el salón cierra a las 16:00 y Marcelo quiere salir a horario).
 *
 * Trabajos técnicos (sábados):
 *   → Deben TERMINAR a las 13:00 o antes (después trabaja solo peinados).
 *   → El último inicio permitido = 13:00 − duración del servicio (alineado a grilla de 30 min).
 */

// ─── Horarios de corte ────────────────────────────────────────────────────────

/** Último inicio permitido para trabajos técnicos martes-viernes. */
export const TECH_LATEST_START_TUE_FRI = "14:00";

/** Minutos del día en que terminan los trabajos técnicos los sábados (13:00). */
const SAT_TECH_END_MINUTES = 13 * 60; // 780

// ─── Tratamientos técnicos (id → durationMinutes) ────────────────────────────

/**
 * Trabajos técnicos del salón con sus duraciones (en minutos).
 * Estos servicios tienen restricción horaria en Tue-Vie y Sábados.
 */
const TECHNICAL_TREATMENTS = new Map<string, number>([
  ["color-essential", 90],
  ["color-signature", 120],
  ["color-premium", 150],
  ["balayage-essential", 120],
  ["balayage-signature", 150],
  ["balayage-premium", 180],
  ["servicio-completo", 90],       // Servicio completo
  ["color", 60],                   // Color / color con retoque
  ["color-retoque-reflejos", 60],  // Color con retoque de reflejos
  ["color-mechas-total", 90],      // Color con mechas
  ["mechas-contramechas", 120],    // Mechas y contra mechas
  ["balayage", 120],               // Balayage
  ["reflejos-gorra", 120],         // Reflejos gorra
  ["reflejos-papel-retoque", 90],  // Reflejos papel retoque
  ["reflejos-papel-completo", 120],// Reflejos papel completo
  ["barrido", 45],                 // Barrido
  ["planchado", 60],               // Planchado
]);

// ─── Keratina ─────────────────────────────────────────────────────────────────

/**
 * Único inicio permitido para keratina (reserva pública).
 * Con cierre 16:00 y servicio de 1 h, 15:30 ya no entra; queda 15:00.
 */
export const KERATINA_ONLY_TIME_LOCAL = "15:00";

// ─── Helpers internos ─────────────────────────────────────────────────────────

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isSaturday(dateKey: string): boolean {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return false;
  return new Date(y, m - 1, d).getDay() === 6;
}

/**
 * Último inicio permitido para un trabajo técnico el sábado,
 * de modo que el servicio termine exactamente a las 13:00 o antes.
 * Devuelve un string "HH:MM" alineado a la grilla de 30 min.
 */
function saturdayTechLastStart(durationMinutes: number): string {
  const lastStartMins = Math.floor((SAT_TECH_END_MINUTES - durationMinutes) / 30) * 30;
  if (lastStartMins <= 0) return "00:00"; // no hay slot disponible
  return `${pad2(Math.floor(lastStartMins / 60))}:${pad2(lastStartMins % 60)}`;
}

// ─── API pública ──────────────────────────────────────────────────────────────

export function isTechnicalTreatment(treatmentId: string): boolean {
  return TECHNICAL_TREATMENTS.has(treatmentId);
}

export function treatmentIsKeratinaOnly1530(treatmentId: string): boolean {
  return treatmentId === "keratina";
}

/**
 * Filtra los slots según las reglas de negocio del tratamiento.
 * Pasar `dateKey` para aplicar las restricciones del sábado.
 *
 * Reglas aplicadas (por orden de prioridad):
 *  1. Keratina → solo 15:00
 *  2. Trabajo técnico en sábado → slots que terminan antes de las 13:00
 *  3. Trabajo técnico en martes–viernes → inicio no posterior a 14:00
 */
export function filterPublicSlotsByTreatmentRules(
  treatmentId: string | undefined,
  slots: string[],
  dateKey?: string,
): string[] {
  if (!treatmentId) return slots;

  // 1. Keratina: único horario fijo
  if (treatmentIsKeratinaOnly1530(treatmentId)) {
    return slots.filter((t) => t === KERATINA_ONLY_TIME_LOCAL);
  }

  const duration = TECHNICAL_TREATMENTS.get(treatmentId);
  if (duration === undefined) return slots; // no es técnico → sin restricción

  // 2. Sábado: el trabajo debe TERMINAR antes de las 13:00
  if (dateKey && isSaturday(dateKey)) {
    const lastStart = saturdayTechLastStart(duration);
    return slots.filter((t) => t <= lastStart);
  }

  // 3. Martes–Viernes: inicio no posterior a 14:00
  return slots.filter((t) => t <= TECH_LATEST_START_TUE_FRI);
}

// Mantener por retrocompatibilidad (no se usa fuera de este módulo pero por claridad)
export const REFLEJOS_BALAYAGE_LATEST_START = TECH_LATEST_START_TUE_FRI;
export function treatmentRequiresStartNoLaterThan14(treatmentId: string): boolean {
  return TECHNICAL_TREATMENTS.has(treatmentId);
}
