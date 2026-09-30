"use client";

import { ChevronLeft, Gift } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GiftCardImageActions } from "@/components/panel/gift-card-image-actions";
import {
  panelBackBtn,
  panelCard,
  panelContainer,
  panelInput,
  panelLabel,
  panelPage,
  panelPrimaryBtn,
} from "@/components/panel/panel-ui";
import { SALON_TREATMENTS } from "@/lib/treatments/catalog";
import { isOfferedTreatmentId } from "@/lib/treatments/experience-packages";

type Rule = {
  id: string;
  kind: "visits" | "birthday";
  everyVisits: number | null;
  title: string;
  description: string;
  treatmentIds: string[];
  treatmentNames: string[];
  validDays: number;
  active: boolean;
};

type Suggestion = {
  kind: "visits" | "birthday";
  phoneDigits: string;
  customerName: string;
  customerPhone: string;
  occasionKey: string;
  ruleId: string;
  title: string;
  description: string;
  treatmentIds: string[];
  validDays: number;
  visitCount: number | null;
  daysUntil: number | null;
};

type GiftCardRow = {
  id: string;
  code: string;
  customerName: string;
  customerPhoneDigits: string;
  title: string;
  description: string;
  treatmentNames: string[];
  status: "active" | "reserved" | "used" | "cancelled" | "expired";
  expiresAt: string;
  origin: string;
};

type Draft = {
  phoneDigits: string;
  customerName: string;
  customerPhone: string;
  title: string;
  description: string;
  treatmentIds: string[];
  validDays: string;
  origin: "birthday" | "visits" | "manual";
  ruleId: string;
  occasionKey: string;
};

type ClientHit = {
  phoneDigits: string;
  customerName: string;
  customerPhone: string;
};

const emptyManualDraft = (): Draft => ({
  phoneDigits: "",
  customerName: "",
  customerPhone: "",
  title: "",
  description: "",
  treatmentIds: [],
  validDays: "90",
  origin: "manual",
  ruleId: "",
  occasionKey: "",
});

const OFFERED = SALON_TREATMENTS.filter((treatment) => isOfferedTreatmentId(treatment.id));

type RuleForm = {
  kind: "visits" | "birthday";
  everyVisits: string;
  title: string;
  description: string;
  treatmentIds: string[];
  validDays: string;
  active: boolean;
};

const emptyRule: RuleForm = {
  kind: "visits",
  everyVisits: "5",
  title: "",
  description: "",
  treatmentIds: [],
  validDays: "90",
  active: true,
};

