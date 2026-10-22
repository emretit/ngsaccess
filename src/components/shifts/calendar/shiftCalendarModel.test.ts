import { describe, expect, it } from "vitest";
import { calendarDayResolver, groupAssignments } from "./shiftCalendarModel";
import { cellData, type Employee, type Shift, type Assignment } from "../lib/planning";
import type { Leave, Holiday } from "../lib/calendarOverlays";

const employee = { _id: "e1", projectId: "p1", firstName: "Ayşe", lastName: "Demir" } as Employee;
const shifts = [
  { _id: "night", name: "Gece", startTime: "22:00", endTime: "06:00" },
  { _id: "morning", name: "Sabah", startTime: "05:00", endTime: "09:00" },
] as Shift[];
const assignments = [
  { _id: "a1", employeeId: "e1", shiftId: "night", startDate: "2026-10-19", endDate: "2026-10-19" },
  { _id: "other", employeeId: "e2", shiftId: "morning", startDate: "2026-10-20", endDate: "2026-10-20" },
  { _id: "a2", employeeId: "e1", shiftId: "morning", startDate: "2026-10-20", endDate: "2026-10-20" },
] as Assignment[];
const leaves = [
  { _id: "pending", employeeId: "e1", status: "pending", startDate: "2026-10-20", endDate: "2026-10-20", leaveType: "sick" },
  { _id: "leave", employeeId: "e1", status: "approved", startDate: "2026-10-20", endDate: "2026-10-20", leaveType: "annual" },
] as Leave[];
const holidays = [
  { _id: "other-holiday", projectId: "p2", date: "2026-10-20", name: "Başka proje" },
  { _id: "holiday", projectId: "p1", date: "2026-10-20", name: "Proje tatili", isHalfDay: true },
] as Holiday[];

function summarize(data: ReturnType<typeof cellData>) {
  return {
    records: data.records.map(({ assignment, shift, continuation }) => ({ id: assignment._id, shift: shift.name, continuation })),
    conflict: data.conflict, leave: data.leave?._id ?? null, holiday: data.holiday?._id ?? null,
  };
}

describe("Takvim gün modeli golden", () => {
  it("gece devamı, çakışma, onaylı izin ve proje tatilini aynı hücrede korur", () => {
    const resolve = calendarDayResolver(groupAssignments(assignments), shifts, leaves, holidays);
    expect(summarize(resolve(employee, "2026-10-20"))).toEqual({
      records: [
        { id: "a1", shift: "Gece", continuation: true },
        { id: "a2", shift: "Sabah", continuation: false },
      ],
      conflict: true, leave: "leave", holiday: "holiday",
    });
  });

  it("boş gün ve genel tatil golden sonuçlarını korur", () => {
    const resolve = calendarDayResolver(groupAssignments([]), shifts, [], [
      { _id: "global", date: "2026-10-21", name: "Genel tatil" } as Holiday,
    ]);
    expect(summarize(resolve(employee, "2026-10-21"))).toEqual({ records: [], conflict: false, leave: null, holiday: "global" });
    expect(summarize(resolve(employee, "2026-10-22"))).toEqual({ records: [], conflict: false, leave: null, holiday: null });
  });

  it("gruplama sırasını ve önceki ortak model sonuçlarını korur", () => {
    const grouped = groupAssignments(assignments);
    expect(grouped.get("e1")?.map((assignment) => assignment._id)).toEqual(["a1", "a2"]);
    const resolve = calendarDayResolver(grouped, shifts, leaves, holidays);
    for (const date of ["2026-10-19", "2026-10-20", "2026-10-21"]) {
      expect(resolve(employee, date)).toEqual(cellData(employee, date, assignments, shifts, leaves, holidays));
    }
  });
});
