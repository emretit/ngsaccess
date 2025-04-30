
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface Zone {
  id: number;
  name: string;
  description?: string;
}

export interface Door {
  id: number;
  name: string;
  zone_id: number;
  location?: string;
  status?: string;
}

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
      return data || [];
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
      return data || [];
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
