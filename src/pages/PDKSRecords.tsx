import { subDays } from "date-fns";
import { toLocalDateString } from "@/lib/date";
import { summarizePdksRecords } from "@/lib/pdksSummary";
import { PDKSDateNavigator } from "@/components/pdks/dashboard/PDKSDateNavigator";
import { useCallback, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PDKSFilterBar, type FilterValues, type StatusFilter } from "@/components/pdks/dashboard/PDKSFilterBar";
import { PDKSSummaryCards } from "@/components/pdks/dashboard/PDKSSummaryCards";
import { PDKSTableView } from "@/components/pdks/dashboard/PDKSTableView";
import { PDKSHeatmapView } from "@/components/pdks/dashboard/PDKSHeatmapView";
import { PDKSEmployeeDetailDrawer } from "@/components/pdks/dashboard/PDKSEmployeeDetailDrawer";
import { PDKSChartView } from "@/components/pdks/dashboard/PDKSChartView";
import { PDKSEnhancedExportPanel } from "@/components/pdks/dashboard/PDKSEnhancedExportPanel";
import { PDKSMobileDrawer } from "@/components/pdks/dashboard/PDKSMobileDrawer";
import { PDKSQuickPresets } from "@/components/pdks/dashboard/PDKSQuickPresets";
import { PDKSActiveFilterChips } from "@/components/pdks/dashboard/PDKSActiveFilterChips";
import { PDKSSavedViews } from "@/components/pdks/dashboard/PDKSSavedViews";
import { PDKSOvertimeAlert } from "@/components/pdks/dashboard/PDKSOvertimeAlert";
import { PDKSImportDialog } from "@/components/pdks/dashboard/PDKSImportDialog";
import { PDKSSmartPresets, type SmartPresetSelection } from "@/components/pdks/dashboard/PDKSSmartPresets";
import { Upload } from "lucide-react";
import { PDKSAiChat } from "@/components/pdks/PDKSAiChat";
import { PDKSInlineQuery } from "@/components/pdks/PDKSInlineQuery";
import { usePdksStats } from "@/hooks/usePdksStats";
import { usePdksTableData } from "@/hooks/usePdksTableData";
import { usePdksFilterParams } from "@/hooks/usePdksFilterParams";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, BarChart3, Table2, Download, X, LayoutGrid } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

const DEFAULT_FILTERS: FilterValues = {
  dateRange: { from: undefined, to: undefined },
  reportType: "daily",
  companyId: undefined,
  departmentId: undefined,
  positionId: undefined,
  shiftId: undefined,
  statusFilter: "all",
  person: "",
};

