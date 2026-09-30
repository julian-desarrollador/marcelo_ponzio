import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/mongodb";
import { verifyPanelCookie } from "@/lib/panel-turnos-auth";
import { renderGiftCardJpeg } from "@/lib/rewards/gift-card-image";
import { findGiftCardById } from "@/lib/rewards/store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!verifyPanelCookie(cookieStore.get("panel_turnos_auth")?.value)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const db = await getDb();
    const card = await findGiftCardById(db, id);
    if (!card) {
      return NextResponse.json({ error: "No se encontró la gift card." }, { status: 404 });
    }
    const jpeg = await renderGiftCardJpeg({
      customerName: card.customerName,
      title: card.title,
      description: card.description,
      code: card.code,
      expiresAt: card.expiresAt,
    });
    return new NextResponse(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[api/panel-turnos/recompensas/gift-cards imagen]", e);
    return NextResponse.json({ error: "No se pudo armar la imagen." }, { status: 500 });
  }
}
