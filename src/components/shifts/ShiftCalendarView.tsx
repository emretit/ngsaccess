import { useMemo, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { ShiftCalendarGrid } from "./ShiftCalendarGrid";
import { AssignShiftDialog } from "./AssignShiftDialog";
import { AssignmentEditDialog } from "./AssignmentEditDialog";
import { formatWeekRange, getWeekStart } from "./lib/weekUtils";
import { addDays } from "date-fns";

type Employee = FunctionReturnType<typeof api.employees.list>[number];
type Shift = FunctionReturnType<typeof api.shifts.list>[number];
type Assignment = FunctionReturnType<typeof api.shifts.listAssignments>[number];

interface ShiftCalendarViewProps {
  employees: Employee[];
  shifts: Shift[];
  assignments: Assignment[];
}

export function ShiftCalendarView({
  employees,
  shifts,
  assignments,
}: ShiftCalendarViewProps) {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getWeekStart(new Date()),
  );
  const [search, setSearch] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignInitial, setAssignInitial] = useState<{
    employeeId?: string;
    startDate?: string;
    endDate?: string;
  }>({});
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter((e) =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q),
    );
  }, [employees, search]);

  const employeeNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e._id, `${e.firstName} ${e.lastName}`);
    return m;
  }, [employees]);

  const shiftNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shifts) m.set(s._id, s.name);
    return m;
  }, [shifts]);

  const goPrev = () => setWeekStart((w) => addDays(w, -7));
  const goNext = () => setWeekStart((w) => addDays(w, 7));
  const goToday = () => setWeekStart(getWeekStart(new Date()));

  const handleEmptyCellClick = (employeeId: string, date: string) => {
    setAssignInitial({ employeeId, startDate: date, endDate: date });
    setAssignDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            Bu Hafta
          </Button>
          <Button variant="outline" size="sm" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium">
            {formatWeekRange(weekStart)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Çalışan ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full sm:w-56"
          />
          <Button
            onClick={() => {
              setAssignInitial({});
              setAssignDialogOpen(true);
            }}
          >
            Vardiya Ata
          </Button>
        </div>
      </div>

      <ShiftCalendarGrid
        weekStart={weekStart}
        employees={filteredEmployees}
        shifts={shifts}
        assignments={assignments}
        onEmptyCellClick={handleEmptyCellClick}
        onAssignmentClick={(a) => setEditAssignment(a)}
      />

      <AssignShiftDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        employees={employees}
        shifts={shifts}
        assignments={assignments}
        initial={assignInitial}
      />

      <AssignmentEditDialog
        open={editAssignment !== null}
        onOpenChange={(o) => !o && setEditAssignment(null)}
        assignment={editAssignment}
        shifts={shifts}
        shiftName={
          editAssignment
            ? shiftNameMap.get(editAssignment.shiftId) ?? "Vardiya"
            : ""
        }
        employeeName={
          editAssignment
            ? employeeNameMap.get(editAssignment.employeeId) ?? "Çalışan"
            : ""
        }
      />
    </div>
  );
}
