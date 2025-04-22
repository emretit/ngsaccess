
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Zone {
  id: number;
  name: string;
}
export interface Door {
  id: number;
  name: string;
  zone_id: number;
}

export function useZonesAndDoors() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: zoneData } = await supabase
        .from("zones")
        .select("id, name").order("name", { ascending: true });
      setZones(zoneData || []);

      const { data: doorData } = await supabase
        .from("doors")
        .select("id, name, zone_id").order("name", { ascending: true });
      setDoors(doorData || []);

      setLoading(false);
    }
    fetchData();
  }, []);

  return { zones, doors, loading };
}
