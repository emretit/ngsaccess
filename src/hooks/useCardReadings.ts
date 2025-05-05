
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CardReading } from "@/types/access-control";

interface CardReadingsData {
  readings: CardReading[];
  totalCount: number;
}

export const useCardReadings = (pageSize: number = 100) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [accessFilter, setAccessFilter] = useState<'all' | 'granted' | 'denied'>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, accessFilter]);

  const fetchCardReadings = useCallback(async (): Promise<CardReadingsData> => {
    console.log("Fetching card readings for page:", currentPage);
    console.log("Filters:", { searchTerm, dateFilter, accessFilter });
    
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
    
    console.log("Card readings fetched:", data?.length || 0, "records");
    return {
      readings: data as CardReading[],
      totalCount: count || 0
    };
  }, [currentPage, searchTerm, dateFilter, accessFilter, pageSize, refreshTrigger]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["cardReadings", currentPage, searchTerm, dateFilter, accessFilter, refreshTrigger],
    queryFn: fetchCardReadings,
    staleTime: 10 * 1000, // Consider data stale after 10 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });

  const handleRefresh = useCallback(() => {
    console.log("Manual refresh triggered");
    setRefreshTrigger(prev => prev + 1);
    refetch();
  }, [refetch]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setDateFilter(undefined);
    setAccessFilter('all');
  }, []);

  const totalPages = data ? Math.ceil(data.totalCount / pageSize) : 0;

  return {
    data,
    isLoading,
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
    pageSize
  };
};
