import { ObjectId, type Db } from "mongodb";

import { canonicalPhoneDigitsAR, customerPhoneDigitsQueryValues } from "@/lib/customer/phone-canonical-ar";
import { findReservationByHexId } from "@/lib/reservations/service";
import type { CreateReservationInput } from "@/lib/reservations/types";
import { insertPublicConfirmedReservationWithoutPayment } from "@/lib/reservations/service";

import {
  cancelReservedGiftCard,
  claimGiftCard,
  findGiftCardByCode,
  giftCardAppliesToTreatments,
  markGiftCardActiveAgain,
  markGiftCardUsed,
  viewStatus,
} from "./store";
import type { GiftCardDoc } from "./types";

function reservationEnded(startsAt: Date, durationMinutes: number | undefined, now: Date): boolean {
  const minutes = durationMinutes ?? 30;
  return startsAt.getTime() + minutes * 60_000 < now.getTime();
}

/** Alinea reserved/used/active con el turno asociado. Se llama al leer. */
export async function syncGiftCard(db: Db, card: GiftCardDoc, now = new Date()): Promise<GiftCardDoc> {
  if (card.status !== "reserved" || !card.reservationId) return card;
  const reservation = await findReservationByHexId(db, card.reservationId);
  if (!reservation || reservation.reservationStatus === "cancelled") {
    if (card.expiresAt.getTime() <= now.getTime()) {
      await cancelReservedGiftCard(db, card._id, now);
      return { ...card, status: "cancelled", reservationId: null, updatedAt: now };
    }
    await markGiftCardActiveAgain(db, card._id, now);
    return { ...card, status: "active", reservationId: null, updatedAt: now };
  }
  if (reservation.reservationStatus === "confirmed" || reservation.reservationStatus === "completed") {
    const duration = reservation.totalDurationMinutes ?? reservation.durationMinutes;
    if (reservationEnded(reservation.startsAt, duration, now)) {
      await markGiftCardUsed(db, card._id, now);
      return { ...card, status: "used", updatedAt: now };
    }
  }
  return card;
}

export async function syncGiftCards(db: Db, cards: GiftCardDoc[], now = new Date()): Promise<GiftCardDoc[]> {
  const synced: GiftCardDoc[] = [];
  for (const card of cards) {
    synced.push(await syncGiftCard(db, card, now));
  }
  return synced;
}

export async function redeemGiftCardForReservation(
  db: Db,
  input: CreateReservationInput & { giftCardCode: string },
  sessionPhoneDigits: string,
): Promise<{ ok: true; id: string } | { error: string; code?: string }> {
  const now = new Date();
  const code = input.giftCardCode.trim().toUpperCase();
  let card = await findGiftCardByCode(db, code);
  if (!card) return { error: "No encontramos esa gift card.", code: "GIFT_CARD_NOT_FOUND" };
  card = await syncGiftCard(db, card, now);

  const sessionKeys = customerPhoneDigitsQueryValues(sessionPhoneDigits);
  if (!sessionKeys.includes(card.customerPhoneDigits)) {
    return { error: "Esta gift card es de otra cuenta.", code: "GIFT_CARD_FORBIDDEN" };
  }
  const bookingPhone = canonicalPhoneDigitsAR(input.customerPhone);
  if (!bookingPhone || !customerPhoneDigitsQueryValues(bookingPhone).includes(card.customerPhoneDigits)) {
    return {
      error: "El WhatsApp del turno tiene que ser el de la cuenta que tiene la gift card.",
      code: "GIFT_CARD_PHONE",
    };
  }
  if (viewStatus(card, now) !== "active") {
    return { error: "Esta gift card no está disponible.", code: "GIFT_CARD_UNAVAILABLE" };
  }

  const serviceIds = (input.serviceIds ?? []).map((id) => id.trim()).filter(Boolean);
  const selected = serviceIds.length > 0 ? serviceIds : [input.treatmentId.trim()];
  if (!giftCardAppliesToTreatments(card.treatmentIds, selected)) {
    return { error: "Esta gift card no aplica a los servicios elegidos.", code: "GIFT_CARD_TREATMENT" };
  }

  const created = await insertPublicConfirmedReservationWithoutPayment(db, {
    ...input,
    giftCardCode: card.code,
    giftCardTitle: card.title,
  });
  if ("error" in created) return created;

  const claimed = await claimGiftCard(db, card.code, created.id, now);
  if (!claimed) {
    await db.collection("reservations").deleteOne({ _id: new ObjectId(created.id) });
    return { error: "Esta gift card ya se usó. Elegí otra o pagá la seña.", code: "GIFT_CARD_TAKEN" };
  }
  return { ok: true, id: created.id };
}
