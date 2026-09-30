import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/mongodb";
import { verifyPanelCookie } from "@/lib/panel-turnos-auth";
import { insertRewardRule, listRewardRules, serializeRewardRule, validateRewardRuleInput } from "@/lib/rewards/store";
import type { RewardRuleKind } from "@/lib/rewards/types";

export const dynamic = "force-dynamic";

async function unauthorized() {
  const cookieStore = await cookies();
  return !verifyPanelCookie(cookieStore.get("panel_turnos_auth")?.value);
}

function parseRuleBody(body: unknown) {
  if (!body || typeof body !== "object") return { error: "Cuerpo inválido." as const };
  const b = body as Record<string, unknown>;
  const treatmentIds = Array.isArray(b.treatmentIds) ? b.treatmentIds.map((id) => String(id ?? "")) : [];
  return validateRewardRuleInput({
    kind: String(b.kind ?? "") as RewardRuleKind,
    everyVisits: b.everyVisits == null || b.everyVisits === "" ? undefined : Number(b.everyVisits),
    title: String(b.title ?? ""),
    description: String(b.description ?? ""),
    treatmentIds,
    validDays: Number(b.validDays),
    active: b.active !== false,
  });
}

export async function GET() {
  if (await unauthorized()) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const db = await getDb();
    const rules = await listRewardRules(db);
    return NextResponse.json({ rules: rules.map(serializeRewardRule) });
  } catch (e) {
    console.error("[api/panel-turnos/recompensas/reglas GET]", e);
    return NextResponse.json({ error: "No se pudieron cargar las reglas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (await unauthorized()) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }
  const parsed = parseRuleBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const db = await getDb();
    const rule = await insertRewardRule(db, parsed.value);
    return NextResponse.json({ rule: serializeRewardRule(rule) }, { status: 201 });
  } catch (e) {
    console.error("[api/panel-turnos/recompensas/reglas POST]", e);
    return NextResponse.json({ error: "No se pudo guardar la regla." }, { status: 500 });
  }
}
