import type { Db } from "mongodb";

import { customerPhoneDigitsQueryValues } from "@/lib/customer/phone-canonical-ar";

export const CUSTOMER_PROFILES_COLLECTION = "customer_profiles";

export type CustomerProfileDoc = {
  phoneDigits: string;
  displayName: string;
  updatedAt: Date;
};

const NAME_MAX = 80;

/** Mismo piso que el alta de turno (≥ 2); recorta espacios. */
export function normalizeDisplayName(raw: string): string | null {
  const name = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (name.length < 2 || name.length > NAME_MAX) return null;
  return name;
}

let indexesEnsured = false;

export async function ensureCustomerProfileIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(CUSTOMER_PROFILES_COLLECTION).createIndex(
    { phoneDigits: 1 },
    { unique: true, name: "by_phoneDigits" },
  );
  indexesEnsured = true;
}

export async function findCustomerDisplayName(db: Db, phoneDigitsCanonical: string): Promise<string | null> {
  const canonical = phoneDigitsCanonical.trim();
  if (!canonical) return null;
  await ensureCustomerProfileIndexes(db);
  const keys = customerPhoneDigitsQueryValues(canonical);
  const row = await db.collection<CustomerProfileDoc>(CUSTOMER_PROFILES_COLLECTION).findOne(
    { phoneDigits: { $in: keys } },
    { projection: { displayName: 1 } },
  );
  const name = row?.displayName?.trim();
  return name && name.length >= 2 ? name : null;
}

export async function upsertCustomerDisplayName(
  db: Db,
  phoneDigitsCanonical: string,
  displayName: string,
): Promise<string | null> {
  const canonical = phoneDigitsCanonical.trim();
  const name = normalizeDisplayName(displayName);
  if (!canonical || !name) return null;
  await ensureCustomerProfileIndexes(db);
  const now = new Date();
  await db.collection<CustomerProfileDoc>(CUSTOMER_PROFILES_COLLECTION).updateOne(
    { phoneDigits: canonical },
    { $set: { phoneDigits: canonical, displayName: name, updatedAt: now } },
    { upsert: true },
  );
  return name;
}

/** Borra fichas de un WhatsApp (todas las variantes canónicas) para moverlas a otro número. */
export async function deleteCustomerProfilesForPhone(db: Db, phoneDigitsCanonical: string): Promise<void> {
  const canonical = phoneDigitsCanonical.trim();
  if (!canonical) return;
  await ensureCustomerProfileIndexes(db);
  const keys = customerPhoneDigitsQueryValues(canonical);
  await db.collection(CUSTOMER_PROFILES_COLLECTION).deleteMany({ phoneDigits: { $in: keys } });
}
