import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/mongodb";
import { verifyPanelCookie } from "@/lib/panel-turnos-auth";
import { serializeRewardRule, updateRewardRule, validateRewardRuleInput } from "@/lib/rewards/store";
import type { RewardRuleKind } from "@/lib/rewards/types";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!verifyPanelCookie(cookieStore.get("panel_turnos_auth")?.value)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { id } = await context.params;
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
  const parsed = validateRewardRuleInput({
    kind: String(b.kind ?? "") as RewardRuleKind,
    everyVisits: b.everyVisits == null || b.everyVisits === "" ? undefined : Number(b.everyVisits),
    title: String(b.title ?? ""),
    description: String(b.description ?? ""),
    treatmentIds: Array.isArray(b.treatmentIds) ? b.treatmentIds.map((item) => String(item ?? "")) : [],
    validDays: Number(b.validDays),
    active: b.active !== false,
  });
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const db = await getDb();
    const rule = await updateRewardRule(db, id, parsed.value);
    if (!rule) return NextResponse.json({ error: "Regla no encontrada." }, { status: 404 });
    return NextResponse.json({ rule: serializeRewardRule(rule) });
  } catch (e) {
    console.error("[api/panel-turnos/recompensas/reglas PATCH]", e);
    return NextResponse.json({ error: "No se pudo actualizar la regla." }, { status: 500 });
  }
}
