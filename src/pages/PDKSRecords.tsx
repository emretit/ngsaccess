import { Link } from "react-router-dom";
import { useState } from "react";
import { ShiftTree } from "@/components/shifts/ShiftTree";
import { ShiftPlanSheet, useShiftPlanOpen } from "@/components/shifts/ShiftPlanSheet";
import { Settings, CalendarClock } from "lucide-react";
import { PDKS_SETTINGS_FROM_RECORDS, PDKS_SETTINGS_PATH } from "@/components/pdks/settings/route";
import { usePermissions } from "@/hooks/usePermissions";
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
  const [createShiftOpen, setCreateShiftOpen] = useState(false);
  const { setOpen: setPlanOpen } = useShiftPlanOpen();
  const view = usePdksRecordsView(filters, setFilters);
  const canSettings = usePermissions().can("schedule.manage");
  const {
    projectId, activeProject, canManage, setImport, setWarningsOpen, setAi,
    exportRows, dateRangeLabel, selectedDate, filterSummary, selectedIds,
    records, isLoading, setDatesOpen, setSmartPreset,
    effectiveSmartPreset, detailTrigger, detail, setDrilldown,
    startDate, endDate, importOpen,
  } = view;
  return (
    <div className="min-w-0 max-w-full space-y-4">
      <PageHeader
        title="PDKS"
        scope={`${activeProject?.name ?? "Proje seçin"} · ${dateRangeLabel}`}
        secondaryMenu={
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
                  {exportMenu}
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
      >
        <Button variant="outline" onClick={() => setPlanOpen(true)} disabled={!projectId}>
          <CalendarClock className="h-4 w-4" aria-hidden="true" />Vardiya planı
        </Button>
        {canSettings && (
          <Button asChild>
            <Link to={PDKS_SETTINGS_PATH} state={PDKS_SETTINGS_FROM_RECORDS}>
              <Settings className="h-4 w-4" aria-hidden="true" />
              Ayarlar
            </Link>
          </Button>
        )}
      </PageHeader>
      <div className="flex min-w-0 flex-col gap-4 min-[1100px]:flex-row min-[1100px]:gap-5">
        {projectId && <QuerySectionBoundary resetKey={projectId} title="Vardiyalar yüklenemedi" className="w-full min-w-0 shrink-0 min-[1100px]:w-[220px]">
          <ShiftTree key={projectId} projectId={projectId} selectedShiftId={filters.shiftId}
            onSelectShift={shiftId => setFilters({ ...filters, shiftId })}
            createOpen={createShiftOpen} onCreateOpenChange={setCreateShiftOpen} />
        </QuerySectionBoundary>}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex min-w-0 flex-col flex-wrap gap-3 sm:flex-row sm:items-center">
            <PdksPeriodSwitcher filters={filters} setFilters={setFilters} />
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
          <PdksRecordsResults view={view} />
        </div>
      </div>
      <ShiftPlanSheet onCreateShift={() => setCreateShiftOpen(true)} />
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
