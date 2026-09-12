import type { Db } from "mongodb";

import { canonicalPhoneDigitsAR, customerPhoneDigitsQueryValues } from "@/lib/customer/phone-canonical-ar";

import type { ReservationDoc } from "./types";

const COLLECTION = "reservations";

/** Reservas del cliente (mismo WhatsApp, formato AR unificado + variantes guardadas). */
export async function listReservationsByCustomerPhoneDigits(
  db: Db,
  phoneDigitsCanonical: string,
): Promise<ReservationDoc[]> {
  const keys = customerPhoneDigitsQueryValues(phoneDigitsCanonical);
  return db
    .collection<ReservationDoc>(COLLECTION)
    .find({ customerPhoneDigits: { $in: keys } })
    .sort({ startsAt: -1 })
    .limit(200)
    .toArray();
}

/** Pasa todas las reservas de un WhatsApp a otro (Mis datos). */
export async function reassignReservationsToPhone(
  db: Db,
  fromPhoneDigitsCanonical: string,
  toPhoneDigitsCanonical: string,
  toCustomerPhone: string,
  now: Date,
): Promise<number> {
  const fromKeys = customerPhoneDigitsQueryValues(fromPhoneDigitsCanonical);
  const result = await db.collection<ReservationDoc>(COLLECTION).updateMany(
    { customerPhoneDigits: { $in: fromKeys } },
    {
      $set: {
        customerPhone: toCustomerPhone.trim(),
        customerPhoneDigits: toPhoneDigitsCanonical,
        updatedAt: now,
      },
    },
  );
  return result.modifiedCount;
}

/** Hay turnos en `phoneDigitsCanonical` que no pertenecen a `ownerPhoneDigitsCanonical`. */
export async function phoneHasForeignReservations(
  db: Db,
  phoneDigitsCanonical: string,
  ownerPhoneDigitsCanonical: string,
): Promise<boolean> {
  const targetKeys = customerPhoneDigitsQueryValues(phoneDigitsCanonical);
  const ownerKeys = new Set(customerPhoneDigitsQueryValues(ownerPhoneDigitsCanonical));
  const rows = await db
    .collection<ReservationDoc>(COLLECTION)
    .find({ customerPhoneDigits: { $in: targetKeys } }, { projection: { customerPhoneDigits: 1 } })
    .limit(50)
    .toArray();
  return rows.some((r) => !ownerKeys.has(String(r.customerPhoneDigits ?? "")));
}

/** Rellena `customerPhoneDigits` en documentos sin el campo (tandas acotadas). */
export async function backfillCustomerPhoneDigitsBatch(db: Db, batchSize = 250): Promise<number> {
  const col = db.collection<ReservationDoc>(COLLECTION);
  const rows = await col
    .find({ customerPhoneDigits: { $exists: false } }, { projection: { _id: 1, customerPhone: 1 } })
    .limit(batchSize)
    .toArray();
  if (rows.length === 0) return 0;
  await Promise.all(
    rows.map((r) =>
      col.updateOne(
        { _id: r._id },
        { $set: { customerPhoneDigits: canonicalPhoneDigitsAR(String(r.customerPhone ?? "")) } },
      ),
    ),
  );
  return rows.length;
}

/**
 * Re-normaliza `customerPhoneDigits` en todos los documentos cuya forma guardada
 * no coincide con la normalización corregida (variantes "0…" o "9…" mal canonicalizadas).
 * Se ejecuta una sola vez al subir la versión de índices.
 */
export async function renormalizeCustomerPhoneDigitsBatch(db: Db, batchSize = 250): Promise<number> {
  const col = db.collection<ReservationDoc>(COLLECTION);
  // Busca documentos con la forma canónica antigua incorrecta:
  // "5490XXXXXXXXXX" (de "011...") o "5499XXXXXXXXXX" (de "9 11...")
  const rows = await col
    .find(
      {
        customerPhoneDigits: {
          $regex: "^(5490|5499)",
        },
      },
      { projection: { _id: 1, customerPhone: 1 } },
    )
    .limit(batchSize)
    .toArray();
  if (rows.length === 0) return 0;
  await Promise.all(
    rows.map((r) =>
      col.updateOne(
        { _id: r._id },
        { $set: { customerPhoneDigits: canonicalPhoneDigitsAR(String(r.customerPhone ?? "")) } },
      ),
    ),
  );
  return rows.length;
}
