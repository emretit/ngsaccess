import { CorrectionRequestsEntry } from "@/components/pdks/CorrectionRequestsPanel";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { usePdksFilterParams } from "@/hooks/usePdksFilterParams";
import { PDKSDateNavigator } from "@/components/pdks/dashboard/PDKSDateNavigator";
import { PDKSFilterBar, type FilterValues } from "@/components/pdks/dashboard/PDKSFilterBar";
import { PDKSEmployeeDetailDrawer } from "@/components/pdks/dashboard/PDKSEmployeeDetailDrawer";
import { PDKSEnhancedExportPanel } from "@/components/pdks/dashboard/PDKSEnhancedExportPanel";
import { PDKSImportDialog } from "@/components/pdks/dashboard/PDKSImportDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePdksRecordsView } from "@/components/pdks/records/usePdksRecordsView";
import { PdksPeriodSwitcher } from "@/components/pdks/records/PdksPeriodSwitcher";
import { PdksRecordsResults } from "@/components/pdks/records/PdksRecordsResults";
import { PdksAssistantSheet } from "@/components/pdks/records/PdksAssistantSheet";
import { PdksWarningsSheet } from "@/components/pdks/records/PdksWarningsSheet";
import { PdksDatesSheet } from "@/components/pdks/records/PdksDatesSheet";
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
  const view = usePdksRecordsView(filters, setFilters);
  const {
    projectId, activeProject, canManage, setImport, setWarningsOpen, setAi,
    exportRows, dateRangeLabel, selectedDate, filterSummary, selectedIds,
    records, isLoading, setDatesOpen, analysis, setAnalysis, setSmartPreset,
    effectiveSmartPreset, detailTrigger, detail, setDrilldown,
    startDate, endDate, importOpen,
  } = view;
  return (
    <div className="min-w-0 max-w-full space-y-4">
      <PageHeader
        title="PDKS Kayıtları"
        scope={`${activeProject?.name ?? "Proje seçin"} · ${dateRangeLabel}`}
        secondaryMenu={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Diğer</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManage && <DropdownMenuItem onClick={() => setImport(true)}>İçe aktar</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => setWarningsOpen(true)}>
                Uyarılar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAi(true)}>
                Asistan
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
        <PdksPeriodSwitcher filters={filters} setFilters={setFilters} />
        <PDKSDateNavigator values={filters} onChange={setFilters} />
        <Button variant="ghost" onClick={() => setDatesOpen(true)}>
          Tarih ve kayıtlı görünümler
        </Button>
      </div>
      <div role="group" aria-label="Görünüm" className="flex gap-1">
        <Button variant={!analysis || filters.reportType === "daily" ? "secondary" : "ghost"} aria-pressed={!analysis || filters.reportType === "daily"} onClick={() => setAnalysis(false)}>Kayıtlar</Button>
        <Button disabled={filters.reportType === "daily"} variant={analysis && filters.reportType !== "daily" ? "secondary" : "ghost"} aria-pressed={analysis && filters.reportType !== "daily"} onClick={() => setAnalysis(true)}>Analiz</Button>
      </div>
      {canManage && projectId && (
        <CorrectionRequestsEntry key={projectId} projectId={projectId} />
      )}
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
      <PdksRecordsResults view={view} />
      <PDKSEmployeeDetailDrawer
        returnFocusTo={detailTrigger}
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
      <PdksAssistantSheet {...view} />
      <PdksWarningsSheet {...view} />
      <PdksDatesSheet {...view} />
    </div>
  );
}
