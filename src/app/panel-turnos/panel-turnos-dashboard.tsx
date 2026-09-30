"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Gift,
  Lock,
  Plus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DesignUpdateAnnouncement } from "@/components/announcements/design-update-announcement";
import { PanelBlockCard } from "@/components/panel/panel-block-card";
import { PanelReservationCard } from "@/components/panel/panel-reservation-card";
import type { PanelAgendaBlock, PanelReservation } from "@/components/panel/panel-types";
import {
  panelCard,
  panelChip,
  panelContainer,
  panelDayDefault,
  panelDayOutside,
  panelDaySelected,
  panelPage,
} from "@/components/panel/panel-ui";
import { agendaBlockAppliesToDateKey } from "@/lib/booking/agenda-blocks-shared";
import {
  PANEL_WEEK_LETTERS,
  buildPanelMonthGrid,
  panelMonthTitle,
} from "@/lib/booking/panel-month-grid";
import { pickScrollToReservationId } from "@/lib/booking/panel-now-focus";
import { trackPanelClick } from "@/lib/analytics/track";
import { argentinaTodayDateKey } from "@/lib/booking/public-slot-lead";

export type { PanelAgendaBlock, PanelReservation } from "@/components/panel/panel-types";

type DayRow = { kind: "reservation"; item: PanelReservation } | { kind: "block"; item: PanelAgendaBlock };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayYmd(local: Date) {
  return `${local.getFullYear()}-${pad2(local.getMonth() + 1)}-${pad2(local.getDate())}`;
}

function weekdayLongFromKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const w = new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(dt);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function dayLongFromKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" }).format(dt);
}

function digitsOnlyPhone(s: string) {
  return s.replace(/\D/g, "");
}

/** Dígitos internacionales para wa.me (Argentina centrado, sin +). */
function whatsAppDigitsFromStoredPhone(raw: string): string | null {
  const d = digitsOnlyPhone(raw);
  if (d.length < 10 || d.length > 15) return null;
  if (d.startsWith("54")) return d;
  if (d.length === 11 && d.startsWith("9")) return `54${d}`;
  if (d.length === 10) return `549${d}`;
  return `54${d}`;
}

