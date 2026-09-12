import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { serializePanelClientVisit } from "@/lib/panel/client-serialize";
import { findCustomerDisplayName } from "@/lib/customer/customer-profiles";
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
    const fromProfile = await findCustomerDisplayName(db, canonical);
    return NextResponse.json({
      client: {
        phoneDigits: latest.customerPhoneDigits ?? canonical,
        customerName: fromProfile || latest.customerName.trim() || "Cliente",
        customerPhone: latest.customerPhone.trim() || canonical,
        visitCount: visits.length,
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
  const rawName =
    typeof body === "object" && body && "customerName" in body
      ? String((body as { customerName: unknown }).customerName ?? "")
      : "";

  try {
    const db = await getDb();
    await ensureReservationIndexes(db);
    const visits = await listReservationsByPhoneDigits(db, canonical);
    if (visits.length === 0) {
      return NextResponse.json({ error: "Clienta no encontrada." }, { status: 404 });
    }

    const result = await updateCustomerNameForPhone(db, canonical, rawName);
    if ("error" in result) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    }
    return NextResponse.json({ ok: true as const, customerName: result.customerName });
  } catch (e) {
    console.error("[api/panel-turnos/clientes/[phone] PATCH]", e);
    return NextResponse.json({ error: "No se pudo guardar el nombre." }, { status: 500 });
  }
}
