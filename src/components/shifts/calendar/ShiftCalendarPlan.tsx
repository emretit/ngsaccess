import { usePermissions } from "@/hooks/usePermissions";
import { ClearAssignmentsDialog } from '../ClearAssignmentsDialog';
import { shiftExportRows } from '@/lib/shiftExport';
import { csvExport, downloadExport, exportFilenamePart, xlsxExport } from '@/lib/spreadsheetExport';
import { notify } from '@/lib/notify';
import { ShiftSelect } from "../ShiftSelect";
import { assignmentInitial, shiftTimeLabel } from "../lib/planning";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { BulkBar } from "@/components/shared/BulkBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Button } from "@/components/ui/button";
import { PaginationBar, pageRange } from "@/components/shared/PaginationBar";
import { ShiftCalendarGrid, type CalendarProps } from "../ShiftCalendarGrid";
import { ShiftAgendaView } from "../ShiftAgendaView";
import { ShiftDayDetails } from "../ShiftDayDetails";
import { AssignShiftDialog } from "../AssignShiftDialog";
import { AssignmentEditDialog } from "../AssignmentEditDialog";
import {
  istanbulToday,
  type Assignment,
  type Employee,
  type Period,
  type Shift,
} from "../lib/planning";
import { useShiftCalendarData } from "./useShiftCalendarData";
import { calendarDayResolver, groupAssignments } from "./shiftCalendarModel";
import { openCalendarDay } from "./calendarActions";
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
}: {
  projectId: Id<"projects">;
  projectName: string;
  employees: Employee[];
  shifts: Shift[];
  openDefinitions: () => void;
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
  const [shiftFilter, setShiftFilter] = useState("all");
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
  const [edit, setEdit] = useState<Assignment | null>(null);
  const { range, filtered, pageCount, currentPage, visible, assignments, leaves, holidays } =
    useShiftCalendarData({ projectId, employees, day, effectivePeriod, search, shiftFilter, page });
  const exportPlan = async (format: 'xlsx' | 'csv') => {
    if (!can("reports.view") || !assignments || exporting) return;
    setExporting(true);
    try {
      const rows = shiftExportRows(visible, range.days, assignments, shifts);
      const blob = format === 'xlsx' ? await xlsxExport(rows, 'Vardiyalar') : new Blob([csvExport(rows)], { type: 'text/csv;charset=utf-8' });
      downloadExport(blob, `vardiyalar-${exportFilenamePart(projectName)}-${range.rangeStart}_${range.rangeEnd}.${format}`);
    } catch (error: unknown) { notify.error('Vardiyalar aktarılamadı', error); }
    finally { setExporting(false); }
  };
  const active = shifts.filter((s) => s.isActive !== false);
  const loading =
    assignments === undefined || leaves === undefined || holidays === undefined;
  const assignmentsByEmployee = useMemo(() => groupAssignments(assignments ?? []), [assignments]);
  const getData = calendarDayResolver(assignmentsByEmployee, shifts, leaves ?? [], holidays ?? []);
  const clearSelection = () => setSelected(new Set());
  const changeDay = (next: string) => {
    if (!next) return;
    setDay(next);
    clearSelection();
  };
  const select = (id: string) =>
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allVisibleSelected = visible.length > 0 && visible.every((employee) => selected.has(employee._id));
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
        checked: allVisibleSelected ? true : visible.some((employee) => selected.has(employee._id)) ? "indeterminate" : false,
        onToggle: () => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((employee) => employee._id))),
      },
      onSelect: select,
    } : {}),
    selected,
  };
  return (
    <div className="space-y-4 [&_button]:max-sm:min-h-11 [&_input]:max-sm:min-h-11">
      <CalendarHeader activeCount={active.length} loading={loading} exporting={exporting}
        onAssign={() => setAssign(assignmentInitial(day))} openDefinitions={openDefinitions}
        onExport={exportPlan} onClear={() => setClearOpen(true)} />
      {clearOpen && <ClearAssignmentsDialog projectId={projectId} employees={employees} initialIds={[...selected]} start={range.rangeStart} end={range.rangeEnd} onClose={() => { setClearOpen(false); clearSelection(); }} />}
      {!shifts.length ? (
        <EmptyState
          title="Henüz vardiya tanımlanmamış"
          description={canManage ? "Atama yapmak için önce bir vardiya tanımlayın." : "Vardiya tanımlarını yetkili yöneticiler ekler."}
          action={canManage ? { label: "Vardiya tanımlarına git", onClick: openDefinitions } : undefined}
        />
      ) : <>
      {!active.length && (
        <p role="status" className="text-sm text-muted-foreground">
          Tüm vardiya tanımları pasif; mevcut atamalar görünür ama yeni atama yapılamaz.
          {canManage && <> <Button variant="link" className="h-auto p-0 align-baseline" onClick={openDefinitions}>Bir tanımı etkinleştirin</Button>.</>}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CalendarNavigation day={day} effectivePeriod={effectivePeriod} period={period} compact={compact}
          range={range} changeDay={changeDay} setPeriod={setPeriod} clearSelection={clearSelection} />
        <div className="flex min-w-0 flex-wrap items-center gap-2 max-[760px]:w-full">
          <Input aria-label="Çalışan ara" placeholder="Çalışan ara" value={search}
            className="w-32 max-[760px]:flex-1" onChange={(event) => {
              setSearch(event.target.value); setPage(0); clearSelection();
            }} />
          <div className="w-36 max-[760px]:flex-1">
            <ShiftSelect label="Vardiya" value={shiftFilter} onChange={(value) => { setShiftFilter(value); clearSelection(); }}
              options={[{ value: "all", label: "Tüm vardiyalar" }, ...shifts.map(s => ({ value: s._id, label: `${s.name} · ${shiftTimeLabel(s)}` }))]} />
          </div>
          {(search.trim() !== "" || shiftFilter !== "all") && <Button variant="ghost" className="px-2" onClick={() => {
            setSearch(""); setShiftFilter("all"); setPage(0); clearSelection();
          }}>Temizle</Button>}
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
      {loading ? (
        <SectionSkeleton label="Plan, izin ve tatiller kontrol ediliyor" />
      ) : !employees.length ? (
        <EmptyState
          title="Bu projede çalışan yok"
          description="Plan oluşturmak için önce çalışan ekleyin."
          action={{
            label: "Kişileri aç",
            onClick: () => navigate("/employees"),
          }}
        />
      ) : !filtered.length ? (
        <EmptyState
          title="Aramayla eşleşen çalışan yok"
          description="Başka bir ad deneyin veya filtreleri temizleyin."
        />
      ) : (
        <>
          {assignments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Bu dönemde atama yok.
            </p>
          )}
          {compact ? (
            <ShiftAgendaView {...calendarProps} />
          ) : (
            <ShiftCalendarGrid {...calendarProps} />
          )}
        </>
      )}
      <PaginationBar
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
      />
      </>}
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
        employeeName={employees
          .filter((e) => e._id === edit?.employeeId)
          .map((e) => `${e.firstName} ${e.lastName}`)
          .join("")}
      />
    </div>
  );
}
