import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { findCustomerDisplayName } from "@/lib/customer/customer-profiles";
import { logCustomerDailyActive, normalizeActivitySource } from "@/lib/customer/session-analytics";
import { canonicalPhoneDigitsAR } from "@/lib/customer/phone-canonical-ar";
import { CUSTOMER_PROFILE_COOKIE, readCustomerProfilePhoneDigits } from "@/lib/customer/customer-session";
import { getDb } from "@/lib/mongodb";
import { listReservationsByCustomerPhoneDigits } from "@/lib/reservations/customer-queries";
import { ensureReservationIndexes } from "@/lib/reservations/service";
import { serializeReservationForCustomer } from "@/lib/reservations/customer-public-serialize";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CUSTOMER_PROFILE_COOKIE)?.value;
  const fromCookie = readCustomerProfilePhoneDigits(raw);
  if (!fromCookie) {
    return NextResponse.json({ error: "No iniciaste sesión." }, { status: 401 });
  }
  const digits = canonicalPhoneDigitsAR(fromCookie);
  if (!digits) {
    return NextResponse.json({ error: "No iniciaste sesión." }, { status: 401 });
  }

  try {
    const db = await getDb();
    await ensureReservationIndexes(db);
    const source = normalizeActivitySource(new URL(request.url).searchParams.get("source"));
    const list = await listReservationsByCustomerPhoneDigits(db, digits);
    const profileName = await findCustomerDisplayName(db, digits);
    const fromReservations = list.find((r) => r.customerName?.trim())?.customerName?.trim() ?? null;
    const customerName = profileName ?? fromReservations;
    await logCustomerDailyActive(db, { phoneDigits: digits, source, customerName });
    return NextResponse.json({
      displayName: customerName,
      reservations: list.map(serializeReservationForCustomer),
    });
  } catch (e) {
    console.error("[api/me/reservations]", e);
    return NextResponse.json({ error: "No se pudieron cargar los turnos." }, { status: 500 });
  }
}
