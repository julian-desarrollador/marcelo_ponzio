import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { canonicalPhoneDigitsAR, customerPhoneDigitsQueryValues } from "@/lib/customer/phone-canonical-ar";
import { getDb } from "@/lib/mongodb";
import { verifyPanelCookie } from "@/lib/panel-turnos-auth";
import { syncGiftCards } from "@/lib/rewards/redeem";
import {
  giftCardShareText,
  issueGiftCard,
  listGiftCards,
  serializeGiftCard,
  validateRewardRuleInput,
} from "@/lib/rewards/store";
import type { GiftCardOrigin, RewardRuleKind } from "@/lib/rewards/types";

export const dynamic = "force-dynamic";

function parseOrigin(value: unknown): GiftCardOrigin | null {
  if (value === "birthday" || value === "visits" || value === "manual") return value;
  return null;
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!verifyPanelCookie(cookieStore.get("panel_turnos_auth")?.value)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const phone = new URL(request.url).searchParams.get("phone")?.trim() ?? "";
  const filter = phone
    ? { customerPhoneDigits: { $in: customerPhoneDigitsQueryValues(canonicalPhoneDigitsAR(phone) || phone) } }
    : {};
  try {
    const db = await getDb();
    const cards = await syncGiftCards(db, await listGiftCards(db, filter));
    return NextResponse.json({ giftCards: cards.map((card) => serializeGiftCard(card)) });
  } catch (e) {
    console.error("[api/panel-turnos/recompensas/gift-cards GET]", e);
    return NextResponse.json({ error: "No se pudieron cargar las gift cards." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!verifyPanelCookie(cookieStore.get("panel_turnos_auth")?.value)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const origin = parseOrigin(b.origin);
  if (!origin) return NextResponse.json({ error: "Origen inválido." }, { status: 400 });
  const phoneDigits = canonicalPhoneDigitsAR(String(b.phoneDigits ?? ""));
  if (phoneDigits.length < 8) return NextResponse.json({ error: "Teléfono inválido." }, { status: 400 });
  const ruleId = String(b.ruleId ?? "").trim();
  const occasionKey = String(b.occasionKey ?? "").trim();
  if (origin !== "manual" && (!ruleId || !occasionKey)) {
    return NextResponse.json({ error: "Falta la ocasión de la regla." }, { status: 400 });
  }
  const kind: RewardRuleKind = origin === "birthday" ? "birthday" : "visits";
  const parsed = validateRewardRuleInput({
    kind,
    everyVisits: kind === "visits" ? 1 : undefined,
    title: String(b.title ?? ""),
    description: String(b.description ?? ""),
    treatmentIds: Array.isArray(b.treatmentIds) ? b.treatmentIds.map((id) => String(id ?? "")) : [],
    validDays: Number(b.validDays),
    active: true,
  });
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const db = await getDb();
    const issued = await issueGiftCard(db, {
      customerPhoneDigits: phoneDigits,
      customerName: String(b.customerName ?? ""),
      title: parsed.value.title,
      description: parsed.value.description,
      treatmentIds: parsed.value.treatmentIds,
      validDays: parsed.value.validDays,
      origin,
      ruleId: origin === "manual" ? null : ruleId,
      occasionKey: origin === "manual" ? null : occasionKey,
    });
    if ("error" in issued) {
      const status = issued.code === "DUPLICATE_OCCASION" ? 409 : 400;
      return NextResponse.json({ error: issued.error, code: issued.code }, { status });
    }
    const originHeader = request.headers.get("origin")?.trim() || new URL(request.url).origin;
    return NextResponse.json(
      {
        giftCard: serializeGiftCard(issued.card),
        shareText: giftCardShareText(issued.card, originHeader),
      },
      { status: 201 },
    );
  } catch (e) {
    console.error("[api/panel-turnos/recompensas/gift-cards POST]", e);
    return NextResponse.json({ error: "No se pudo emitir la gift card." }, { status: 500 });
  }
}
