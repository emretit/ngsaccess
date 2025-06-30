
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PDKSFilterBar } from "@/components/pdks/dashboard/PDKSFilterBar";
import { PDKSSummaryCards } from "@/components/pdks/dashboard/PDKSSummaryCards";
import { PDKSTableView } from "@/components/pdks/dashboard/PDKSTableView";
import { PDKSChartView } from "@/components/pdks/dashboard/PDKSChartView";
import { PDKSRealTimeWidget } from "@/components/pdks/dashboard/PDKSRealTimeWidget";
import { PDKSExportPanel } from "@/components/pdks/dashboard/PDKSExportPanel";
import { PDKSAiChat } from "@/components/pdks/PDKSAiChat";
import { usePdksRecords } from "@/hooks/usePdksRecords";
import { Button } from "@/components/ui/button";
import { X, MessageSquare, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function PDKSRecords() {
  const [activeTab, setActiveTab] = useState("table");
  const [showAiChat, setShowAiChat] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  const { 
    records, 
    filteredRecords, 
    loading, 
    searchTerm, 
    setSearchTerm, 
    statusFilter, 
    setStatusFilter 
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-gray-900 dark:to-gray-800">
      {/* Header Section */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                PDKS Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Personel Devam Kontrol Sistemi - Anlık Takip ve Raporlama
              </p>
            </div>
            
            {/* Mobile Menu Button */}
            <div className="flex items-center gap-2 lg:hidden">
              <Sheet open={showMobileFilters} onOpenChange={setShowMobileFilters}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="top" className="h-auto">
                  <PDKSFilterBar onFiltersChange={handleFiltersChange} />
                </SheetContent>
              </Sheet>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAiChat(!showAiChat)}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Desktop Filter Bar */}
        <div className="hidden lg:block">
          <PDKSFilterBar onFiltersChange={handleFiltersChange} />
        </div>
      </div>
      
      {/* Summary Cards */}
      <PDKSSummaryCards data={summaryData} />
      
      {/* Main Content Area */}
      <div className="flex gap-6 px-6 pb-6 relative">
        {/* Left Content - Main Dashboard */}
        <div className={`flex-1 transition-all duration-300 ${showAiChat ? 'lg:mr-80' : ''}`}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
              <TabsList className="grid w-full grid-cols-2 max-w-md bg-gray-100 dark:bg-gray-800">
                <TabsTrigger 
                  value="table" 
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#711A1A]"
                >
                  📊 Tablo Görünümü
                </TabsTrigger>
                <TabsTrigger 
                  value="charts" 
                  className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-[#711A1A]"
                >
                  📈 Grafik Görünümü
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="table" className="space-y-6">
              <PDKSTableView records={tableRecords} loading={loading} />
            </TabsContent>
            
            <TabsContent value="charts" className="space-y-6">
              <PDKSChartView />
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Right Sidebar - Only show when AI chat is closed */}
        {!showAiChat && (
          <div className="hidden lg:block w-80 space-y-6">
            <PDKSRealTimeWidget />
            <PDKSExportPanel />
            
            <Button
              onClick={() => setShowAiChat(true)}
              className="w-full bg-[#711A1A] hover:bg-[#711A1A]/90 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              AI Asistan
            </Button>
          </div>
        )}
      </div>
      
      {/* AI Chat - Fixed Sidebar (Desktop) */}
      {showAiChat && (
        <div className="hidden lg:block fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 z-50 shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-[#711A1A] to-[#8B1C26] text-white">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <h3 className="font-semibold">AI Asistan</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAiChat(false)}
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-[calc(100vh-4rem)]">
            <PDKSAiChat />
          </div>
        </div>
      )}
      
      {/* Mobile AI Chat Modal */}
      {showAiChat && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-50">
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-[#711A1A] to-[#8B1C26] text-white">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                <h3 className="font-semibold">AI Asistan</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAiChat(false)}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-[calc(100vh-4rem)]">
              <PDKSAiChat />
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Floating Action Button */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => setShowAiChat(!showAiChat)}
          className="bg-[#711A1A] hover:bg-[#711A1A]/90 text-white rounded-full h-14 w-14 p-0 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110"
        >
          {showAiChat ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        </Button>
      </div>
    </div>
  );
}
