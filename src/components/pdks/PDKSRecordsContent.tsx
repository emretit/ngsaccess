// @ts-nocheck
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AiInsightsCard } from "@/components/pdks/AiInsightsCard";
import { PDKSTable } from "./PDKSTable";
import { PDKSAiChat } from "./PDKSAiChat";

interface PDKSRecordsContentProps {
  section: string;
  records: any[];
  filteredRecords: any[];
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
  isLoadingInsight,
}: PDKSRecordsContentProps) {
  const rawEmployees = useQuery(api.employees.list, {}) ?? [];

  const employees = rawEmployees
    .filter((emp: any) => emp.isActive !== false)
    .map((emp: any) => ({
      id: emp._id,
      employee_first_name: emp.firstName ?? "",
      employee_last_name: emp.lastName ?? "",
      date: new Date().toISOString().split("T")[0],
      entry_time: "",
      exit_time: "",
      status: "present",
    }));

  const employeesLoading = rawEmployees === undefined;

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
