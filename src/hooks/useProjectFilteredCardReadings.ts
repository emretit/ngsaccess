
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CardReading } from "@/types/access-control";
import { useProjectAccess } from './useProjectAccess';

interface CardReadingsData {
  readings: CardReading[];
  totalCount: number;
}

export const useProjectFilteredCardReadings = (pageSize: number = 100) => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [accessFilter, setAccessFilter] = useState<'all' | 'granted' | 'denied'>('all');

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, accessFilter]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["cardReadings", projectIds, currentPage, searchTerm, dateFilter, accessFilter],
    queryFn: async (): Promise<CardReadingsData> => {
      console.log("Fetching card readings for projects:", projectIds);
      
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      // Build query
      let query = supabase
        .from("card_readings")
        .select(`
          *,
          employees (
            departments (name)
          )
        `, { count: "exact" });
      
      // Super admin değilse proje filtrelemesi uygula
      if (!isSuperAdmin && projectIds.length > 0) {
        query = query.in('project_id', projectIds);
      } else if (!isSuperAdmin && projectIds.length === 0) {
        // Kullanıcının hiç projesi yoksa boş sonuç döndür
        return { readings: [], totalCount: 0 };
      }
      
      // Apply search filter
      if (searchTerm) {
        query = query.or(`employee_name.ilike.%${searchTerm}%,card_no.ilike.%${searchTerm}%,device_name.ilike.%${searchTerm}%`);
      }
      
      // Apply date filter
      if (dateFilter) {
        const startDate = new Date(dateFilter);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(dateFilter);
        endDate.setHours(23, 59, 59, 999);
        
        query = query
          .gte('access_time', startDate.toISOString())
          .lte('access_time', endDate.toISOString());
      }
      
      // Apply access status filter
      if (accessFilter === 'granted') {
        query = query.eq('access_granted', true);
      } else if (accessFilter === 'denied') {
        query = query.eq('access_granted', false);
      }
      
      // Apply sorting and pagination
      const { data, error, count } = await query
        .order("access_time", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("Error fetching card readings:", error);
        throw error;
      }
      
      // Convert the response to match CardReading type
      const cardReadings: CardReading[] = data.map((item: any) => ({
        ...item,
        status: item.access_granted ? 'success' : 'denied'
      }));
      
      return {
        readings: cardReadings,
        totalCount: count || 0
      };
    },
    enabled: !projectLoading && (isSuperAdmin || projectIds.length > 0),
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setDateFilter(undefined);
    setAccessFilter('all');
  };

  const totalPages = data ? Math.ceil(data.totalCount / pageSize) : 0;

  return {
    data,
    isLoading: isLoading || projectLoading,
    error,
    currentPage,
    setCurrentPage,
    searchTerm,
    setSearchTerm,
    dateFilter,
    setDateFilter,
    accessFilter, 
    setAccessFilter,
    handleRefresh,
    handleClearFilters,
    totalPages,
    pageSize,
    hasProjectAccess: isSuperAdmin || projectIds.length > 0
  };
};
