
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AccessRule } from '@/types/access-control';
import { useProjectAccess } from './useProjectAccess';

export const useAccessRules = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { projectIds } = useProjectAccess();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['access-rules'],
    queryFn: async () => {
      console.log('Fetching access rules with pure junction table approach...');
      
      // Get all access rules for the project
      const { data: rulesData, error: rulesError } = await supabase
        .from('access_rules')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });

      if (rulesError) {
        console.error('Error fetching access rules:', rulesError);
        throw rulesError;
      }

      // Get employee relations for all rules
      const { data: employeeRelations, error: empError } = await supabase
        .from('group_members')
        .select(`
          group_id,
          employees:employee_id (id, first_name, last_name)
        `)
        .in('project_id', projectIds);

      if (empError) {
        console.error('Error fetching employee relations:', empError);
        throw empError;
      }

      // Get device relations for all rules
      const { data: deviceRelations, error: devError } = await supabase
        .from('group_devices')
        .select(`
          group_id,
          devices:device_id (id, name, location)
        `)
        .in('project_id', projectIds);

      if (devError) {
        console.error('Error fetching device relations:', devError);
        throw devError;
      }

      // Combine data
      const rulesWithRelations = (rulesData || []).map(rule => {
        const ruleEmployees = (employeeRelations || [])
          .filter(rel => rel.group_id === rule.id)
          .map(rel => ({ employees: rel.employees }));

        const ruleDevices = (deviceRelations || [])
          .filter(rel => rel.group_id === rule.id)
          .map(rel => ({ devices: rel.devices }));

        return {
          ...rule,
          target_type: rule.target_type || 'individual',
          access_direction: rule.access_direction || 'both',
          priority: rule.priority || 100,
          is_template: rule.is_template || false,
          template_name: rule.template_name || null,
          rule_employees: ruleEmployees,
          rule_devices: ruleDevices,
          rule_positions: [],
          rule_zones: [],
          rule_doors: [],
        };
      });

      console.log('Access rules with relations loaded:', rulesWithRelations);
      return rulesWithRelations;
    },
    enabled: projectIds.length > 0,
  });

  const createRuleMutation = useMutation({
    mutationFn: async (ruleData: {
      name: string;
      description?: string;
      selected_employees?: string[];
      selected_devices?: string[];
      selected_zones?: string[];
      start_time?: string;
      end_time?: string;
      days: string[];
    }) => {
      console.log('Creating access rule with pure junction approach:', ruleData);
      
      const projectId = projectIds.length > 0 ? projectIds[0] : null;

      // Create the main rule
      const { data: rule, error: ruleError } = await supabase
        .from('access_rules')
        .insert([{
          name: ruleData.name,
          description: ruleData.description || null,
          target_type: 'individual',
          access_direction: 'both',
          priority: 100,
          start_time: ruleData.start_time || null,
          end_time: ruleData.end_time || null,
          days: ruleData.days,
          is_active: true,
          project_id: projectId,
        }])
        .select()
        .single();

      if (ruleError) {
        console.error('Error creating access rule:', ruleError);
        throw ruleError;
      }

      // Create junction table relations
      const promises = [];

      // Employee relations - always use junction table
      if (ruleData.selected_employees?.length) {
        const employeeRelations = ruleData.selected_employees.map(empId => ({
          group_id: rule.id,
          employee_id: parseInt(empId),
          project_id: projectId
        }));
        promises.push(supabase.from('group_members').insert(employeeRelations));
      }

      // Device relations - always use junction table
      if (ruleData.selected_devices?.length) {
        const deviceRelations = ruleData.selected_devices.map(deviceId => ({
          group_id: rule.id,
          device_id: parseInt(deviceId),
          project_id: projectId
        }));
        promises.push(supabase.from('group_devices').insert(deviceRelations));
      }

      // Execute all relation inserts
      if (promises.length > 0) {
        const results = await Promise.all(promises);
        results.forEach((result, index) => {
          if (result.error) {
            console.error(`Error creating relation ${index}:`, result.error);
            throw result.error;
          }
        });
      }

      return rule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Erişim kuralı başarıyla oluşturuldu.",
      });
    },
    onError: (error) => {
      console.error('Create rule error:', error);
      toast({
        title: "Hata",
        description: "Erişim kuralı oluşturulurken hata oluştu.",
        variant: "destructive",
      });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      console.log('Toggling rule status:', id, is_active);
      const { data, error } = await supabase
        .from('access_rules')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error toggling rule:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Kural durumu güncellendi.",
      });
    },
    onError: (error) => {
      console.error('Toggle rule error:', error);
      toast({
        title: "Hata",
        description: "Kural durumu güncellenirken hata oluştu.",
        variant: "destructive",
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: number) => {
      console.log('Deleting access rule:', ruleId);
      
      // Delete relations first
      await Promise.all([
        supabase.from('group_members').delete().eq('group_id', ruleId),
        supabase.from('group_devices').delete().eq('group_id', ruleId),
      ]);

      // Delete the main rule
      const { data, error } = await supabase
        .from('access_rules')
        .delete()
        .eq('id', ruleId)
        .select()
        .single();

      if (error) {
        console.error('Error deleting access rule:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Erişim kuralı başarıyla silindi.",
      });
    },
    onError: (error) => {
      console.error('Delete rule error:', error);
      toast({
        title: "Hata",
        description: "Erişim kuralı silinirken hata oluştu.",
        variant: "destructive",
      });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({
      id,
      ruleData
    }: {
      id: number;
      ruleData: {
        name: string;
        description?: string;
        selected_employees?: string[];
        selected_devices?: string[];
        selected_zones?: string[];
        start_time?: string;
        end_time?: string;
        days: string[];
      };
    }) => {
      console.log('Updating access rule with pure junction approach:', id, ruleData);
      
      const projectId = projectIds.length > 0 ? projectIds[0] : null;

      // Update the main rule
      const { data: rule, error: ruleError } = await supabase
        .from('access_rules')
        .update({
          name: ruleData.name,
          description: ruleData.description || null,
          target_type: 'individual',
          access_direction: 'both',
          priority: 100,
          start_time: ruleData.start_time || null,
          end_time: ruleData.end_time || null,
          days: ruleData.days,
        })
        .eq('id', id)
        .select()
        .single();

      if (ruleError) {
        console.error('Error updating access rule:', ruleError);
        throw ruleError;
      }

      // Clear existing relations
      await Promise.all([
        supabase.from('group_members').delete().eq('group_id', id),
        supabase.from('group_devices').delete().eq('group_id', id),
      ]);

      // Recreate relations
      const promises = [];

      // Employee relations - always use junction table
      if (ruleData.selected_employees?.length) {
        const employeeRelations = ruleData.selected_employees.map(empId => ({
          group_id: rule.id,
          employee_id: parseInt(empId),
          project_id: projectId
        }));
        promises.push(supabase.from('group_members').insert(employeeRelations));
      }

      // Device relations - always use junction table  
      if (ruleData.selected_devices?.length) {
        const deviceRelations = ruleData.selected_devices.map(deviceId => ({
          group_id: rule.id,
          device_id: parseInt(deviceId),
          project_id: projectId
        }));
        promises.push(supabase.from('group_devices').insert(deviceRelations));
      }

      if (promises.length > 0) {
        const results = await Promise.all(promises);
        results.forEach((result, index) => {
          if (result.error) {
            console.error(`Error creating relation ${index}:`, result.error);
            throw result.error;
          }
        });
      }

      return rule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Erişim kuralı başarıyla güncellendi.",
      });
    },
    onError: (error) => {
      console.error('Update rule error:', error);
      toast({
        title: "Hata",
        description: "Erişim kuralı güncellenirken hata oluştu.",
        variant: "destructive",
      });
    },
  });

  return {
    rules,
    isLoading,
    createRule: createRuleMutation.mutate,
    isCreating: createRuleMutation.isPending,
    toggleRule: toggleRuleMutation.mutate,
    isToggling: toggleRuleMutation.isPending,
    deleteRule: deleteRuleMutation.mutate,
    isDeleting: deleteRuleMutation.isPending,
    updateRule: updateRuleMutation.mutate,
    isUpdating: updateRuleMutation.isPending
  };
};
