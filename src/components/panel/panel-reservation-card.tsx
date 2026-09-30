"use client";

import { forwardRef } from "react";
import {
  CalendarClock,
  Check,
  Circle,
  FileText,
  MessageCircle,
  Scissors,
  Smartphone,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";

import {
  isReservationInProgress,
  isReservationTimeFocused,
} from "@/lib/booking/panel-now-focus";
import { trackPanelClick } from "@/lib/analytics/track";
import { canonicalPhoneDigitsAR } from "@/lib/customer/phone-canonical-ar";
import { panelDurationLabel } from "@/lib/treatments/catalog";

import type { PanelReservation } from "@/components/panel/panel-types";

type PanelReservationCardProps = {
  reservation: PanelReservation;
  selectedDateKey: string;
  whatsAppUrl: string | null;
  onRequestCancel: () => void;
  cancelDisabled?: boolean;
};

function ServiceLineIcon({ category, muted }: { category: string; muted?: boolean }) {
  const cls = `h-4 w-4 shrink-0 ${muted ? "text-gray-500" : "text-[#B88E2F]"}`;
  if (category === "Cortes y peinado") return <Scissors className={cls} strokeWidth={1.85} />;
  return <Sparkles className={cls} strokeWidth={1.85} />;
}

function statusChip(reservation: PanelReservation, inProgress: boolean) {
  const { reservationStatus, paymentStatus } = reservation;

  if (reservationStatus === "cancelled") {
    return {
      badge: "Cancelada",
      badgeClass: "bg-gray-100 text-gray-700",
      showCheck: false,
    };
  }
  if (inProgress) {
    return {
      badge: "En curso",
      badgeClass: "bg-gray-200 text-gray-800",
      showCheck: false,
    };
  }
  if (reservationStatus === "pending_payment" || paymentStatus === "pending") {
    return {
      badge: "Pendiente de pago",
      badgeClass: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
      showCheck: false,
    };
  }
  return {
    badge: "Confirmada",
    badgeClass: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
    showCheck: true,
  };
}

function formatWaTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function WhatsAppTrackingBlock({ reservation: r }: { reservation: PanelReservation }) {
  if (r.reservationStatus === "cancelled") {
    if (r.cancelledBy === "whatsapp") {
      return (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] leading-snug text-red-800">
          Canceló el turno respondiendo al recordatorio por WhatsApp.
        </p>
      );
    }
    return null;
  }

  if (r.reservationStatus !== "confirmed" && r.reservationStatus !== "pending_payment") {
    return null;
  }

  const reminderSent = Boolean(r.waReminder24hSentAt);
  const attendanceConfirmed = Boolean(r.waAttendanceConfirmedAt);
  const reminderWhen = r.waReminder24hSentAt ? formatWaTimestamp(r.waReminder24hSentAt) : "";
  const attendanceWhen = r.waAttendanceConfirmedAt ? formatWaTimestamp(r.waAttendanceConfirmedAt) : "";

  return (
    <div className="mt-3 space-y-1.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-gray-500 uppercase">WhatsApp</p>
      <div className="flex items-start gap-2 text-[13px] leading-snug">
        {reminderSent ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} />
        ) : (
          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" strokeWidth={2} />
        )}
        <p className={reminderSent ? "text-gray-800" : "text-gray-500"}>
          <span className="font-medium">Recordatorio 24h:</span>{" "}
          {reminderSent ? `Enviado${reminderWhen ? ` · ${reminderWhen}` : ""}` : "Aún no enviado"}
        </p>
      </div>
      <div className="flex items-start gap-2 text-[13px] leading-snug">
        {attendanceConfirmed ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} />
        ) : (
          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" strokeWidth={2} />
        )}
        <p className={attendanceConfirmed ? "text-gray-800" : "text-gray-500"}>
          <span className="font-medium">Asistencia:</span>{" "}
          {attendanceConfirmed
            ? `Confirmó${attendanceWhen ? ` · ${attendanceWhen}` : ""}`
            : reminderSent
              ? "Sin confirmar"
              : "Pendiente (tras el recordatorio)"}
        </p>
      </div>
    </div>
  );
}

