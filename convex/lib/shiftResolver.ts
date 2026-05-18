import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { parseHHMM, type EffectiveWorkSettings } from "./pdksHelpers";

type AnyCtx = QueryCtx | MutationCtx;

const WEEKDAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function weekdayCodeForDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  return WEEKDAY_CODES[d.getUTCDay()];
}

export function assignmentAppliesOnDate(
  assignment: Pick<Doc<"shiftAssignments">, "startDate" | "endDate" | "weekPattern">,
  dateISO: string,
): boolean {
  if (dateISO < assignment.startDate || dateISO > assignment.endDate) return false;
  const pattern = assignment.weekPattern;
  if (!pattern || pattern.length === 0) return true;
  return pattern.includes(weekdayCodeForDate(dateISO));
}

export interface ShiftResolver {
  resolve(employeeId: Id<"employees">, dateISO: string): Doc<"shifts"> | null;
  shifts: Map<string, Doc<"shifts">>;
}

export async function buildShiftResolver(
  ctx: AnyCtx,
  employees: Doc<"employees">[],
): Promise<ShiftResolver> {
  const employeeIds = employees.map((e) => e._id);

  const [allShifts, assignmentLists] = await Promise.all([
    ctx.db.query("shifts").collect(),
    Promise.all(
      employeeIds.map((id) =>
        ctx.db
          .query("shiftAssignments")
          .withIndex("by_employee", (q) => q.eq("employeeId", id))
          .collect(),
      ),
    ),
  ]);

  const shiftMap = new Map<string, Doc<"shifts">>();
  for (const s of allShifts) shiftMap.set(String(s._id), s);

  const assignmentsByEmp = new Map<string, Doc<"shiftAssignments">[]>();
  employeeIds.forEach((id, i) => {
    const list = assignmentLists[i].slice().sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    assignmentsByEmp.set(String(id), list);
  });

  const empById = new Map<string, Doc<"employees">>();
  for (const e of employees) empById.set(String(e._id), e);

  return {
    shifts: shiftMap,
    resolve(employeeId, dateISO) {
      const empKey = String(employeeId);
      const list = assignmentsByEmp.get(empKey) ?? [];
      for (const a of list) {
        if (assignmentAppliesOnDate(a, dateISO)) {
          const s = shiftMap.get(String(a.shiftId));
          if (s) return s;
        }
      }
      const emp = empById.get(empKey);
      if (emp?.shiftId) {
        const s = shiftMap.get(String(emp.shiftId));
        if (s) return s;
      }
      return null;
    },
  };
}

export interface ShiftThresholds {
  lateThresholdMin: number;
  earlyThresholdMin: number;
  shiftStartMin: number;
  shiftEndMin: number;
}

export function thresholdsForShift(
  shift: Doc<"shifts"> | null,
  settings: EffectiveWorkSettings,
): ShiftThresholds {
  const startStr = shift?.startTime ?? settings.workStartTime;
  const endStr = shift?.endTime ?? settings.workEndTime;
  const shiftStartMin = parseHHMM(startStr);
  const shiftEndMin = parseHHMM(endStr);
  const lateTolerance = shift?.lateToleranceMinutes ?? settings.maxLateMinutes;
  const earlyTolerance =
    shift?.earlyExitToleranceMinutes ?? settings.earlyExitToleranceMinutes;
  return {
    shiftStartMin,
    shiftEndMin,
    lateThresholdMin: shiftStartMin + lateTolerance,
    earlyThresholdMin: shiftEndMin - earlyTolerance,
  };
}

export function settingsForShift(
  shift: Doc<"shifts"> | null,
  settings: EffectiveWorkSettings,
): EffectiveWorkSettings {
  if (!shift) return settings;
  return {
    ...settings,
    workStartTime: shift.startTime,
    workEndTime: shift.endTime,
    maxLateMinutes: shift.lateToleranceMinutes ?? settings.maxLateMinutes,
    earlyExitToleranceMinutes:
      shift.earlyExitToleranceMinutes ?? settings.earlyExitToleranceMinutes,
  };
}
