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
import { PDKSRealTimeWidget } from "@/components/pdks/dashboard/PDKSRealTimeWidget";
import { PDKSEnhancedExportPanel } from "@/components/pdks/dashboard/PDKSEnhancedExportPanel";
import { PDKSMobileDrawer } from "@/components/pdks/dashboard/PDKSMobileDrawer";
import { PDKSAiChat } from "@/components/pdks/PDKSAiChat";
import { usePdksRecords } from "@/hooks/usePdksRecords";
import { usePdksStats } from "@/hooks/usePdksStats";
import { usePdksTableData } from "@/hooks/usePdksTableData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, BarChart3, Table2, RefreshCw, Activity, Download, X, Calendar as CalendarIcon, LayoutGrid } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
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
  const [filters, setFilters] = useState<FilterValues>(DEFAULT_FILTERS);
  const [drilldown, setDrilldown] = useState<{
    employeeId: Id<"employees">;
    date?: string;
  } | null>(null);
  const { toast } = useToast();

  const { loading, handleRefresh } = usePdksRecords();
  const { stats: summaryData, isLoading: statsLoading } = usePdksStats({
    companyId: filters.companyId,
    departmentId: filters.departmentId,
    positionId: filters.positionId,
    shiftId: filters.shiftId,
    compareWithPrevious: true,
  });

  const {
    tableRecords,
    isLoading: tableLoading,
    selectedDate,
    dateRangeLabel,
    startDate,
    endDate,
  } = usePdksTableData(filters);

  const handleRefreshData = () => {
    handleRefresh();
    toast({
      title: "Veriler güncellendi",
      description: "PDKS verileri yenilendi.",
    });
  };

  const activeFilterCount =
    (filters.dateRange.from ? 1 : 0) +
    (filters.reportType !== "daily" ? 1 : 0) +
    (filters.companyId ? 1 : 0) +
    (filters.departmentId ? 1 : 0) +
    (filters.positionId ? 1 : 0) +
    (filters.shiftId ? 1 : 0) +
    (filters.statusFilter !== "all" ? 1 : 0) +
    (filters.person ? 1 : 0);

  const handleCardClick = useCallback((status: StatusFilter) => {
    setFilters((f) => ({ ...f, statusFilter: status }));
  }, []);

  const handleHeatmapCellClick = useCallback(
    (employeeId: string, date: string) => {
      setDrilldown({ employeeId: employeeId as Id<"employees">, date });
    },
    []
  );

  if (loading || statsLoading) {
    return <LoadingSpinner text="PDKS kayıtları yükleniyor..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">PDKS Dashboard</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-sm text-muted-foreground">
              Personel Devam Kontrol Sistemi
            </p>
            <Badge variant="outline" className="gap-1.5 text-xs">
              <CalendarIcon className="h-3 w-3" />
              {dateRangeLabel}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {tableRecords.length} çalışan
            </Badge>
            {filters.statusFilter !== "all" && (
              <Badge variant="default" className="text-xs gap-1">
                Filtre: {filters.statusFilter}
                <button
                  onClick={() =>
                    setFilters((f) => ({ ...f, statusFilter: "all" }))
                  }
                  className="hover:opacity-70"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshData}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Yenile</span>
          </Button>
          <PDKSMobileDrawer
            values={filters}
            onChange={setFilters}
            activeFilterCount={activeFilterCount}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAiChat(true)}
            className="gap-2 border-primary text-primary hover:bg-primary/5"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">AI Asistan</span>
          </Button>
        </div>
      </div>

      <div className="hidden lg:block">
        <PDKSFilterBar values={filters} onChange={setFilters} />
      </div>

      <PDKSSummaryCards data={summaryData} onCardClick={handleCardClick} />

      <Card className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4 py-3 border-b border-border">
            <TabsList className="grid w-full grid-cols-5 h-10 bg-muted">
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
              <TabsTrigger value="realtime" className="flex items-center gap-2 text-xs sm:text-sm">
                <Activity className="h-4 w-4" />
                <span>Canlı</span>
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
                records={tableRecords}
                loading={tableLoading}
                selectedDate={selectedDate}
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
              <PDKSChartView />
            </TabsContent>

            <TabsContent value="realtime" className="mt-0">
              <PDKSRealTimeWidget />
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
