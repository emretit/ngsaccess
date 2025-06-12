
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Zone, Door } from "@/types/access-control";
import { useProjectAccess } from "./useProjectAccess";

// Re-export the types so components importing from this file can use them
export type { Zone, Door };

export function useZonesAndDoors() {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const { 
    data: zones = [], 
    isLoading: zonesLoading,
    error: zonesError,
    refetch: refetchZones
  } = useQuery({
    queryKey: ['zones', projectIds],
    queryFn: async () => {
      console.log('Fetching zones for projects:', projectIds);
      
      let query = supabase
        .from("zones")
        .select("id, name, description")
        .order("name", { ascending: true });

      // Super admin değilse proje filtrelemesi uygula
      if (!isSuperAdmin && projectIds.length > 0) {
        query = query.in('project_id', projectIds);
      } else if (!isSuperAdmin && projectIds.length === 0) {
        // Kullanıcının hiç projesi yoksa boş sonuç döndür
        return [];
      }
        
      const { data, error } = await query;
      if (error) throw error;
      return data as Zone[] || [];
    },
    enabled: !projectLoading && (isSuperAdmin || projectIds.length > 0),
    staleTime: 10 * 60 * 1000, // 10 dakika boyunca veri fresh kabul edilir
    gcTime: 20 * 60 * 1000, // 20 dakika cache'de kalır
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  const { 
    data: doors = [], 
    isLoading: doorsLoading,
    error: doorsError,
    refetch: refetchDoors
  } = useQuery({
    queryKey: ['doors', projectIds],
    queryFn: async () => {
      console.log('Fetching doors for projects:', projectIds);
      
      let query = supabase
        .from("doors")
        .select("id, name, zone_id, location, status")
        .order("name", { ascending: true });

      // Super admin değilse proje filtrelemesi uygula
      if (!isSuperAdmin && projectIds.length > 0) {
        query = query.in('project_id', projectIds);
      } else if (!isSuperAdmin && projectIds.length === 0) {
        // Kullanıcının hiç projesi yoksa boş sonuç döndür
        return [];
      }
        
      const { data, error } = await query;
      if (error) throw error;
      return data as Door[] || [];
    },
    enabled: !projectLoading && (isSuperAdmin || projectIds.length > 0),
    staleTime: 10 * 60 * 1000, // 10 dakika boyunca veri fresh kabul edilir
    gcTime: 20 * 60 * 1000, // 20 dakika cache'de kalır
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  const loading = zonesLoading || doorsLoading || projectLoading;
  
  // Verileri yenileme fonksiyonu
  const refreshData = () => {
    refetchZones();
    refetchDoors();
  };

  return { 
    zones, 
    doors, 
    loading, 
    error: zonesError || doorsError,
    refreshData
  };
}
