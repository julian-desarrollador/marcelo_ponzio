import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { CUSTOMER_PROFILE_COOKIE, readCustomerProfilePhoneDigits } from "@/lib/customer/customer-session";
import { canonicalPhoneDigitsAR, customerPhoneDigitsQueryValues } from "@/lib/customer/phone-canonical-ar";
import { getDb } from "@/lib/mongodb";
import { syncGiftCards } from "@/lib/rewards/redeem";
import { listGiftCards, serializeGiftCard } from "@/lib/rewards/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const fromCookie = readCustomerProfilePhoneDigits(cookieStore.get(CUSTOMER_PROFILE_COOKIE)?.value);
  const digits = fromCookie ? canonicalPhoneDigitsAR(fromCookie) : "";
  if (!digits) {
    return NextResponse.json({ error: "No iniciaste sesión." }, { status: 401 });
  }
  try {
    const db = await getDb();
    const cards = await syncGiftCards(
      db,
      await listGiftCards(db, { customerPhoneDigits: { $in: customerPhoneDigitsQueryValues(digits) } }),
    );
    return NextResponse.json({ giftCards: cards.map((card) => serializeGiftCard(card)) });
  } catch (e) {
    console.error("[api/me/gift-cards GET]", e);
    return NextResponse.json({ error: "No se pudieron cargar tus gift cards." }, { status: 500 });
  }
}
