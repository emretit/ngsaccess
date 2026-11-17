import { shiftExportRows } from "@/lib/shiftExport";
import { usePermissions } from "@/hooks/usePermissions";
import { ClearAssignmentsDialog } from '../ClearAssignmentsDialog';

import { csvExport, downloadExport, exportFilenamePart, xlsxExport } from '@/lib/spreadsheetExport';
import { notify } from '@/lib/notify';
import { ShiftSelect } from "../ShiftSelect";
import { assignmentInitial, offsetDay, shiftTimeLabel } from "../lib/planning";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BulkBar } from "@/components/shared/BulkBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Button } from "@/components/ui/button";
import { PaginationBar, pageRange } from "@/components/shared/PaginationBar";
import { useListSelection } from "@/hooks/useListSelection";
import { ShiftCalendarGrid, type CalendarProps } from "../ShiftCalendarGrid";
import { ShiftAgendaView } from "../ShiftAgendaView";
import { ShiftDayDetails } from "../ShiftDayDetails";
import { AssignShiftDialog } from "../AssignShiftDialog";
import { AssignmentEditDialog } from "../AssignmentEditDialog";
import {
  istanbulToday,
  type Assignment,
  type DepartmentAssignment,
  type Employee,
  type Period,
  type Shift,
} from "../lib/planning";
import { useShiftCalendarData } from "./useShiftCalendarData";
import { resolvedCalendarDay, groupAssignments } from "./shiftCalendarModel";
import { openCalendarDay } from "./calendarActions";
import { createPortal } from "react-dom";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarNavigation } from "./CalendarNavigation";
function useCompact() {
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setCompact(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return compact;
}
export function ShiftCalendarPlan({
  projectId,
  projectName,
  employees,
  shifts,
  openDefinitions,
  definitionsLoading = false,
  shiftFilter: controlledShiftFilter,
  onShiftFilterChange,
  actionsContainer,
}: {
  projectId: Id<"projects">;
  projectName: string;
  employees: Employee[];
  shifts: Shift[];
  openDefinitions: () => void;
  definitionsLoading?: boolean;
  shiftFilter?: string;
  onShiftFilterChange?: (value: string) => void;
  actionsContainer?: HTMLDivElement | null;
}) {
  const { can } = usePermissions();
  const canManage = can("schedule.manage");
  const [clearOpen, setClearOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const compact = useCompact();
  const navigate = useNavigate();
  const [day, setDay] = useState(istanbulToday);
  const [period, setPeriod] = useState<Period>("week");
  const effectivePeriod = compact ? "day" : period;
  const [search, setSearch] = useState("");
  const [localShiftFilter, setLocalShiftFilter] = useState("all");
  const shiftFilter = controlledShiftFilter ?? localShiftFilter;
  const setShiftFilter = onShiftFilterChange ?? setLocalShiftFilter;
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assign, setAssign] = useState<{
    employeeIds?: string[];
    startDate?: string;
    endDate?: string;
  } | null>(null);
  const [detail, setDetail] = useState<{
    employee: Employee;
    date: string;
  } | null>(null);
  const [edit, setEdit] = useState<Assignment | DepartmentAssignment | null>(null);
  const { range, filtered, pageCount, currentPage, visible, assignments, leaves, holidays, cells, departmentAssignments, departments } =
    useShiftCalendarData({ projectId, employees, day, effectivePeriod, search, page });
  const exportPlan = async (format: 'xlsx' | 'csv') => {
    if (!can("reports.view") || !assignments || exporting) return;
    setExporting(true);
    try {
      const rows = shiftExportRows(visible, range.days, assignments, shifts, getData);
      const blob = format === 'xlsx' ? await xlsxExport(rows, 'Vardiyalar') : new Blob([csvExport(rows)], { type: 'text/csv;charset=utf-8' });
      downloadExport(blob, `vardiyalar-${exportFilenamePart(projectName)}-${range.rangeStart}_${range.rangeEnd}.${format}`);
    } catch (error: unknown) { notify.error('Vardiyalar aktarılamadı', error); }
    finally { setExporting(false); }
  };
  const active = shifts.filter((s) => s.isActive !== false);
  const loading =
    definitionsLoading || assignments === undefined || leaves === undefined || holidays === undefined || cells === undefined || departmentAssignments === undefined || departments === undefined;
  const assignmentsByEmployee = useMemo(() => groupAssignments(assignments ?? []), [assignments]);
  const cellMap = useMemo(() => new Map((cells ?? []).map(cell => [`${cell.employeeId}|${cell.date}`, cell])), [cells]);
  const getData = (employee: Employee, date: string) => {
    const cell = cellMap.get(`${employee._id}|${date}`);
    const previous = cellMap.get(`${employee._id}|${offsetDay(date, -1)}`);
    const showPrevious = shiftFilter === "all" || previous?.shiftIds.includes(shiftFilter as Id<"shifts">);
    const shown = shiftFilter === "all" || cell?.shiftIds.includes(shiftFilter as Id<"shifts">);
    return resolvedCalendarDay(employee, date, shown ? cell : undefined, (shown || showPrevious) ? assignmentsByEmployee.get(employee._id) ?? [] : [], shifts, departmentAssignments ?? [], departments ?? [], leaves ?? [], holidays ?? [], showPrevious ? previous : undefined);
  };
  const clearSelection = () => setSelected(new Set());
  const changeDay = (next: string) => {
    if (!next) return;
    setDay(next);
    clearSelection();
  };
  const selection = useListSelection({ visibleIds: visible.map((employee) => employee._id), selected, onChange: setSelected });
  const calendarProps: CalendarProps = {
    employees: visible,
    days: range.days,
    getData,
    onOpen: (employee: Employee, date: string) => openCalendarDay(
      employee, date, canManage && active.length > 0, getData(employee, date), setAssign, setDetail,
    ),
    canAssign: canManage && active.length > 0,
    ...(canManage ? {
      selectAll: {
        checked: selection.checked,
        onToggle: () => selection.selectAll(selection.checked !== true),
      },
      onSelect: selection.toggle,
    } : {}),
    selected,
  };
  const emptyState =
    !shifts.length ? (
        <EmptyState
          title="Henüz vardiya tanımlanmamış"
          description={canManage ? "Atama yapmak için önce bir vardiya tanımlayın." : "Vardiya tanımlarını yetkili yöneticiler ekler."}
          action={canManage ? { label: "Vardiya tanımla", onClick: openDefinitions } : undefined}
        />
      ) : !employees.length ? (
        <EmptyState title="Bu projede çalışan yok" description="Plan oluşturmak için önce çalışan ekleyin." action={{ label: "Kişileri aç", onClick: () => navigate("/employees") }} />
      ) : !filtered.length ? (
        <EmptyState title="Aramayla eşleşen çalışan yok" description="Başka bir ad deneyin veya filtreleri temizleyin." />
      ) : undefined;

  const actions = (
    <CalendarHeader activeCount={active.length} loading={loading} exporting={exporting}
      onAssign={() => setAssign(assignmentInitial(day))}
      onExport={exportPlan} onClear={() => setClearOpen(true)} />
  );

  return (
    <div className="overflow-hidden rounded-lg border bg-surface [&_button]:max-sm:min-h-11 [&_input]:max-sm:min-h-11">
      {actionsContainer ? createPortal(actions, actionsContainer) : actionsContainer === undefined ? actions : null}
      {clearOpen && <ClearAssignmentsDialog projectId={projectId} onClose={() => { setClearOpen(false); clearSelection(); }} />}
      {!definitionsLoading && shifts.length > 0 && !active.length && (
        <p role="status" className="text-sm text-muted-foreground">
          Tüm vardiya tanımları pasif; mevcut atamalar görünür ama yeni atama yapılamaz.
          {canManage && <> <Button variant="link" className="h-auto p-0 align-baseline" onClick={openDefinitions}>Vardiya tanımlarından bir vardiyayı etkinleştirin</Button>.</>}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3 sm:px-4">
        <CalendarNavigation day={day} effectivePeriod={effectivePeriod} period={period} compact={compact}
          range={range} changeDay={changeDay} setPeriod={setPeriod} clearSelection={clearSelection} />
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input aria-label="Çalışan ara" placeholder="Çalışan ara" value={search}
              className="h-9 border-line bg-background pl-9" onChange={event => {
                setSearch(event.target.value); setPage(0); clearSelection();
              }} />
          </div>
          <div className="flex items-center gap-2">
            {!onShiftFilterChange && <div className="w-44">
              <ShiftSelect label="Vardiya" value={shiftFilter} onChange={value => { setShiftFilter(value); clearSelection(); }}
                options={[{ value: "all", label: "Tüm vardiyalar" }, ...shifts.map(shift => ({ value: shift._id, label: `${shift.name} · ${shiftTimeLabel(shift)}` }))]} />
            </div>}
            {(search.trim() !== "" || shiftFilter !== "all") && <Button variant="ghost" className="px-2" onClick={() => {
              setSearch(""); setShiftFilter("all"); setPage(0); clearSelection();
            }}>Temizle</Button>}
          </div>
        </div>
      </div>
      {canManage && <BulkBar count={selected.size} onClear={clearSelection}>
        <Button
          disabled={loading || !active.length}
          onClick={() =>
            setAssign(assignmentInitial(day, [...selected]))
          }
        >
          Seçilenlere ata
        </Button>
      </BulkBar>}
      {!loading && !emptyState && !(cells ?? []).some(cell => cell.kind !== "none") && assignments?.length === 0 && (
        <p className="border-b px-4 py-2 text-xs text-muted-foreground">Bu dönemde atama yok.</p>
      )}
      {compact ? loading ? <SectionSkeleton label={definitionsLoading ? "Çalışanlar ve vardiyalar yükleniyor" : "Plan, izin ve tatiller kontrol ediliyor"} /> : emptyState ?? <ShiftAgendaView {...calendarProps} /> : (
        <ShiftCalendarGrid {...calendarProps} loading={loading} loadingLabel={definitionsLoading ? "Çalışanlar ve vardiyalar yükleniyor" : undefined} emptyState={emptyState} />
      )}
      {shifts.length > 0 && <PaginationBar
        summary={`${pageRange(filtered.length, currentPage + 1, 50)} / ${filtered.length} çalışan`}
        page={currentPage + 1}
        pageCount={pageCount}
        onPrevious={() => {
          setPage(currentPage - 1);
          clearSelection();
        }}
        onNext={() => {
          setPage(currentPage + 1);
          clearSelection();
        }}
      />}
      {assign && (
        <AssignShiftDialog
          open
          onOpenChange={(open) => {
            if (!open) setAssign(null);
          }}
          projectId={projectId}
          employees={employees}
          shifts={shifts}
          initial={assign}
        />
      )}
      {detail && !loading && (
        <ShiftDayDetails
          {...detail}
          data={getData(detail.employee, detail.date)}
          onClose={() => setDetail(null)}
          canAssign={canManage && active.length > 0}
          onEditDepartment={(assignment) => { setDetail(null); setEdit(assignment); }}
          onEdit={(assignment) => {
            setDetail(null);
            setEdit(assignment);
          }}
          onAssign={() => {
            setAssign({
              employeeIds: [detail.employee._id],
              startDate: detail.date,
              endDate: detail.date,
            });
            setDetail(null);
          }}
        />
      )}
      <AssignmentEditDialog
        open={edit !== null}
        onOpenChange={(open) => {
          if (!open) setEdit(null);
        }}
        assignment={edit}
        shifts={shifts}
        shiftName={
          shifts.find((s) => s._id === edit?.shiftId)?.name ?? "Vardiya"
        }
        employeeName={edit && "departmentId" in edit ? departments?.find(department => department._id === edit.departmentId)?.name ?? "Departman" : employees
          .filter((e) => edit && "employeeId" in edit && e._id === edit.employeeId)
          .map((e) => `${e.firstName} ${e.lastName}`)
          .join("")}
      />
    </div>
  );
}
