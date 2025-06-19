
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AccessRule } from "@/types/access-control";

export const useAccessRulesQuery = (projectId?: number) => {
  return useQuery({
    queryKey: ['access-rules', projectId],
    queryFn: async () => {
      console.log('useAccessRules - Fetching access rules for project:', projectId);
      
      let query = supabase
        .from('access_rules')
        .select(`
          *,
          group_members!group_members_group_id_fkey (
            id,
            group_id,
            employee_id,
            project_id,
            created_at,
            employees!group_members_employee_id_fkey (
              id,
              first_name,
              last_name,
              email
            )
          ),
          group_devices!group_devices_group_id_fkey (
            id,
            group_id,
            device_id,
            project_id,
            created_at,
            devices!group_devices_device_id_fkey (
              id,
              name,
              device_serial,
              zone_id,
              door_id
            )
          )
        `)
        .order('priority', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching access rules:', error);
        throw error;
      }

      console.log('useAccessRules - Fetched data:', data);
      return data as AccessRule[];
    }
  });
};
