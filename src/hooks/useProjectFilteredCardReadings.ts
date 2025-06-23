
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

      // Build query - using access_status instead of access_granted and properly join devices
      let query = supabase
        .from("card_readings")
        .select(`
          *,
          employees (
            departments (name)
          ),
          devices (
            name,
            device_serial
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
        query = query.or(`employee_name.ilike.%${searchTerm}%,card_no.ilike.%${searchTerm}%`);
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
      
      // Apply access status filter - using access_status enum
      if (accessFilter === 'granted') {
        query = query.eq('access_status', 'izin_verildi');
      } else if (accessFilter === 'denied') {
        query = query.eq('access_status', 'reddedildi');
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
        access_granted: item.access_status === 'izin_verildi', // Convert enum to boolean for compatibility
        status: item.access_status === 'izin_verildi' ? 'success' : 'denied',
        device_name: item.devices?.name || 'Bilinmeyen Cihaz', // Get from devices table
        device_location: '-', // Default value since column doesn't exist
        device_ip: '-', // Default value
        device_serial: item.devices?.device_serial || '-', // Get from devices table
        devices: item.devices // Keep the devices relation
      }));
      
      return {
        readings: cardReadings,
        totalCount: count || 0
      };
    },
    enabled: !projectLoading && (isSuperAdmin || projectIds.length > 0),
    staleTime: 2 * 60 * 1000, // 2 dakika boyunca veri fresh kabul edilir
    gcTime: 5 * 60 * 1000, // 5 dakika cache'de kalır
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
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
