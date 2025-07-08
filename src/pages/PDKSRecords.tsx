
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { PDKSFilterBar } from "@/components/pdks/dashboard/PDKSFilterBar";
import { PDKSSummaryCards } from "@/components/pdks/dashboard/PDKSSummaryCards";
import { PDKSTableView } from "@/components/pdks/dashboard/PDKSTableView";
import { PDKSChartView } from "@/components/pdks/dashboard/PDKSChartView";
import { PDKSRealTimeWidget } from "@/components/pdks/dashboard/PDKSRealTimeWidget";
import { PDKSEnhancedExportPanel } from "@/components/pdks/dashboard/PDKSEnhancedExportPanel";
import { PDKSMobileDrawer } from "@/components/pdks/dashboard/PDKSMobileDrawer";
import { PDKSAiChat } from "@/components/pdks/PDKSAiChat";
import { usePdksRecords } from "@/hooks/usePdksRecords";
import { Button } from "@/components/ui/button";
import { X, MessageSquare, BarChart3, Table2, RefreshCw, Menu, Activity, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function PDKSRecords() {
  const [activeTab, setActiveTab] = useState("table");
  const [showAiChat, setShowAiChat] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { toast } = useToast();
  
  const { 
    records, 
    filteredRecords, 
    loading, 
    searchTerm, 
    setSearchTerm, 
    statusFilter, 
    setStatusFilter,
    handleRefresh 
  } = usePdksRecords();

  // Mock data for summary cards
  const summaryData = {
    totalEmployees: 150,
    presentToday: 132,
    lateArrivals: 8,
    overtimeHours: 45,
    insideBuilding: 42
  };

  // Transform records for table view
  const tableRecords = filteredRecords.map(record => ({
    id: record.id.toString(),
    name: `${record.employee_first_name} ${record.employee_last_name}`,
    employeeId: record.id.toString(),
    department: "IT",
    firstEntry: record.entry_time || "09:00",
    lastExit: record.exit_time || "18:00",
    totalHours: "8h 30m",
    overtime: "30m",
    leaveType: "-",
    status: record.status as 'present' | 'late' | 'absent' | 'leave',
    detailedLogs: [
      { time: "09:00", action: "Giriş", location: "Ana Giriş" },
      { time: "12:30", action: "Çıkış", location: "Ana Giriş" },
      { time: "13:30", action: "Giriş", location: "Ana Giriş" },
      { time: "18:00", action: "Çıkış", location: "Ana Giriş" }
    ]
  }));

  const handleFiltersChange = (filters: any) => {
    console.log("Filters changed:", filters);
  };

  const handleRefreshData = () => {
    handleRefresh();
    toast({
      title: "Veriler Yenilendi",
      description: "PDKS verileri başarıyla güncellendi.",
    });
  };

  if (loading) {
    return <LoadingSpinner text="PDKS kayıtları yükleniyor..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-gray-900 dark:to-gray-800">
      {/* Modern Header Section */}
      <div className="bg-white/90 backdrop-blur-sm dark:bg-gray-900/90 border-b border-gray-200/50 dark:border-gray-800/50 shadow-lg sticky top-0 z-40">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
                  PDKS Dashboard
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 font-medium">
                  📊 Personel Devam Kontrol Sistemi - Anlık Takip ve Raporlama
                </p>
              </div>
            </div>
            
            {/* Header Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshData}
                className="hidden sm:flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden md:inline">Yenile</span>
              </Button>
              
              <PDKSMobileDrawer onFiltersChange={handleFiltersChange} />
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAiChat(!showAiChat)}
                className="lg:hidden border-[#711A1A] text-[#711A1A] hover:bg-[#711A1A]/5"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">AI</span>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Desktop Filter Bar */}
        <div className="hidden lg:block border-t border-gray-100/50 dark:border-gray-800/50">
          <PDKSFilterBar onFiltersChange={handleFiltersChange} />
        </div>
      </div>
      
      {/* Enhanced Summary Cards */}
      <div className="relative z-30">
        <PDKSSummaryCards data={summaryData} />
      </div>
      
      {/* Main Content Layout */}
      <div className="px-4 sm:px-6 pb-6">
        <Card className="bg-white/95 backdrop-blur-sm dark:bg-gray-900/95 rounded-2xl shadow-2xl border-0 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Enhanced Tab Navigation */}
            <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-4 sm:p-6 border-b border-gray-200/50">
              <TabsList className="grid w-full grid-cols-4 max-w-2xl bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-1 shadow-inner h-12">
                <TabsTrigger 
                  value="table" 
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#711A1A] data-[state=active]:shadow-md rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  <Table2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Tablo</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="charts" 
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#711A1A] data-[state=active]:shadow-md rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Grafikler</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="realtime" 
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#711A1A] data-[state=active]:shadow-md rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">Canlı Takip</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="export" 
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#711A1A] data-[state=active]:shadow-md rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Dışa Aktar</span>
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="p-4 sm:p-6">
              <TabsContent value="table" className="space-y-6 mt-0">
                <PDKSTableView records={tableRecords} loading={loading} />
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
                  <PDKSEnhancedExportPanel />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </div>
      
      {/* Enhanced AI Chat - Fixed Sidebar (Desktop) */}
      {showAiChat && (
        <div className="hidden lg:block fixed right-0 top-0 h-full w-80 bg-white/98 backdrop-blur-md dark:bg-gray-900/98 border-l border-gray-200/50 dark:border-gray-800/50 z-50 shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-[#711A1A] to-[#8B1C26] text-white">
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
            <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-[#711A1A] to-[#8B1C26] text-white">
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
          className="bg-gradient-to-r from-[#711A1A] to-[#8B1C26] hover:from-[#711A1A]/90 hover:to-[#8B1C26]/90 text-white rounded-full h-16 w-16 p-0 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95"
        >
          {showAiChat ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        </Button>
      </div>
    </div>
  );
}
