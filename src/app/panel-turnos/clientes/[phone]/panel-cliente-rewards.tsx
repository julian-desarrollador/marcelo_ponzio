"use client";

import { useEffect, useState } from "react";

import { GiftCardImageActions } from "@/components/panel/gift-card-image-actions";
import { panelCard, panelInput, panelLabel, panelPrimaryBtn } from "@/components/panel/panel-ui";
import { formatBirthdayLabel } from "@/lib/rewards/birthday";
import { SALON_TREATMENTS } from "@/lib/treatments/catalog";
import { isOfferedTreatmentId } from "@/lib/treatments/experience-packages";

type GiftCardRow = {
  id: string;
  code: string;
  title: string;
  status: string;
  expiresAt: string;
};

type Props = {
  phoneDigits: string;
  customerName: string;
  customerPhone: string;
  birthdayMonthDay: string | null;
};

const OFFERED = SALON_TREATMENTS.filter((treatment) => isOfferedTreatmentId(treatment.id));

function statusLabel(status: string): string {
  if (status === "active") return "Activa";
  if (status === "reserved") return "En un turno";
  if (status === "used") return "Usada";
  if (status === "cancelled") return "Anulada";
  if (status === "expired") return "Vencida";
  return status;
}

export function PanelClienteRewards({ phoneDigits, customerName, birthdayMonthDay }: Props) {
  const [birthday, setBirthday] = useState(birthdayMonthDay ?? "");
  const [cards, setCards] = useState<GiftCardRow[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [validDays, setValidDays] = useState("90");
  const [treatmentId, setTreatmentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issuedId, setIssuedId] = useState<string | null>(null);

  useEffect(() => {
    setBirthday(birthdayMonthDay ?? "");
  }, [birthdayMonthDay]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/panel-turnos/recompensas/gift-cards?phone=${encodeURIComponent(phoneDigits)}`,
        { credentials: "same-origin" },
      );
      const data = (await res.json()) as { giftCards?: GiftCardRow[] };
      if (!cancelled && res.ok) setCards(data.giftCards ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [phoneDigits]);

  async function saveBirthday() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/panel-turnos/clientes/${encodeURIComponent(phoneDigits)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ birthdayMonthDay: birthday }),
      });
      const data = (await res.json()) as { error?: string; birthdayMonthDay?: string | null };
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el cumpleaños.");
        return;
      }
      setBirthday(data.birthdayMonthDay ?? "");
      setMessage("Cumpleaños guardado.");
    } catch {
      setError("Sin conexión. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function emit() {
    setBusy(true);
    setError(null);
    setIssuedId(null);
    try {
      const res = await fetch("/api/panel-turnos/recompensas/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          phoneDigits,
          customerName,
          title,
          description,
          treatmentIds: treatmentId ? [treatmentId] : [],
          validDays: Number(validDays),
          origin: "manual",
        }),
      });
      const data = (await res.json()) as { error?: string; giftCard?: GiftCardRow; shareText?: string };
      if (!res.ok || !data.giftCard) {
        setError(data.error ?? "No se pudo crear la gift card.");
        return;
      }
      setCards((prev) => [data.giftCard!, ...prev]);
      setIssuedId(data.giftCard.id);
      setOpen(false);
      setTitle("");
      setDescription("");
      setTreatmentId("");
      setMessage(`Gift card creada para ${customerName}.`);
    } catch {
      setError("Sin conexión. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${panelCard} mb-4 p-4`}>
      <h2 className="font-montserrat text-[18px] font-bold text-gray-900">Gift card para {customerName}</h2>
      <p className="mt-1 text-[14px] leading-snug text-gray-600">
        Un regalo o una promo. Ella la ve en su perfil y la usa al reservar, sin pagar seña.
      </p>

      {open ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            void emit();
          }}
        >
          <label className="block">
            <span className={panelLabel}>Qué le regalás</span>
            <input
              className={panelInput}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Servicio completo o 20% off en color"
              autoFocus
            />
          </label>
          <label className="block">
            <span className={panelLabel}>Texto que ve ella</span>
            <textarea
              className={panelInput}
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Opcional. Ej. Feliz cumple."
            />
          </label>
          <label className="block">
            <span className={panelLabel}>Válida por (días)</span>
            <input
              className={panelInput}
              inputMode="numeric"
              value={validDays}
              onChange={(event) => setValidDays(event.target.value)}
            />
          </label>
          <label className="block">
            <span className={panelLabel}>En qué servicio</span>
            <select className={`${panelInput} cursor-pointer`} value={treatmentId} onChange={(event) => setTreatmentId(event.target.value)}>
              <option value="">Cualquier servicio</option>
              {OFFERED.map((treatment) => (
                <option key={treatment.id} value={treatment.id}>
                  {treatment.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy || !title.trim()} className={panelPrimaryBtn}>
            {busy ? "Creando…" : `Crear gift card para ${customerName}`}
          </button>
          <button
            type="button"
            className="h-11 w-full cursor-pointer text-[15px] font-semibold text-gray-600"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`${panelPrimaryBtn} mt-4`}>
          Crear gift card
        </button>
      )}

      {cards.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-gray-100 pt-3">
          {cards.map((card) => (
            <li key={card.id} className="text-[14px] text-gray-800">
              <span className="font-semibold">{card.title}</span>
              <span className="text-gray-500"> · {card.code} · {statusLabel(card.status)}</span>
              <GiftCardImageActions cardId={card.id} code={card.code} preview={card.id === issuedId} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[14px] text-gray-500">Todavía no tiene gift cards.</p>
      )}

      <div className="mt-5 border-t border-gray-100 pt-4">
        <label className="block">
          <span className={panelLabel}>Cumpleaños (día y mes)</span>
          <input
            type="date"
            className={panelInput}
            value={birthday ? `2000-${birthday}` : ""}
            onChange={(event) => {
              const value = event.target.value;
              setBirthday(value.length >= 10 ? value.slice(5) : "");
            }}
          />
        </label>
        <p className="mt-1 text-[13px] text-gray-500">
          {birthday
            ? `${formatBirthdayLabel(birthday)}. Sirve para sugerir el regalo en Recompensas.`
            : "Opcional. Si lo cargás, en Recompensas aparece cuando esté por cumplir."}
        </p>
        <button type="button" disabled={busy} onClick={() => void saveBirthday()} className="mt-3 cursor-pointer text-[14px] font-semibold text-[#B88E2F] disabled:cursor-not-allowed">
          Guardar cumpleaños
        </button>
      </div>

      {message ? <p className="mt-2 text-[13px] font-medium text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-2 text-[13px] text-red-700">{error}</p> : null}
    </section>
  );
}
