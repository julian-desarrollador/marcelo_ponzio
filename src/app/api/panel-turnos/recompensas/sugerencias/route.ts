import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/mongodb";
import { verifyPanelCookie } from "@/lib/panel-turnos-auth";
import { listRewardSuggestions } from "@/lib/rewards/eligibility";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  if (!verifyPanelCookie(cookieStore.get("panel_turnos_auth")?.value)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  try {
    const db = await getDb();
    const suggestions = await listRewardSuggestions(db);
    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("[api/panel-turnos/recompensas/sugerencias GET]", e);
    return NextResponse.json({ error: "No se pudieron cargar las sugerencias." }, { status: 500 });
  }
}
