import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Giriş/çıkış penceresi alanları; `validWindow` ve esnek vardiya aynı biçimi paylaşır. */
const windowFields = {
  checkInStart: v.string(), checkInEnd: v.string(),
  checkOutStart: v.string(), checkOutEnd: v.string(),
  checkOutEndDayOffset: v.union(v.literal(0), v.literal(1)),
};
/**
 * Vardiya hesap alanlarının geçerlilik tarihli sürümleri.
 * `shifts` belgesi bugünden itibaren geçerli değerleri tutar; her `shiftVersions` satırı
 * `validUntil` tarihine kadar (dahil) geçerli olan ESKİ değerlerin anlık görüntüsüdür.
 * Ad ve aktiflik sürümlenmez; tür (sabit/esnek) değişikliği yeni tanım gerektirir.
 */
export const shiftRuleFields = {
  scheduleType: v.optional(v.union(v.literal("fixed"), v.literal("flexible"))),
  flexible: v.optional(v.object({
    requiredNetMinutes: v.number(),
    ...windowFields,
    maxSpanMinutes: v.number(),
    breakMode: v.union(v.literal("duration"), v.literal("existingLegal")),
    breakMinutes: v.optional(v.number()),
  })),
  validWindow: v.optional(v.object(windowFields)),
  absentAfterLateMinutes: v.optional(v.number()),
  minWorkMinutes: v.optional(v.number()),
  missingCheckInLateMinutes: v.optional(v.number()),
  holidayWorkRequired: v.optional(v.boolean()),
  startTime: v.string(),
  endTime: v.string(),
  breakStart: v.optional(v.string()),
  breakEnd: v.optional(v.string()),
  lateToleranceMinutes: v.optional(v.number()),
  earlyExitToleranceMinutes: v.optional(v.number()),
  overtimeStartToleranceMinutes: v.optional(v.number()),
  overtimeEnabled: v.optional(v.boolean()),
};
export const shiftRulesValidator = v.object(shiftRuleFields);
export type ShiftRules = Pick<Doc<"shifts">, keyof typeof shiftRuleFields>;
export const SHIFT_RULE_KEYS = Object.keys(shiftRuleFields) as (keyof ShiftRules)[];

/** Belgeden yalnız hesap alanlarını alır; tanımsız alanlar anlık görüntüye yazılmaz. */
export function ruleSnapshot(shift: ShiftRules): ShiftRules {
  const snapshot: Partial<Record<keyof ShiftRules, unknown>> = {};
  for (const key of SHIFT_RULE_KEYS) if (shift[key] !== undefined) snapshot[key] = shift[key];
  return snapshot as ShiftRules;
}

/** Eski sürümü uygular: belgedeki tüm hesap alanları silinir, yerine anlık görüntü konur. */
export function applyShiftRules(shift: Doc<"shifts">, rules: ShiftRules): Doc<"shifts"> {
  const base: Partial<Doc<"shifts">> = { ...shift };
  for (const key of SHIFT_RULE_KEYS) delete base[key];
  return { ...base, ...rules } as Doc<"shifts">;
}

/** Bir tanımın tutulabilecek en fazla geçmiş sürümü (yazma tarafında da uygulanır). */
export const MAX_VERSIONS_PER_SHIFT = 200;
export type ShiftVersionRow = Pick<Doc<"shiftVersions">, "shiftId" | "validUntil" | "rules">;
/** Sürümlerden tarihe göre vardiya üretir; aynı sürüm için hep aynı nesne döner. */
export function createVersionedShiftLookup(shifts: ReadonlyMap<string, Doc<"shifts">>, versions: readonly ShiftVersionRow[]) {
  const byShift = new Map<string, { validUntil: string; shift: Doc<"shifts"> }[]>();
  for (const version of versions) {
    const shift = shifts.get(version.shiftId);
    if (!shift) continue;
    const list = byShift.get(version.shiftId) ?? [];
    list.push({ validUntil: version.validUntil, shift: applyShiftRules(shift, version.rules) });
    byShift.set(version.shiftId, list);
  }
  for (const list of byShift.values()) list.sort((a, b) => a.validUntil.localeCompare(b.validUntil));
  return (id: Id<"shifts">, date: string): Doc<"shifts"> | undefined => {
    const list = byShift.get(id);
    return list?.find(version => date <= version.validUntil)?.shift ?? shifts.get(id);
  };
}

/** Yalnız geçmişi olan vardiyalar için, aralığın başından sonra biten sürümleri okur. */
export async function loadShiftVersions(ctx: Pick<QueryCtx, "db">, shifts: readonly Doc<"shifts">[], rangeStart?: string): Promise<Doc<"shiftVersions">[]> {
  const versioned = shifts.filter(shift => shift.versionedUntil !== undefined && (!rangeStart || shift.versionedUntil >= rangeStart));
  const lists = await Promise.all(versioned.map(shift => ctx.db.query("shiftVersions")
    .withIndex("by_shift_until", q => rangeStart ? q.eq("shiftId", shift._id).gte("validUntil", rangeStart) : q.eq("shiftId", shift._id))
    .take(MAX_VERSIONS_PER_SHIFT)));
  return lists.flat();
}
