import type { Db } from "mongodb";

import { argentinaTodayDateKey } from "@/lib/booking/public-slot-lead";
import { canonicalPhoneDigitsAR, customerPhoneDigitsQueryValues } from "@/lib/customer/phone-canonical-ar";
import { normalizeDisplayName, upsertCustomerDisplayName } from "@/lib/customer/customer-profiles";
import { normalizePhoneDigits } from "@/lib/booking/salon-availability";

import type { ReservationDoc } from "./types";

const COLLECTION = "reservations";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function escapeRegex(raw: string): string {
  return raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type ClientSummaryRow = {
  phoneDigits: string;
  customerName: string;
  customerPhone: string;
  visitCount: number;
  lastVisitDateKey: string;
};

type ClientAggregateRow = {
  _id: string;
  customerName: string;
  customerPhone: string;
  visitCount: number;
  lastVisitDateKey: string;
};

function buildClientSearchFilter(q: string): Record<string, unknown> | null {
  const trimmed = q.trim();
  if (!trimmed) return null;

  const or: Record<string, unknown>[] = [
    { customerName: { $regex: escapeRegex(trimmed), $options: "i" } },
  ];

  const rawDigits = normalizePhoneDigits(trimmed);
  if (rawDigits.length >= 4) {
    or.push({ customerPhone: { $regex: escapeRegex(rawDigits) } });
  }

  const canonical = canonicalPhoneDigitsAR(trimmed);
  if (canonical) {
    or.push({ customerPhoneDigits: { $in: customerPhoneDigitsQueryValues(canonical) } });
  }

  return { $or: or };
}

/** month: 1–12 (enero = 1) */
export async function listReservationsForCalendarMonth(
  db: Db,
  year: number,
  month: number,
): Promise<ReservationDoc[]> {
  const last = new Date(year, month, 0).getDate();
  const from = `${year}-${pad2(month)}-01`;
  const to = `${year}-${pad2(month)}-${pad2(last)}`;

  return db
    .collection<ReservationDoc>(COLLECTION)
    .find({
      dateKey: { $gte: from, $lte: to },
      reservationStatus: { $ne: "pending_payment" },
    })
    .sort({ dateKey: 1, timeLocal: 1 })
    .toArray();
}

/** Resumen de clientas agrupadas por WhatsApp (para buscador del panel). */
export async function listClientsSummary(db: Db, opts?: { q?: string; limit?: number }): Promise<ClientSummaryRow[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 80, 1), 200);
  const search = opts?.q?.trim() ? buildClientSearchFilter(opts.q) : null;

  const match: Record<string, unknown> = {
    customerPhoneDigits: { $exists: true, $nin: [null, ""] },
  };
  if (search) {
    match.$and = [search];
  }

  const rows = await db
    .collection<ReservationDoc>(COLLECTION)
    .aggregate<ClientAggregateRow>([
      { $match: match },
      { $sort: { startsAt: -1 } },
      {
        $group: {
          _id: "$customerPhoneDigits",
          customerName: { $first: "$customerName" },
          customerPhone: { $first: "$customerPhone" },
          visitCount: { $sum: 1 },
          lastVisitDateKey: { $first: "$dateKey" },
        },
      },
      { $sort: { lastVisitDateKey: -1 } },
      { $limit: limit },
    ])
    .toArray();

  return rows.map((r) => ({
    phoneDigits: r._id,
    customerName: r.customerName?.trim() || "Cliente",
    customerPhone: r.customerPhone?.trim() || r._id,
    visitCount: r.visitCount,
    lastVisitDateKey: r.lastVisitDateKey,
  }));
}

/** Historial de turnos de una clienta (por teléfono canónico). */
export async function listReservationsByPhoneDigits(db: Db, phoneDigits: string): Promise<ReservationDoc[]> {
  const canonical = canonicalPhoneDigitsAR(phoneDigits) || phoneDigits.trim();
  const keys = customerPhoneDigitsQueryValues(canonical);
  if (keys.length === 0) return [];

  return db
    .collection<ReservationDoc>(COLLECTION)
    .find({ customerPhoneDigits: { $in: keys } })
    .sort({ startsAt: -1 })
    .toArray();
}

/** Nombre de ficha + turnos confirmados/pendientes de hoy y futuros (panel). */
export async function updateCustomerNameForPhone(
  db: Db,
  phoneDigitsCanonical: string,
  displayName: string,
  now = new Date(),
): Promise<{ customerName: string; upcomingUpdated: number } | { error: string; code?: string }> {
  const name = normalizeDisplayName(displayName);
  if (!name) {
    return { error: "El nombre es demasiado corto.", code: "INVALID_NAME" };
  }
  const canonical = canonicalPhoneDigitsAR(phoneDigitsCanonical) || phoneDigitsCanonical.trim();
  if (!canonical || canonical.length < 8) {
    return { error: "Teléfono inválido.", code: "INVALID_PHONE" };
  }

  const saved = await upsertCustomerDisplayName(db, canonical, name);
  if (!saved) {
    return { error: "El nombre es demasiado corto.", code: "INVALID_NAME" };
  }

  const keys = customerPhoneDigitsQueryValues(canonical);
  const todayKey = argentinaTodayDateKey(now);
  const result = await db.collection<ReservationDoc>(COLLECTION).updateMany(
    {
      customerPhoneDigits: { $in: keys },
      reservationStatus: { $in: ["confirmed", "pending_payment"] },
      dateKey: { $gte: todayKey },
    },
    { $set: { customerName: saved, updatedAt: now } },
  );

  return { customerName: saved, upcomingUpdated: result.modifiedCount };
}
