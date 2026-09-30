import type { Db } from "mongodb";

import { canonicalPhoneDigitsAR, customerPhoneDigitsQueryValues } from "@/lib/customer/phone-canonical-ar";
import { CUSTOMER_PROFILES_COLLECTION, type CustomerProfileDoc } from "@/lib/customer/customer-profiles";
import type { ReservationDoc } from "@/lib/reservations/types";

import { argentinaDateKey, birthdayWithinWindow } from "./birthday";
import { listGiftCards, listRewardRules } from "./store";
import type { RewardSuggestion } from "./types";

type VisitRow = {
  phoneDigits: string;
  customerName: string;
  customerPhone: string;
  visitCount: number;
};

function reservationEnded(r: Pick<ReservationDoc, "startsAt" | "durationMinutes" | "totalDurationMinutes">, now: Date): boolean {
  const start = r.startsAt instanceof Date ? r.startsAt.getTime() : new Date(r.startsAt).getTime();
  if (!Number.isFinite(start)) return false;
  const minutes = r.totalDurationMinutes ?? r.durationMinutes ?? 30;
  return start + minutes * 60_000 < now.getTime();
}

export function isRewardVisit(
  r: Pick<ReservationDoc, "reservationStatus" | "startsAt" | "durationMinutes" | "totalDurationMinutes">,
  now = new Date(),
): boolean {
  if (r.reservationStatus !== "confirmed" && r.reservationStatus !== "completed") return false;
  return reservationEnded(r, now);
}

async function countRewardVisits(db: Db, now: Date): Promise<Map<string, VisitRow>> {
  const rows = await db
    .collection<ReservationDoc>("reservations")
    .find(
      { reservationStatus: { $in: ["confirmed", "completed"] }, startsAt: { $lt: now } },
      {
        projection: {
          customerPhoneDigits: 1,
          customerPhone: 1,
          customerName: 1,
          startsAt: 1,
          durationMinutes: 1,
          totalDurationMinutes: 1,
          reservationStatus: 1,
        },
      },
    )
    .sort({ startsAt: -1 })
    .toArray();

  const byPhone = new Map<string, VisitRow>();
  for (const row of rows) {
    if (!isRewardVisit(row, now)) continue;
    const phoneDigits = (row.customerPhoneDigits?.trim() || canonicalPhoneDigitsAR(row.customerPhone || "")).trim();
    if (phoneDigits.length < 8) continue;
    const current = byPhone.get(phoneDigits);
    if (current) {
      current.visitCount += 1;
      continue;
    }
    byPhone.set(phoneDigits, {
      phoneDigits,
      customerName: row.customerName?.trim() || "Cliente",
      customerPhone: row.customerPhone?.trim() || phoneDigits,
      visitCount: 1,
    });
  }
  return byPhone;
}

function occasionAlreadyIssued(
  issued: Set<string>,
  phoneDigits: string,
  ruleId: string,
  occasionKey: string,
): boolean {
  const keys = customerPhoneDigitsQueryValues(phoneDigits);
  return keys.some((phone) => issued.has(`${phone}|${ruleId}|${occasionKey}`));
}

export async function listRewardSuggestions(db: Db, now = new Date()): Promise<RewardSuggestion[]> {
  const [rules, cards, visits] = await Promise.all([
    listRewardRules(db),
    listGiftCards(db, {}, 2000),
    countRewardVisits(db, now),
  ]);
  const activeRules = rules.filter((rule) => rule.active);
  const issued = new Set(
    cards
      .filter((card) => card.ruleId && card.occasionKey)
      .map((card) => `${card.customerPhoneDigits}|${card.ruleId}|${card.occasionKey}`),
  );

  const profiles = await db
    .collection<CustomerProfileDoc>(CUSTOMER_PROFILES_COLLECTION)
    .find({ birthdayMonthDay: { $type: "string" } })
    .toArray();
  const profileByPhone = new Map(profiles.map((profile) => [profile.phoneDigits, profile]));

  const suggestions: RewardSuggestion[] = [];
  const todayKey = argentinaDateKey(now);

  for (const rule of activeRules) {
    if (rule.kind === "visits") {
      const every = rule.everyVisits ?? 0;
      if (every < 1) continue;
      for (const visit of visits.values()) {
        const milestone = Math.floor(visit.visitCount / every) * every;
        if (milestone < every) continue;
        const occasionKey = `visits:${milestone}`;
        if (occasionAlreadyIssued(issued, visit.phoneDigits, rule._id.toHexString(), occasionKey)) continue;
        const profile = profileByPhone.get(visit.phoneDigits);
        suggestions.push({
          kind: "visits",
          phoneDigits: visit.phoneDigits,
          customerName: profile?.displayName?.trim() || visit.customerName,
          customerPhone: visit.customerPhone,
          occasionKey,
          ruleId: rule._id.toHexString(),
          title: rule.title,
          description: rule.description,
          treatmentIds: rule.treatmentIds,
          validDays: rule.validDays,
          visitCount: visit.visitCount,
          daysUntil: null,
        });
      }
      continue;
    }

    for (const profile of profiles) {
      const monthDay = profile.birthdayMonthDay?.trim() ?? "";
      const upcoming = birthdayWithinWindow(monthDay, todayKey, 7);
      if (!upcoming) continue;
      const occasionKey = `birthday:${upcoming.year}`;
      if (occasionAlreadyIssued(issued, profile.phoneDigits, rule._id.toHexString(), occasionKey)) continue;
      const visit = visits.get(profile.phoneDigits);
      suggestions.push({
        kind: "birthday",
        phoneDigits: profile.phoneDigits,
        customerName: profile.displayName?.trim() || visit?.customerName || "Cliente",
        customerPhone: visit?.customerPhone || profile.phoneDigits,
        occasionKey,
        ruleId: rule._id.toHexString(),
        title: rule.title,
        description: rule.description,
        treatmentIds: rule.treatmentIds,
        validDays: rule.validDays,
        visitCount: visit?.visitCount ?? null,
        daysUntil: upcoming.daysUntil,
      });
    }
  }

  suggestions.sort((a, b) => {
    const dayA = a.daysUntil ?? 99;
    const dayB = b.daysUntil ?? 99;
    if (dayA !== dayB) return dayA - dayB;
    return a.customerName.localeCompare(b.customerName, "es");
  });
  return suggestions;
}