function whatsAppChatUrl(
  phoneRaw: string,
  opts: { customerName: string; displayDate: string; timeLocal: string; treatmentName: string },
): string | null {
  const n = whatsAppDigitsFromStoredPhone(phoneRaw);
  if (!n) return null;
  const name = opts.customerName.trim();
  const greet = name ? `Hola ${name}` : "Hola";
  const text = `${greet}, te escribimos desde Marcelo Ponzio Estilista por tu turno: ${opts.treatmentName}, ${opts.displayDate} a las ${opts.timeLocal}.`;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export function PanelTurnosDashboard() {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [list, setList] = useState<PanelReservation[]>([]);
  const [agendaBlocks, setAgendaBlocks] = useState<PanelAgendaBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null);
  const [cancelConfirmReservationId, setCancelConfirmReservationId] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const [clockTick, setClockTick] = useState(0);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const grid = useMemo(() => buildPanelMonthGrid(year, month), [year, month]);
  const todayKey = todayYmd(now);

  const [selectedKey, setSelectedKey] = useState<string>(() => {
    const key = todayYmd(now);
    const [y, m] = key.split("-").map(Number);
    if (y === now.getFullYear() && m === now.getMonth() + 1) return key;
    return `${year}-${pad2(month)}-01`;
  });

  useEffect(() => {
    const curFirst = `${year}-${pad2(month)}-01`;
    const curLast = new Date(year, month, 0).getDate();
    const curLastKey = `${year}-${pad2(month)}-${pad2(curLast)}`;
    if (selectedKey >= curFirst && selectedKey <= curLastKey) return;

    if (todayKey >= curFirst && todayKey <= curLastKey) {
      setSelectedKey(todayKey);
      return;
    }
    setSelectedKey(curFirst);
  }, [year, month, selectedKey, todayKey]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/panel-turnos/reservations?year=${year}&month=${month}`);
        const data = (await res.json()) as {
          reservations?: PanelReservation[];
          agendaBlocks?: PanelAgendaBlock[];
          error?: string;
        };
        if (!res.ok) {
          if (res.status === 401) router.refresh();
          return;
        }
        if (alive) {
          setList(data.reservations ?? []);
          setAgendaBlocks(data.agendaBlocks ?? []);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [year, month, router, refreshTick]);

  const visibleReservations = useMemo(() => {
    if (showCancelled) return list;
    return list.filter((r) => r.reservationStatus !== "cancelled");
  }, [list, showCancelled]);

  const combinedCountsByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of visibleReservations) {
      m.set(r.dateKey, (m.get(r.dateKey) ?? 0) + 1);
    }
    for (const cell of grid) {
      const key = cell.dateKey;
      for (const b of agendaBlocks) {
        if (agendaBlockAppliesToDateKey(b, key)) {
          m.set(key, (m.get(key) ?? 0) + 1);
        }
      }
    }
    return m;
  }, [visibleReservations, agendaBlocks, grid]);

  const cancelledCountSelectedDay = useMemo(
    () => list.filter((r) => r.dateKey === selectedKey && r.reservationStatus === "cancelled").length,
    [list, selectedKey],
  );
  const cancelledLabel = cancelledCountSelectedDay === 1 ? "Cancelada" : "Canceladas";

  const dayRows = useMemo(() => {
    const rows: DayRow[] = [];
    for (const r of visibleReservations) {
      if (r.dateKey === selectedKey) rows.push({ kind: "reservation", item: r });
    }
    for (const b of agendaBlocks) {
      if (agendaBlockAppliesToDateKey(b, selectedKey)) {
        rows.push({ kind: "block", item: b });
      }
    }
    rows.sort((a, b) => {
      const ta = a.item.timeLocal;
      const tb = b.item.timeLocal;
      return ta.localeCompare(tb);
    });
    return rows;
  }, [visibleReservations, agendaBlocks, selectedKey]);

  const scrollTargetId = useMemo(() => {
    const dayReservations = visibleReservations.filter((r) => r.dateKey === selectedKey);
    return pickScrollToReservationId(dayReservations, selectedKey);
  }, [visibleReservations, selectedKey, clockTick]);

  useEffect(() => {
    const id = window.setInterval(() => setClockTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (loading || !scrollTargetId) return;
    const el = cardRefs.current[scrollTargetId];
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [scrollTargetId, loading, dayRows.length, selectedKey]);

  const reloadMonth = useCallback(() => {
    setRefreshTick((t) => t + 1);
  }, []);

  async function handleDeleteBlock(blockId: string) {
    if (!window.confirm("¿Eliminar este bloqueo de agenda?")) return;
    const res = await fetch(`/api/panel-turnos/agenda-blocks?id=${encodeURIComponent(blockId)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!res.ok) return;
    trackPanelClick("delete_block", "confirmed");
    reloadMonth();
  }

  async function handleCancelReservation(reservationId: string) {
    setCancellingReservationId(reservationId);
    try {
      const res = await fetch(`/api/panel-turnos/reservations/${encodeURIComponent(reservationId)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) return;
      trackPanelClick("cancel_turno", "confirmed");
      reloadMonth();
    } finally {
      setCancellingReservationId(null);
    }
  }

  async function handleLogout() {
    trackPanelClick("panel_logout");
    setLogoutBusy(true);
    await fetch("/api/panel-turnos/logout", { method: "POST" });
    router.refresh();
    setLogoutBusy(false);
  }

  function prevMonth() {
    trackPanelClick("calendar_nav", "prev_month");
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
      return;
    }
    setMonth((m) => m - 1);
  }

  function nextMonth() {
    trackPanelClick("calendar_nav", "next_month");
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
      return;
    }
    setMonth((m) => m + 1);
  }

  return (
    <div className={`${panelPage} bg-[#F0F1F3]`}>
      <div className={`${panelContainer} pt-6`}>
        <header className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-gray-500">Panel</p>
              <h1 className="font-montserrat text-[22px] font-bold leading-tight text-gray-900">Agenda del salón</h1>
              <p className="mt-1 text-[14px] text-gray-500">Marcelo Ponzio Estilista</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href="/panel-turnos/nuevo"
              onClick={() => trackPanelClick("agregar_turno")}
              className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#B88E2F] text-[14px] font-semibold text-white shadow-md transition active:scale-[0.98]"
            >
              <Plus className="h-5 w-5" strokeWidth={2.2} />
              Agregar turno
            </Link>
            <Link
              href="/panel-turnos/bloqueo"
              onClick={() => trackPanelClick("bloquear_horario")}
              className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 text-[14px] font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              <Lock className="h-5 w-5" strokeWidth={2.2} />
              Bloquear horario
            </Link>
          </div>

          <Link
            href="/panel-turnos/clientes"
            onClick={() => trackPanelClick("clientes_open_list")}
            className="mt-3 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white text-[14px] font-semibold text-gray-800 shadow-sm transition hover:border-[#B88E2F]/30 hover:bg-gray-50"
          >
            <Users className="h-5 w-5 text-[#B88E2F]" strokeWidth={2.2} />
            Clientes
          </Link>
          <Link
            href="/panel-turnos/recompensas"
            onClick={() => trackPanelClick("recompensas_open")}
            className="mt-3 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white text-[14px] font-semibold text-gray-800 shadow-sm transition hover:border-[#B88E2F]/30 hover:bg-gray-50"
          >
            <Gift className="h-5 w-5 text-[#B88E2F]" strokeWidth={2.2} />
            Recompensas
          </Link>
        </header>

        <section className={`mt-5 ${panelCard} p-4`}>
          <div className="relative mb-3 flex items-center justify-center px-10">
            <button
              type="button"
              onClick={prevMonth}
              className="absolute left-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-center text-[15px] font-semibold capitalize tracking-tight text-gray-900">
              {panelMonthTitle(year, month)}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="absolute right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] font-semibold tracking-wide text-gray-400">
            {PANEL_WEEK_LETTERS.map((L) => (
              <div key={L} className="py-2">
                {L}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-2 text-center">
            {grid.map((cell) => {
              const sel = cell.dateKey === selectedKey;
              const count = combinedCountsByDay.get(cell.dateKey) ?? 0;
              const inMonth = cell.inMonth;

              return (
                <button
                  key={`${cell.dateKey}-${cell.inMonth}-${cell.day}`}
                  type="button"
                  onClick={() => setSelectedKey(cell.dateKey)}
                  className="flex w-full cursor-pointer flex-col items-center py-1"
                >
                  <span
                    className={[
                      "flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-semibold leading-none transition",
                      inMonth ? panelDayDefault : panelDayOutside,
                      sel ? panelDaySelected : "",
                    ].join(" ")}
                  >
                    {cell.day}
                  </span>
                  <span className="mt-0.5 flex h-2 items-center justify-center">
                    {count > 0 ? (
                      <span className="block h-1.5 w-1.5 rounded-full bg-[#B88E2F]" />
                    ) : (
                      <span className="block h-1.5 w-1.5 rounded-full bg-transparent" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[22px] font-bold leading-tight tracking-tight text-gray-900">
              {weekdayLongFromKey(selectedKey)}
            </p>
            <p className="mt-0.5 text-[14px] text-gray-500">{dayLongFromKey(selectedKey)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setShowCancelled((v) => !v)}
              className={[
                "flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-[13px] transition",
                showCancelled
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
              ].join(" ")}
              aria-pressed={showCancelled}
              aria-label={showCancelled ? "Ocultar canceladas" : "Mostrar canceladas"}
              title={showCancelled ? "Ocultar canceladas" : "Mostrar canceladas"}
            >
              <span className="font-semibold">{cancelledCountSelectedDay}</span>
              <span className="font-semibold">{cancelledLabel}</span>
            </button>
            <div className={panelChip}>
              <CalendarDays className="h-4 w-4 text-[#B88E2F]" strokeWidth={1.75} />
              <span className="font-semibold">
                {dayRows.length} {dayRows.length === 1 ? "evento" : "eventos"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {loading ? (
            <p className="py-10 text-center text-[14px] text-gray-500">Cargando agenda…</p>
          ) : dayRows.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-gray-500">No hay turnos ni bloqueos este día.</p>
          ) : (
            dayRows.map((row) => {
              if (row.kind === "block") {
                return (
                  <PanelBlockCard
                    key={`block-${row.item.id}`}
                    block={row.item}
                    selectedDateKey={selectedKey}
                    onDelete={() => void handleDeleteBlock(row.item.id)}
                  />
                );
              }
              const r = row.item;
              const waUrl = whatsAppChatUrl(r.customerPhone, {
                customerName: r.customerName,
                displayDate: r.displayDate,
                timeLocal: r.timeLocal,
                treatmentName: r.treatmentName,
              });
              return (
                <PanelReservationCard
                  key={r.id}
                  ref={(el) => {
                    cardRefs.current[r.id] = el;
                  }}
                  reservation={r}
                  selectedDateKey={selectedKey}
                  whatsAppUrl={waUrl}
                  onRequestCancel={() => setCancelConfirmReservationId(r.id)}
                  cancelDisabled={cancellingReservationId === r.id}
                />
              );
            })
          )}
        </div>

        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutBusy}
            className="cursor-pointer text-[13px] text-gray-400 underline-offset-4 hover:text-[#B88E2F] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cerrar sesión del panel
          </button>
        </div>
      </div>
      {cancelConfirmReservationId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => {
            if (cancellingReservationId !== cancelConfirmReservationId) {
              setCancelConfirmReservationId(null);
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-montserrat text-[20px] font-bold text-gray-900">Cancelar turno</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-gray-600">
              ¿Estás seguro que deseás cancelar este turno? Esta acción no se puede deshacer.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelConfirmReservationId(null)}
                disabled={cancellingReservationId === cancelConfirmReservationId}
                className="inline-flex h-9 items-center rounded-xl border border-gray-200 px-3 text-[12px] font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = cancelConfirmReservationId;
                  if (!id) return;
                  trackPanelClick("cancel_turno", "confirm_modal");
                  await handleCancelReservation(id);
                  setCancelConfirmReservationId(null);
                }}
                disabled={cancellingReservationId === cancelConfirmReservationId}
                className="inline-flex h-9 items-center rounded-xl border border-red-200 bg-red-50 px-3 text-[12px] font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
              >
                {cancellingReservationId === cancelConfirmReservationId ? "Cancelando..." : "Sí, cancelar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <DesignUpdateAnnouncement scope="/panel-turnos" titleClassName="font-montserrat" />
    </div>
  );
}
