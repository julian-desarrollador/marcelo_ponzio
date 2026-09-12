import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isLikelyWhatsappNumber } from "@/lib/booking/salon-availability";
import {
  deleteCustomerProfilesForPhone,
  findCustomerDisplayName,
  normalizeDisplayName,
  upsertCustomerDisplayName,
} from "@/lib/customer/customer-profiles";
import { canonicalPhoneDigitsAR } from "@/lib/customer/phone-canonical-ar";
import {
  CUSTOMER_PROFILE_COOKIE,
  mintCustomerProfileToken,
  readCustomerProfilePhoneDigits,
} from "@/lib/customer/customer-session";
import { getDb } from "@/lib/mongodb";
import {
  listReservationsByCustomerPhoneDigits,
  phoneHasForeignReservations,
  reassignReservationsToPhone,
} from "@/lib/reservations/customer-queries";

export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE_SEC = 60 * 24 * 60 * 60;

function sessionDigitsOr401(raw: string | undefined) {
  const fromCookie = readCustomerProfilePhoneDigits(raw);
  if (!fromCookie) return null;
  return canonicalPhoneDigitsAR(fromCookie) || null;
}

function setSessionCookie(cookieStore: Awaited<ReturnType<typeof cookies>>, phoneDigits: string) {
  cookieStore.set(CUSTOMER_PROFILE_COOKIE, mintCustomerProfileToken(phoneDigits), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
  });
}

export async function GET() {
  const cookieStore = await cookies();
  const digits = sessionDigitsOr401(cookieStore.get(CUSTOMER_PROFILE_COOKIE)?.value);
  if (!digits) {
    return NextResponse.json({ error: "No iniciaste sesión." }, { status: 401 });
  }

  try {
    const db = await getDb();
    const list = await listReservationsByCustomerPhoneDigits(db, digits);
    const fromReservations = list.find((r) => r.customerName?.trim())?.customerName?.trim() ?? null;
    const displayName = (await findCustomerDisplayName(db, digits)) ?? fromReservations;
    const customerPhone = list.find((r) => r.customerPhone?.trim())?.customerPhone?.trim() || digits;
    return NextResponse.json({ displayName, customerPhone });
  } catch (e) {
    console.error("[api/me/profile GET]", e);
    return NextResponse.json({ error: "No se pudieron cargar tus datos." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const digits = sessionDigitsOr401(cookieStore.get(CUSTOMER_PROFILE_COOKIE)?.value);
  if (!digits) {
    return NextResponse.json({ error: "No iniciaste sesión." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  const rawName =
    typeof body === "object" && body && "displayName" in body
      ? String((body as { displayName: unknown }).displayName ?? "")
      : "";
  const name = normalizeDisplayName(rawName);
  if (!name) {
    return NextResponse.json({ error: "El nombre es demasiado corto." }, { status: 400 });
  }

  const rawPhone =
    typeof body === "object" && body && "customerPhone" in body
      ? String((body as { customerPhone: unknown }).customerPhone ?? "").trim()
      : "";

  try {
    const db = await getDb();
    const now = new Date();

    if (!rawPhone) {
      const saved = await upsertCustomerDisplayName(db, digits, name);
      if (!saved) {
        return NextResponse.json({ error: "El nombre es demasiado corto." }, { status: 400 });
      }
      return NextResponse.json({ ok: true as const, displayName: saved, customerPhone: null, phoneChanged: false });
    }

    if (!isLikelyWhatsappNumber(rawPhone)) {
      return NextResponse.json({ error: "Ingresá un WhatsApp válido (10 a 15 dígitos)." }, { status: 400 });
    }

    const newDigits = canonicalPhoneDigitsAR(rawPhone);
    if (!newDigits) {
      return NextResponse.json({ error: "Ingresá un WhatsApp válido (10 a 15 dígitos)." }, { status: 400 });
    }

    if (newDigits === digits) {
      const saved = await upsertCustomerDisplayName(db, digits, name);
      if (!saved) {
        return NextResponse.json({ error: "El nombre es demasiado corto." }, { status: 400 });
      }
      return NextResponse.json({
        ok: true as const,
        displayName: saved,
        customerPhone: rawPhone,
        phoneChanged: false,
      });
    }

    const taken = await phoneHasForeignReservations(db, newDigits, digits);
    if (taken) {
      return NextResponse.json(
        {
          error: "Ese WhatsApp ya tiene turnos de otra cuenta. Usá un número que no esté en uso.",
        },
        { status: 409 },
      );
    }

    const existingName = await findCustomerDisplayName(db, newDigits);
    if (existingName) {
      return NextResponse.json(
        {
          error: "Ese WhatsApp ya tiene una cuenta. Usá un número que no esté en uso.",
        },
        { status: 409 },
      );
    }

    await reassignReservationsToPhone(db, digits, newDigits, rawPhone, now);
    await deleteCustomerProfilesForPhone(db, digits);
    const saved = (await upsertCustomerDisplayName(db, newDigits, name)) ?? name;
    setSessionCookie(cookieStore, newDigits);

    return NextResponse.json({
      ok: true as const,
      displayName: saved,
      customerPhone: rawPhone,
      phoneChanged: true,
    });
  } catch (e) {
    console.error("[api/me/profile PATCH]", e);
    return NextResponse.json({ error: "No se pudieron guardar tus datos." }, { status: 500 });
  }
}