export default function PDKSRecords() {
  const [activeTab, setActiveTab] = useState("table");
  const [showAiChat, setShowAiChat] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [smartPreset, setSmartPreset] = useState<SmartPresetSelection | null>(null);
  const { filters, setFilters } = usePdksFilterParams(DEFAULT_FILTERS);
  const [drilldown, setDrilldown] = useState<{
    employeeId: Id<"employees">;
    date?: string;
  } | null>(null);
  const {
    tableRecords: rawTableRecords,
    allRecords,
    isLoading: tableLoading,
    selectedDate,
    dateRangeLabel,
    startDate,
    endDate,
  } = usePdksTableData(filters);

  const todayKey = toLocalDateString();
  const selectedDateKey = toLocalDateString(selectedDate);
  const showLiveStats = filters.reportType === "daily" && selectedDateKey === todayKey;

  const { stats: liveData, isLoading: statsLoading } = usePdksStats({
    companyId: filters.companyId,
    departmentId: filters.departmentId,
    positionId: filters.positionId,
    shiftId: filters.shiftId,
    compareWithPrevious: true,
    enabled: showLiveStats,
  });

  const effectiveSmartPreset = smartPreset?.date && smartPreset.date !== selectedDateKey ? null : smartPreset;
  const tableRecords = effectiveSmartPreset
    ? rawTableRecords.filter((r) =>
        effectiveSmartPreset.employeeIds.some((id) => String(id) === String(r.id)),
      )
    : rawTableRecords;

  const summaryData = summarizePdksRecords(allRecords, todayKey);

  const activeFilterCount =
    (filters.dateRange.from ? 1 : 0) +
    (filters.reportType !== "daily" ? 1 : 0) +
    (filters.companyId ? 1 : 0) +
    (filters.departmentId ? 1 : 0) +
    (filters.positionId ? 1 : 0) +
    (filters.shiftId ? 1 : 0) +
    (filters.statusFilter !== "all" ? 1 : 0) +
    (filters.person ? 1 : 0);

  const handleCardClick = useCallback(
    (status: StatusFilter) => {
      setFilters({ ...filters, statusFilter: status });
    },
    [filters, setFilters]
  );

  const handleHeatmapCellClick = useCallback(
    (employeeId: string, date: string) => {
      setDrilldown({ employeeId: employeeId as Id<"employees">, date });
    },
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">PDKS Kayıtları</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">
              Personel Devam Kontrol Sistemi
            </p>
            <PDKSDateNavigator values={filters} onChange={setFilters} />
            <Badge variant="secondary" className="text-xs">
              {tableRecords.length} çalışan
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PDKSSavedViews filters={filters} onApply={setFilters} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport(true)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">İçe Aktar</span>
          </Button>
          <PDKSMobileDrawer
            values={filters}
            onChange={setFilters}
            activeFilterCount={activeFilterCount}
          />
        </div>
      </div>

      <div className="hidden lg:block">
        <PDKSFilterBar values={filters} onChange={setFilters} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PDKSQuickPresets values={filters} onChange={setFilters} />
        <PDKSActiveFilterChips values={filters} onChange={setFilters} />
      </div>

      <PDKSSmartPresets
        key={selectedDateKey}
        anchorDate={selectedDate}
        selection={effectiveSmartPreset}
        onChange={setSmartPreset}
      />

      <PDKSOvertimeAlert />

      <PDKSSummaryCards
        data={summaryData}
        loading={tableLoading}
        liveData={showLiveStats ? liveData : undefined}
        liveLoading={statsLoading}
        isPeriod={filters.reportType !== "daily"}
        onCardClick={handleCardClick}
      />

      <PDKSInlineQuery
        filters={filters}
        onApplyFilters={setFilters}
        onOpenChat={() => setShowAiChat(true)}
      />

      <Card className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4 py-3 border-b border-border">
            <TabsList className="grid w-full grid-cols-4 h-10 bg-muted">
              <TabsTrigger value="table" className="flex items-center gap-2 text-xs sm:text-sm">
                <Table2 className="h-4 w-4" />
                <span>Tablo</span>
              </TabsTrigger>
              <TabsTrigger value="heatmap" className="flex items-center gap-2 text-xs sm:text-sm">
                <LayoutGrid className="h-4 w-4" />
                <span>Heatmap</span>
              </TabsTrigger>
              <TabsTrigger value="charts" className="flex items-center gap-2 text-xs sm:text-sm">
                <BarChart3 className="h-4 w-4" />
                <span>Grafikler</span>
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center gap-2 text-xs sm:text-sm">
                <Download className="h-4 w-4" />
                <span>Dışa Aktar</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-4">
            <TabsContent value="table" className="mt-0">
              <PDKSTableView
                key={`${filters.reportType}:${startDate}:${endDate}`}
                records={tableRecords}
                loading={tableLoading}
                selectedDate={selectedDate}
                editDate={filters.reportType === "daily" ? selectedDateKey : undefined}
                onShowDetail={(employeeId) => setDrilldown({ employeeId })}
              />
            </TabsContent>

            <TabsContent value="heatmap" className="mt-0">
              <PDKSHeatmapView
                records={tableRecords}
                loading={tableLoading}
                startDate={startDate}
                endDate={endDate}
                onCellClick={handleHeatmapCellClick}
              />
            </TabsContent>

            <TabsContent value="charts" className="mt-0">
              <PDKSChartView
                startDate={filters.reportType === "daily" ? toLocalDateString(subDays(selectedDate, 6)) : startDate}
                endDate={endDate}
              />
            </TabsContent>

            <TabsContent value="export" className="mt-0">
              <PDKSEnhancedExportPanel
                records={tableRecords}
                selectedDate={selectedDate}
                dateRange={dateRangeLabel}
              />
            </TabsContent>
          </div>
        </Tabs>
      </Card>

      <PDKSEmployeeDetailDrawer
        open={drilldown !== null}
        onOpenChange={(open) => !open && setDrilldown(null)}
        employeeId={drilldown?.employeeId ?? null}
        startDate={startDate}
        endDate={endDate}
        highlightDate={drilldown?.date}
      />

      <PDKSImportDialog open={showImport} onOpenChange={setShowImport} />

      <Sheet open={showAiChat} onOpenChange={setShowAiChat}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-border bg-primary text-primary-foreground">
            <SheetTitle className="flex items-center gap-2 text-primary-foreground">
              <MessageSquare className="h-5 w-5" />
              AI Asistan — PDKS Veri Analizi
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <PDKSAiChat />
          </div>
        </SheetContent>
      </Sheet>

      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setShowAiChat(!showAiChat)}
          size="icon"
          className="rounded-full h-14 w-14 shadow-lg"
        >
          {showAiChat ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}
