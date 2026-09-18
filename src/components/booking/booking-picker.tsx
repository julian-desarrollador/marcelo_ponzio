"use client";

import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { TreatmentCategory } from "@/lib/treatments/catalog";
import {
  SALON_TREATMENT_CATEGORIES,
  SALON_TREATMENT_OPTIONS,
  buildSalonCalendarItems,
  formatSalonDisplayDate,
  getAvailableTimesForDate,
  salonMonthNames,
  salonWeekdayLabels,
} from "@/lib/booking/salon-availability";
import { isArgentinaPublicHoliday } from "@/lib/booking/argentina-holidays";
import {
  marceloWorkUnavailableOnDate,
  treatmentIdsIncludeMarceloWork,
} from "@/lib/booking/marcelo-work";
import { argentinaTodayDateKey, minPublicBookableDateKey } from "@/lib/booking/public-slot-lead";

export type BookingPickerProps = {
  selectedTreatmentId: string;
  onTreatmentIdChange: (id: string) => void;
  selectedDate: string;
  onDateChange: (dateKey: string) => void;
  selectedTime: string;
  onTimeChange: (time: string) => void;
  /** Si se pasa, define qué horarios mostrar (ej. reserva pública con margen de 60 min en “hoy”). */
  resolveTimeSlots?: (dateKey: string) => string[];
  /**
   * Horarios ya resueltos en servidor (solapes, reglas). Solo aplica al `selectedDate` actual.
   * `undefined`: usar `resolveTimeSlots` / plantilla. `null`: cargando.
   */
  remoteTimeSlots?: string[] | null;
  /** `public`: reglas y textos de reserva web. `panel`: alta manual sin tope de “desde mañana”. */
  bookingContext?: "public" | "panel";
  bookingFocusRef?: React.RefObject<HTMLDivElement | null>;
  treatmentFirstHintVisible: boolean;
  onTreatmentFirstHintVisible: (visible: boolean) => void;
  selectedCountLabel?: string;
  selectedDurationLabel?: string;
  summaryTitle?: string;
  monthAvailabilityServiceIds?: string[];
  multiSelect?: boolean;
  selectedTreatmentIds?: string[];
  onToggleTreatmentId?: (id: string) => void;
  onClearTreatmentIds?: () => void;
  comboHintText?: string;
  comboDurationLabel?: string;
  comboAlertText?: string | null;
  /** Solo renderiza calendario u horarios (flujo wizard pantalla completa). */
  wizardSection?: "date" | "time";
};

