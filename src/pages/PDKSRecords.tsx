
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

export default function PDKSRecords() {
  const [activeTab, setActiveTab] = useState("table");
  const [showAiChat, setShowAiChat] = useState(false);
  
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
    department: "IT", // This would come from employee data
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
    // Apply filters logic here
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Filter Bar - Sticky */}
      <PDKSFilterBar onFiltersChange={handleFiltersChange} />
      
      {/* Summary Cards */}
      <PDKSSummaryCards data={summaryData} />
      
      {/* Main Content Area */}
      <div className="flex gap-6 px-6 pb-6">
        {/* Left Content - Main Dashboard */}
        <div className="flex-1">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="table" className="flex items-center gap-2">
                📊 Tablo Görünümü
              </TabsTrigger>
              <TabsTrigger value="charts" className="flex items-center gap-2">
                📈 Grafik Görünümü
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="table" className="space-y-6">
              <PDKSTableView records={tableRecords} loading={loading} />
            </TabsContent>
            
            <TabsContent value="charts" className="space-y-6">
              <PDKSChartView />
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Right Sidebar */}
        <div className="w-80 space-y-6">
          {/* Real-time Widget */}
          <PDKSRealTimeWidget />
          
          {/* Export Panel */}
          <PDKSExportPanel />
          
          {/* AI Chat Toggle */}
          <div className="lg:hidden">
            <button
              onClick={() => setShowAiChat(!showAiChat)}
              className="w-full bg-[#711A1A] hover:bg-[#711A1A]/90 text-white px-4 py-2 rounded-lg"
            >
              {showAiChat ? "AI Chat'i Kapat" : "AI Chat'i Aç"}
            </button>
          </div>
        </div>
      </div>
      
      {/* AI Chat - Desktop Sidebar */}
      <div className="hidden lg:block fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 z-40">
        <PDKSAiChat />
      </div>
      
      {/* AI Chat - Mobile Modal */}
      {showAiChat && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-50">
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-gray-900">
            <PDKSAiChat />
            <button
              onClick={() => setShowAiChat(false)}
              className="absolute top-4 left-4 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
