import { ClearAssignmentsDialog } from '../ClearAssignmentsDialog';
import { useAuth } from '@/components/auth/AuthProvider';
import { capabilities } from '@/lib/capabilities';
import { shiftExportRows } from '@/lib/shiftExport';
import { csvExport, downloadExport, exportFilenamePart, xlsxExport } from '@/lib/spreadsheetExport';
import { notify } from '@/lib/notify';
import { ShiftSelect } from "../ShiftSelect";
import { assignmentInitial, shiftTimeLabel } from "../lib/planning";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Id } from "../../../../convex/_generated/dataModel";
import { StatInline } from "@/components/shared/StatInline";
import { FilterBar } from "@/components/shared/FilterBar";
import { BulkBar } from "@/components/shared/BulkBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { Button } from "@/components/ui/button";
import { PaginationBar, pageRange } from "@/components/shared/PaginationBar";
import { ShiftCalendarGrid } from "../ShiftCalendarGrid";
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
  const { profile } = useAuth();
  const canManage = capabilities(profile?.role).admin;
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
    if (!assignments || exporting) return;
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
  const calendarProps = {
    employees: visible,
    days: range.days,
    getData,
    onOpen: (employee: Employee, date: string) => setDetail({ employee, date }),
    selected,
    onSelect: select,
  };
  return (
    <div className="space-y-4 [&_button]:max-sm:min-h-11 [&_input]:max-sm:min-h-11">
      <CalendarHeader projectName={projectName} activeCount={active.length} loading={loading}
        onAssign={() => setAssign(assignmentInitial(day))} openDefinitions={openDefinitions} />
      <div className="flex flex-wrap gap-2">
        {canManage && <Button variant="outline" onClick={() => setClearOpen(true)}>Toplu temizle</Button>}
        <Button variant="outline" disabled={loading || exporting} onClick={() => exportPlan('xlsx')}>Excel'e aktar</Button>
        <Button variant="outline" disabled={loading || exporting} onClick={() => exportPlan('csv')}>CSV'ye aktar</Button>
        <span className="self-center text-xs text-muted-foreground">Dışa aktarım: görünen sayfa ve dönem</span>
      </div>
      {clearOpen && <ClearAssignmentsDialog projectId={projectId} employees={employees} initialIds={[...selected]} start={range.rangeStart} end={range.rangeEnd} onClose={() => { setClearOpen(false); clearSelection(); }} />}
      <StatInline
        items={[
          { label: "Görünen çalışan", value: filtered.length },
          { label: "Proje genelinde aktif tanım", value: active.length },
        ]}
      />
      <div className="space-y-2">
        <FilterBar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(0);
            clearSelection();
          }}
          searchLabel="Çalışan ara"
          placeholder="Çalışan ara · Ad veya e-posta"
          hasFilters={shiftFilter !== "all"}
          onClear={() => {
            setSearch("");
            setShiftFilter("all");
            setPage(0);
            clearSelection();
          }}
        >
          <label className="text-xs flex flex-col gap-1 min-w-0 max-w-full">
            Vardiya
            <ShiftSelect label="Vardiya" value={shiftFilter} onChange={(value) => { setShiftFilter(value); clearSelection(); }}
              options={[{ value: "all", label: "Tüm vardiyalar" }, ...shifts.map(s => ({ value: s._id, label: `${s.name} · ${shiftTimeLabel(s)}` }))]} />
          </label>
        </FilterBar>
      </div>
      <CalendarNavigation day={day} effectivePeriod={effectivePeriod} period={period} compact={compact}
        range={range} changeDay={changeDay} setPeriod={setPeriod} clearSelection={clearSelection} />
      <BulkBar count={selected.size} onClear={clearSelection}>
        <Button
          disabled={loading || !active.length}
          onClick={() =>
            setAssign(assignmentInitial(day, [...selected]))
          }
        >
          Seçilenlere ata
        </Button>
      </BulkBar>
      {!active.length && (
        <EmptyState
          title={
            shifts.length
              ? "Atanabilir vardiya yok"
              : "Henüz vardiya tanımlanmamış"
          }
          description="Bir vardiyayı etkinleştirin veya yeni tanım ekleyin."
          action={{ label: "Tanımları aç", onClick: openDefinitions }}
        />
      )}
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
              Bu dönemde atama yok.{active.length > 0 ? " Boş bir gün seçerek plan oluşturabilirsiniz." : ""}
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
        summary={`${pageRange(filtered.length, currentPage + 1, 50)} / ${filtered.length} çalışan · İstanbul saati`}
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
          canAssign={!!active.length}
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