export function BookingPicker({
  selectedTreatmentId,
  onTreatmentIdChange,
  selectedDate,
  onDateChange,
  selectedTime,
  onTimeChange,
  resolveTimeSlots,
  remoteTimeSlots,
  bookingContext = "public",
  bookingFocusRef,
  treatmentFirstHintVisible,
  onTreatmentFirstHintVisible,
  selectedCountLabel,
  selectedDurationLabel,
  summaryTitle,
  monthAvailabilityServiceIds = [],
  multiSelect = false,
  selectedTreatmentIds = [],
  onToggleTreatmentId,
  onClearTreatmentIds,
  comboHintText,
  comboDurationLabel,
  comboAlertText,
  wizardSection,
}: BookingPickerProps) {
  const isLight = bookingContext === "public" || bookingContext === "panel";
  const [visibleMonthDate, setVisibleMonthDate] = useState(() => {
    const today = new Date();
    if (bookingContext === "panel") {
      return new Date(today.getFullYear(), today.getMonth(), 1);
    }
    const [y, m] = minPublicBookableDateKey(today).split("-").map(Number);
    return new Date(y, m - 1, 1);
  });
  /** `undefined`: sin servicio o sin datos; `null`: cargando; objeto: hay al menos un hueco ese día para el servicio. */
  const [monthAvailability, setMonthAvailability] = useState<Record<string, boolean> | null | undefined>(undefined);
  const [isTreatmentModalOpen, setIsTreatmentModalOpen] = useState(false);
  const [activeTreatmentCategory, setActiveTreatmentCategory] = useState<TreatmentCategory | null>(null);

  const selectedTreatment = useMemo(
    () => SALON_TREATMENT_OPTIONS.find((option) => option.id === selectedTreatmentId),
    [selectedTreatmentId],
  );
  const visibleTreatments = useMemo(
    () =>
      activeTreatmentCategory
        ? SALON_TREATMENT_OPTIONS.filter((option) => option.category === activeTreatmentCategory)
        : [],
    [activeTreatmentCategory],
  );
  const calendarItems = useMemo(
    () => buildSalonCalendarItems(visibleMonthDate.getFullYear(), visibleMonthDate.getMonth()),
    [visibleMonthDate],
  );
  const visibleMonthLabel = `${salonMonthNames[visibleMonthDate.getMonth()]} ${visibleMonthDate.getFullYear()}`;
  const todayKey = argentinaTodayDateKey();
  const effectiveTreatmentIds =
    monthAvailabilityServiceIds.length > 0
      ? monthAvailabilityServiceIds
      : selectedTreatmentId.trim()
        ? [selectedTreatmentId]
        : [];
  const showMarceloAwayNotice =
    treatmentIdsIncludeMarceloWork(effectiveTreatmentIds) &&
    visibleMonthDate.getFullYear() === 2026 &&
    visibleMonthDate.getMonth() === 9;
  const selectedDateMarceloAway = Boolean(
    selectedDate && marceloWorkUnavailableOnDate(selectedDate, effectiveTreatmentIds),
  );

  useEffect(() => {
    if (!selectedTreatmentId.trim() && monthAvailabilityServiceIds.length === 0) {
      setMonthAvailability(undefined);
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    setMonthAvailability(null);
    const y = visibleMonthDate.getFullYear();
    const m = visibleMonthDate.getMonth();
    const q = new URLSearchParams({
      year: String(y),
      monthIndex: String(m),
      treatmentId: selectedTreatmentId,
      scope: bookingContext === "panel" ? "panel" : "public",
    });
    if (monthAvailabilityServiceIds.length > 0) {
      q.set("serviceIds", monthAvailabilityServiceIds.join(","));
    }
    fetch(`/api/booking/month-availability?${q.toString()}`, {
      credentials: "same-origin",
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<{ availability?: Record<string, boolean> }>;
      })
      .then((data) => {
        if (cancelled) return;
        const raw = data.availability;
        setMonthAvailability(typeof raw === "object" && raw !== null ? raw : undefined);
      })
      .catch(() => {
        if (!cancelled) setMonthAvailability(undefined);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [selectedTreatmentId, visibleMonthDate, bookingContext, monthAvailabilityServiceIds]);

  useEffect(() => {
    if (!selectedDate || !selectedTreatmentId.trim()) return;
    if (monthAvailability === undefined || monthAvailability === null) return;
    if (monthAvailability[selectedDate] === false) {
      onDateChange("");
      onTimeChange("");
    }
  }, [monthAvailability, onDateChange, onTimeChange, selectedDate, selectedTreatmentId]);

  const useRemoteSlots = remoteTimeSlots !== undefined;
  const slotsLoading = useRemoteSlots && selectedDate && remoteTimeSlots === null;
  const availableTimes = selectedDate
    ? useRemoteSlots
      ? remoteTimeSlots === null
        ? []
        : remoteTimeSlots
      : resolveTimeSlots
        ? resolveTimeSlots(selectedDate)
        : getAvailableTimesForDate(selectedDate)
    : [];
  const isSelectedDateHoliday = Boolean(selectedDate && isArgentinaPublicHoliday(selectedDate));

  const activeStep = !selectedTreatment
    ? 1
    : !selectedDate
      ? 2
      : !selectedTime
        ? 3
        : 4;

  const stepCardClass = (step: number) =>
    isLight
      ? `flex w-full cursor-pointer items-center justify-between rounded-2xl border bg-[var(--surface-card)] px-4 py-4 text-left shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all ${
          activeStep === step
            ? "border-[var(--premium-gold)] ring-2 ring-[var(--premium-gold)]/25"
            : "border-[var(--border-light)]"
        }`
      : `flex w-full cursor-pointer items-center justify-between rounded-2xl border bg-[#171717] px-4 py-3 text-left transition-all ${
          activeStep === step
            ? "border-[var(--premium-gold)] shadow-[0_0_0_1px_rgba(228,202,105,0.22),0_0_22px_rgba(206,120,50,0.18)]"
            : "border-white/8"
        }`;

  const stepCardStaticClass = (step: number) =>
    isLight
      ? `flex items-center justify-between rounded-2xl border bg-[var(--surface-card)] px-4 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all ${
          activeStep === step
            ? "border-[var(--premium-gold)] ring-2 ring-[var(--premium-gold)]/25"
            : "border-[var(--border-light)]"
        }`
      : `flex items-center justify-between rounded-2xl border bg-[#171717] px-4 py-3 transition-all ${
          activeStep === step
            ? "border-[var(--premium-gold)] shadow-[0_0_0_1px_rgba(228,202,105,0.22),0_0_22px_rgba(206,120,50,0.18)]"
            : "border-white/8"
        }`;

  const stepLabelClass = isLight
    ? "text-[16px] font-semibold tracking-[0.06em] text-[var(--text-secondary)]"
    : "text-[11px] tracking-[0.14em] text-[var(--soft-gray)]/55";

  const stepValueClass = isLight
    ? "mt-1 text-[16px] font-semibold text-[var(--text-primary)]"
    : "mt-1 text-[14px] text-[var(--soft-gray)]";

  const stepMetaClass = isLight
    ? "mt-1 text-[16px] text-[var(--text-secondary)]"
    : "mt-1 text-[11px] text-[var(--soft-gray)]/55";

  const stepHintClass = isLight
    ? "mt-2 flex items-center gap-2 text-[16px] font-medium text-[var(--accent-orange)]"
    : "mt-2 flex items-center gap-2 text-[11px] text-[var(--premium-gold)]/92";

  const openTreatmentModal = () => {
    setActiveTreatmentCategory(selectedTreatment?.category ?? null);
    setIsTreatmentModalOpen(true);
  };

  const closeTreatmentModal = () => {
    setIsTreatmentModalOpen(false);
    setActiveTreatmentCategory(null);
  };

  const selectTreatment = (treatmentId: string) => {
    onTreatmentIdChange(treatmentId);
    if (multiSelect && onToggleTreatmentId) {
      onToggleTreatmentId(treatmentId);
      return;
    }
    closeTreatmentModal();
  };

  return (
    <>
      {!wizardSection && (
      <section className="space-y-3">
        <button type="button" onClick={openTreatmentModal} className={stepCardClass(1)}>
          <div>
            <p className={stepLabelClass}>Paso 1 · Servicio</p>
            <p className={stepValueClass}>
              {summaryTitle ?? (selectedTreatment ? selectedTreatment.name : "Elegí servicio")}
            </p>
            {selectedCountLabel ? <p className={stepMetaClass}>{selectedCountLabel}</p> : selectedTreatment ? (
              <p className={stepMetaClass}>
                {selectedTreatment.category} · {selectedTreatment.subtitle}
              </p>
            ) : null}
            {selectedDurationLabel ? (
              <div
                className={`mt-2 inline-flex items-center rounded-full px-3 py-1 ${
                  isLight
                    ? "border border-[var(--premium-gold)] bg-[var(--premium-gold)]/15"
                    : "border border-[var(--premium-gold)]/55 bg-[var(--premium-gold)]/12"
                }`}
              >
                <span
                  className={`text-[16px] font-semibold ${isLight ? "text-[var(--text-primary)]" : "text-[var(--premium-gold)]"}`}
                >
                  {selectedDurationLabel}
                </span>
              </div>
            ) : null}
            {activeStep === 1 && (
              <div className={stepHintClass}>
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--premium-gold)]" />
                <span>Comenzá seleccionando el servicio</span>
              </div>
            )}
          </div>
          <ChevronRight
            className={`h-5 w-5 shrink-0 ${isLight ? "text-[var(--text-secondary)]" : "text-[var(--soft-gray)]/60"}`}
            strokeWidth={1.8}
          />
        </button>

        <div className={stepCardStaticClass(2)}>
          <div>
            <p className={stepLabelClass}>Paso 2 · Fecha</p>
            <p className={stepValueClass}>{selectedDate ? formatSalonDisplayDate(selectedDate) : "Elegí día"}</p>
            {activeStep === 2 && (
              <div className={stepHintClass}>
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--premium-gold)]" />
                <span>Ahora elegí una fecha disponible</span>
              </div>
            )}
          </div>
          <ChevronRight
            className={`h-5 w-5 shrink-0 rotate-90 ${isLight ? "text-[var(--text-secondary)]" : "text-[var(--soft-gray)]/60"}`}
            strokeWidth={1.8}
          />
        </div>
      </section>
      )}

      {(wizardSection === undefined || wizardSection === "date") && (
      <section
        className={
          isLight
            ? "mt-4 overflow-hidden rounded-[24px] border border-[var(--border-light)] bg-[var(--surface-card)] p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
            : "mt-4 overflow-hidden rounded-[24px] border border-white/8 bg-[#e4c48f] p-3 text-[#2c241b] shadow-[0_12px_26px_rgba(0,0,0,0.36)]"
        }
      >
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              setVisibleMonthDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
            }
            className={`cursor-pointer rounded-lg p-2 ${
              isLight
                ? "text-[var(--text-primary)] hover:bg-[var(--surface-light)]"
                : "text-[#7f6a45] hover:bg-black/10"
            }`}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
          </button>
          <h2
            className={`flex items-center gap-2 text-[20px] leading-none font-heading ${
              isLight ? "font-bold text-[var(--text-primary)]" : ""
            }`}
          >
            {visibleMonthLabel}
            {selectedTreatmentId && monthAvailability === null ? (
              <span
                className={`inline-block h-2.5 w-2.5 animate-pulse rounded-full ${
                  isLight ? "bg-[var(--premium-gold)]" : "bg-[#7f6a45]/90"
                }`}
                aria-hidden
              />
            ) : null}
          </h2>
          <button
            type="button"
            onClick={() =>
              setVisibleMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
            }
            className={`cursor-pointer rounded-lg p-2 ${
              isLight
                ? "text-[var(--text-primary)] hover:bg-[var(--surface-light)]"
                : "text-[#7f6a45] hover:bg-black/10"
            }`}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>

        {treatmentFirstHintVisible ? (
          <p
            role="status"
            aria-live="polite"
            className={
              isLight
                ? "mb-3 rounded-xl border border-[var(--premium-gold)]/40 bg-[var(--premium-gold)]/10 px-4 py-3 text-center text-[16px] leading-snug text-[var(--text-primary)]"
                : "mb-2 rounded-xl border border-[#8a7548]/55 bg-[#fff9ec]/97 px-3 py-2.5 text-center text-[12px] leading-snug text-[#2c241b] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
            }
          >
            <span className="font-semibold">Primero elegí un servicio</span>
            {isLight ? " (paso 1) para poder elegir el día." : " (paso 1) para poder elegir el día."}
          </p>
        ) : null}

        {showMarceloAwayNotice ? (
          <p
            role="status"
            className={
              isLight
                ? "mb-3 rounded-xl border border-[var(--border-light)] bg-[var(--surface-light)] px-4 py-3 text-center text-[15px] leading-snug text-[var(--text-secondary)]"
                : "mb-2 rounded-xl border border-[#8a7548]/35 bg-[#fff9ec]/90 px-3 py-2.5 text-center text-[12px] leading-snug text-[#2c241b]"
            }
          >
            Marcelo no atiende del 10 al 25 de octubre. En esas fechas Lucas sigue con color, peinados y
            tratamientos.
          </p>
        ) : null}

        <div
          className="grid grid-cols-7 gap-y-2 text-center"
          aria-busy={Boolean(selectedTreatmentId && monthAvailability === null)}
        >
          {salonWeekdayLabels.map((label) => (
            <div
              key={label}
              className={
                isLight
                  ? "text-[16px] font-semibold tracking-[0.04em] text-[var(--text-secondary)]"
                  : "text-[10px] tracking-[0.08em] text-[#7f7364]"
              }
            >
              {label}
            </div>
          ))}
          {calendarItems.map((day) => {
            const isSelected = day.value === selectedDate;
            const isToday = day.value === todayKey && day.isCurrentMonth;
            const monthAvailReady = monthAvailability !== undefined && monthAvailability !== null;
            const fullyBooked =
              Boolean(selectedTreatmentId) &&
              monthAvailReady &&
              day.isCurrentMonth &&
              day.isAvailable &&
              monthAvailability[day.value] === false;
            const marceloAwayDay = marceloWorkUnavailableOnDate(day.value, effectiveTreatmentIds);
            const isDisabled = !day.isCurrentMonth || !day.isAvailable || fullyBooked;

            const dayClass = isLight
              ? `mx-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border text-[16px] font-semibold transition-all disabled:cursor-not-allowed ${
                  isSelected
                    ? "border-[var(--premium-gold)] bg-[var(--premium-gold)] text-[var(--on-accent)] shadow-[0_4px_12px_rgba(228,202,105,0.35)]"
                    : fullyBooked
                      ? "border-[var(--border-light)] bg-[var(--surface-light)] text-[var(--text-secondary)] line-through decoration-[var(--text-secondary)]"
                      : !day.isCurrentMonth
                        ? "border-transparent text-[var(--text-secondary)]/35"
                        : day.isAvailable
                          ? isToday
                            ? "border-[var(--premium-gold)]/50 bg-[var(--premium-gold)]/12 text-[var(--text-primary)]"
                            : "border-[var(--border-light)] bg-white text-[var(--text-primary)] hover:border-[var(--premium-gold)]/40 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                          : "border-transparent text-[var(--text-secondary)]/45"
                }`
              : `mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[12px] transition-colors disabled:cursor-not-allowed ${
                  isSelected
                    ? "bg-[#1a1a1a] text-[#c89b56] shadow-[0_6px_14px_rgba(0,0,0,0.25)]"
                    : fullyBooked
                      ? "bg-[#c9b89a]/55 text-[#5c4f3d] line-through decoration-[#6b5a45]"
                      : !day.isCurrentMonth
                        ? "text-[#cfbea8]/45"
                        : day.isAvailable
                          ? "bg-[#eed7ae] text-[#3b2f22]"
                          : "text-[#897a67]"
                }`;

            return (
              <button
                key={day.value}
                type="button"
                disabled={isDisabled}
                title={
                  fullyBooked
                    ? marceloAwayDay
                      ? "Marcelo no atiende ese día (viaje)."
                      : "Sin cupos para este servicio (ocupado o bloqueado)."
                    : !day.isAvailable && day.isCurrentMonth
                      ? "Día no disponible (cerrado o feriado)."
                      : undefined
                }
                aria-label={
                  fullyBooked
                    ? `${day.dayNumber}, sin cupos`
                    : !day.isAvailable && day.isCurrentMonth
                      ? `${day.dayNumber}, no disponible`
                      : undefined
                }
                onClick={() => {
                  if (!selectedTreatment) {
                    onTreatmentFirstHintVisible(true);
                    return;
                  }
                  onDateChange(day.value);
                  onTimeChange("");
                  requestAnimationFrame(() => {
                    bookingFocusRef?.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  });
                }}
                className={dayClass}
              >
                {day.dayNumber}
              </button>
            );
          })}
        </div>
      </section>
      )}

      {(wizardSection === undefined || wizardSection === "time") && (
      <div ref={bookingFocusRef} className={wizardSection ? "" : "mt-4"}>
        <section>
          {!wizardSection && (
          <div className={stepCardStaticClass(3)}>
            <div>
              <p className={stepLabelClass}>Paso 3 · Horario</p>
              <p className={stepValueClass}>
                {selectedTime ? `Horario elegido: ${selectedTime}` : "Elegí horario"}
              </p>
              {activeStep === 3 && (
                <div className={stepHintClass}>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--premium-gold)]" />
                  <span>Seleccioná un horario para continuar</span>
                </div>
              )}
            </div>
            <ChevronRight
              className={`h-5 w-5 shrink-0 ${isLight ? "text-[var(--text-secondary)]" : "text-[var(--soft-gray)]/60"}`}
              strokeWidth={1.8}
            />
          </div>
          )}

          <div className={`grid grid-cols-2 gap-3 ${wizardSection ? "" : "mt-4"}`}>
            {slotsLoading ? (
              <div
                className={`col-span-2 rounded-2xl border px-4 py-6 text-center text-[16px] ${
                  isLight
                    ? "border-[var(--border-light)] bg-[var(--surface-card)] text-[var(--text-secondary)]"
                    : "border-white/8 bg-[#171717] text-[var(--soft-gray)]/68"
                }`}
              >
                Cargando horarios…
              </div>
            ) : availableTimes.length > 0 ? (
              availableTimes.map((time) => {
                const isActive = time === selectedTime;
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => onTimeChange(time)}
                    className={`h-12 min-h-[48px] cursor-pointer rounded-xl border text-[16px] font-semibold transition-all ${
                      isLight
                        ? isActive
                          ? "border-[var(--premium-gold)] bg-[var(--premium-gold)] text-[var(--on-accent)] shadow-[0_4px_14px_rgba(228,202,105,0.35)]"
                          : "border-[var(--border-light)] bg-white text-[var(--text-primary)] hover:border-[var(--premium-gold)]/45 hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
                        : isActive
                          ? "border-[var(--premium-gold)] bg-[rgba(206,120,50,0.14)] text-[var(--premium-gold)]"
                          : "border-white/8 bg-[#151515] text-[var(--soft-gray)]"
                    }`}
                  >
                    {time}
                  </button>
                );
              })
            ) : (
              <div
                className={`col-span-2 rounded-2xl border px-4 py-6 text-center ${
                  selectedDate
                    ? isLight
                      ? "border-amber-300 bg-amber-50"
                      : "border-amber-500/35 bg-amber-950/20"
                    : isLight
                      ? "border-[var(--premium-gold)]/35 bg-[var(--premium-gold)]/10"
                      : bookingContext === "panel"
                        ? "border-white/8 bg-[#171717]"
                        : "border-[var(--premium-gold)]/35 bg-[rgba(206,120,50,0.14)]"
                }`}
              >
                {selectedDate ? (
                  <>
                    <p
                      className={`text-[16px] font-semibold ${
                        isLight ? "text-[var(--text-primary)]" : "text-amber-100/95"
                      }`}
                    >
                      {selectedDateMarceloAway
                        ? "Marcelo no atiende ese día."
                        : isSelectedDateHoliday
                          ? "Feriado (cerrado): no hay horarios disponibles para este dia."
                          : "No hay horarios disponibles para este dia."}
                    </p>
                    <p className={`mt-2 text-[16px] ${isLight ? "text-[var(--text-secondary)]" : "text-amber-100/75"}`}>
                      {selectedDateMarceloAway
                        ? "Del 10 al 25 de octubre no toma cortes, despuntados, servicio completo ni reflejos de papel. Elegí otra fecha, o un servicio de Lucas."
                        : isSelectedDateHoliday
                          ? "Elegi otra fecha habilitada para ver turnos disponibles."
                          : "Proba con otra fecha para ver turnos disponibles."}
                    </p>
                  </>
                ) : bookingContext === "panel" ? (
                  <p className={`text-[16px] ${isLight ? "text-[var(--text-secondary)]" : "text-[var(--soft-gray)]/72"}`}>
                    Elegí una fecha para ver los horarios disponibles.
                  </p>
                ) : (
                  <>
                    <p
                      className={`text-[16px] font-semibold ${
                        isLight ? "text-[var(--text-primary)]" : "text-[var(--premium-gold)]"
                      }`}
                    >
                      Los turnos web se reservan a partir de mañana (no el mismo día).
                    </p>
                    <p className={`mt-2 text-[16px] ${isLight ? "text-[var(--text-secondary)]" : "text-[var(--soft-gray)]/88"}`}>
                      Elegí una fecha desde mañana para ver horarios.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
      )}

      {!wizardSection && isTreatmentModalOpen && (
        <div
          className={`fixed inset-0 z-40 flex items-end ${
            isLight ? "bg-black/40 backdrop-blur-[2px]" : "bg-black/60 backdrop-blur-[3px]"
          }`}
        >
          <button
            type="button"
            aria-label="Cerrar selector de servicio"
            onClick={closeTreatmentModal}
            className="absolute inset-0 cursor-pointer bg-transparent"
          />

          <div
            className={
              isLight
                ? "relative max-h-[88vh] w-full overflow-y-auto rounded-t-[32px] border-t border-[var(--border-light)] bg-[var(--surface-light)] px-4 pt-3 pb-8 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]"
                : "relative w-full rounded-t-[32px] border-t border-white/8 bg-[#161616] px-4 pt-3 pb-6 shadow-[0_-18px_40px_rgba(0,0,0,0.45)]"
            }
          >
            <div
              className={`mx-auto mb-4 h-1.5 w-14 rounded-full ${
                isLight ? "bg-[var(--border-light)]" : "bg-white/12"
              }`}
            />

            <div className="mb-4 flex items-center justify-between">
              {activeTreatmentCategory ? (
                <button
                  type="button"
                  onClick={() => setActiveTreatmentCategory(null)}
                  className={`cursor-pointer rounded-lg p-2 ${
                    isLight
                      ? "text-[var(--text-primary)] hover:bg-white"
                      : "text-[var(--soft-gray)]/75 hover:bg-white/5"
                  }`}
                  aria-label="Volver a categorías"
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
                </button>
              ) : (
                <span className="h-5 w-5" />
              )}

              <h2
                className={`text-[26px] leading-none font-heading ${
                  isLight ? "font-bold text-[var(--text-primary)]" : ""
                }`}
              >
                {activeTreatmentCategory ?? "Elegí servicio"}
              </h2>

              <button
                type="button"
                onClick={closeTreatmentModal}
                className={`cursor-pointer rounded-lg px-3 py-2 text-[16px] font-semibold ${
                  isLight
                    ? "text-[var(--text-secondary)] hover:bg-white"
                    : "text-[var(--soft-gray)]/75 hover:bg-white/5"
                }`}
              >
                Cerrar
              </button>
            </div>
            {multiSelect ? (
              <div
                className={`mb-3 rounded-xl border px-4 py-3 ${
                  isLight
                    ? "border-[var(--border-light)] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
                    : "border-white/10 bg-[#1b1b1b]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`min-w-0 flex-1 text-[16px] leading-snug ${
                      isLight ? "text-[var(--text-primary)]" : "text-[var(--soft-gray)]/82"
                    }`}
                  >
                    <span className={`font-bold ${isLight ? "text-[var(--accent-orange)]" : "text-[var(--premium-gold)]"}`}>
                      {selectedTreatmentIds.length}
                    </span>{" "}
                    seleccionados
                    {comboDurationLabel ? (
                      <span className={isLight ? "text-[var(--text-secondary)]" : "text-[var(--soft-gray)]/58"}>
                        {" "}
                        ·{" "}
                        <span className="font-semibold text-[var(--premium-gold)]">{comboDurationLabel}</span>
                      </span>
                    ) : null}
                    {summaryTitle ? (
                      <span className={isLight ? "text-[var(--text-secondary)]" : "text-[var(--soft-gray)]/58"}>
                        {" "}
                        · {summaryTitle}
                      </span>
                    ) : null}
                  </p>
                  {selectedTreatmentIds.length > 0 && onClearTreatmentIds ? (
                    <button
                      type="button"
                      onClick={onClearTreatmentIds}
                      aria-label="Quitar todos los servicios seleccionados"
                      className="shrink-0 cursor-pointer rounded-lg border border-red-300 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {multiSelect && comboAlertText ? (
              <div
                className={`mb-3 rounded-xl border px-4 py-3 text-center text-[16px] font-medium ${
                  isLight
                    ? "border-amber-300 bg-amber-50 text-[var(--text-primary)]"
                    : "border-amber-500/45 bg-amber-950/95 text-amber-100 shadow-[0_14px_34px_rgba(0,0,0,0.48)]"
                }`}
              >
                {comboAlertText}
              </div>
            ) : null}
            {activeTreatmentCategory ? (
              <div className="max-h-[52vh] space-y-3 overflow-y-auto pb-2">
                {visibleTreatments.map((treatment) => {
                  const isSelected = multiSelect
                    ? selectedTreatmentIds.includes(treatment.id)
                    : treatment.id === selectedTreatmentId;

                  return (
                    <button
                      key={treatment.id}
                      type="button"
                      onClick={() => selectTreatment(treatment.id)}
                      className={`w-full cursor-pointer rounded-2xl border px-4 py-4 text-left transition-all ${
                        isLight
                          ? isSelected
                            ? "border-[var(--premium-gold)] bg-[var(--premium-gold)]/12 shadow-[0_4px_16px_rgba(228,202,105,0.18)] ring-2 ring-[var(--premium-gold)]/20"
                            : "border-[var(--border-light)] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:border-[var(--premium-gold)]/35 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
                          : isSelected
                            ? "border-[var(--premium-gold)] bg-[rgba(228,202,105,0.1)]"
                            : "border-white/8 bg-[#1c1c1c]"
                      }`}
                    >
                      <p
                        className={`text-[18px] leading-tight font-heading ${
                          isLight ? "font-bold text-[var(--text-primary)]" : "text-[var(--soft-gray)]"
                        }`}
                      >
                        {treatment.name}
                      </p>
                      <p className={`mt-1 text-[16px] ${isLight ? "text-[var(--text-secondary)]" : "text-[var(--soft-gray)]/58"}`}>
                        {treatment.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {SALON_TREATMENT_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveTreatmentCategory(category)}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-2xl border px-4 py-4 text-left transition-all ${
                      isLight
                        ? "border-[var(--border-light)] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] hover:border-[var(--premium-gold)]/35 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
                        : "border-white/8 bg-[#1c1c1c] hover:bg-[#222]"
                    }`}
                  >
                    <div>
                      <p
                        className={`text-[20px] leading-none font-heading ${
                          isLight ? "font-bold text-[var(--text-primary)]" : "text-[var(--soft-gray)]"
                        }`}
                      >
                        {category}
                      </p>
                      <p className={`mt-1 text-[16px] ${isLight ? "text-[var(--text-secondary)]" : "text-[var(--soft-gray)]/58"}`}>
                        {SALON_TREATMENT_OPTIONS.filter((option) => option.category === category).length} servicios
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-5 w-5 ${isLight ? "text-[var(--text-secondary)]" : "text-[var(--soft-gray)]/55"}`}
                      strokeWidth={1.8}
                    />
                  </button>
                ))}
              </div>
            )}
            {multiSelect ? (
              <div className="mt-4">
                <button
                  type="button"
                  disabled={selectedTreatmentIds.length === 0}
                  onClick={closeTreatmentModal}
                  className={`h-12 w-full rounded-xl text-[16px] font-bold transition ${
                    selectedTreatmentIds.length > 0
                      ? "cursor-pointer bg-[var(--premium-gold)] text-[var(--on-accent)] shadow-[0_8px_22px_rgba(206,120,50,0.28)]"
                      : isLight
                        ? "cursor-not-allowed bg-[var(--border-light)] text-[var(--text-secondary)]"
                        : "cursor-not-allowed bg-[#2a2a2a] text-white/40"
                  }`}
                >
                  Continuar ({selectedTreatmentIds.length})
                </button>
                {selectedTreatmentIds.length > 0 ? (
                  <p className={`mt-2 text-center text-[16px] ${isLight ? "text-[var(--text-secondary)]" : "text-[var(--soft-gray)]/55"}`}>
                    Cuando termines de elegir, tocá Continuar.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
