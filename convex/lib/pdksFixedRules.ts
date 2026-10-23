import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { clockMinute, relativeMinute } from "./pdksFlexible";
import { resolveAttendanceEvidence } from "./pdksEvidence";
import { resolvePdksCheckpoint, type PdksDayPolicy } from "./pdksRules";

export type FixedShiftRules = Pick<Doc<"shifts">,
  "validWindow" | "absentAfterLateMinutes" | "minWorkMinutes" | "missingCheckInLateMinutes" | "holidayWorkRequired">;
type Window = NonNullable<FixedShiftRules["validWindow"]>;
export const FIXED_RULE_KEYS = ["validWindow", "absentAfterLateMinutes", "minWorkMinutes", "missingCheckInLateMinutes", "holidayWorkRequired"] as const;

export function hasFixedShiftRules(shift: (FixedShiftRules & { scheduleType?: string }) | null | undefined): boolean {
  return shift?.scheduleType !== "flexible" && !!(shift?.validWindow || shift?.absentAfterLateMinutes !== undefined
    || shift?.minWorkMinutes !== undefined || shift?.missingCheckInLateMinutes !== undefined || shift?.holidayWorkRequired);
}

/** Schedules that must use the shared PDKS day engine, including legacy policies. */
export function usesShiftDayRules(shift: (FixedShiftRules & { scheduleType?: string }) | null | undefined): boolean {
  return shift?.scheduleType === "flexible" || hasFixedShiftRules(shift);
}

export function validateFixedRules(shift: FixedShiftRules & { scheduleType?: string; startTime: string; endTime: string }) {
  if (shift.scheduleType === "flexible") {
    if (FIXED_RULE_KEYS.some(key => shift[key] !== undefined)) throw new ConvexError("Gelişmiş sabit vardiya kuralları esnek vardiyada kullanılamaz");
    return;
  }
  for (const key of ["absentAfterLateMinutes", "minWorkMinutes", "missingCheckInLateMinutes"] as const) {
    const value = shift[key];
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 1440)) {
      throw new ConvexError("Gelişmiş kural süresi 0–1440 arasında tam sayı dakika olmalıdır");
    }
  }
  const window = shift.validWindow;
  if (!window) return;
  try {
    const start = clockMinute(shift.startTime);
    const end = clockMinute(shift.endTime) + (shift.endTime < shift.startTime ? 1440 : 0);
    const entryStart = clockMinute(window.checkInStart), entryEnd = clockMinute(window.checkInEnd);
    const exitStart = clockMinute(window.checkOutStart), exitEnd = fixedExitEnd(window);
    if (window.checkOutEndDayOffset !== 0 && window.checkOutEndDayOffset !== 1) throw new Error("Çıkış gün farkı 0 veya 1 olmalıdır");
    if (entryStart > entryEnd || start < entryStart || start > entryEnd) throw new Error("Giriş penceresi aynı gün içinde olmalı ve vardiya başlangıcını kapsamalıdır");
    if (exitStart > exitEnd || end < exitStart || end > exitEnd) throw new Error("Çıkış penceresi vardiya bitişini kapsamalıdır; gece vardiyasında ertesi günü seçin");
  } catch (error: unknown) {
    throw new ConvexError(error instanceof Error ? error.message : "Geçerli bir saat penceresi girin");
  }
}

// Like flexible schedules, only the exit window's END carries a day offset.
export function fixedExitEnd(window: Window) {
  return clockMinute(window.checkOutEnd) + 1440 * window.checkOutEndDayOffset;
}
export function validFixedPunch(window: Window, date: string, iso: string, direction: "entry" | "exit") {
  const minute = relativeMinute(date, iso);
  return direction === "entry"
    ? minute >= clockMinute(window.checkInStart) && minute <= clockMinute(window.checkInEnd)
    : minute >= clockMinute(window.checkOutStart) && minute <= fixedExitEnd(window);
}

/** Keep raw readings in the caller; only eligible endpoints enter attendance/pairing. */
export function fixedPunchEvidence(params: {
  rules: FixedShiftRules;
  date: string;
  readings: readonly Doc<"cardReadings">[];
  manual: { entryISO?: string; exitISO?: string };
  policy: PdksDayPolicy;
}) {
  const { rules, date, policy } = params;
  const window = rules.validWindow;
  let outsideWindow = false;
  const accepts = (iso: string, direction: "entry" | "exit") => !window || validFixedPunch(window, date, iso, direction);
  const readings: Doc<"cardReadings">[] = [];
  for (const reading of params.readings) {
    const point = resolvePdksCheckpoint(reading, policy)?.pointType;
    const direction = point === "entry" || point === "exit" ? point : reading.direction;
    if (direction === "entry" || direction === "exit") {
      if (accepts(reading.accessTime, direction)) readings.push({ ...reading, direction });
      else outsideWindow = true;
    } else if (window && policy.punchMode === "legacy" && policy.calculationMode !== "eachPunch") {
      // Legacy undirected readers retain first/last inference, within each window.
      const canEnter = accepts(reading.accessTime, "entry"), canExit = accepts(reading.accessTime, "exit");
      const inferred = canEnter && (!canExit || !params.manual.entryISO && !readings.some(r => r.direction === "entry")) ? "entry" : "exit";
      if (accepts(reading.accessTime, inferred)) readings.push({ ...reading, direction: inferred });
      else outsideWindow = true;
    } else if (accepts(reading.accessTime, "entry") || accepts(reading.accessTime, "exit")) readings.push(reading);
    else outsideWindow = true;
  }
  const manual: { entryISO?: string; exitISO?: string } = {};
  for (const [key, direction] of [["entryISO", "entry"], ["exitISO", "exit"]] as const) {
    const iso = params.manual[key];
    if (!iso) continue;
    if (accepts(iso, direction)) manual[key] = iso;
    else outsideWindow = true;
  }
  const evidence = resolveAttendanceEvidence(readings, manual, policy.punchMode === "legacy"
    ? { ...policy, punchMode: "requirements", requireCheckIn: false, requireCheckOut: false }
    : policy);
  const missingEntryLate = !evidence.firstISO && !!evidence.lastISO && rules.missingCheckInLateMinutes !== undefined;
  if (missingEntryLate) {
    evidence.decision = "present";
    evidence.attendanceCredit = true;
  }
  if (outsideWindow) {
    evidence.decision = "incomplete";
    evidence.attendanceCredit = false;
  }
  return { readings, manual, evidence, outsideWindow, missingEntryLate };
}
