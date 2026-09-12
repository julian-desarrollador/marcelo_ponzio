import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { findCustomerDisplayName } from "@/lib/customer/customer-profiles";
import { isLikelyWhatsappNumber } from "@/lib/booking/salon-availability";
import { canonicalPhoneDigitsAR, customerPhoneDigitsQueryValues } from "@/lib/customer/phone-canonical-ar";
import { logCustomerSessionStart, normalizeSessionEventSource } from "@/lib/customer/session-analytics";
import { CUSTOMER_PROFILE_COOKIE, mintCustomerProfileToken } from "@/lib/customer/customer-session";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_POSTS_PER_WINDOW = 12;
const hits = new Map<string, { windowStart: number; count: number }>();

function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

function allowSessionPost(ip: string): boolean {
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || now - row.windowStart > WINDOW_MS) {
    hits.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (row.count >= MAX_POSTS_PER_WINDOW) return false;
  row.count++;
  return true;
}

export async function POST(request: Request) {
  if (!allowSessionPost(clientIp(request))) {
    return NextResponse.json({ error: "Demasiados intentos. Probá en un minuto." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const phone = typeof body === "object" && body && "phone" in body ? String((body as { phone?: unknown }).phone) : "";
  const source = normalizeSessionEventSource(
    typeof body === "object" && body && "source" in body ? (body as { source?: unknown }).source : undefined,
  );
  if (!isLikelyWhatsappNumber(phone)) {
    return NextResponse.json({ error: "Ingresá un número de WhatsApp válido (10 a 15 dígitos)." }, { status: 400 });
  }

  const digits = canonicalPhoneDigitsAR(phone);
  if (!digits) {
    return NextResponse.json({ error: "Número inválido." }, { status: 400 });
  }

  // Validar que el número tiene al menos una reserva antes de emitir la cookie.
  let customerName: string | null = null;
  try {
    const db = await getDb();
    const keys = customerPhoneDigitsQueryValues(digits);
    const found = await db
      .collection("reservations")
      .findOne<{ customerName?: string }>(
        { customerPhoneDigits: { $in: keys } },
        { projection: { customerName: 1 } },
      );
    if (!found) {
      return NextResponse.json(
        { error: "No encontramos reservas con ese número. Usá el mismo WhatsApp con el que reservaste." },
        { status: 404 },
      );
    }
    customerName = (await findCustomerDisplayName(db, digits)) ?? found.customerName?.trim() ?? null;
  } catch (e) {
    console.error("[api/me/session] db validation", e);
    // Si la DB falla no bloqueamos el login.
  }

  const token = mintCustomerProfileToken(digits);
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_PROFILE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 24 * 60 * 60,
  });

  try {
    const db = await getDb();
    await logCustomerSessionStart(db, {
      phoneDigits: digits,
      userAgent: request.headers.get("user-agent"),
      source,
      customerName,
    });
  } catch (e) {
    console.error("[api/me/session] analytics", e);
  }

  return NextResponse.json({ ok: true as const });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_PROFILE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true as const });
}
