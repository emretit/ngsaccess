
import { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Get project access information
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const { data: records = [], isLoading, error, refetch } = useQuery({
    queryKey: ['pdksRecords', projectIds],
    queryFn: async (): Promise<PDKSRecord[]> => {
      let query = supabase
        .from('pdks_records')
        .select('*')
        .order('date', { ascending: false });

      // Apply project filtering if not super admin
      if (!isSuperAdmin && projectIds.length > 0) {
        query = query.in('project_id', projectIds);
      } else if (!isSuperAdmin && projectIds.length === 0) {
        // User has no project access, return empty array
        return [];
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !projectLoading && (isSuperAdmin || projectIds.length > 0),
    staleTime: 3 * 60 * 1000, // 3 dakika fresh
    gcTime: 8 * 60 * 1000, // 8 dakika cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  const filteredRecords = records.filter(record => {
    const fullName = `${record.employee_first_name} ${record.employee_last_name}`.toLowerCase();
    const matchesSearch = searchTerm === "" || fullName.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleRefresh = () => {
    refetch();
  };

  return {
    records,
    filteredRecords,
    loading: isLoading || projectLoading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    handleRefresh
  };
}
