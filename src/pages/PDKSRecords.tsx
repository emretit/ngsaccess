
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
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
import { X, MessageSquare, BarChart3, Table2, RefreshCw, Activity, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function PDKSRecords() {
  const [activeTab, setActiveTab] = useState("table");
  const [showAiChat, setShowAiChat] = useState(false);
  const [filters, setFilters] = useState<{
    dateRange?: { from?: Date; to?: Date };
    reportType?: "daily" | "weekly" | "monthly" | "custom";
  }>({ reportType: "daily" });
  const { toast } = useToast();

  const {
    records,
    filteredRecords,
    loading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    handleRefresh,
  } = usePdksRecords();

  // Get real statistics from database
  const { stats: summaryData, isLoading: statsLoading } = usePdksStats();
  const refetchStats = () => {};

  // Get real table data from database (filters: date range, report type)
  const {
    tableRecords,
    isLoading: tableLoading,
    refetch: refetchTable = () => {},
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
      reportType: (newFilters.reportType as "daily" | "weekly" | "monthly" | "custom") ?? "daily",
    });
  };

  const handleRefreshData = () => {
    handleRefresh();
    refetchStats();
    refetchTable();
    toast({
      title: "Veriler Yenilendi",
      description: "PDKS verileri başarıyla güncellendi.",
    });
  };

  if (loading || statsLoading || tableLoading) {
    return <LoadingSpinner text="PDKS kayıtları yükleniyor..." />;
  }

  return (
    <div className="space-y-6">
      {/* Sayfa başlığı ve aksiyonlar - Layout AppHeader ile uyumlu */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            PDKS Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Personel Devam Kontrol Sistemi - Anlık Takip ve Raporlama
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
          <PDKSMobileDrawer onFiltersChange={handleFiltersChange} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAiChat(!showAiChat)}
            className="gap-2 border-primary text-primary hover:bg-primary/5"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">AI Asistan</span>
          </Button>
        </div>
      </div>
      
      {/* Desktop Filter Bar */}
      <div className="hidden lg:block">
        <PDKSFilterBar onFiltersChange={handleFiltersChange} />
      </div>
      
      {/* Summary Cards */}
      <PDKSSummaryCards data={summaryData} />

      {/* Dashboard Widgets - Bekleyen izinler, yaklaşan vardiyalar, şu an içeride */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PDKSDashboardWidgets />
        </div>
        <div>
          <PDKSCurrentlyInsideWidget />
        </div>
      </div>

      {/* Main Content */}
      <div>
        <Card className="bg-white/95 backdrop-blur-sm dark:bg-gray-900/95 rounded-2xl shadow-2xl border-0 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Enhanced Tab Navigation */}
            <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-4 sm:p-6 border-b border-gray-200/50">
              <TabsList className="grid w-full grid-cols-4 max-w-2xl bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-1 shadow-inner h-12">
                <TabsTrigger 
                  value="table" 
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  <Table2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Tablo</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="charts" 
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Grafikler</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="realtime" 
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">Canlı Takip</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="export" 
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Dışa Aktar</span>
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="p-4 sm:p-6">
              <TabsContent value="table" className="space-y-6 mt-0">
                <PDKSTableView
                  records={tableRecords}
                  loading={tableLoading}
                  selectedDate={selectedDate}
                />
              </TabsContent>
              
              <TabsContent value="charts" className="space-y-6 mt-0">
                <PDKSChartView />
              </TabsContent>
              
              <TabsContent value="realtime" className="space-y-6 mt-0">
                <div className="max-w-md mx-auto">
                  <PDKSRealTimeWidget />
                </div>
              </TabsContent>
              
              <TabsContent value="export" className="space-y-6 mt-0">
                <div className="max-w-md mx-auto">
                  <PDKSEnhancedExportPanel
                    records={tableRecords}
                    selectedDate={selectedDate}
                    dateRange={dateRangeLabel}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </div>
      
      {/* Enhanced AI Chat - Fixed Sidebar (Desktop) */}
      {showAiChat && (
        <div className="hidden lg:block fixed right-0 top-0 h-full w-80 bg-white/98 backdrop-blur-md dark:bg-gray-900/98 border-l border-gray-200/50 dark:border-gray-800/50 z-50 shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-primary to-primary/80 text-white">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">AI Asistan</h3>
                <p className="text-xs text-white/80">PDKS Veri Analizi</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAiChat(false)}
              className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-[calc(100vh-5rem)]">
            <PDKSAiChat />
          </div>
        </div>
      )}
      
      {/* Enhanced Mobile AI Chat Modal */}
      {showAiChat && (
        <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50">
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white/98 backdrop-blur-md dark:bg-gray-900/98 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-primary to-primary/80 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">AI Asistan</h3>
                  <p className="text-xs text-white/80">PDKS Veri Analizi</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAiChat(false)}
                className="h-8 w-8 p-0 text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-[calc(100vh-5rem)]">
              <PDKSAiChat />
            </div>
          </div>
        </div>
      )}
      
      {/* Enhanced Mobile Floating Action Button */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setShowAiChat(!showAiChat)}
          className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-full h-16 w-16 p-0 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95"
        >
          {showAiChat ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        </Button>
      </div>
    </div>
  );
}
