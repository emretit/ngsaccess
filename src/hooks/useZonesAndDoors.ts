
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Zone, Door } from "@/types/access-control";

// Re-export the types so components importing from this file can use them
export type { Zone, Door };

export function useZonesAndDoors() {
  const { 
    data: zones = [], 
    isLoading: zonesLoading,
    error: zonesError,
    refetch: refetchZones
  } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zones")
        .select("id, name, description")
        .order("name", { ascending: true });
        
      if (error) throw error;
      return data as Zone[] || [];
    }
  });

  const { 
    data: doors = [], 
    isLoading: doorsLoading,
    error: doorsError,
    refetch: refetchDoors
  } = useQuery({
    queryKey: ['doors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doors")
        .select("id, name, zone_id, location, status")
        .order("name", { ascending: true });
        
      if (error) throw error;
      return data as Door[] || [];
    }
  });

  const loading = zonesLoading || doorsLoading;
  
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
