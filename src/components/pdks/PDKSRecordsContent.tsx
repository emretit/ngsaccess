import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AiInsightsCard } from "@/components/pdks/AiInsightsCard";
import { PDKSTable } from "./PDKSTable";
import { PDKSAiChat } from "./PDKSAiChat";

interface PDKSAttendanceRecord {
  id: string;
  employee_first_name: string;
  employee_last_name: string;
  date: string;
  entry_time: string;
  exit_time: string;
  status: string;
}

interface PDKSRecordsContentProps {
  section: string;
  records: PDKSAttendanceRecord[];
  filteredRecords: PDKSAttendanceRecord[];
  loading: boolean;
  searchTerm: string;
  statusFilter: string;
  insight: string;
  isLoadingInsight: boolean;
}

export function PDKSRecordsContent({
  section,
  records: _records,
  filteredRecords: _filteredRecords,
  loading: _loading,
  searchTerm,
  statusFilter,
  insight,
  isLoadingInsight,
}: PDKSRecordsContentProps) {
  const rawEmployees = useQuery(api.employees.list, {});
  const employeesLoading = rawEmployees === undefined;

  const employees: PDKSAttendanceRecord[] = (rawEmployees ?? [])
    .filter((emp) => emp.isActive !== false)
    .map((emp) => ({
      id: String(emp._id),
      employee_first_name: emp.firstName ?? "",
      employee_last_name: emp.lastName ?? "",
      date: new Date().toISOString().split("T")[0],
      entry_time: "",
      exit_time: "",
      status: "present",
    }));

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
        <div className="rounded-lg border bg-card shadow-xs overflow-hidden mt-6 mx-6">
          <PDKSTable
            records={employees}
            loading={employeesLoading}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
          />
        </div>
      </div>
    );
  }

  if (section === "department") {
    return (
      <div className="rounded-lg border bg-card shadow-xs p-6 m-6">
        <h3 className="font-medium text-lg mb-4">Departman Raporları</h3>
        <p className="text-gray-500">Bu özellik henüz geliştirilmektedir.</p>
      </div>
    );
  }

  if (section === "detailed") {
    return (
      <div className="rounded-lg border bg-card shadow-xs p-6 m-6">
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
