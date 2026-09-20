import {
  SALON_TREATMENTS,
  TREATMENT_CATEGORIES,
  type TreatmentCategory,
} from "@/lib/treatments/catalog";
import { isOfferedTreatmentId } from "@/lib/treatments/experience-packages";
import { isArgentinaPublicHoliday } from "@/lib/booking/argentina-holidays";

export type SalonTreatmentOption = {
  id: string;
  name: string;
  subtitle: string;
  category: TreatmentCategory;
  priceLabel?: string;
  badge?: string;
  experienceFamily?: "color-experience" | "balayage-experience";
};

export const SALON_TREATMENT_CATEGORIES: TreatmentCategory[] = [...TREATMENT_CATEGORIES];

export const SALON_TREATMENT_OPTIONS: SalonTreatmentOption[] = SALON_TREATMENTS.filter((t) =>
  isOfferedTreatmentId(t.id),
).map((t) => ({
  id: t.id,
  name: t.name,
  subtitle: t.subtitle,
  category: t.category,
  priceLabel: t.priceLabel,
  badge: t.badge,
  experienceFamily: t.experienceFamily,
}));

/** Minuto del día (0–24h): el servicio debe *terminar* a esta hora o antes (16:00 = cierre puntual). */
export const SALON_LAST_SERVICE_END_MINUTES = 16 * 60;

const SLOT_STEP_MINUTES = 30;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function minutesToHhmm(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Inicios de turno cada `SLOT_STEP_MINUTES`, con `open` inclusive y `close` exclusive (ej. 9:00–16:00). */
function buildStepSlots(openH: number, openM: number, closeH: number, closeM: number): string[] {
  let t = openH * 60 + openM;
  const end = closeH * 60 + closeM;
  const out: string[] = [];
  while (t < end) {
    out.push(minutesToHhmm(t));
    t += SLOT_STEP_MINUTES;
  }
  return out;
}

/**
 * Horarios base según Google Maps (ART): lun y dom cerrados; mar–vie 9:00–16:00; sáb 10:00–16:00.
 * Grilla cada 30 min (último inicio 15:30).
 */
const availableTimesByWeekday: Record<number, string[]> = {
  0: [],
  1: [],
  2: buildStepSlots(9, 0, 16, 0),
  3: buildStepSlots(9, 0, 16, 0),
  4: buildStepSlots(9, 0, 16, 0),
  5: buildStepSlots(9, 0, 16, 0),
  6: buildStepSlots(10, 0, 16, 0),
};

/** Quita inicios donde el servicio pasaría de `SALON_LAST_SERVICE_END_MINUTES`. */
export function filterSlotsServiceEndsOnOrBeforeClose(
  slots: string[],
  durationMinutes: number,
  lastServiceEndMinutes: number = SALON_LAST_SERVICE_END_MINUTES,
): string[] {
  return slots.filter((t) => hhmmToMinutes(t) + durationMinutes <= lastServiceEndMinutes);
}

/**
 * Excepciones manuales por fecha (prioridad sobre `availableTimesByWeekday`).
 * Vacío: las entradas previas no tenían origen documentado; sumar acá `yyyy-mm-dd` → horarios cuando haya agenda confirmada.
 *
 * Copia de respaldo (no activa):
 * - 2026-03-30: 09:00, 16:30, 18:15
 * - 2026-03-31: 10:00, 17:00, 18:00
 * - 2026-04-01: 08:00, 10:00, 11:00, 12:00, 17:00
 * - 2026-04-04: 09:00, 10:00, 11:00, 12:00
 * - 2026-04-07: 10:00, 11:00, 15:00, 16:00, 17:30, 18:30
 * - 2026-04-08: 08:00, 09:00, 10:00, 10:30, 15:00, 16:00
 * - 2026-04-09: 08:00, 09:00, 10:00
 * - 2026-04-10: 11:00, 15:00, 16:00, 17:30, 18:30
 * - 2026-04-11: 08:00, 09:00, 10:00, 11:00, 12:00, 13:00
 */
const availableTimesByDateOverride: Record<string, string[]> = {};

export const salonWeekdayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export const salonMonthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function formatSalonDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getAvailableTimesForDate(value: string) {
  const date = parseDateKey(value);
  const today = startOfDay(new Date());

  if (startOfDay(date) < today) {
    return [];
  }
  if (isArgentinaPublicHoliday(value)) {
    return [];
  }

  const override = availableTimesByDateOverride[value];
  if (override) {
    return override;
  }

  return availableTimesByWeekday[date.getDay()] ?? [];
}

export type SalonCalendarItem = {
  value: string;
  dayNumber: number;
  weekday: string;
  isCurrentMonth: boolean;
  isAvailable: boolean;
};

export function buildSalonCalendarItems(year: number, monthIndex: number): SalonCalendarItem[] {
  const firstDayOfMonth = new Date(year, monthIndex, 1);
  const startWeekday = firstDayOfMonth.getDay();
  const gridStartDate = new Date(year, monthIndex, 1 - startWeekday);

  return Array.from({ length: 35 }, (_, index) => {
    const currentDate = new Date(gridStartDate);
    currentDate.setDate(gridStartDate.getDate() + index);

    const value = formatSalonDateKey(currentDate);

    return {
      value,
      dayNumber: currentDate.getDate(),
      weekday: salonWeekdayLabels[currentDate.getDay()],
      isCurrentMonth: currentDate.getMonth() === monthIndex,
      isAvailable: getAvailableTimesForDate(value).length > 0,
    };
  });
}

export function formatSalonDisplayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "Elegí día";

  const date = new Date(year, month - 1, day);
  return `${salonWeekdayLabels[date.getDay()]}, ${day} ${salonMonthNames[month - 1].slice(0, 3).toLowerCase()}`;
}

/** Solo dígitos, para cruzar reservas con el mismo WhatsApp aunque el formato varíe. */
export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function isLikelyWhatsappNumber(raw: string): boolean {
  const digits = normalizePhoneDigits(raw);
  return digits.length >= 10 && digits.length <= 15;
}

/** Últimos 4 dígitos para listados del panel (sin mostrar el número completo). */
export function maskPhoneForPanelDisplay(raw: string): string {
  const digits = normalizePhoneDigits(raw);
  if (digits.length < 4) return raw.trim() || "—";
  return `··· ${digits.slice(-4)}`;
}
