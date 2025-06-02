
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export interface AccessRuleFormData {
  name: string;
  description?: string;
  departments: Array<{ type: "department"; id: number; name: string }>;
  employees: Array<{ type: "employee"; id: number; name: string }>;
  zones: Array<{ type: "zone"; id: number; name: string }>;
  doors: Array<{ type: "door"; id: number; name: string }>;
  start_time: string;
  end_time: string;
  days: string[];
  is_active: boolean;
}

export interface AccessRule {
  id: number;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  days: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  departments: Array<{ id: number; name: string }>;
  employees: Array<{ id: number; name: string }>;
  zones: Array<{ id: number; name: string }>;
  doors: Array<{ id: number; name: string }>;
}

export const useAccessRules = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch access rules with related data
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

  // Create access rule
  const createRuleMutation = useMutation({
    mutationFn: async (formData: AccessRuleFormData) => {
      // Insert main rule
      const { data: rule, error: ruleError } = await supabase
        .from('access_rules')
        .insert({
          name: formData.name,
          description: formData.description,
          type: 'unified',
          start_time: formData.start_time,
          end_time: formData.end_time,
          days: formData.days,
          is_active: formData.is_active
        })
        .select()
        .single();

      if (ruleError) throw ruleError;

      // Insert department relationships
      if (formData.departments.length > 0) {
        const { error: deptError } = await supabase
          .from('access_rule_departments')
          .insert(
            formData.departments.map(dept => ({
              rule_id: rule.id,
              department_id: dept.id
            }))
          );
        if (deptError) throw deptError;
      }

      // Insert employee relationships
      if (formData.employees.length > 0) {
        const { error: empError } = await supabase
          .from('access_rule_employees')
          .insert(
            formData.employees.map(emp => ({
              rule_id: rule.id,
              employee_id: emp.id
            }))
          );
        if (empError) throw empError;
      }

      // Insert zone relationships
      if (formData.zones.length > 0) {
        const { error: zoneError } = await supabase
          .from('access_rule_zones')
          .insert(
            formData.zones.map(zone => ({
              rule_id: rule.id,
              zone_id: zone.id
            }))
          );
        if (zoneError) throw zoneError;
      }

      // Insert door relationships
      if (formData.doors.length > 0) {
        const { error: doorError } = await supabase
          .from('access_rule_doors')
          .insert(
            formData.doors.map(door => ({
              rule_id: rule.id,
              door_id: door.id
            }))
          );
        if (doorError) throw doorError;
      }

      return rule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules-unified'] });
      toast({
        title: "Başarılı",
        description: "Erişim kuralı başarıyla oluşturuldu.",
      });
    },
    onError: (error) => {
      console.error('Access rule creation error:', error);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Erişim kuralı oluşturulurken bir hata oluştu.",
      });
    }
  });

  // Toggle rule status
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      const { error } = await supabase
        .from('access_rules')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules-unified'] });
      toast({
        title: "Başarılı",
        description: "Kural durumu güncellendi.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Kural durumu güncellenirken bir hata oluştu.",
      });
    }
  });

  return {
    rules,
    isLoading,
    createRule: createRuleMutation.mutate,
    isCreating: createRuleMutation.isPending,
    toggleRule: toggleRuleMutation.mutate,
    isToggling: toggleRuleMutation.isPending
  };
};
