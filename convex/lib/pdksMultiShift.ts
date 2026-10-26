import type { Doc, Id } from "../_generated/dataModel";
import { computePdksDay } from "./pdksDay";
import { validFixedPunch } from "./pdksFixedRules";
import { relativeMinute } from "./pdksFlexible";
import { parseHHMM } from "./pdksHelpers";
import { effectiveDirection, type PdksDayPolicy } from "./pdksRules";
import type { DayPlan } from "./shiftResolver";

type Day = ReturnType<typeof computePdksDay>;
type Params = Parameters<typeof computePdksDay>[0];
export type PdksSegment = {
  shiftId: Id<"shifts">; shiftName: string; plannedStart: string; plannedEnd: string;
  firstISO: string | null; lastISO: string | null; totalMinutes: number;
  lateMinutes: number; earlyExitMinutes: number; overtimeMinutes: number;
  decision: "present" | "absent" | "incomplete";
};
export type PlannedDay = Omit<Day, "attendanceDecision"> & { attendanceDecision?: Day["attendanceDecision"]; noShift?: boolean; segments?: PdksSegment[]; planKind?: "rest" };
export function plannedDayFields(day: Pick<PlannedDay, "segments" | "planKind" | "noShift">) {
  return { ...(day.noShift ? { noShift: true } : {}), ...(day.segments ? { segments: day.segments } : {}), ...(day.planKind ? { planKind: day.planKind } : {}) };
}

/** A project-scoped view must never leak a shift from another project. */
export function scopedPdksPlan(plan: DayPlan, projectId?: Id<"projects">): DayPlan {
  if (!projectId || plan.kind !== "shifts") return plan;
  const shifts = plan.shifts.filter(shift => shift.projectId === projectId || shift.scheduleType === "flexible" && !shift.projectId);
  return shifts.length ? { ...plan, shifts } : { kind: "none", source: "project" };
}
export function usesPlanDayRules(plan: DayPlan): boolean {
  return plan.kind === "rest" || plan.kind === "shifts" && (plan.calendar === "plan" || plan.shifts.length > 1 || plan.source === "department");
}

function segmentIndex(date: string, accessTime: string, shifts: readonly Doc<"shifts">[], direction?: string): number {
  const windowIndex = shifts.findIndex(shift => shift.validWindow &&
    (direction === "entry" || direction === "exit"
      ? validFixedPunch(shift.validWindow, date, accessTime, direction)
      : validFixedPunch(shift.validWindow, date, accessTime, "entry") || validFixedPunch(shift.validWindow, date, accessTime, "exit")));
  if (windowIndex >= 0) return windowIndex;
  const minute = relativeMinute(date, accessTime);
  for (let i = 0; i < shifts.length - 1; i++) {
    const current = shifts[i], next = shifts[i + 1];
    if (!current || !next) continue;
    const start = parseHHMM(current.startTime);
    const end = parseHHMM(current.endTime) + (current.endTime <= current.startTime ? 1440 : 0);
    const nextStart = parseHHMM(next.startTime);
    if (minute >= end && minute <= nextStart) {
      if (direction === "exit") return i;
      if (direction === "entry") return i + 1;
    }
    if (minute <= end + Math.max(0, nextStart - end) / 2 || minute < start) return i;
  }
  return Math.max(0, shifts.length - 1);
}

export function shiftForInstant(date: string, accessTime: string, plan: DayPlan, direction?: string): Doc<"shifts"> | null {
  return plan.kind === "shifts" ? plan.shifts[segmentIndex(date, accessTime, plan.shifts, direction)] ?? null : null;
}

export function splitReadingsByShift(date: string, readings: readonly Doc<"cardReadings">[], shifts: readonly Doc<"shifts">[], policy?: PdksDayPolicy): Doc<"cardReadings">[][] {
  const buckets: Doc<"cardReadings">[][] = shifts.map(() => []);
  for (const reading of readings) {
    const direction = policy ? effectiveDirection(reading, policy) : reading.direction;
    buckets[segmentIndex(date, reading.accessTime, shifts, direction)]?.push(reading);
  }
  return buckets;
}

export function manualForSegment(manual: Doc<"pdksRecords"> | undefined, index: number, count: number) {
  if (!manual || count <= 1) return manual;
  if (index !== 0 && index !== count - 1) return undefined;
  return { ...manual, entryTime: index === 0 ? manual.entryTime : undefined, exitTime: index === count - 1 ? manual.exitTime : undefined };
}

