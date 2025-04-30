
import { useState } from "react";
import { PDKSRecordsContent } from "@/components/pdks/PDKSRecordsContent";
import { PDKSRecordsSidebar } from "@/components/pdks/PDKSRecordsSidebar";
import { AiDrawer } from "@/components/pdks/AiDrawer";
import { usePdksRecords } from "@/hooks/usePdksRecords";

export default function PDKSRecords() {
  const [selectedSection, setSelectedSection] = useState("summary");
  const { 
    records, 
    filteredRecords, 
    loading, 
    searchTerm, 
    setSearchTerm, 
    statusFilter, 
    setStatusFilter 
  } = usePdksRecords();

  const [insight, setInsight] = useState("PDKS kayıtlarına göre bu ay devamsızlık oranı %5 olarak gerçekleşmiştir. Geçen aya göre %2 düşüş göstermiştir.");
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  return (
    <div className="flex h-full">
      <PDKSRecordsSidebar 
        selected={selectedSection} 
        onSelect={setSelectedSection} 
      />
      <div className="flex-1 overflow-hidden">
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
      <AiDrawer />
    </div>
  );
}