function statusLabel(status: GiftCardRow["status"]): string {
  switch (status) {
    case "active":
      return "Activa";
    case "reserved":
      return "En un turno";
    case "used":
      return "Usada";
    case "cancelled":
      return "Anulada";
    case "expired":
      return "Vencida";
    default:
      return status;
  }
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

function suggestionLine(item: Suggestion): string {
  if (item.kind === "birthday") {
    if (item.daysUntil === 0) return "Cumple hoy";
    if (item.daysUntil === 1) return "Cumple mañana";
    return `Cumple en ${item.daysUntil ?? "?"} días`;
  }
  const milestone = item.occasionKey.replace("visits:", "");
  return `${item.visitCount ?? milestone} visitas · hito ${milestone}`;
}

function TreatmentChecks({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2">
      <label className="flex cursor-pointer items-center gap-2 px-1 py-1 text-[14px] text-gray-700">
        <input
          type="checkbox"
          checked={selected.length === 0}
          onChange={() => onChange([])}
          className="h-4 w-4 cursor-pointer accent-[#B88E2F]"
        />
        Cualquier servicio
      </label>
      {OFFERED.map((treatment) => (
        <label key={treatment.id} className="flex cursor-pointer items-center gap-2 px-1 py-1 text-[14px] text-gray-800">
          <input
            type="checkbox"
            checked={selected.includes(treatment.id)}
            onChange={() => {
              const next = selected.includes(treatment.id)
                ? selected.filter((id) => id !== treatment.id)
                : [...selected, treatment.id];
              onChange(next);
            }}
            className="h-4 w-4 cursor-pointer accent-[#B88E2F]"
          />
          {treatment.name}
        </label>
      ))}
    </div>
  );
}

export function PanelRecompensasClient() {
  const [tab, setTab] = useState<"regalar" | "emitidas" | "reglas">("regalar");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [cards, setCards] = useState<GiftCardRow[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientHits, setClientHits] = useState<ClientHit[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<{ id: string; code: string } | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleForm>(emptyRule);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sugRes, cardRes, ruleRes] = await Promise.all([
        fetch("/api/panel-turnos/recompensas/sugerencias", { credentials: "same-origin" }),
        fetch("/api/panel-turnos/recompensas/gift-cards", { credentials: "same-origin" }),
        fetch("/api/panel-turnos/recompensas/reglas", { credentials: "same-origin" }),
      ]);
      const sugData = (await sugRes.json()) as { suggestions?: Suggestion[]; error?: string };
      const cardData = (await cardRes.json()) as { giftCards?: GiftCardRow[]; error?: string };
      const ruleData = (await ruleRes.json()) as { rules?: Rule[]; error?: string };
      if (!sugRes.ok || !cardRes.ok || !ruleRes.ok) {
        setError(sugData.error || cardData.error || ruleData.error || "No se pudo cargar.");
        return;
      }
      setSuggestions(sugData.suggestions ?? []);
      setCards(cardData.giftCards ?? []);
      setRules(ruleData.rules ?? []);
    } catch {
      setError("Sin conexión. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!draft || draft.origin !== "manual" || draft.phoneDigits) return;
    const q = clientQuery.trim();
    if (q.length < 2) {
      setClientHits([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearchingClients(true);
      void fetch(`/api/panel-turnos/clientes?q=${encodeURIComponent(q)}&limit=8`, {
        credentials: "same-origin",
      })
        .then(async (res) => {
          const data = (await res.json()) as { clients?: ClientHit[] };
          if (!cancelled && res.ok) setClientHits(data.clients ?? []);
        })
        .catch(() => {
          if (!cancelled) setClientHits([]);
        })
        .finally(() => {
          if (!cancelled) setSearchingClients(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [clientQuery, draft]);

  const activeCount = useMemo(() => cards.filter((card) => card.status === "active").length, [cards]);

  async function emit(current: Draft) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/panel-turnos/recompensas/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          phoneDigits: current.phoneDigits,
          customerName: current.customerName,
          title: current.title,
          description: current.description,
          treatmentIds: current.treatmentIds,
          validDays: Number(current.validDays),
          origin: current.origin,
          ruleId: current.ruleId || undefined,
          occasionKey: current.occasionKey || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; giftCard?: { id: string; code: string } };
      if (!res.ok || !data.giftCard) {
        setError(data.error ?? "No se pudo emitir.");
        return;
      }
      setDraft(null);
      setShare({ id: data.giftCard.id, code: data.giftCard.code });
      await load();
      setTab("emitidas");
    } catch {
      setError("Sin conexión. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function anular(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/panel-turnos/recompensas/gift-cards/${encodeURIComponent(id)}/anular`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo anular.");
        return;
      }
      await load();
    } catch {
      setError("Sin conexión. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRule() {
    setBusy(true);
    setError(null);
    const payload = {
      kind: ruleForm.kind,
      everyVisits: ruleForm.kind === "visits" ? Number(ruleForm.everyVisits) : undefined,
      title: ruleForm.title,
      description: ruleForm.description,
      treatmentIds: ruleForm.treatmentIds,
      validDays: Number(ruleForm.validDays),
      active: ruleForm.active,
    };
    try {
      const res = await fetch(
        editingRuleId
          ? `/api/panel-turnos/recompensas/reglas/${encodeURIComponent(editingRuleId)}`
          : "/api/panel-turnos/recompensas/reglas",
        {
          method: editingRuleId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar la regla.");
        return;
      }
      setRuleForm(emptyRule);
      setEditingRuleId(null);
      await load();
    } catch {
      setError("Sin conexión. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function editRule(rule: Rule) {
    setEditingRuleId(rule.id);
    setRuleForm({
      kind: rule.kind,
      everyVisits: String(rule.everyVisits ?? 5),
      title: rule.title,
      description: rule.description,
      treatmentIds: rule.treatmentIds,
      validDays: String(rule.validDays),
      active: rule.active,
    });
    setTab("reglas");
  }

  return (
    <div className={`${panelPage} bg-[#F0F1F3]`}>
      <div className={`${panelContainer} pt-6`}>
        <header className="mb-5 flex items-start gap-3">
          <Link href="/panel-turnos" className={panelBackBtn} aria-label="Volver a la agenda">
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-gray-500">Panel</p>
            <h1 className="font-montserrat text-[22px] font-bold text-gray-900">Recompensas</h1>
            <p className="mt-1 text-[14px] text-gray-500">
              {activeCount} {activeCount === 1 ? "gift card activa" : "gift cards activas"}
            </p>
          </div>
        </header>

        <button
          type="button"
          onClick={() => {
            setClientQuery("");
            setClientHits([]);
            setDraft(emptyManualDraft());
          }}
          className={`${panelPrimaryBtn} mb-4`}
        >
          Crear gift card
        </button>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {(
            [
              ["regalar", "Para regalar"],
              ["emitidas", "Emitidas"],
              ["reglas", "Reglas"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`h-10 cursor-pointer rounded-xl text-[13px] font-semibold ${
                tab === id ? "bg-[#B88E2F] text-white" : "border border-gray-200 bg-white text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-800">
            {error}
          </p>
        ) : null}

        {share ? (
          <div className={`${panelCard} mb-4 p-4`}>
            <p className="text-[15px] font-semibold text-gray-900">Gift card lista</p>
            <p className="mt-1 text-[13px] text-gray-500">Descargala o compartila y adjuntala en WhatsApp.</p>
            <GiftCardImageActions cardId={share.id} code={share.code} preview />
          </div>
        ) : null}

        {loading ? <p className="text-[15px] text-gray-500">Cargando…</p> : null}

        {!loading && tab === "regalar" ? (
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <p className="rounded-2xl bg-white px-4 py-4 text-[15px] text-gray-600">
                No hay cumpleaños ni hitos de visitas para regalar. Cargá una regla o el cumpleaños en la ficha.
              </p>
            ) : (
              suggestions.map((item) => (
                <article key={`${item.ruleId}-${item.phoneDigits}-${item.occasionKey}`} className={`${panelCard} p-4`}>
                  <p className="text-[12px] font-semibold tracking-wide text-[#B88E2F] uppercase">
                    {item.kind === "birthday" ? "Cumpleaños" : "Visitas"}
                  </p>
                  <h2 className="mt-1 font-montserrat text-[18px] font-bold text-gray-900">{item.customerName}</h2>
                  <p className="mt-1 text-[14px] text-gray-600">{suggestionLine(item)}</p>
                  <p className="mt-2 text-[15px] text-gray-800">{item.title}</p>
                  <button
                    type="button"
                    className={`${panelPrimaryBtn} mt-3 h-11`}
                    onClick={() =>
                      setDraft({
                        phoneDigits: item.phoneDigits,
                        customerName: item.customerName,
                        customerPhone: item.customerPhone,
                        title: item.title,
                        description: item.description,
                        treatmentIds: item.treatmentIds,
                        validDays: String(item.validDays),
                        origin: item.kind,
                        ruleId: item.ruleId,
                        occasionKey: item.occasionKey,
                      })
                    }
                  >
                    Crear gift card
                  </button>
                </article>
              ))
            )}
          </div>
        ) : null}

        {!loading && tab === "emitidas" ? (
          <div className="space-y-3">
            {cards.length === 0 ? (
              <p className="rounded-2xl bg-white px-4 py-4 text-[15px] text-gray-600">Todavía no hay gift cards.</p>
            ) : (
              cards.map((card) => (
                <article key={card.id} className={`${panelCard} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-montserrat text-[17px] font-bold text-gray-900">{card.customerName}</p>
                      <p className="text-[14px] text-gray-700">{card.title}</p>
                      <p className="mt-1 text-[13px] tracking-wide text-[#8B6914]">{card.code}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[12px] font-semibold text-gray-700">
                      {statusLabel(card.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] text-gray-500">Vence {formatWhen(card.expiresAt)}</p>
                  {card.treatmentNames.length > 0 ? (
                    <p className="mt-1 text-[13px] text-gray-500">{card.treatmentNames.join(", ")}</p>
                  ) : (
                    <p className="mt-1 text-[13px] text-gray-500">Cualquier servicio</p>
                  )}
                  <GiftCardImageActions cardId={card.id} code={card.code} />
                  {card.status === "active" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void anular(card.id)}
                      className="mt-3 cursor-pointer text-[14px] font-semibold text-red-700"
                    >
                      Anular
                    </button>
                  ) : null}
                </article>
              ))
            )}
          </div>
        ) : null}

        {!loading && tab === "reglas" ? (
          <div className="space-y-4">
            <form
              className={`${panelCard} space-y-3 p-4`}
              onSubmit={(event) => {
                event.preventDefault();
                void saveRule();
              }}
            >
              <p className="text-[15px] font-semibold text-gray-900">
                {editingRuleId ? "Editar regla" : "Nueva regla"}
              </p>
              <label className="block">
                <span className={panelLabel}>Tipo</span>
                <select
                  className={panelInput}
                  value={ruleForm.kind}
                  onChange={(event) =>
                    setRuleForm((prev) => ({ ...prev, kind: event.target.value as "visits" | "birthday" }))
                  }
                >
                  <option value="visits">Cada N visitas</option>
                  <option value="birthday">Cumpleaños</option>
                </select>
              </label>
              {ruleForm.kind === "visits" ? (
                <label className="block">
                  <span className={panelLabel}>Cada cuántas visitas</span>
                  <input
                    className={panelInput}
                    inputMode="numeric"
                    value={ruleForm.everyVisits}
                    onChange={(event) => setRuleForm((prev) => ({ ...prev, everyVisits: event.target.value }))}
                  />
                </label>
              ) : null}
              <label className="block">
                <span className={panelLabel}>Beneficio</span>
                <input
                  className={panelInput}
                  value={ruleForm.title}
                  onChange={(event) => setRuleForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Ej. 20% off en color"
                />
              </label>
              <label className="block">
                <span className={panelLabel}>Detalle</span>
                <textarea
                  className={panelInput}
                  rows={2}
                  value={ruleForm.description}
                  onChange={(event) => setRuleForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>
              <label className="block">
                <span className={panelLabel}>Válida (días)</span>
                <input
                  className={panelInput}
                  inputMode="numeric"
                  value={ruleForm.validDays}
                  onChange={(event) => setRuleForm((prev) => ({ ...prev, validDays: event.target.value }))}
                />
              </label>
              <div>
                <span className={panelLabel}>Aplica a</span>
                <TreatmentChecks
                  selected={ruleForm.treatmentIds}
                  onChange={(treatmentIds) => setRuleForm((prev) => ({ ...prev, treatmentIds }))}
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[14px] text-gray-800">
                <input
                  type="checkbox"
                  checked={ruleForm.active}
                  onChange={(event) => setRuleForm((prev) => ({ ...prev, active: event.target.checked }))}
                  className="h-4 w-4 cursor-pointer accent-[#B88E2F]"
                />
                Activa
              </label>
              <button type="submit" disabled={busy} className={panelPrimaryBtn}>
                {editingRuleId ? "Guardar cambios" : "Crear regla"}
              </button>
            </form>

            {rules.map((rule) => (
              <article key={rule.id} className={`${panelCard} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-montserrat text-[16px] font-bold text-gray-900">{rule.title}</p>
                    <p className="mt-1 text-[13px] text-gray-500">
                      {rule.kind === "birthday" ? "Cumpleaños" : `Cada ${rule.everyVisits} visitas`} · {rule.validDays}{" "}
                      días · {rule.active ? "Activa" : "Pausada"}
                    </p>
                  </div>
                  <Gift className="h-5 w-5 text-[#B88E2F]" />
                </div>
                <button type="button" onClick={() => editRule(rule)} className="mt-2 cursor-pointer text-[14px] font-semibold text-[#B88E2F]">
                  Editar
                </button>
              </article>
            ))}
          </div>
        ) : null}

        {draft ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 py-6 sm:items-center">
            <form
              className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
              onSubmit={(event) => {
                event.preventDefault();
                if (!draft.phoneDigits || !draft.title.trim()) return;
                void emit(draft);
              }}
            >
              <h2 className="font-montserrat text-[20px] font-bold text-gray-900">Crear gift card</h2>
              <p className="mt-1 text-[14px] leading-snug text-gray-600">
                Elegí a quién se la regalás y qué incluye. Ella la ve en su perfil y la usa al reservar.
              </p>
              {draft.origin === "manual" && !draft.phoneDigits ? (
                <div className="mt-4">
                  <label className="block">
                    <span className={panelLabel}>Clienta</span>
                    <input
                      className={panelInput}
                      value={clientQuery}
                      onChange={(event) => setClientQuery(event.target.value)}
                      placeholder="Nombre o WhatsApp"
                      autoFocus
                    />
                  </label>
                  {searchingClients ? <p className="mt-2 text-[13px] text-gray-500">Buscando…</p> : null}
                  {clientHits.length > 0 ? (
                    <ul className="mt-2 overflow-hidden rounded-xl border border-gray-200">
                      {clientHits.map((client) => (
                        <li key={client.phoneDigits}>
                          <button
                            type="button"
                            className="flex w-full cursor-pointer flex-col px-3 py-2.5 text-left hover:bg-gray-50"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                phoneDigits: client.phoneDigits,
                                customerName: client.customerName,
                                customerPhone: client.customerPhone,
                              })
                            }
                          >
                            <span className="text-[15px] font-semibold text-gray-900">{client.customerName}</span>
                            <span className="text-[13px] text-gray-500">{client.customerPhone}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-[15px] font-semibold text-gray-900">
                  Para {draft.customerName}
                  <span className="ml-1 font-normal text-gray-500">{draft.customerPhone || draft.phoneDigits}</span>
                </p>
              )}
              {draft.phoneDigits ? (
                <>
                  <label className="mt-4 block">
                    <span className={panelLabel}>Qué le regalás</span>
                    <input
                      className={panelInput}
                      value={draft.title}
                      onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                      placeholder="Ej. Servicio completo o 20% off en color"
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className={panelLabel}>Texto que ve ella</span>
                    <textarea
                      className={panelInput}
                      rows={2}
                      value={draft.description}
                      onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                      placeholder="Opcional. Ej. Para que te des un gusto en el salón."
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className={panelLabel}>Válida por (días)</span>
                    <input
                      className={panelInput}
                      inputMode="numeric"
                      value={draft.validDays}
                      onChange={(event) => setDraft({ ...draft, validDays: event.target.value })}
                    />
                    <span className="mt-1 block text-[13px] text-gray-500">Después de esa fecha no se puede usar.</span>
                  </label>
                  <div className="mt-3">
                    <span className={panelLabel}>En qué servicio</span>
                    <TreatmentChecks
                      selected={draft.treatmentIds}
                      onChange={(treatmentIds) => setDraft({ ...draft, treatmentIds })}
                    />
                    <span className="mt-1 block text-[13px] text-gray-500">
                      Si no marcás ninguno, sirve para cualquier servicio.
                    </span>
                  </div>
                  <button type="submit" disabled={busy || !draft.title.trim()} className={`${panelPrimaryBtn} mt-4`}>
                    {busy ? "Creando…" : "Crear gift card"}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="mt-2 h-11 w-full cursor-pointer text-[15px] font-semibold text-gray-600"
                onClick={() => setDraft(null)}
              >
                Cancelar
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
