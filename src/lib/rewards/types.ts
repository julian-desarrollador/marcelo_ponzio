import type { ObjectId } from "mongodb";

export type RewardRuleKind = "visits" | "birthday";

export type RewardRuleDoc = {
  _id: ObjectId;
  kind: RewardRuleKind;
  /** Cada cuántas visitas válidas se sugiere el regalo. Solo kind "visits". */
  everyVisits?: number;
  title: string;
  description: string;
  /** Vacío = aplica a cualquier servicio. */
  treatmentIds: string[];
  validDays: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type GiftCardOrigin = "birthday" | "visits" | "manual";

export type GiftCardStatus = "active" | "reserved" | "used" | "cancelled";

export type GiftCardDoc = {
  _id: ObjectId;
  code: string;
  customerPhoneDigits: string;
  customerName: string;
  title: string;
  description: string;
  treatmentIds: string[];
  origin: GiftCardOrigin;
  ruleId?: string | null;
  /** birthday:2026 o visits:10. Ausente en emisión manual. */
  occasionKey?: string | null;
  status: GiftCardStatus;
  reservationId?: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type GiftCardViewStatus = GiftCardStatus | "expired";

export type RewardSuggestion = {
  kind: RewardRuleKind;
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
