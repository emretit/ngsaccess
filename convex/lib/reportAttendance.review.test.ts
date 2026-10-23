import { expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { hasUnsupportedShiftCalendar } from "./reportAttendance";
import type { DayPlan } from "./shiftResolver";

const workingDays = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const shift: Doc<"shifts"> = { _id: "shift" as Id<"shifts">, _creationTime: 0, name: "Sabah", startTime: "08:00", endTime: "12:00", createdAt: "", updatedAt: "" };
const departmentPlan: DayPlan = { kind: "shifts", source: "department", calendar: "project", shifts: [shift], departmentId: "department" as Id<"departments">, departmentAssignmentId: "assignment" as Id<"departmentShiftAssignments"> };
const holiday: Doc<"holidays"> = { _id: "holiday" as Id<"holidays">, _creationTime: 0, date: "2026-06-27", name: "Tatil", createdAt: "" };

it("a resolved department weekly shift on a project weekend warns", () => {
  expect(hasUnsupportedShiftCalendar([], ["2026-06-27"], workingDays, new Map(), () => departmentPlan)).toBe(true);
});
it("matching department weekdays and holidays retain their calendar treatment", () => {
  expect(hasUnsupportedShiftCalendar([], ["2026-06-22"], workingDays, new Map(), () => departmentPlan)).toBe(false);
  expect(hasUnsupportedShiftCalendar([], [holiday.date], workingDays, new Map([[holiday.date, holiday]]), () => departmentPlan)).toBe(false);
});
it("filled and rest cycle days never emit the unsupported calendar warning", () => {
  expect(hasUnsupportedShiftCalendar([], ["2026-06-27"], workingDays, new Map(), () => ({ ...departmentPlan, calendar: "plan" }))).toBe(false);
  expect(hasUnsupportedShiftCalendar([], ["2026-06-22"], workingDays, new Map(), () => ({ kind: "rest", source: "department", calendar: "plan" }))).toBe(false);
});
it("personal weekly rows keep both selected and non-matching day warnings exactly", () => {
  const assignment: Doc<"shiftAssignments"> = { _id: "personal" as Id<"shiftAssignments">, _creationTime: 0, employeeId: "employee" as Id<"employees">, shiftId: shift._id, startDate: "2026-06-01", endDate: "2026-06-30", weekPattern: ["SAT"], createdAt: "", updatedAt: "" };
  for (const date of ["2026-06-22", "2026-06-27", "2026-07-01"]) {
    const legacy = hasUnsupportedShiftCalendar([assignment], [date], workingDays, new Map());
    const plan: DayPlan = date === "2026-06-27" ? { kind: "shifts", source: "employee", calendar: "project", shifts: [shift], assignmentId: assignment._id } : { kind: "none", source: "project" };
    expect(hasUnsupportedShiftCalendar([assignment], [date], workingDays, new Map(), () => plan)).toBe(legacy);
  }
});
