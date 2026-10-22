import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { visibleRange, type Employee, type Period } from "../lib/planning";

// Keep definitions outside the plan boundary and range queries inside it.
export function useShiftCalendarDefinitions(projectId: Id<"projects">) {
  const employees = useQuery(api.employees.list, { projectId });
  const shifts = useQuery(api.shifts.list, { projectId });
  return { employees, shifts };
}

export function useShiftCalendarData({ projectId, employees, day, effectivePeriod, search, shiftFilter, page }: {
  projectId: Id<"projects">; employees: Employee[]; day: string; effectivePeriod: Period;
  search: string; shiftFilter: string; page: number;
}) {
  const range = visibleRange(day, effectivePeriod);
  const filtered = employees.filter((e) =>
    `${e.firstName} ${e.lastName} ${e.email ?? ""}`
      .toLocaleLowerCase("tr-TR")
      .includes(search.trim().toLocaleLowerCase("tr-TR")),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * 50, (currentPage + 1) * 50);
  const assignments = useQuery(api.shifts.listAssignments, {
    projectId,
    rangeStart: range.rangeStart,
    rangeEnd: range.rangeEnd,
    employeeIds: visible.map((e) => e._id),
    ...(shiftFilter === "all" ? {} : { shiftId: shiftFilter as Id<"shifts"> }),
  });
  const leaves = useQuery(api.leaves.listForRange, {
    projectId,
    startDate: range.rangeStart,
    endDate: range.rangeEnd,
  });
  const holidays = useQuery(api.holidays.listForRange, {
    startDate: range.rangeStart,
    endDate: range.rangeEnd,
  });
  return { range, filtered, pageCount, currentPage, visible, assignments, leaves, holidays };
}
