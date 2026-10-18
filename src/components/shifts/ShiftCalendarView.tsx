import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatInline } from "@/components/shared/StatInline";
import { FilterBar } from "@/components/shared/FilterBar";
import { BulkBar } from "@/components/shared/BulkBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-picker";
import { ShiftCalendarGrid } from "./ShiftCalendarGrid";
import { ShiftAgendaView } from "./ShiftAgendaView";
import { ShiftDayDetails } from "./ShiftDayDetails";
import { ShiftListSidebar } from "./ShiftListSidebar";
import { AssignShiftDialog } from "./AssignShiftDialog";
import { AssignmentEditDialog } from "./AssignmentEditDialog";
import {
  cellData,
  dayLabel,
  istanbulToday,
  nextPeriod,
  visibleRange,
  type Assignment,
  type Employee,
  type Period,
  type Shift,
} from "./lib/planning";
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
export function ShiftCalendarView({
  projectId,
  projectName,
}: {
  projectId: Id<"projects">;
  projectName: string;
}) {
  const employees = useQuery(api.employees.list, { projectId });
  const shifts = useQuery(api.shifts.list, { projectId });
  const [definitions, setDefinitions] = useState(false);
  if (!employees || !shifts)
    return <SectionSkeleton label="Çalışanlar ve vardiyalar yükleniyor" />;
  return (
    <div className="group/plan min-w-0 max-w-full space-y-5">
      <QuerySectionBoundary
        resetKey={projectId}
        title="Vardiya planı yüklenemedi"
        description="Tekrar deneyin. Vardiya tanımlarını görüntülemeye devam edebilirsiniz."
      >
        <Plan
          projectId={projectId}
          projectName={projectName}
          employees={employees}
          shifts={shifts}
          openDefinitions={() => setDefinitions(true)}
        />
      </QuerySectionBoundary>
      <Button
        variant="outline"
        className="hidden group-has-[[role=alert]]/plan:inline-flex"
        onClick={() => setDefinitions(true)}
      >
        Vardiya tanımları
      </Button>
      <ShiftListSidebar
        open={definitions}
        onOpenChange={setDefinitions}
        shifts={shifts}
        projectId={projectId}
      />
    </div>
  );
}
function Plan({
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
  const compact = useCompact();
  const navigate = useNavigate();
  const [day, setDay] = useState(istanbulToday);
  const [period, setPeriod] = useState<Period>("week");
  const effectivePeriod = compact ? "day" : period;
  const range = visibleRange(day, effectivePeriod);
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
  const active = shifts.filter((s) => s.isActive !== false);
  const loading =
    assignments === undefined || leaves === undefined || holidays === undefined;
  const assignmentsByEmployee = useMemo(() => {
    const grouped = new Map<string, Assignment[]>();
    for (const assignment of assignments ?? []) {
      const list = grouped.get(assignment.employeeId) ?? [];
      list.push(assignment);
      grouped.set(assignment.employeeId, list);
    }
    return grouped;
  }, [assignments]);
  const getData = (employee: Employee, date: string) =>
    cellData(
      employee,
      date,
      assignmentsByEmployee.get(employee._id) ?? [],
      shifts,
      leaves ?? [],
      holidays ?? [],
    );
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
    <>
      <PageHeader
        title="Vardiyalar"
        scope={<span className="break-all">{projectName} · Çalışma planı</span>}
        primaryAction={{
          label: "Vardiya ata",
          disabled: loading,
          onClick: () =>
            active.length
              ? setAssign({
                  startDate: range.rangeStart,
                  endDate: range.rangeEnd,
                })
              : openDefinitions(),
        }}
        secondaryMenu={
          <Button variant="outline" onClick={openDefinitions}>
            Vardiya tanımları
          </Button>
        }
      />
      <StatInline
        items={[
          { label: "Görünen çalışan", value: filtered.length },
          { label: "Gün", value: range.days.length },
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
          <label className="text-xs space-y-1 min-w-0 max-w-full">
            Vardiya
            <select
              className="block h-9 w-full max-w-[260px] rounded-md border border-control bg-surface px-2 text-sm"
              value={shiftFilter}
              onChange={(e) => {
                setShiftFilter(e.target.value);
                clearSelection();
              }}
            >
              <option value="all">Tüm vardiyalar</option>
              {shifts.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </FilterBar>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Button
          variant="outline"
          aria-label="Önceki dönem"
          onClick={() => changeDay(nextPeriod(day, effectivePeriod, -1))}
        >
          Önceki
        </Button>
        <Button variant="outline" onClick={() => changeDay(istanbulToday())}>
          Bugün
        </Button>
        <Button
          variant="outline"
          aria-label="Sonraki dönem"
          onClick={() => changeDay(nextPeriod(day, effectivePeriod, 1))}
        >
          Sonraki
        </Button>
        <label className="text-xs">
          Tarih
          <DateInput
            required
            value={day}
            onChange={changeDay}
            className="w-auto max-w-full"
          />
        </label>
        {!compact && (
          <label className="text-xs">
            Dönem
            <select
              value={period}
              className="block h-9 border border-control rounded-md bg-surface px-2"
              onChange={(e) => {
                setPeriod(e.target.value as Period);
                clearSelection();
              }}
            >
              <option value="week">Hafta</option>
              <option value="month">Ay</option>
            </select>
          </label>
        )}
      </div>
      <p className="text-sm font-medium">
        {dayLabel(range.rangeStart)}
        {range.rangeStart !== range.rangeEnd
          ? ` – ${dayLabel(range.rangeEnd)}`
          : ""}
      </p>
      <BulkBar count={selected.size} onClear={clearSelection}>
        <Button
          disabled={loading || !active.length}
          onClick={() =>
            setAssign({
              employeeIds: [...selected],
              startDate: range.rangeStart,
              endDate: range.rangeEnd,
            })
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
              Bu dönemde atama yok. Boş bir gün seçerek plan oluşturabilirsiniz.
            </p>
          )}
          {compact ? (
            <ShiftAgendaView {...calendarProps} />
          ) : (
            <ShiftCalendarGrid {...calendarProps} />
          )}
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {filtered.length ? currentPage * 50 + 1 : 0}–
          {Math.min((currentPage + 1) * 50, filtered.length)} /{" "}
          {filtered.length} çalışan · İstanbul saati
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => {
              setPage(currentPage - 1);
              clearSelection();
            }}
          >
            Önceki kişiler
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pageCount - 1}
            onClick={() => {
              setPage(currentPage + 1);
              clearSelection();
            }}
          >
            Sonraki kişiler
          </Button>
        </div>
      </div>
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
    </>
  );
}