const decisionFor = (day: Day) => day.attendanceDecision ?? (day.hasAttendance ? day.durationMeasured ? "present" : "incomplete" : "absent");
export function mergePdksDays(days: readonly Day[], shifts: readonly Doc<"shifts">[], dayKind?: Params["dayKind"]): PlannedDay {
  const first = days[0];
  if (!first) throw new Error("Birleştirilecek vardiya günü bulunamadı");
  const sum = (key: "rawTotalMinutes" | "breakMinutes" | "totalMinutes" | "nightMinutes" | "rawNightMinutes" | "overtimeMinutes" | "nightOvertimeMinutes" | "lateMinutes" | "earlyExitMinutes") => days.reduce((total, day) => total + day[key], 0);
  const decisions = days.map(decisionFor);
  const attendanceDecision = decisions.every(d => d === "present") ? "present" : decisions.every(d => d === "absent") ? "absent" : "incomplete";
  const overtimeMinutes = sum("overtimeMinutes");
  const result: PlannedDay = {
    ...first,
    rawTotalMinutes: sum("rawTotalMinutes"), breakMinutes: sum("breakMinutes"), totalMinutes: sum("totalMinutes"),
    nightMinutes: sum("nightMinutes"), rawNightMinutes: sum("rawNightMinutes"), overtimeMinutes,
    nightOvertimeMinutes: sum("nightOvertimeMinutes"), lateMinutes: sum("lateMinutes"), earlyExitMinutes: sum("earlyExitMinutes"),
    overtimeSegments: days.flatMap(day => day.overtimeSegments),
    multiplier: overtimeMinutes > 0 ? days.reduce((total, day) => total + day.multiplier * day.overtimeMinutes, 0) / overtimeMinutes : first.multiplier,
    overtimePayTRY: days.every(day => day.overtimePayTRY === null) ? null : days.reduce((total, day) => total + (day.overtimePayTRY ?? 0), 0),
    firstISO: days.find(day => day.firstISO)?.firstISO ?? null,
    lastISO: [...days].reverse().find(day => day.lastISO)?.lastISO ?? null,
    isLate: days.some(day => day.isLate), isEarlyExit: days.some(day => day.isEarlyExit), exitNextDay: days.some(day => day.exitNextDay),
    hasAttendance: days.some(day => day.hasAttendance), isOvernightShift: days[days.length - 1]?.isOvernightShift ?? false,
    durationMeasured: days.every(day => day.durationMeasured), attendanceDecision,
    punchQuality: attendanceDecision === "present" ? "ok" : attendanceDecision === "absent" ? "noPunch" : days.find(day => day.punchQuality !== "ok")?.punchQuality ?? "missingExit",
    segments: shifts.flatMap((shift, index) => {
      const day = days[index];
      return day ? [{ shiftId: shift._id, shiftName: shift.name, plannedStart: shift.startTime, plannedEnd: shift.endTime,
        firstISO: day.firstISO, lastISO: day.lastISO, totalMinutes: day.totalMinutes, lateMinutes: day.lateMinutes,
        earlyExitMinutes: day.earlyExitMinutes, overtimeMinutes: day.overtimeMinutes, decision: decisionFor(day) }] : [];
    }),
  };
  // Weekly non-working days use the same attendance/calendar precedence as a single shift.
  if (dayKind === undefined && first.classification !== "workday") delete result.attendanceDecision;
  return result;
}

export function computePdksPlannedDay(params: Params & { dayPlan?: DayPlan }): PlannedDay {
  const plan = params.dayPlan;
  if (!plan) return computePdksDay(params);
  // No dated assignment: neither access events, manual edits nor leave create PDKS.
  if (plan.kind === "none") return {
    date: params.date, noShift: true, firstISO: null, lastISO: null,
    rawTotalMinutes: 0, breakMinutes: 0, totalMinutes: 0, overtimeMinutes: 0,
    nightMinutes: 0, rawNightMinutes: 0, nightOvertimeMinutes: 0,
    multiplier: 0, classification: "workday", isLate: false, lateMinutes: 0,
    isEarlyExit: false, earlyExitMinutes: 0, exitNextDay: false,
    isOvernightShift: false, hasAttendance: false, durationMeasured: false,
    punchQuality: "noPunch", overtimePayTRY: null, overtimeSegments: [],
  };
  const dayKind = plan.kind === "rest" ? "rest" : plan.kind === "shifts" && plan.calendar === "plan" ? "work" : undefined;
  if (plan.kind !== "shifts" || plan.shifts.length <= 1) {
    const day = computePdksDay({ ...params, shift: plan.kind === "shifts" ? plan.shifts[0] ?? null : null, dayKind });
    return plan.kind === "rest" ? { ...day, planKind: "rest" } : day;
  }
  const buckets = splitReadingsByShift(params.date, params.readings, plan.shifts, params.policy);
  return mergePdksDays(plan.shifts.map((shift, index) => computePdksDay({ ...params, shift, dayKind,
    readings: buckets[index] ?? [], manual: manualForSegment(params.manual, index, plan.shifts.length),
    manualExitNextDay: index === plan.shifts.length - 1 && shift.endTime <= shift.startTime && !!params.manual?.exitTime && params.manual.exitTime <= shift.startTime,
  })), plan.shifts, dayKind);
}
