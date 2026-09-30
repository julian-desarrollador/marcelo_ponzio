import { randomBytes } from "crypto";
import { MongoServerError, ObjectId, type Db, type Filter } from "mongodb";

import { findCatalogTreatmentById } from "@/lib/treatments/catalog";

import type { GiftCardDoc, GiftCardOrigin, GiftCardViewStatus, RewardRuleDoc, RewardRuleKind } from "./types";

export const REWARD_RULES_COLLECTION = "reward_rules";
export const GIFT_CARDS_COLLECTION = "gift_cards";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let indexesEnsured = false;

export function treatmentNamesForIds(treatmentIds: string[]): string[] {
  return treatmentIds.map((id) => findCatalogTreatmentById(id)?.name ?? id);
}

export function giftCardAppliesToTreatments(treatmentIds: string[], selectedIds: string[]): boolean {
  if (treatmentIds.length === 0) return selectedIds.length > 0;
  const allowed = new Set(treatmentIds);
  return selectedIds.length > 0 && selectedIds.every((id) => allowed.has(id));
}

export function viewStatus(card: Pick<GiftCardDoc, "status" | "expiresAt">, now = new Date()): GiftCardViewStatus {
  if (card.status === "active" && card.expiresAt.getTime() <= now.getTime()) return "expired";
  return card.status;
}

export function generateGiftCardCode(): string {
  const bytes = randomBytes(5);
  let body = "";
  for (let i = 0; i < 5; i += 1) {
    body += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `MP-GIFT-${body}`;
}

export async function ensureRewardIndexes(db: Db): Promise<void> {
  if (indexesEnsured) return;
  await db.collection(REWARD_RULES_COLLECTION).createIndex({ active: 1, kind: 1 }, { name: "by_active_kind" });
  await db.collection(GIFT_CARDS_COLLECTION).createIndex({ code: 1 }, { unique: true, name: "by_code" });
  await db.collection(GIFT_CARDS_COLLECTION).createIndex(
    { customerPhoneDigits: 1, createdAt: -1 },
    { name: "by_phone_created" },
  );
  await db.collection(GIFT_CARDS_COLLECTION).createIndex(
    { customerPhoneDigits: 1, ruleId: 1, occasionKey: 1 },
    {
      unique: true,
      name: "by_occasion",
      partialFilterExpression: {
        ruleId: { $exists: true, $type: "string" },
        occasionKey: { $exists: true, $type: "string" },
      },
    },
  );
  indexesEnsured = true;
}

export async function listRewardRules(db: Db): Promise<RewardRuleDoc[]> {
  await ensureRewardIndexes(db);
  return db
    .collection<RewardRuleDoc>(REWARD_RULES_COLLECTION)
    .find({})
    .sort({ active: -1, createdAt: -1 })
    .toArray();
}

export async function findRewardRuleById(db: Db, id: string): Promise<RewardRuleDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  await ensureRewardIndexes(db);
  return db.collection<RewardRuleDoc>(REWARD_RULES_COLLECTION).findOne({ _id: new ObjectId(id) });
}

export type RewardRuleInput = {
  kind: RewardRuleKind;
  everyVisits?: number;
  title: string;
  description: string;
  treatmentIds: string[];
  validDays: number;
  active: boolean;
};

export function validateRewardRuleInput(raw: RewardRuleInput): { ok: true; value: RewardRuleInput } | { error: string } {
  const kind = raw.kind;
  if (kind !== "visits" && kind !== "birthday") return { error: "Tipo de regla inválido." };
  const title = raw.title.trim().replace(/\s+/g, " ");
  if (title.length < 2 || title.length > 80) return { error: "El título tiene que tener entre 2 y 80 caracteres." };
  const description = raw.description.trim().replace(/\s+/g, " ");
  if (description.length > 240) return { error: "La descripción es demasiado larga." };
  const validDays = Math.floor(Number(raw.validDays));
  if (!Number.isFinite(validDays) || validDays < 1 || validDays > 730) {
    return { error: "La validez tiene que ser entre 1 y 730 días." };
  }
  let everyVisits: number | undefined;
  if (kind === "visits") {
    everyVisits = Math.floor(Number(raw.everyVisits));
    if (!Number.isFinite(everyVisits) || everyVisits < 1 || everyVisits > 100) {
      return { error: "Las visitas tienen que ser un número entre 1 y 100." };
    }
  }
  const treatmentIds = [...new Set(raw.treatmentIds.map((id) => id.trim()).filter(Boolean))];
  if (treatmentIds.some((id) => !findCatalogTreatmentById(id))) {
    return { error: "Hay un servicio que no existe en el catálogo." };
  }
  return {
    ok: true,
    value: {
      kind,
      everyVisits,
      title,
      description,
      treatmentIds,
      validDays,
      active: raw.active !== false,
    },
  };
}

