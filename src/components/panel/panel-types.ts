export type PanelReservation = {
  id: string;
  treatmentId: string;
  treatmentName: string;
  subtitle: string;
  category: string;
  dateKey: string;
  timeLocal: string;
  displayDate: string;
  customerName: string;
  customerPhone: string;
  reservationStatus: string;
  paymentStatus: string;
  cancelledBy?: "panel" | "customer" | "whatsapp" | null;
  source?: string;
  startsAt: string;
  createdAt: string;
  /** ISO: recordatorio 24h enviado (cron). */
  waReminder24hSentAt?: string | null;
  /** ISO: confirmó asistencia respondiendo el recordatorio. */
  waAttendanceConfirmedAt?: string | null;
  giftCardCode?: string | null;
  giftCardTitle?: string | null;
};

export type PanelAgendaBlock = {
  id: string;
  anchorDateKey: string;
  timeLocal: string;
  durationMinutes: number;
  scope: string;
  recurrence: { type: "weekly"; untilDateKey?: string | null } | null;
  notes?: string | null;
};
