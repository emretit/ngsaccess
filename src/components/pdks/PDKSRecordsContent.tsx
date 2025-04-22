
import { AiInsightsCard } from "@/components/pdks/AiInsightsCard";
import { PDKSTable } from "./PDKSTable";
import { PDKSAiChat } from "./PDKSAiChat";

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
  // Sample data for demo purposes if no records are available
  const demoRecords = [
    {
      id: 1,
      employee_first_name: "Ahmet",
      employee_last_name: "Yılmaz",
      date: "2025-04-22",
      entry_time: "08:15",
      exit_time: "17:30",
      status: "present"
    },
    {
      id: 2,
      employee_first_name: "Ayşe",
      employee_last_name: "Kaya",
      date: "2025-04-22",
      entry_time: "08:45",
      exit_time: "17:20",
      status: "late"
    },
    {
      id: 3,
      employee_first_name: "Mehmet",
      employee_last_name: "Demir",
      date: "2025-04-22",
      entry_time: "",
      exit_time: "",
      status: "absent"
    },
    {
      id: 4,
      employee_first_name: "Fatma",
      employee_last_name: "Şahin",
      date: "2025-04-21",
      entry_time: "08:05",
      exit_time: "17:00",
      status: "present"
    },
    {
      id: 5,
      employee_first_name: "Ali",
      employee_last_name: "Öztürk",
      date: "2025-04-21",
      entry_time: "09:10",
      exit_time: "18:00",
      status: "late"
    }
  ];

  // Use actual data if available, otherwise use demo data
  const recordsToDisplay = filteredRecords.length > 0 ? filteredRecords : (records.length > 0 ? records : demoRecords);

  if (section === "summary") {
    return (
      <div className="p-6">
        <AiInsightsCard insight={insight} isLoading={isLoadingInsight} />
      </div>
    );
  }

  if (section === "attendance") {
    return (
      <div className="p-0">
        <div className="glass-card overflow-hidden mt-6 mx-6">
          <PDKSTable
            records={recordsToDisplay}
            loading={loading}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
          />
        </div>
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
