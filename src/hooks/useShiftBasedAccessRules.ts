
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AccessRule } from "@/types/access-control";

export interface ShiftBasedAccessRule extends AccessRule {
  shift_id?: number;
  shift_name?: string;
  shift_start_time?: string;
  shift_end_time?: string;
  is_shift_based?: boolean;
}

export const useShiftBasedAccessRules = (projectId?: number) => {
  return useQuery({
    queryKey: ['shift-based-access-rules', projectId],
    queryFn: async () => {
      console.log('Fetching shift-based access rules for project:', projectId);
      
      let query = supabase
        .from('access_rules')
        .select(`
          *,
          shifts!inner(
            id,
            name,
            start_time,
            end_time
          ),
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
        console.error('Error fetching shift-based access rules:', error);
        throw error;
      }

      // Transform data to include shift information
      const shiftBasedRules: ShiftBasedAccessRule[] = data?.map(rule => ({
        ...rule,
        shift_id: rule.shifts?.id,
        shift_name: rule.shifts?.name,
        shift_start_time: rule.shifts?.start_time,
        shift_end_time: rule.shifts?.end_time,
        is_shift_based: !!rule.shifts,
      })) || [];

      console.log('Shift-based access rules fetched:', shiftBasedRules);
      return shiftBasedRules;
    }
  });
};

export const useShifts = (projectId?: number) => {
  return useQuery({
    queryKey: ['shifts', projectId],
    queryFn: async () => {
      let query = supabase
        .from('shifts')
        .select('*')
        .order('name');

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching shifts:', error);
        throw error;
      }

      return data || [];
    }
  });
};
