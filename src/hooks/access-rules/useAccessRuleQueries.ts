
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AccessRule } from '@/types/access-rule';

export const useAccessRuleQueries = () => {
  const { data: rules, isLoading } = useQuery({
    queryKey: ['access-rules-unified'],
    queryFn: async () => {
      const { data: rulesData, error: rulesError } = await supabase
        .from('access_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (rulesError) throw rulesError;

      // Fetch related data for each rule
      const enrichedRules = await Promise.all(
        rulesData.map(async (rule) => {
          // Fetch departments
          const { data: departmentRels } = await supabase
            .from('access_rule_departments')
            .select('department_id')
            .eq('rule_id', rule.id);

          let departments: Array<{ id: number; name: string }> = [];
          if (departmentRels && departmentRels.length > 0) {
            const deptIds = departmentRels.map(rel => rel.department_id);
            const { data: deptData } = await supabase
              .from('departments')
              .select('id, name')
              .in('id', deptIds);
            departments = deptData || [];
          }

          // Fetch employees
          const { data: employeeRels } = await supabase
            .from('access_rule_employees')
            .select('employee_id')
            .eq('rule_id', rule.id);

          let employees: Array<{ id: number; name: string }> = [];
          if (employeeRels && employeeRels.length > 0) {
            const empIds = employeeRels.map(rel => rel.employee_id);
            const { data: empData } = await supabase
              .from('employees')
              .select('id, first_name, last_name')
              .in('id', empIds);
            employees = (empData || []).map(emp => ({
              id: emp.id,
              name: `${emp.first_name} ${emp.last_name}`.trim()
            }));
          }

          // Fetch zones
          const { data: zoneRels } = await supabase
            .from('access_rule_zones')
            .select('zone_id')
            .eq('rule_id', rule.id);

          let zones: Array<{ id: number; name: string }> = [];
          if (zoneRels && zoneRels.length > 0) {
            const zoneIds = zoneRels.map(rel => rel.zone_id);
            const { data: zoneData } = await supabase
              .from('zones')
              .select('id, name')
              .in('id', zoneIds);
            zones = zoneData || [];
          }

          // Fetch doors
          const { data: doorRels } = await supabase
            .from('access_rule_doors')
            .select('door_id')
            .eq('rule_id', rule.id);

          let doors: Array<{ id: number; name: string }> = [];
          if (doorRels && doorRels.length > 0) {
            const doorIds = doorRels.map(rel => rel.door_id);
            const { data: doorData } = await supabase
              .from('doors')
              .select('id, name')
              .in('id', doorIds);
            doors = doorData || [];
          }

          return {
            ...rule,
            departments,
            employees,
            zones,
            doors
          };
        })
      );

      return enrichedRules as AccessRule[];
    }
  });

  return { rules, isLoading };
};
