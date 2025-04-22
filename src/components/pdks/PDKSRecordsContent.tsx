import { useEffect, useState } from "react";
import { AiInsightsCard } from "@/components/pdks/AiInsightsCard";
import { PDKSTable } from "./PDKSTable";
import { PDKSAiChat } from "./PDKSAiChat";
import { supabase } from "@/integrations/supabase/client";

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
  const [employees, setEmployees] = useState<PDKSRecord[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      // Convert employee data to PDKSRecord format
      const formattedRecords = data.map(emp => ({
        id: emp.id,
        employee_first_name: emp.first_name,
        employee_last_name: emp.last_name,
        date: new Date().toISOString().split('T')[0],
        entry_time: "",  // These will be empty for new employees
        exit_time: "",   // These will be empty for new employees
        status: "present" // Default status
      }));

      setEmployees(formattedRecords);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setEmployeesLoading(false);
    }
  }

  if (section === "summary") {
    return (
      <div className="p-6">
        <AiInsightsCard insight={insight} isLoading={isLoadingInsight} />
      </div>
    );
  }

  if (section === "attendance") {
    const displayRecords = employees;
    
    return (
      <div className="p-0">
        <div className="glass-card overflow-hidden mt-6 mx-6">
          <PDKSTable
            records={displayRecords}
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