export async function insertRewardRule(db: Db, input: RewardRuleInput): Promise<RewardRuleDoc> {
  await ensureRewardIndexes(db);
  const now = new Date();
  const doc: Omit<RewardRuleDoc, "_id"> = {
    kind: input.kind,
    ...(input.kind === "visits" ? { everyVisits: input.everyVisits } : {}),
    title: input.title,
    description: input.description,
    treatmentIds: input.treatmentIds,
    validDays: input.validDays,
    active: input.active,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection<Omit<RewardRuleDoc, "_id">>(REWARD_RULES_COLLECTION).insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function updateRewardRule(
  db: Db,
  id: string,
  input: RewardRuleInput,
): Promise<RewardRuleDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  await ensureRewardIndexes(db);
  const now = new Date();
  const set: Record<string, unknown> = {
    kind: input.kind,
    title: input.title,
    description: input.description,
    treatmentIds: input.treatmentIds,
    validDays: input.validDays,
    active: input.active,
    updatedAt: now,
  };
  const unset: Record<string, ""> = {};
  if (input.kind === "visits") set.everyVisits = input.everyVisits;
  else unset.everyVisits = "";
  const result = await db.collection<RewardRuleDoc>(REWARD_RULES_COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
    { returnDocument: "after" },
  );
  return result ?? null;
}

export async function listGiftCards(
  db: Db,
  filter: Filter<GiftCardDoc> = {},
  limit = 200,
): Promise<GiftCardDoc[]> {
  await ensureRewardIndexes(db);
  return db
    .collection<GiftCardDoc>(GIFT_CARDS_COLLECTION)
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function findGiftCardByCode(db: Db, code: string): Promise<GiftCardDoc | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  await ensureRewardIndexes(db);
  return db.collection<GiftCardDoc>(GIFT_CARDS_COLLECTION).findOne({ code: normalized });
}

export async function findGiftCardById(db: Db, id: string): Promise<GiftCardDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  await ensureRewardIndexes(db);
  return db.collection<GiftCardDoc>(GIFT_CARDS_COLLECTION).findOne({ _id: new ObjectId(id) });
}

export type IssueGiftCardInput = {
  customerPhoneDigits: string;
  customerName: string;
  title: string;
  description: string;
  treatmentIds: string[];
  origin: GiftCardOrigin;
  ruleId?: string | null;
  occasionKey?: string | null;
  validDays: number;
};

export async function issueGiftCard(
  db: Db,
  input: IssueGiftCardInput,
): Promise<{ ok: true; card: GiftCardDoc } | { error: string; code?: string }> {
  await ensureRewardIndexes(db);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.validDays * 24 * 60 * 60 * 1000);
  const ruleId = input.ruleId?.trim() || null;
  const occasionKey = input.occasionKey?.trim() || null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const doc: Omit<GiftCardDoc, "_id"> = {
      code: generateGiftCardCode(),
      customerPhoneDigits: input.customerPhoneDigits,
      customerName: input.customerName.trim() || "Cliente",
      title: input.title,
      description: input.description,
      treatmentIds: input.treatmentIds,
      origin: input.origin,
      status: "active",
      expiresAt,
      createdAt: now,
      updatedAt: now,
      ...(ruleId ? { ruleId } : {}),
      ...(occasionKey ? { occasionKey } : {}),
    };
    try {
      const result = await db.collection<Omit<GiftCardDoc, "_id">>(GIFT_CARDS_COLLECTION).insertOne(doc);
      return { ok: true, card: { ...doc, _id: result.insertedId } };
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        const message = String(e.message ?? "");
        if (message.includes("by_occasion")) {
          return { error: "Ya se emitió una gift card para esta ocasión.", code: "DUPLICATE_OCCASION" };
        }
        continue;
      }
      throw e;
    }
  }
  return { error: "No se pudo generar un código. Probá de nuevo.", code: "CODE_COLLISION" };
}

