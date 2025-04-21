
import { AiInsightsCard } from "@/components/pdks/AiInsightsCard";
import { PDKSTable } from "./PDKSTable";
import { PDKSAiChat } from "./PDKSAiChat";
import { AttendanceTable } from "./AttendanceTable";

interface PDKSRecord {
  id: number;
  employee_first_name: string;
  employee_last_name: string;
  date: string;
  entry_time: string;
  exit_time: string;
  status: string;
}

interface PDKSRecordsContentProps {
  section: string;
  records: PDKSRecord[];
  filteredRecords: PDKSRecord[];
  loading: boolean;
  searchTerm: string;
  statusFilter: string;
  insight: string;
  isLoadingInsight: boolean;
}

export function PDKSRecordsContent({
  section,
  records,
  filteredRecords,
  loading,
  searchTerm,
  statusFilter,
  insight,
  isLoadingInsight
}: PDKSRecordsContentProps) {
  if (section === "summary") {
    return (
      <div className="p-6">
        <AiInsightsCard insight={insight} isLoading={isLoadingInsight} />
      </div>
    );
  }

  if (section === "attendance") {
    return (
      <div className="p-6">
        <AttendanceTable 
          dateRange={{
            start: new Date().toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0]
          }}
        />
      </div>
    );
  }

  if (section === "department") {
    return (
      <div className="glass-card p-6 m-6">
        <h3 className="font-medium text-lg mb-4">Departman Raporları</h3>
        <p className="text-gray-500">Bu özellik henüz geliştirilmektedir.</p>
      </div>
    );
  }

  if (section === "detailed") {
    return (
      <div className="glass-card p-6 m-6">
        <h3 className="font-medium text-lg mb-4">Detaylı Raporlar</h3>
        <p className="text-gray-500">Bu özellik henüz geliştirilmektedir.</p>
      </div>
    );
  }

  if (section === "ai-report") {
    return (
      <div className="p-6">
        <PDKSAiChat />
      </div>
    );
  }

  return null;
}
