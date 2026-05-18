import { useMemo, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, ChevronLeft, ChevronRight, Calendar, Plus, Search } from "lucide-react";
import { ShiftCalendarGrid } from "./ShiftCalendarGrid";
import { AssignShiftDialog } from "./AssignShiftDialog";
import { AssignmentEditDialog } from "./AssignmentEditDialog";
import { formatWeekRange, getWeekStart } from "./lib/weekUtils";
import { addDays } from "date-fns";

type Employee = FunctionReturnType<typeof api.employees.list>[number];
type Shift = FunctionReturnType<typeof api.shifts.list>[number];
type Assignment = FunctionReturnType<typeof api.shifts.listAssignments>[number];
type Holiday = FunctionReturnType<typeof api.holidays.listForRange>[number];
type Leave = FunctionReturnType<typeof api.leaves.listForRange>[number];

interface ShiftCalendarViewProps {
  employees: Employee[];
  shifts: Shift[];
  assignments: Assignment[];
  leaves?: Leave[];
  holidays?: Holiday[];
  onNavigateToDefinitions?: () => void;
}

export function ShiftCalendarView({
  employees,
  shifts,
  assignments,
  leaves = [],
  holidays = [],
  onNavigateToDefinitions,
}: ShiftCalendarViewProps) {
  const hasNoShifts = shifts.length === 0;
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
    if (hasNoShifts) {
      onNavigateToDefinitions?.();
      return;
    }
    setAssignInitial({ employeeId, startDate: date, endDate: date });
    setAssignDialogOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card shadow-xs p-4 md:p-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 mr-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <CalendarDays className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight">Vardiya Takvimi</h2>
              <p className="text-xs text-muted-foreground">
                {formatWeekRange(weekStart)}
              </p>
            </div>
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Çalışan ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={goPrev} className="h-8 w-8 p-0">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday} className="h-8 gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5" />
                Bu Hafta
              </Button>
              <Button variant="outline" size="sm" onClick={goNext} className="h-8 w-8 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                if (hasNoShifts) {
                  onNavigateToDefinitions?.();
                  return;
                }
                setAssignInitial({});
                setAssignDialogOpen(true);
              }}
              disabled={hasNoShifts && !onNavigateToDefinitions}
              title={hasNoShifts ? "Önce vardiya tanımlayın" : undefined}
            >
              <Plus className="h-3.5 w-3.5" />
              {hasNoShifts ? "Vardiya Tanımla" : "Vardiya Ata"}
            </Button>
          </div>
        </div>
      </div>

      <ShiftCalendarGrid
        weekStart={weekStart}
        employees={filteredEmployees}
        shifts={shifts}
        assignments={assignments}
        leaves={leaves}
        holidays={holidays}
        onEmptyCellClick={handleEmptyCellClick}
        onAssignmentClick={(a) => setEditAssignment(a)}
      />

      <AssignShiftDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        employees={employees}
        shifts={shifts}
        assignments={assignments}
        leaves={leaves}
        holidays={holidays}
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
