
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Device } from "@/types/device";
import { useEffect } from "react";

export function useDevices(projectId: number | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(timer);
  }, [queryClient]);

  return useQuery({
    queryKey: ['devices', projectId],
    queryFn: async () => {
      let query = supabase.from('server_devices').select('*');
      
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Device[];
    },
  });
}
