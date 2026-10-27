import { planShiftIds } from "../../../../convex/lib/shiftPlan";
import { scheduleIntervals } from "../../../../convex/lib/shiftUx";
import { holidayOn, leaveForEmployeeOn } from "../lib/calendarOverlays";
import { offsetDay, type PlanCell, type DepartmentAssignment, type Department, type DayData } from "../lib/planning";
import { cellData, type Assignment, type Employee, type Shift } from "../lib/planning";
import type { Leave, Holiday } from "../lib/calendarOverlays";

export function groupAssignments(assignments: Assignment[]) {
  const grouped = new Map<string, Assignment[]>();
  for (const assignment of assignments) {
    const list = grouped.get(assignment.employeeId) ?? [];
    list.push(assignment);
    grouped.set(assignment.employeeId, list);
  }
  return grouped;
}

// Legacy adapter retained for older export consumers and compatibility fixtures.
// The live calendar uses resolvedCalendarDay with server planCells below.
export function calendarDayResolver(
  assignmentsByEmployee: Map<string, Assignment[]>, shifts: Shift[], leaves: Leave[], holidays: Holiday[],
) {
  return (employee: Employee, date: string) => cellData(
    employee, date, assignmentsByEmployee.get(employee._id) ?? [], shifts, leaves, holidays,
  );
}

/** Sunucu o gün eski sürümü çözdüyse saatleri o sürümden alır; yoksa güncel tanım. */
function shiftOnDay(shifts: Shift[], cell: PlanCell | undefined, id: Shift["_id"]): Shift | undefined {
  const shift = shifts.find(item => item._id === id);
  const version = cell?.versionedShifts?.find(item => item.shiftId === id);
  return shift && version ? { ...shift, startTime: version.startTime, endTime: version.endTime,
    scheduleType: version.scheduleType, flexible: version.flexible ?? undefined } : shift;
}
/** Hydrate the server's decision; priority and cycle resolution belong to planCells. */
export function resolvedCalendarDay(
  employee: Employee, date: string, cell: PlanCell | undefined, assignments: Assignment[], shifts: Shift[],
  departmentAssignments: DepartmentAssignment[], departments: Department[], leaves: Leave[], holidays: Holiday[], previousCell?: PlanCell,
): DayData {
  const assignment = assignments.find(row => row._id === cell?.assignmentId);
  const resolvedShifts = cell?.shiftIds.flatMap(id => { const shift = shiftOnDay(shifts, cell, id); return shift ? [shift] : []; }) ?? [];
  const previousAssignment = assignments.find(row => row._id === previousCell?.assignmentId);
  const previousNightShifts = (previousCell?.shiftIds ?? []).flatMap(id => {
    const shift = shiftOnDay(shifts, previousCell, id);
    return shift && shift.scheduleType !== "flexible" && shift.endTime < shift.startTime ? [shift] : [];
  });
  const continuations = previousAssignment ? previousNightShifts.map(shift => ({ assignment: previousAssignment, shift, continuation: true })) : [];
  const shiftMap = new Map(shifts.map(shift => [String(shift._id), shiftOnDay(shifts, cell, shift._id) ?? shift]));
  const dayStart = Date.parse(date) / 60000;
  // Keep the existing personal-layer conflict marker without choosing a winner on the client.
  const intervals = assignments.map(row => {
    const referencedIds = row.plan ? planShiftIds(row.plan) : [row.shiftId];
    const referencedShifts = new Map(referencedIds.flatMap(id => {
      const shift = shiftMap.get(id);
      return shift ? [[id, shift] as const] : [];
    }));
    const first = referencedShifts.values().next().value;
    if (!first || referencedShifts.size !== referencedIds.length) return [];
    return scheduleIntervals({ ...row, startDate: row.startDate > offsetDay(date, -1) ? row.startDate : offsetDay(date, -1), endDate: row.endDate < date ? row.endDate : date }, first, referencedShifts)
      .map(([start, end]) => [Math.max(start, dayStart), Math.min(end, dayStart + 1440)] as const).filter(([start, end]) => start < end);
  });
  const conflict = intervals.some((list, index) => intervals.slice(index + 1).some(other => list.some(([start, end]) => other.some(([a, b]) => start < b && a < end))));
  return {
    records: [...continuations, ...(assignment ? resolvedShifts.map(shift => ({ assignment, shift, continuation: false })) : [])],
    ...(previousCell && !previousAssignment && previousNightShifts.length ? {
      inheritedContinuations: previousNightShifts.map(shift => ({
        shift, source: previousCell.source,
        departmentAssignment: departmentAssignments.find(row => row._id === previousCell.departmentAssignmentId),
        departmentName: departments.find(item => item._id === previousCell.departmentId)?.name,
      })),
    } : {}),
    conflict,
    leave: leaveForEmployeeOn(date, employee._id, leaves),
    holiday: holidayOn(date, holidays.filter(holiday => !holiday.projectId || holiday.projectId === employee.projectId)),
    ...(cell ? { resolved: { cell, shifts: resolvedShifts, assignment,
      departmentAssignment: departmentAssignments.find(row => row._id === cell.departmentAssignmentId),
      departmentName: departments.find(item => item._id === cell.departmentId)?.name,
    } } : {}),
  };
}
