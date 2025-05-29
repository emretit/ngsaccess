
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useProjectAccess } from '@/hooks/useProjectAccess';

export interface PDKSRecord {
  id: number;
  employee_first_name: string;
  employee_last_name: string;
  date: string;
  entry_time: string;
  exit_time: string;
  status: string;
}

export function usePdksRecords() {
  const [records, setRecords] = useState<PDKSRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Get project access information
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  useEffect(() => {
    if (!projectLoading) {
      fetchRecords();
    }
  }, [projectIds, isSuperAdmin, projectLoading]);

  async function fetchRecords() {
    setLoading(true);
    try {
      let query = supabase
        .from('pdks_records')
        .select('*')
        .order('date', { ascending: false });

      // Apply project filtering if not super admin
      if (!isSuperAdmin && projectIds.length > 0) {
        query = query.in('project_id', projectIds);
      } else if (!isSuperAdmin && projectIds.length === 0) {
        // User has no project access, return empty array
        setRecords([]);
        setLoading(false);
        return;
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching PDKS records:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredRecords = records.filter(record => {
    const fullName = `${record.employee_first_name} ${record.employee_last_name}`.toLowerCase();
    const matchesSearch = searchTerm === "" || fullName.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRefresh = () => {
    fetchRecords();
  };

  return {
    records,
    filteredRecords,
    loading: loading || projectLoading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    handleRefresh
  };
}
