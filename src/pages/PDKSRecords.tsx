
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PDKSFilterBar } from "@/components/pdks/dashboard/PDKSFilterBar";
import { PDKSSummaryCards } from "@/components/pdks/dashboard/PDKSSummaryCards";
import { PDKSDashboardWidgets } from "@/components/pdks/dashboard/PDKSDashboardWidgets";
import { PDKSCurrentlyInsideWidget } from "@/components/pdks/dashboard/PDKSCurrentlyInsideWidget";
import { PDKSTableView } from "@/components/pdks/dashboard/PDKSTableView";
import { PDKSChartView } from "@/components/pdks/dashboard/PDKSChartView";
import { PDKSRealTimeWidget } from "@/components/pdks/dashboard/PDKSRealTimeWidget";
import { PDKSEnhancedExportPanel } from "@/components/pdks/dashboard/PDKSEnhancedExportPanel";
import { PDKSMobileDrawer } from "@/components/pdks/dashboard/PDKSMobileDrawer";
import { PDKSAiChat } from "@/components/pdks/PDKSAiChat";
import { usePdksRecords } from "@/hooks/usePdksRecords";
import { usePdksStats } from "@/hooks/usePdksStats";
import { usePdksTableData } from "@/hooks/usePdksTableData";
import { Button } from "@/components/ui/button";
import { MessageSquare, BarChart3, Table2, RefreshCw, Activity, Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function PDKSRecords() {
  const [activeTab, setActiveTab] = useState("table");
  const [showAiChat, setShowAiChat] = useState(false);
  const [filters, setFilters] = useState<{
    dateRange?: { from?: Date; to?: Date };
    department?: string;
    person?: string;
    reportType?: "daily" | "weekly" | "monthly" | "custom";
  }>({ reportType: "daily" });
  const { toast } = useToast();

  const {
    loading,
    handleRefresh,
  } = usePdksRecords();

  const { stats: summaryData, isLoading: statsLoading } = usePdksStats();

  const {
    tableRecords,
    isLoading: tableLoading,
    selectedDate,
    dateRangeLabel,
  } = usePdksTableData(filters);

  const handleFiltersChange = (newFilters: {
    dateRange?: { from?: Date; to?: Date };
    department?: string;
    person?: string;
    reportType?: string;
  }) => {
    setFilters({
      dateRange: newFilters.dateRange,
      department: newFilters.department,
      person: newFilters.person,
      reportType: (newFilters.reportType as "daily" | "weekly" | "monthly" | "custom") ?? "daily",
    });
  };

  const handleRefreshData = () => {
    handleRefresh();
    toast({
      title: "Veriler güncellendi",
      description: "PDKS verileri yenilendi.",
    });
  };

  const activeFilterCount =
    (filters.dateRange?.from ? 1 : 0) +
    (filters.department && filters.department !== "all" ? 1 : 0) +
    (filters.person ? 1 : 0) +
    (filters.reportType && filters.reportType !== "daily" ? 1 : 0);

  if (loading || statsLoading || tableLoading) {
    return <LoadingSpinner text="PDKS kayıtları yükleniyor..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">PDKS Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Personel Devam Kontrol Sistemi
          </p>
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
            onFiltersChange={handleFiltersChange}
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
        <PDKSFilterBar onFiltersChange={handleFiltersChange} />
      </div>

      <PDKSSummaryCards data={summaryData} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PDKSDashboardWidgets />
        </div>
        <div>
          <PDKSCurrentlyInsideWidget />
        </div>
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-4 py-3 border-b border-border">
            <TabsList className="grid w-full grid-cols-4 h-10 bg-muted">
              <TabsTrigger value="table" className="flex items-center gap-2 text-xs sm:text-sm">
                <Table2 className="h-4 w-4" />
                <span>Tablo</span>
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
