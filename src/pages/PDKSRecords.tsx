
import { useState, useEffect } from 'react';
import { usePdksAi } from "@/hooks/usePdksAi";
import { useMedia } from "@/hooks/use-mobile";
import { usePdksRecords } from "@/hooks/usePdksRecords";
import { PDKSHeader } from "@/components/pdks/PDKSHeader";
import { PDKSRecordsSidebar } from '@/components/pdks/PDKSRecordsSidebar';
import { PDKSRecordsContent } from '@/components/pdks/PDKSRecordsContent';
import { PDKSAiChat } from "@/components/pdks/PDKSAiChat";
import { AiDrawer } from "@/components/pdks/AiDrawer";
import { exportToCsv } from "@/utils/exportToCsv";
import { useToast } from "@/hooks/use-toast";

export default function PDKSRecords() {
  const [selectedSection, setSelectedSection] = useState("summary");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const { toast } = useToast();
  const { insight, isLoadingInsight, fetchInsight } = usePdksAi();
  const isMobile = useMedia("(max-width: 768px)");
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

  // Check if Llama server is accessible on page load
  useEffect(() => {
    const checkLlamaServer = async () => {
      try {
        const response = await fetch("http://localhost:5050/status", {
          method: 'GET',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        
        if (response.ok) {
          const data = await response.json();
          toast({
            title: "Llama AI Modeli Hazır",
            description: `Yerel Llama sunucusu ${data.status || 'aktif'} durumunda.`,
          });
        }
      } catch (error) {
        console.log("Llama server check failed:", error);
        // Silent fail - the model status component will handle the display
      }
    };
    
    checkLlamaServer();
  }, [toast]);

  return (
    <main className="flex-1 p-6 bg-gray-50 flex flex-col min-h-[calc(100vh-4rem)]">
      <PDKSHeader
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onRefresh={handleRefresh}
        onExportCSV={() => exportToCsv(filteredRecords)}
        onAiPanelToggle={() => setShowAiPanel(!showAiPanel)}
        showAiPanel={showAiPanel}
        isMobile={isMobile}
        AiDrawer={<AiDrawer filters={{ statusFilter }} />}
      />
      <div className="flex flex-1 min-h-0 mt-2 gap-4">
        <PDKSRecordsSidebar 
          selected={selectedSection}
          onSelect={setSelectedSection}
        />
        <div className="flex-1 overflow-auto">
          <PDKSRecordsContent
            section={selectedSection}
            records={records}
            filteredRecords={filteredRecords}
            loading={loading}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            insight={insight}
            isLoadingInsight={isLoadingInsight}
          />
        </div>
        {showAiPanel && !isMobile && (
          <div className="w-96">
            <PDKSAiChat />
          </div>
        )}
      </div>
    </main>
  );
}
