import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { serializePanelClientVisit } from "@/lib/panel/client-serialize";
import { findCustomerDisplayName, findCustomerProfile, setCustomerBirthdayMonthDay } from "@/lib/customer/customer-profiles";
import { parseBirthdayMonthDay } from "@/lib/rewards/birthday";
import { canonicalPhoneDigitsAR } from "@/lib/customer/phone-canonical-ar";
import { getDb } from "@/lib/mongodb";
import { verifyPanelCookie } from "@/lib/panel-turnos-auth";
import { listReservationsByPhoneDigits, updateCustomerNameForPhone } from "@/lib/reservations/admin-queries";
import { ensureReservationIndexes } from "@/lib/reservations/service";

export const dynamic = "force-dynamic";

function parsePhoneParam(phoneParam: string): string | null {
  const phoneDigits = decodeURIComponent(phoneParam).trim();
  const canonical = canonicalPhoneDigitsAR(phoneDigits) || phoneDigits;
  if (!canonical || canonical.length < 8) return null;
  return canonical;
}

export async function GET(_request: Request, context: { params: Promise<{ phone: string }> }) {
  const cookieStore = await cookies();
  if (!verifyPanelCookie(cookieStore.get("panel_turnos_auth")?.value)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { phone: phoneParam } = await context.params;
  const canonical = parsePhoneParam(phoneParam);
  if (!canonical) {
    return NextResponse.json({ error: "Teléfono inválido." }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureReservationIndexes(db);
    const visits = await listReservationsByPhoneDigits(db, canonical);
    if (visits.length === 0) {
      return NextResponse.json({ error: "Clienta no encontrada." }, { status: 404 });
    }

    const latest = visits[0];
    const profile = await findCustomerProfile(db, canonical);
    const fromProfile = profile?.displayName?.trim() || null;
    return NextResponse.json({
      client: {
        phoneDigits: latest.customerPhoneDigits ?? canonical,
        customerName: fromProfile || latest.customerName.trim() || "Cliente",
        customerPhone: latest.customerPhone.trim() || canonical,
        visitCount: visits.length,
        birthdayMonthDay: profile?.birthdayMonthDay?.trim() || null,
      },
      visits: visits.map(serializePanelClientVisit),
    });
  } catch (e) {
    console.error("[api/panel-turnos/clientes/[phone] GET]", e);
    return NextResponse.json({ error: "No se pudo cargar la ficha." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ phone: string }> }) {
  const cookieStore = await cookies();
  if (!verifyPanelCookie(cookieStore.get("panel_turnos_auth")?.value)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { phone: phoneParam } = await context.params;
  const canonical = parsePhoneParam(phoneParam);
  if (!canonical) {
    return NextResponse.json({ error: "Teléfono inválido." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const hasName = typeof body === "object" && body !== null && "customerName" in body;
  const hasBirthday = typeof body === "object" && body !== null && "birthdayMonthDay" in body;
  const rawName = hasName ? String((body as { customerName: unknown }).customerName ?? "") : "";
  const birthday = hasBirthday
    ? parseBirthdayMonthDay((body as { birthdayMonthDay?: unknown }).birthdayMonthDay)
    : undefined;
  if (!hasName && !hasBirthday) {
    return NextResponse.json({ error: "No hay nada para guardar." }, { status: 400 });
  }
  if (birthday === "invalid") {
    return NextResponse.json({ error: "El cumpleaños no es una fecha válida." }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureReservationIndexes(db);
    const visits = await listReservationsByPhoneDigits(db, canonical);
    if (visits.length === 0) {
      return NextResponse.json({ error: "Clienta no encontrada." }, { status: 404 });
    }

    let customerName = visits[0]?.customerName?.trim() || "Cliente";
    if (hasName) {
      const result = await updateCustomerNameForPhone(db, canonical, rawName);
      if ("error" in result) {
        return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
      }
      customerName = result.customerName;
    }
    if (birthday !== undefined) {
      await setCustomerBirthdayMonthDay(db, canonical, birthday, customerName);
    }
    const profile = await findCustomerProfile(db, canonical);
    return NextResponse.json({
      ok: true as const,
      customerName: (await findCustomerDisplayName(db, canonical)) || customerName,
      birthdayMonthDay: profile?.birthdayMonthDay?.trim() || null,
    });
  } catch (e) {
    console.error("[api/panel-turnos/clientes/[phone] PATCH]", e);
    return NextResponse.json({ error: "No se pudo guardar el nombre." }, { status: 500 });
  }
}
