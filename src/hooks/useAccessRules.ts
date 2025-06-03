
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
      console.log('Fetching enhanced access rules...');
      const { data, error } = await supabase
        .from('access_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching access rules:', error);
        throw error;
      }

      // Fetch related data for each rule
      const rulesWithRelations = await Promise.all(
        (data || []).map(async (rule) => {
          // Get employee relations
          let employeeRelations = [];
          if (rule.employee_id) {
            const { data: employee } = await supabase
              .from('employees')
              .select('id, first_name, last_name')
              .eq('id', rule.employee_id)
              .single();
            if (employee) employeeRelations = [{ employees: employee }];
          } else {
            const { data: groupMembers } = await supabase
              .from('group_members')
              .select(`employees:employee_id (id, first_name, last_name)`)
              .eq('group_id', rule.id);
            employeeRelations = groupMembers || [];
          }

          // Get device relations
          let deviceRelations = [];
          if (rule.device_id) {
            const { data: device } = await supabase
              .from('devices')
              .select('id, name, location')
              .eq('id', rule.device_id)
              .single();
            if (device) deviceRelations = [{ devices: device }];
          } else {
            const { data: groupDevices } = await supabase
              .from('group_devices')
              .select(`devices:device_id (id, name, location)`)
              .eq('group_id', rule.id);
            deviceRelations = groupDevices || [];
          }

          return {
            ...rule,
            // Veritabanındaki yeni alanları kullan, eski kodla uyumlu kalması için fallback'ler
            target_type: rule.target_type || 'individual',
            access_direction: rule.access_direction || 'both',
            priority: rule.priority || 100,
            is_template: rule.is_template || false,
            template_name: rule.template_name || null,
            rule_employees: employeeRelations,
            rule_devices: deviceRelations,
            rule_positions: [],
            rule_zones: [],
            rule_doors: [],
          };
        })
      );

      console.log('Enhanced access rules loaded:', rulesWithRelations);
      return rulesWithRelations;
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (ruleData: {
      name: string;
      description?: string;
      target_type: string;
      selected_employees?: string[];
      selected_devices?: string[];
      selected_positions?: string[];
      selected_zones?: string[];
      selected_doors?: string[];
      start_time?: string;
      end_time?: string;
      days: string[];
      access_direction?: string;
      priority?: number;
    }) => {
      console.log('Creating enhanced access rule:', ruleData);
      
      const projectId = projectIds.length > 0 ? projectIds[0] : null;

      // Create the main rule - updated logic for multiple employees
      const { data: rule, error: ruleError } = await supabase
        .from('access_rules')
        .insert([{
          name: ruleData.name,
          description: ruleData.description || null,
          target_type: ruleData.target_type || 'individual',
          access_direction: ruleData.access_direction || 'both',
          priority: ruleData.priority || 100,
          start_time: ruleData.start_time || null,
          end_time: ruleData.end_time || null,
          days: ruleData.days,
          is_active: true,
          project_id: projectId,
          // Only set single employee_id if there's exactly one employee selected
          employee_id: ruleData.selected_employees?.length === 1 
            ? parseInt(ruleData.selected_employees[0]) : null,
          device_id: ruleData.selected_devices?.length === 1 
            ? parseInt(ruleData.selected_devices[0]) : null,
        }])
        .select()
        .single();

      if (ruleError) {
        console.error('Error creating access rule:', ruleError);
        throw ruleError;
      }

      // Create junction table relations for multiple employees
      const promises = [];

      // For individual rules with multiple employees OR department rules
      if (ruleData.selected_employees?.length) {
        // If more than one employee OR it's a department rule, use group_members
        if (ruleData.selected_employees.length > 1 || ruleData.target_type === 'department') {
          const employeeRelations = ruleData.selected_employees.map(empId => ({
            group_id: rule.id,
            employee_id: parseInt(empId),
            project_id: projectId
          }));
          promises.push(supabase.from('group_members').insert(employeeRelations));
        }
      }

      // Device relations (for multiple devices)
      if (ruleData.selected_devices && ruleData.selected_devices.length > 1) {
        const deviceRelations = ruleData.selected_devices.map(deviceId => ({
          group_id: rule.id,
          device_id: parseInt(deviceId),
          project_id: projectId
        }));
        promises.push(supabase.from('group_devices').insert(deviceRelations));
      }

      // Execute all relation inserts
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      return rule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Gelişmiş erişim kuralı başarıyla oluşturuldu.",
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
        target_type: string;
        selected_employees?: string[];
        selected_devices?: string[];
        selected_positions?: string[];
        selected_zones?: string[];
        selected_doors?: string[];
        start_time?: string;
        end_time?: string;
        days: string[];
        access_direction?: string;
        priority?: number;
      };
    }) => {
      console.log('Updating enhanced access rule:', id, ruleData);
      
      const projectId = projectIds.length > 0 ? projectIds[0] : null;

      // Update the main rule - updated logic for multiple employees
      const { data: rule, error: ruleError } = await supabase
        .from('access_rules')
        .update({
          name: ruleData.name,
          description: ruleData.description || null,
          target_type: ruleData.target_type || 'individual',
          access_direction: ruleData.access_direction || 'both',
          priority: ruleData.priority || 100,
          start_time: ruleData.start_time || null,
          end_time: ruleData.end_time || null,
          days: ruleData.days,
          // Only set single employee_id if there's exactly one employee selected
          employee_id: ruleData.selected_employees?.length === 1 
            ? parseInt(ruleData.selected_employees[0]) : null,
          device_id: ruleData.selected_devices?.length === 1 
            ? parseInt(ruleData.selected_devices[0]) : null,
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

      // Recreate relations with updated logic
      const promises = [];

      if (ruleData.selected_employees?.length) {
        // If more than one employee OR it's a department rule, use group_members
        if (ruleData.selected_employees.length > 1 || ruleData.target_type === 'department') {
          const employeeRelations = ruleData.selected_employees.map(empId => ({
            group_id: rule.id,
            employee_id: parseInt(empId),
            project_id: projectId
          }));
          promises.push(supabase.from('group_members').insert(employeeRelations));
        }
      }

      if (ruleData.selected_devices && ruleData.selected_devices.length > 1) {
        const deviceRelations = ruleData.selected_devices.map(deviceId => ({
          group_id: rule.id,
          device_id: parseInt(deviceId),
          project_id: projectId
        }));
        promises.push(supabase.from('group_devices').insert(deviceRelations));
      }

      if (promises.length > 0) {
        await Promise.all(promises);
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
