/**
 * Paquetes MP Experiences (flyers de Color y Balayage).
 * No se combinan con otros servicios. MP Experiences (marca) no es un ítem de catálogo.
 */
export const EXPERIENCE_PACKAGES_ENABLED = true;

export const COLOR_EXPERIENCE_IDS = [
  "color-essential",
  "color-signature",
  "color-premium",
] as const;

export const BALAYAGE_EXPERIENCE_IDS = [
  "balayage-essential",
  "balayage-signature",
  "balayage-premium",
] as const;

export const EXPERIENCE_PACKAGE_IDS = new Set<string>([
  ...COLOR_EXPERIENCE_IDS,
  ...BALAYAGE_EXPERIENCE_IDS,
]);

/** Paquetes que ocupan el turno entero (incluye Servicio completo). */
export const EXCLUSIVE_PACKAGE_IDS = new Set<string>([
  "servicio-completo",
  ...EXPERIENCE_PACKAGE_IDS,
]);

export type ExperienceFamily = "color-experience" | "balayage-experience";

export function isExclusivePackageId(treatmentId: string): boolean {
  return EXCLUSIVE_PACKAGE_IDS.has(treatmentId.trim());
}

export function isExperiencePackageId(treatmentId: string): boolean {
  return EXPERIENCE_PACKAGE_IDS.has(treatmentId.trim());
}

/** false si es un paquete Experience apagado, o Servicio completo (reemplazado por Color Signature). */
export function isOfferedTreatmentId(treatmentId: string): boolean {
  const id = treatmentId.trim();
  if (id === "servicio-completo") return false;
  if (id === "color-signature") return true;
  if (!isExperiencePackageId(id)) return true;
  return EXPERIENCE_PACKAGES_ENABLED;
}

/** true si hay un paquete exclusivo mezclado con otro servicio. */
export function exclusivePackageConflictsWithCombo(treatmentIds: string[]): boolean {
  const unique = [...new Set(treatmentIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length <= 1) return false;
  return unique.some((id) => isExclusivePackageId(id));
}

export function exclusivePackageComboError(): string {
  return "Esta experiencia ya incluye varios servicios y no se puede combinar con otros.";
}

export function parseExperiencePromoParam(raw: string | undefined | null): ExperienceFamily | null {
  if (!EXPERIENCE_PACKAGES_ENABLED) return null;
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "color" || v === "color-experience") return "color-experience";
  if (v === "balayage" || v === "balayage-experience") return "balayage-experience";
  return null;
}

export function experienceFamilyOfId(treatmentId: string): ExperienceFamily | null {
  const id = treatmentId.trim();
  if ((COLOR_EXPERIENCE_IDS as readonly string[]).includes(id)) return "color-experience";
  if ((BALAYAGE_EXPERIENCE_IDS as readonly string[]).includes(id)) return "balayage-experience";
  return null;
}