export async function cancelGiftCard(db: Db, id: string): Promise<GiftCardDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  await ensureRewardIndexes(db);
  return db.collection<GiftCardDoc>(GIFT_CARDS_COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id), status: "active" },
    { $set: { status: "cancelled", updatedAt: new Date() }, $unset: { reservationId: "" } },
    { returnDocument: "after" },
  );
}

/** Vuelve a activa si el turno se cancela y la gift card no venció. */
export async function releaseGiftCardReservation(
  db: Db,
  code: string,
  reservationHexId: string,
  now = new Date(),
): Promise<void> {
  const card = await findGiftCardByCode(db, code);
  if (!card || card.status !== "reserved") return;
  if (card.reservationId && card.reservationId !== reservationHexId) return;
  const expired = card.expiresAt.getTime() <= now.getTime();
  await db.collection<GiftCardDoc>(GIFT_CARDS_COLLECTION).updateOne(
    { _id: card._id, status: "reserved", reservationId: reservationHexId },
    expired
      ? { $set: { status: "cancelled", updatedAt: now }, $unset: { reservationId: "" } }
      : { $set: { status: "active", updatedAt: now }, $unset: { reservationId: "" } },
  );
}

export async function claimGiftCard(
  db: Db,
  code: string,
  reservationHexId: string,
  now = new Date(),
): Promise<boolean> {
  await ensureRewardIndexes(db);
  const result = await db.collection<GiftCardDoc>(GIFT_CARDS_COLLECTION).findOneAndUpdate(
    { code: code.trim().toUpperCase(), status: "active", expiresAt: { $gt: now } },
    { $set: { status: "reserved", reservationId: reservationHexId, updatedAt: now } },
    { returnDocument: "after" },
  );
  return Boolean(result);
}

export async function markGiftCardUsed(db: Db, id: ObjectId, now = new Date()): Promise<void> {
  await db.collection<GiftCardDoc>(GIFT_CARDS_COLLECTION).updateOne(
    { _id: id, status: "reserved" },
    { $set: { status: "used", updatedAt: now } },
  );
}

export async function markGiftCardActiveAgain(db: Db, id: ObjectId, now = new Date()): Promise<void> {
  await db.collection<GiftCardDoc>(GIFT_CARDS_COLLECTION).updateOne(
    { _id: id, status: "reserved" },
    { $set: { status: "active", updatedAt: now }, $unset: { reservationId: "" } },
  );
}

export function serializeRewardRule(rule: RewardRuleDoc) {
  return {
    id: rule._id.toHexString(),
    kind: rule.kind,
    everyVisits: rule.everyVisits ?? null,
    title: rule.title,
    description: rule.description,
    treatmentIds: rule.treatmentIds,
    treatmentNames: treatmentNamesForIds(rule.treatmentIds),
    validDays: rule.validDays,
    active: rule.active,
  };
}

export function serializeGiftCard(card: GiftCardDoc, now = new Date()) {
  return {
    id: card._id.toHexString(),
    code: card.code,
    customerPhoneDigits: card.customerPhoneDigits,
    customerName: card.customerName,
    title: card.title,
    description: card.description,
    treatmentIds: card.treatmentIds,
    treatmentNames: treatmentNamesForIds(card.treatmentIds),
    origin: card.origin,
    ruleId: card.ruleId ?? null,
    occasionKey: card.occasionKey ?? null,
    status: viewStatus(card, now),
    reservationId: card.reservationId ?? null,
    expiresAt: card.expiresAt.toISOString(),
    createdAt: card.createdAt.toISOString(),
  };
}

export function giftCardShareText(
  card: Pick<GiftCardDoc, "customerName" | "title" | "description" | "code" | "expiresAt">,
  origin: string,
): string {
  const until = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(card.expiresAt);
  const base = origin.replace(/\/+$/, "");
  const lines = [
    `Hola ${card.customerName.trim() || ""}, te regalamos una gift card: ${card.title}.`,
    card.description.trim(),
    `Código: ${card.code}`,
    `Válida hasta ${until}.`,
    `La ves en tu perfil y la usás al reservar: ${base}/perfil/gift-cards`,
  ].filter((line) => line.trim().length > 0);
  return lines.join("\n\n");
}

export async function cancelReservedGiftCard(db: Db, id: ObjectId, now = new Date()): Promise<void> {
  await db.collection<GiftCardDoc>(GIFT_CARDS_COLLECTION).updateOne(
    { _id: id, status: "reserved" },
    { $set: { status: "cancelled", updatedAt: now }, $unset: { reservationId: "" } },
  );
}
