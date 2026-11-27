import { Navigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { SHIFT_PLAN_PATH, useOpenShiftPlan } from "@/components/shifts/route";
import { CalendarClock } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { usePdksFilterParams } from "@/hooks/usePdksFilterParams";
import { PDKSDateNavigator } from "@/components/pdks/dashboard/PDKSDateNavigator";
import { PDKSFilterBar, type FilterValues } from "@/components/pdks/dashboard/PDKSFilterBar";
import { PDKSEmployeeDetailDrawer } from "@/components/pdks/dashboard/PDKSEmployeeDetailDrawer";
import { PDKSEnhancedExportPanel } from "@/components/pdks/dashboard/PDKSEnhancedExportPanel";
import { PDKSImportDialog } from "@/components/pdks/dashboard/PDKSImportDialog";
import { PageTemplate } from "@/components/shared/PageTemplate";
import { ErrorState } from "@/components/shared/ErrorState";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePdksRecordsView } from "@/components/pdks/records/usePdksRecordsView";
import { PdksPeriodSwitcher } from "@/components/pdks/records/PdksPeriodSwitcher";
import { PdksRecordsResults } from "@/components/pdks/records/PdksRecordsResults";
import { PdksAssistantSheet } from "@/components/pdks/records/PdksAssistantSheet";
import { PdksWarningsSheet } from "@/components/pdks/records/PdksWarningsSheet";
import { CorrectionRequestsEntry, CorrectionRequestsPanel } from "@/components/pdks/CorrectionRequestsPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
const DEFAULT_FILTERS: FilterValues = {
  dateRange: { from: undefined, to: undefined },
  reportType: "daily",
  statusFilter: "all",
  person: "",
};
export default function PDKSRecords() {
  const location = useLocation();
  const legacyParams = new URLSearchParams(location.search);
  const legacyPlan = legacyParams.get("plan") === "1";
  legacyParams.delete("plan");
  const { projectId, activeProject } = useActiveProject();
  const { filters, setFilters } = usePdksFilterParams(DEFAULT_FILTERS, projectId);
  if (legacyPlan) return <Navigate to={`${SHIFT_PLAN_PATH}${legacyParams.size ? `?${legacyParams}` : ""}`} replace />;
  return (
    <QuerySectionBoundary
      title="PDKS kayıtları yüklenemedi."
      description="Bağlantınızı kontrol edip yeniden deneyin."
      resetKey={`${projectId}:${JSON.stringify(filters)}`}
      className="min-w-0 max-w-full"
      renderFallback={retry => <PageTemplate title="PDKS" scope={activeProject?.name}>
        <ErrorState title="PDKS kayıtları yüklenemedi." description="Bağlantınızı kontrol edip yeniden deneyin." compact onRetry={retry} />
      </PageTemplate>}
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
  const openPlan = useOpenShiftPlan();
  const view = usePdksRecordsView(filters, setFilters);
  const { can } = usePermissions();
  const canApprove = can("attendance.approve");
  const [correctionsOpen, setCorrectionsOpen] = useState(false);
  const {
    projectId, activeProject, canManage, setImport, setWarningsOpen, setAi,
    exportRows, dateRangeLabel, selectedDate, filterSummary, selectedIds,
    records, isLoading, setSmartPreset,
    effectiveSmartPreset, detailTrigger, detail, setDrilldown,
    startDate, endDate, importOpen,
  } = view;
  return (
    <PageTemplate
      title="PDKS"
      scope={`${activeProject?.name ?? "Proje seçin"} · ${dateRangeLabel}`}
      secondaryActions={
        <PDKSEnhancedExportPanel
          records={exportRows}
          dateRange={dateRangeLabel}
          selectedDate={selectedDate}
          filterSummary={filterSummary}
          selectedCount={selectedIds.size}
          totalCount={records.length}
          disabled={isLoading || !projectId}
        >
          {(exportMenu) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">İşlemler</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={view.refresh} disabled={isLoading}>Verileri yenile</DropdownMenuItem>
                {exportMenu}
                {canApprove && projectId && <CorrectionRequestsEntry projectId={projectId} onSelect={() => setCorrectionsOpen(true)} />}
                {canManage && <DropdownMenuItem onClick={() => setImport(true)}>İçe aktar</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => setWarningsOpen(true)}>
                  Uyarılar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAi(true)}>
                  Asistan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </PDKSEnhancedExportPanel>
      }
      primaryAction={<Button onClick={openPlan} disabled={!projectId} className="max-sm:min-h-11">
        <CalendarClock className="h-4 w-4" aria-hidden="true" />Vardiya planı
      </Button>}
      filters={<div className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <PdksPeriodSwitcher filters={filters} setFilters={setFilters} />
          <PDKSDateNavigator values={filters} onChange={setFilters} />
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
      </div>}
      overlays={<>
        {canApprove && projectId && <Dialog open={correctionsOpen} onOpenChange={setCorrectionsOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>Düzeltme talepleri</DialogTitle>
              <DialogDescription>Seçili projenin bekleyen PDKS düzeltme taleplerini değerlendirin.</DialogDescription>
            </DialogHeader>
            <QuerySectionBoundary resetKey={projectId} title="Düzeltme talepleri yüklenemedi." description="Bağlantınızı kontrol edip yeniden deneyin.">
              {correctionsOpen && <CorrectionRequestsPanel projectId={projectId} />}
            </QuerySectionBoundary>
          </DialogContent>
        </Dialog>}
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
      </>}
    >
      <PdksRecordsResults view={view} />
    </PageTemplate>
  );
}
