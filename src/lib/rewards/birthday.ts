import { formatInTimeZone } from "date-fns-tz";

export const REWARDS_TZ = "America/Argentina/Buenos_Aires";

export function argentinaDateKey(now = new Date()): string {
  return formatInTimeZone(now, REWARDS_TZ, "yyyy-MM-dd");
}

export function addCalendarDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map((v) => parseInt(v, 10));
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + days);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** "MM-DD" válido, null si viene vacío, o "invalid". */
export function parseBirthdayMonthDay(raw: unknown): string | null | "invalid" {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const match = /^(\d{2})-(\d{2})$/.exec(text);
  if (!match) return "invalid";
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "invalid";
  const probe = new Date(Date.UTC(2000, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return "invalid";
  return `${match[1]}-${match[2]}`;
}

export function formatBirthdayLabel(monthDay: string): string {
  const [mm, dd] = monthDay.split("-");
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const month = months[Number(mm) - 1];
  if (!month) return monthDay;
  return `${Number(dd)} de ${month}`;
}

/** Próxima ocurrencia del cumpleaños dentro de los próximos `windowDays` días (incluye hoy). */
export function birthdayWithinWindow(
  monthDay: string,
  todayKey: string,
  windowDays = 7,
): { dateKey: string; daysUntil: number; year: number } | null {
  const parsed = parseBirthdayMonthDay(monthDay);
  if (!parsed || parsed === "invalid") return null;
  for (let i = 0; i < windowDays; i += 1) {
    const dateKey = addCalendarDays(todayKey, i);
    if (dateKey.slice(5) === parsed) {
      return { dateKey, daysUntil: i, year: Number(dateKey.slice(0, 4)) };
    }
  }
  return null;
}