export const PanelReservationCard = forwardRef<HTMLElement, PanelReservationCardProps>(
  function PanelReservationCard(
    { reservation: r, selectedDateKey, whatsAppUrl, onRequestCancel, cancelDisabled = false },
    ref,
  ) {
    const focused = isReservationTimeFocused(r.timeLocal, selectedDateKey);
    const inProgress = isReservationInProgress(r.timeLocal, r.treatmentId, selectedDateKey);
    const chip = statusChip(r, inProgress);
    const duration = panelDurationLabel(r.treatmentName, r.category);
    const customerName = r.customerName.trim() || "Cliente";
    const canManage = r.reservationStatus === "confirmed" || r.reservationStatus === "pending_payment";
    const clientPhoneDigits = canonicalPhoneDigitsAR(r.customerPhone);
    const fichaHref =
      clientPhoneDigits.length >= 8
        ? `/panel-turnos/clientes/${encodeURIComponent(clientPhoneDigits)}`
        : null;

    return (
      <article
        ref={ref}
        className={[
          "overflow-hidden rounded-[22px] border bg-white shadow-[0_6px_24px_rgba(0,0,0,0.08)] transition-shadow",
          focused
            ? "border-[#E8D5A8] ring-2 ring-[#B88E2F]/30"
            : "border-gray-200",
        ].join(" ")}
      >
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between gap-2">
            <span
              className={[
                "rounded-full px-3.5 py-1.5 text-[16px] font-semibold leading-none tabular-nums tracking-tight",
                focused ? "bg-[#F5E6C8] text-[#5C4A1F]" : "bg-gray-100 text-gray-800",
              ].join(" ")}
            >
              {r.timeLocal}
            </span>
            {duration ? (
              <span
                className={[
                  "shrink-0 text-[15px] font-semibold tabular-nums tracking-tight",
                  focused ? "text-[#8B6914]" : "text-gray-600",
                ].join(" ")}
              >
                {duration}
              </span>
            ) : null}
          </div>

          <h3
            className={[
              "mt-3 font-montserrat text-[22px] font-bold leading-tight break-words",
              focused ? "text-gray-900" : "text-gray-800",
            ].join(" ")}
          >
            {customerName}
          </h3>

          <p
            className={[
              "mt-2 flex items-start gap-2 text-[14px] leading-snug",
              focused ? "text-[#8B6914]" : "text-gray-600",
            ].join(" ")}
          >
            <ServiceLineIcon category={r.category} muted={!focused} />
            <span className="min-w-0">{r.treatmentName}</span>
          </p>

          {r.giftCardTitle ? (
            <p className={`mt-2 text-[13px] font-semibold ${focused ? "text-[#8B6914]" : "text-[#B88E2F]"}`}>
              Gift card · {r.giftCardTitle}
            </p>
          ) : null}

          {r.source === "panel" ? (
            <p className={`mt-2 flex items-center gap-1.5 text-[12px] ${focused ? "text-gray-600" : "text-gray-500"}`}>
              <User className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              Carga manual
            </p>
          ) : (
            <p className={`mt-2 flex items-center gap-1.5 text-[12px] ${focused ? "text-gray-600" : "text-gray-500"}`}>
              <Smartphone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              Reservó el usuario
            </p>
          )}

          {fichaHref ? (
            <Link
              href={fichaHref}
              onClick={() => trackPanelClick("ficha_desde_card")}
              className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-[#B88E2F] underline-offset-2 hover:underline"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              Ver ficha
            </Link>
          ) : null}

          <div className="mt-3">
            <span
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold",
                chip.badgeClass,
              ].join(" ")}
            >
              {chip.showCheck ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} /> : null}
              {chip.badge}
            </span>
          </div>

          <WhatsAppTrackingBlock reservation={r} />
        </div>

        {canManage ? (
          <div className="border-t border-gray-100 px-4 pt-3 pb-3.5">
            <Link
              href={`/panel-turnos/reprogramar/${encodeURIComponent(r.id)}`}
              onClick={() => trackPanelClick("reprogramar", "card")}
              className={[
                "flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition active:scale-[0.99]",
                focused
                  ? "bg-[#B88E2F] text-white shadow-sm hover:bg-[#A67D28]"
                  : "border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
              ].join(" ")}
            >
              <CalendarClock className="h-5 w-5 shrink-0" strokeWidth={2} />
              Reprogramar
            </Link>

            <div className="mt-2.5 flex items-center justify-between gap-3">
              {whatsAppUrl ? (
                <a
                  href={whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackPanelClick("whatsapp", "card")}
                  className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 text-[13px] font-medium text-[#1A7A3A] underline-offset-2 hover:underline"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span className="truncate">Enviar WhatsApp</span>
                </a>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => {
                  trackPanelClick("cancel_turno", "open");
                  onRequestCancel();
                }}
                disabled={cancelDisabled}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-[13px] font-medium text-red-600 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </article>
    );
  },
);
