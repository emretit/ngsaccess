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

// The existing pure cell model also serves the grid, agenda and day details.
export function calendarDayResolver(
  assignmentsByEmployee: Map<string, Assignment[]>, shifts: Shift[], leaves: Leave[], holidays: Holiday[],
) {
  return (employee: Employee, date: string) => cellData(
    employee, date, assignmentsByEmployee.get(employee._id) ?? [], shifts, leaves, holidays,
  );
}
