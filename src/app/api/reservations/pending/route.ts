import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { parseCreateReservationBody } from "@/lib/reservations/parse-body";
import { treatmentRequiresPublicDeposit } from "@/lib/reservations/public-deposit";
import { findSalonTreatmentById } from "@/lib/treatments/catalog";
import {
  insertPendingReservation,
  insertPublicConfirmedReservationWithoutPayment,
} from "@/lib/reservations/service";
import { CUSTOMER_PROFILE_COOKIE, readCustomerProfilePhoneDigits } from "@/lib/customer/customer-session";
import { canonicalPhoneDigitsAR } from "@/lib/customer/phone-canonical-ar";
import { redeemGiftCardForReservation } from "@/lib/rewards/redeem";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = parseCreateReservationBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  const giftCardCode =
    typeof body === "object" && body && "giftCardCode" in body
      ? String((body as { giftCardCode?: unknown }).giftCardCode ?? "").trim()
      : "";

  try {
    const db = await getDb();
    const ids = (parsed.value.serviceIds ?? []).map((v) => v.trim()).filter(Boolean);
    const normalizedIds = ids.length > 0 ? ids : [parsed.value.treatmentId.trim()];
    if (normalizedIds.length === 0 || normalizedIds.some((id) => !findSalonTreatmentById(id))) {
      return NextResponse.json({ error: "Tratamiento inválido.", code: "INVALID_TREATMENT" }, { status: 400 });
    }

    if (giftCardCode) {
      const cookieStore = await cookies();
      const fromCookie = readCustomerProfilePhoneDigits(cookieStore.get(CUSTOMER_PROFILE_COOKIE)?.value);
      const sessionDigits = fromCookie ? canonicalPhoneDigitsAR(fromCookie) : "";
      if (!sessionDigits) {
        return NextResponse.json(
          { error: "Para usar una gift card tenés que entrar a tu perfil.", code: "GIFT_CARD_AUTH" },
          { status: 401 },
        );
      }
      const redeemed = await redeemGiftCardForReservation(
        db,
        { ...parsed.value, giftCardCode },
        sessionDigits,
      );
      if ("error" in redeemed) {
        const status = redeemed.code === "SLOT_TAKEN" ? 409 : redeemed.code === "GIFT_CARD_AUTH" ? 401 : 400;
        return NextResponse.json({ error: redeemed.error, code: redeemed.code }, { status });
      }
      return NextResponse.json(
        { id: redeemed.id, externalReference: redeemed.id, bookingMode: "confirmed" as const },
        { status: 201 },
      );
    }

    const needsDeposit = normalizedIds.some((id) => treatmentRequiresPublicDeposit(id));

    if (needsDeposit) {
      const result = await insertPendingReservation(db, parsed.value);
      if ("error" in result) {
        const status = result.code === "SLOT_TAKEN" ? 409 : 400;
        return NextResponse.json({ error: result.error, code: result.code }, { status });
      }
      return NextResponse.json(
        {
          id: result.id,
          checkoutToken: result.checkoutToken,
          externalReference: result.externalReference,
          bookingMode: "pending_payment" as const,
        },
        { status: 201 },
      );
    }

    const result = await insertPublicConfirmedReservationWithoutPayment(db, parsed.value);
    if ("error" in result) {
      const status = result.code === "SLOT_TAKEN" ? 409 : 400;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }
    return NextResponse.json(
      {
        id: result.id,
        externalReference: result.externalReference,
        bookingMode: "confirmed" as const,
      },
      { status: 201 },
    );
  } catch (e) {
    console.error("[api/reservations/pending POST]", e);
    return NextResponse.json(
      { error: "No se pudo crear la reserva pendiente. Probá de nuevo en unos minutos." },
      { status: 500 },
    );
  }
}
