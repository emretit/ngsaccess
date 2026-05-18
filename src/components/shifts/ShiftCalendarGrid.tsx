import { useMemo } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { ShiftCalendarCell } from "./ShiftCalendarCell";
import {
  formatDayHeader,
  getWeekDays,
  isDateInRange,
  isSameDay,
  toISODate,
} from "./lib/weekUtils";
import {
  holidayOn,
  leaveForEmployeeOn,
  assignmentAppliesOnDate,
} from "./lib/calendarOverlays";
import { cn } from "@/lib/utils";

type Employee = FunctionReturnType<typeof api.employees.list>[number];
type Shift = FunctionReturnType<typeof api.shifts.list>[number];
type Assignment = FunctionReturnType<typeof api.shifts.listAssignments>[number];
type Holiday = FunctionReturnType<typeof api.holidays.listForRange>[number];
type Leave = FunctionReturnType<typeof api.leaves.listForRange>[number];

interface ShiftCalendarGridProps {
  weekStart: Date;
  employees: Employee[];
  shifts: Shift[];
  assignments: Assignment[];
  leaves?: Leave[];
  holidays?: Holiday[];
  onEmptyCellClick: (employeeId: string, date: string) => void;
  onAssignmentClick: (assignment: Assignment) => void;
}

export function ShiftCalendarGrid({
  weekStart,
  employees,
  shifts,
  assignments,
  leaves = [],
  holidays = [],
  onEmptyCellClick,
  onAssignmentClick,
}: ShiftCalendarGridProps) {
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const today = new Date();

  const shiftMap = useMemo(() => {
    const m = new Map<string, Shift>();
    for (const s of shifts) m.set(s._id, s);
    return m;
  }, [shifts]);

  const assignmentsByEmployee = useMemo(() => {
    const m = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const list = m.get(a.employeeId) ?? [];
      list.push(a);
      m.set(a.employeeId, list);
    }
    return m;
  }, [assignments]);

  if (employees.length === 0) {
    return (
      <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
        Görüntülenecek çalışan yok.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
      <div className="min-w-[820px]">
        <div className="grid grid-cols-[180px_repeat(7,minmax(100px,1fr))] border-b bg-muted/40">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
            Çalışan
          </div>
          {days.map((d) => {
            const { weekday, dayMonth } = formatDayHeader(d);
            const todayCol = isSameDay(d, today);
            return (
              <div
                key={toISODate(d)}
                className={cn(
                  "px-2 py-2 text-center text-xs",
                  todayCol && "bg-primary/10",
                )}
              >
                <div className="font-semibold uppercase text-muted-foreground">
                  {weekday}
                </div>
                <div className="mt-0.5 text-foreground">{dayMonth}</div>
              </div>
            );
          })}
        </div>

        {employees.map((emp) => {
          const empAssignments = assignmentsByEmployee.get(emp._id) ?? [];
          return (
            <div
              key={emp._id}
              className="grid grid-cols-[180px_repeat(7,minmax(100px,1fr))] border-b last:border-b-0"
            >
              <div className="sticky left-0 z-10 flex flex-col justify-center bg-background px-3 py-2 text-sm">
                <span className="truncate font-medium leading-tight">
                  {emp.firstName} {emp.lastName}
                </span>
                {emp.email && (
                  <span className="truncate text-[11px] text-muted-foreground leading-tight">
                    {emp.email}
                  </span>
                )}
              </div>
              {days.map((d) => {
                const iso = toISODate(d);
                const cellAssignments = empAssignments.filter(
                  (a) =>
                    isDateInRange(iso, a.startDate, a.endDate) &&
                    assignmentAppliesOnDate(a, iso),
                );
                const holiday = holidayOn(iso, holidays);
                const leave = leaveForEmployeeOn(iso, String(emp._id), leaves);
                return (
                  <div key={iso} className="p-1">
                    <ShiftCalendarCell
                      isToday={isSameDay(d, today)}
                      cellAssignments={cellAssignments}
                      shiftMap={shiftMap}
                      holiday={holiday}
                      leave={leave}
                      onEmptyClick={() => onEmptyCellClick(emp._id, iso)}
                      onAssignmentClick={onAssignmentClick}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
