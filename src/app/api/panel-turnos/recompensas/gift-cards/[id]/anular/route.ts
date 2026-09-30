import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/mongodb";
import { verifyPanelCookie } from "@/lib/panel-turnos-auth";
import { cancelGiftCard, serializeGiftCard } from "@/lib/rewards/store";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!verifyPanelCookie(cookieStore.get("panel_turnos_auth")?.value)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const db = await getDb();
    const card = await cancelGiftCard(db, id);
    if (!card) {
      return NextResponse.json(
        { error: "Solo se puede anular una gift card activa que todavía no se usó." },
        { status: 409 },
      );
    }
    return NextResponse.json({ giftCard: serializeGiftCard(card) });
  } catch (e) {
    console.error("[api/panel-turnos/recompensas/gift-cards anular]", e);
    return NextResponse.json({ error: "No se pudo anular la gift card." }, { status: 500 });
  }
}
