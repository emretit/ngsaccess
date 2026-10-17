import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toLocalDateString } from "@/lib/date";
import { summarizePdksRecords } from "@/lib/pdksSummary";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { usePdksTableData } from "@/hooks/usePdksTableData";
import { usePdksFilterOptions } from "@/hooks/usePdksFilterOptions";
import { usePdksFilterParams } from "@/hooks/usePdksFilterParams";
import { PDKSDateNavigator } from "@/components/pdks/dashboard/PDKSDateNavigator";
import {
  PDKSFilterBar,
  clearPdksFilters,
  type FilterValues,
  type ReportType,
} from "@/components/pdks/dashboard/PDKSFilterBar";
import { PDKSTableView } from "@/components/pdks/dashboard/PDKSTableView";
import { PDKSChartView } from "@/components/pdks/dashboard/PDKSChartView";
import { PDKSHeatmapView } from "@/components/pdks/dashboard/PDKSHeatmapView";
import { PDKSEmployeeDetailDrawer } from "@/components/pdks/dashboard/PDKSEmployeeDetailDrawer";
import { PDKSEnhancedExportPanel } from "@/components/pdks/dashboard/PDKSEnhancedExportPanel";
import { PDKSImportDialog } from "@/components/pdks/dashboard/PDKSImportDialog";
import { PDKSQuickPresets } from "@/components/pdks/dashboard/PDKSQuickPresets";
import {
  PDKSSmartPresets,
  type SmartPresetSelection,
} from "@/components/pdks/dashboard/PDKSSmartPresets";
import { PDKSOvertimeAlert } from "@/components/pdks/dashboard/PDKSOvertimeAlert";
import { PDKSSavedViews } from "@/components/pdks/dashboard/PDKSSavedViews";
import { PDKSAiChat } from "@/components/pdks/PDKSAiChat";
import { STATUS_FILTER_LABELS } from "@/components/pdks/statusMeta";
import {
  formatDuration,
  readableDate,
} from "@/components/pdks/lib/presentation";
import { PageHeader } from "@/components/shared/PageHeader";
import { BulkBar } from "@/components/shared/BulkBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Id } from "../../convex/_generated/dataModel";
const DEFAULT_FILTERS: FilterValues = {
  dateRange: { from: undefined, to: undefined },
  reportType: "daily",
  statusFilter: "all",
  person: "",
};
export default function PDKSRecords() {
  const { projectId } = useActiveProject();
  const { filters, setFilters } = usePdksFilterParams(DEFAULT_FILTERS, projectId);
  return (
    <QuerySectionBoundary
      title="PDKS kayıtları yüklenemedi."
      description="Bağlantınızı kontrol edip yeniden deneyin."
      resetKey={`${projectId}:${JSON.stringify(filters)}`}
      className="min-w-0 max-w-full"
    >
      <PDKSContent key={projectId} filters={filters} setFilters={setFilters} />
    </QuerySectionBoundary>
  );
}
function PDKSContent({
  filters,
  setFilters,
}: {
  filters: FilterValues;
  setFilters: (v: FilterValues) => void;
}) {
  const navigate = useNavigate();
  const { departments, companies, positions, shifts } = usePdksFilterOptions();
  const {
    projectId,
    activeProject,
    loading: projectLoading,
  } = useActiveProject();
  const [ai, setAi] = useState(false),
    [importOpen, setImport] = useState(false),
    [datesOpen, setDatesOpen] = useState(false),
    [analysis, setAnalysis] = useState(false),
    [warningsOpen, setWarningsOpen] = useState(false);
  const [rangeError, setRangeError] = useState("");
  const [smartPreset, setSmartPreset] = useState<SmartPresetSelection | null>(
    null,
  );
  const [selection, setSelection] = useState<{
    scope: string;
    ids: Set<string>;
  }>({ scope: "", ids: new Set() });
  const [drilldown, setDrilldown] = useState<{
    scope: string;
    employeeId: Id<"employees">;
    date: string;
  } | null>(null);
  const {
    tableRecords: rawRecords,
    allRecords: rawAllRecords,
    isLoading,
    selectedDate,
    dateRangeLabel,
    startDate,
    endDate,
  } = usePdksTableData(filters);
  const selectedDateKey = toLocalDateString(selectedDate);
  const effectiveSmartPreset =
    smartPreset?.date && smartPreset.date !== selectedDateKey
      ? null
      : smartPreset;
  const matchesSmartPreset = (id: string) =>
    !effectiveSmartPreset ||
    effectiveSmartPreset.employeeIds.some((employeeId) => employeeId === id);
  const records = rawRecords.filter((record) => matchesSmartPreset(record.id));
  const allRecords = rawAllRecords.filter((record) =>
    matchesSmartPreset(record.id),
  );
  const scope = `${projectId}:${JSON.stringify(filters)}:${effectiveSmartPreset?.key ?? ""}`;
  const selectedIds =
    selection.scope === scope
      ? new Set(
          [...selection.ids].filter((id) =>
            records.some((record) => record.id === id),
          ),
        )
      : new Set<string>();
  const detail = drilldown?.scope === scope ? drilldown : null;
  const summary = summarizePdksRecords(allRecords, toLocalDateString());
  const exportRows = selectedIds.size
    ? records.filter((r) => selectedIds.has(r.id))
    : records;
  const hasFilters = Boolean(
    filters.person ||
    filters.companyId ||
    filters.departmentId ||
    filters.positionId ||
    filters.shiftId ||
    filters.statusFilter !== "all" ||
    effectiveSmartPreset,
  );
  const filterSummary =
    [
      effectiveSmartPreset?.label,
      filters.person && `Ad / soyad: ${filters.person}`,
      filters.departmentId &&
        `Departman: ${departments?.find((d) => d._id === filters.departmentId)?.name ?? "Seçili"}`,
      filters.companyId &&
        `Şirket: ${companies?.find((c) => c._id === filters.companyId)?.name ?? "Seçili"}`,
      filters.positionId &&
        `Pozisyon: ${positions?.find((p) => p._id === filters.positionId)?.name ?? "Seçili"}`,
      filters.shiftId &&
        `Vardiya: ${shifts?.find((s) => s._id === filters.shiftId)?.name ?? "Seçili"}`,
      filters.statusFilter !== "all" &&
        STATUS_FILTER_LABELS[filters.statusFilter],
    ]
      .filter(Boolean)
      .join(" · ") || "Tüm personel";
  const openDetail = (employeeId: string, date: string) =>
    setDrilldown({ scope, employeeId: employeeId as Id<"employees">, date });
  const counters = [
    { status: "present", value: summary.present },
    { status: "late", value: summary.late },
    { status: "absent", value: summary.absent },
    { status: "leave", value: summary.leave },
  ] as const;
  return (
    <div className="min-w-0 max-w-full space-y-4">
      <PageHeader
        title="PDKS Kayıtları"
        scope={`${activeProject?.name ?? "Proje seçin"} · ${filters.reportType === "daily" ? readableDate(selectedDateKey) : dateRangeLabel}`}
        secondaryMenu={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Diğer</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setImport(true)}>
                İçe aktar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setWarningsOpen(true)}>
                Uyarılar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAi(true)}>
                Asistan
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAnalysis((v) => !v)}>
                {analysis ? "Kayıtlara dön" : "Analiz"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <PDKSEnhancedExportPanel
          records={exportRows}
          dateRange={dateRangeLabel}
          selectedDate={selectedDate}
          filterSummary={filterSummary}
          selectedCount={selectedIds.size}
          totalCount={records.length}
          disabled={isLoading || !projectId}
        />
      </PageHeader>
      <div className="flex min-w-0 flex-col flex-wrap gap-3 sm:flex-row sm:items-center">
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Rapor dönemi"
        >
          {(
            [
              ["daily", "Günlük"],
              ["weekly", "Haftalık"],
              ["monthly", "Aylık"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={filters.reportType === value ? "secondary" : "ghost"}
              aria-pressed={filters.reportType === value}
              onClick={() =>
                setFilters({
                  ...filters,
                  reportType: value as ReportType,
                  dateRange: { from: undefined, to: undefined },
                })
              }
            >
              {label}
            </Button>
          ))}
        </div>
        <PDKSDateNavigator values={filters} onChange={setFilters} />
        <Button variant="ghost" onClick={() => setDatesOpen(true)}>
          Tarih ve kayıtlı görünümler
        </Button>
      </div>
      <PDKSFilterBar
        values={filters}
        onChange={setFilters}
        onClear={() => setSmartPreset(null)}
      />
      {effectiveSmartPreset && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>{effectiveSmartPreset.label}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSmartPreset(null)}
          >
            Uyarı filtresini kaldır
          </Button>
        </div>
      )}
      {projectLoading || isLoading ? (
        <SectionSkeleton rows={6} label="PDKS kayıtları yükleniyor." />
      ) : !projectId ? (
        <EmptyState
          title="Bir proje seçin."
          description="PDKS kayıtlarını görmek için üst çubuktan proje seçin."
        />
      ) : (
        <>
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y py-3 text-xs tabular-nums"
            aria-label="Durum özeti"
          >
            <span>{summary.totalEmployees} personel</span>
            {counters.map((c) => (
              <span key={c.status}>
                {STATUS_FILTER_LABELS[c.status]} <strong>{c.value}</strong>{" "}
                {filters.reportType === "daily" ? "kişi" : "kişi-gün"}
              </span>
            ))}
            <span>
              Fazla mesai{" "}
              {formatDuration(Math.round(summary.overtimeHours * 60))}
            </span>
            <label className="flex flex-wrap items-center gap-2">
              Durum
              <select
                className="h-9 rounded-md border border-input bg-background px-2"
                value={filters.statusFilter}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    statusFilter: e.target
                      .value as FilterValues["statusFilter"],
                  })
                }
              >
                {Object.entries(STATUS_FILTER_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <BulkBar
            count={selectedIds.size}
            onClear={() => setSelection({ scope, ids: new Set() })}
          >
            <span className="text-xs">
              Dışa aktar menüsü seçili satırları kullanır.
            </span>
          </BulkBar>
          {records.length === 0 ? (
            <EmptyState
              title={
                hasFilters
                  ? "Bu filtrelerle eşleşen personel yok."
                  : "Bu projede personel bulunamadı."
              }
              description={
                hasFilters
                  ? "Aramayı değiştirin veya filtreleri temizleyin."
                  : "Personel ekleyerek PDKS kayıtlarını izlemeye başlayın."
              }
              action={{
                label: hasFilters ? "Filtreleri temizle" : "Kişilere git",
                onClick: () => {
                  if (hasFilters) {
                    setSmartPreset(null);
                    setFilters(clearPdksFilters(filters));
                  } else navigate("/employees");
                },
              }}
            />
          ) : analysis ? (
            <PDKSChartView
              records={records}
              scope={`${activeProject?.name} · ${dateRangeLabel} · ${filterSummary}`}
            />
          ) : filters.reportType === "daily" ? (
            <PDKSTableView
              records={records}
              selectedIds={selectedIds}
              onSelectionChange={(ids) => setSelection({ scope, ids })}
              onShowDetail={(id) => openDetail(id, selectedDateKey)}
            />
          ) : (
            <PDKSHeatmapView
              records={records}
              loading={false}
              startDate={startDate}
              endDate={endDate}
              onCellClick={openDetail}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {records.length} personel gösteriliyor · Saatler İstanbul saatidir.
          </p>
        </>
      )}
      <PDKSEmployeeDetailDrawer
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDrilldown(null);
        }}
        employeeId={detail?.employeeId ?? null}
        startDate={startDate}
        endDate={endDate}
        highlightDate={detail?.date}
      />
      <PDKSImportDialog open={importOpen} onOpenChange={setImport} />
      <Sheet open={ai} onOpenChange={setAi}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>PDKS Asistanı</SheetTitle>
            <SheetDescription>
              Asistan sorguları kendi kapsamını belirtir. Bu sayfanın
              filtrelerini otomatik uygulamaz.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <PDKSAiChat />
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={warningsOpen} onOpenChange={setWarningsOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Uyarılar</SheetTitle>
            <SheetDescription>
              {activeProject?.name} · Her uyarının tarih kapsamı aşağıda
              belirtilir.
            </SheetDescription>
          </SheetHeader>
          <QuerySectionBoundary
            resetKey={`${projectId}:${selectedDateKey}`}
            title="Uyarılar yüklenemedi."
          >
            <div className="mt-5 space-y-5">
              <PDKSSmartPresets
                anchorDate={selectedDate}
                selection={effectiveSmartPreset}
                onChange={setSmartPreset}
              />
              <PDKSOvertimeAlert year={selectedDate.getFullYear()} />
            </div>
          </QuerySectionBoundary>
        </SheetContent>
      </Sheet>
      <Sheet open={datesOpen} onOpenChange={(open) => {
        setDatesOpen(open);
        if (!open) setRangeError("");
      }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Tarih ve kayıtlı görünümler</SheetTitle>
            <SheetDescription>Seçili dönem: {dateRangeLabel}</SheetDescription>
          </SheetHeader>
          <div className="mt-5 space-y-5">
            <PDKSQuickPresets values={filters} onChange={setFilters} />
            <PDKSSavedViews filters={filters} onApply={setFilters} />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Özel tarih aralığı
              </legend>
              <label className="block text-xs">
                Başlangıç
                <input
                  type="date"
                  className="mt-1 block h-9 w-full rounded-md border bg-background px-3"
                  value={
                    filters.dateRange.from
                      ? toLocalDateString(filters.dateRange.from)
                      : startDate
                  }
                  max={
                    filters.dateRange.to
                      ? toLocalDateString(filters.dateRange.to)
                      : undefined
                  }
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const from = new Date(`${e.target.value}T12:00:00`);
                    const to =
                      filters.dateRange.to ?? new Date(`${endDate}T12:00:00`);
                    if (from > to) {
                      setRangeError("Başlangıç tarihi bitişten sonra olamaz.");
                      return;
                    }
                    setRangeError("");
                    setFilters({
                      ...filters,
                      reportType: "custom",
                      dateRange: { from, to },
                    });
                  }}
                />
              </label>
              <label className="block text-xs">
                Bitiş
                <input
                  type="date"
                  className="mt-1 block h-9 w-full rounded-md border bg-background px-3"
                  value={
                    filters.dateRange.to
                      ? toLocalDateString(filters.dateRange.to)
                      : endDate
                  }
                  min={
                    filters.dateRange.from
                      ? toLocalDateString(filters.dateRange.from)
                      : undefined
                  }
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const from =
                      filters.dateRange.from ??
                      new Date(`${startDate}T12:00:00`);
                    const to = new Date(`${e.target.value}T12:00:00`);
                    if (from > to) {
                      setRangeError("Bitiş tarihi başlangıçtan önce olamaz.");
                      return;
                    }
                    setRangeError("");
                    setFilters({
                      ...filters,
                      reportType: "custom",
                      dateRange: { from, to },
                    });
                  }}
                />
              </label>
              {rangeError && (
                <p role="alert" className="text-xs text-danger">
                  {rangeError}
                </p>
              )}
            </fieldset>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
