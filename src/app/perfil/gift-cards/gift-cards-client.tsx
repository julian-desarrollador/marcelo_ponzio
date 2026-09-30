"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LightPageHeader } from "@/components/light-page-header";
import { usePerfilSession } from "@/components/perfil/perfil-session-provider";

type GiftCard = {
  code: string;
  title: string;
  description: string;
  treatmentNames: string[];
  status: "active" | "reserved" | "used" | "cancelled" | "expired";
  expiresAt: string;
};

function statusLabel(status: GiftCard["status"]): string {
  if (status === "active") return "Disponible";
  if (status === "reserved") return "En un turno";
  if (status === "used") return "Usada";
  if (status === "cancelled") return "Anulada";
  return "Vencida";
}

function formatUntil(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

export function GiftCardsClient() {
  const { me } = usePerfilSession();
  const [cards, setCards] = useState<GiftCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me !== "authed") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/gift-cards", { credentials: "same-origin", cache: "no-store" });
        const data = (await res.json()) as { giftCards?: GiftCard[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "No se pudieron cargar.");
          setCards([]);
          return;
        }
        setCards(data.giftCards ?? []);
      } catch {
        if (!cancelled) {
          setError("Sin conexión. Probá de nuevo.");
          setCards([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me]);

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-8 pb-28">
      <LightPageHeader
        title="Mis gift cards"
        subtitle="Regalos y promos para usar al reservar"
        backHref="/perfil"
        backLabel="Volver al perfil"
      />

      {me === "guest" ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[16px] text-amber-900">
          Iniciá sesión desde Perfil con tu WhatsApp.{" "}
          <Link href="/perfil#acceso" className="cursor-pointer font-semibold text-[#B88E2F] underline-offset-2 hover:underline">
            Ir a acceso
          </Link>
        </p>
      ) : null}

      {me === "authed" && cards === null ? <p className="text-[16px] text-gray-500">Cargando…</p> : null}
      {error ? <p className="mb-3 text-[15px] text-red-700">{error}</p> : null}

      {me === "authed" && cards && cards.length === 0 && !error ? (
        <p className="text-[16px] leading-relaxed text-gray-600">Todavía no tenés gift cards.</p>
      ) : null}

      <div className="space-y-5">
        {cards?.map((card) => (
          <article
            key={card.code}
            className="overflow-hidden rounded-[24px] border border-[#e4ca69]/40 bg-[#111111] px-5 py-6 text-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
          >
            <p className="text-center text-[11px] font-semibold tracking-[0.28em] text-[#e4ca69]">MARCELO PONZIO</p>
            <p className="mt-1 text-center text-[10px] tracking-[0.32em] text-[#e4ca69]/80">ESTILISTA</p>
            <h2 className="mt-5 text-center font-heading text-[34px] leading-none font-semibold tracking-wide text-[#e4ca69]">
              GIFT CARD
            </h2>
            <p className="mt-4 text-center text-[18px] font-semibold tracking-wide text-white">{card.title}</p>
            {card.description ? (
              <p className="mt-2 text-center text-[14px] leading-snug text-white/75">{card.description}</p>
            ) : null}
            <p className="mt-2 text-center text-[13px] text-white/60">
              {card.treatmentNames.length > 0 ? card.treatmentNames.join(" · ") : "Cualquier servicio"}
            </p>
            <div className="mx-auto mt-5 max-w-[240px] rounded-xl border border-[#e4ca69]/70 px-4 py-3 text-center">
              <p className="text-[10px] tracking-[0.22em] text-[#e4ca69]">CÓDIGO DE CANJE</p>
              <p className="mt-1 text-[20px] font-semibold tracking-[0.12em] text-[#e4ca69]">{card.code}</p>
            </div>
            <p className="mt-4 text-center text-[13px] text-white/70">
              {statusLabel(card.status)} · hasta {formatUntil(card.expiresAt)}
            </p>
            {card.status === "active" ? (
              <Link
                href={`/turnos?giftCard=${encodeURIComponent(card.code)}`}
                className="mt-5 flex h-12 cursor-pointer items-center justify-center rounded-full bg-[#B88E2F] text-[16px] font-semibold text-white"
              >
                Usar al reservar
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </main>
  );
}
