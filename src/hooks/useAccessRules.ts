import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { AccessRule } from '@/types/access-control';
import { useProjectAccess } from './useProjectAccess';

export const useAccessRules = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { projectIds } = useProjectAccess();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['access-rules'],
    queryFn: async () => {
      console.log('Fetching access rules with multiple relations...');
      const { data, error } = await supabase
        .from('access_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching access rules:', error);
        throw error;
      }

      // Her kural için ilişkili çalışanları ve cihazları getir
      const rulesWithRelations = await Promise.all(
        (data || []).map(async (rule) => {
          // Çoklu çalışan ilişkilerini getir
          const { data: employeeRelations, error: empError } = await supabase
            .from('group_members')
            .select(`
              employees:employee_id (
                id,
                first_name,
                last_name
              )
            `)
            .eq('group_id', rule.id);

          // Çoklu cihaz ilişkilerini getir  
          const { data: deviceRelations, error: deviceError } = await supabase
            .from('group_devices')
            .select(`
              devices:device_id (
                id,
                name,
                location
              )
            `)
            .eq('group_id', rule.id);

          if (empError) console.error('Error fetching employee relations:', empError);
          if (deviceError) console.error('Error fetching device relations:', deviceError);

          // Fallback: Eğer group tabloları boşsa, tekil değerleri kullan
          let finalEmployeeRelations = employeeRelations || [];
          let finalDeviceRelations = deviceRelations || [];

          if (finalEmployeeRelations.length === 0 && rule.employee_id) {
            const { data: singleEmployee } = await supabase
              .from('employees')
              .select('id, first_name, last_name')
              .eq('id', rule.employee_id)
              .single();
            
            if (singleEmployee) {
              finalEmployeeRelations = [{ employees: singleEmployee }];
            }
          }

          if (finalDeviceRelations.length === 0 && rule.device_id) {
            const { data: singleDevice } = await supabase
              .from('devices')
              .select('id, name, location')
              .eq('id', rule.device_id)
              .single();
            
            if (singleDevice) {
              finalDeviceRelations = [{ devices: singleDevice }];
            }
          }

          return {
            ...rule,
            rule_employees: finalEmployeeRelations,
            rule_devices: finalDeviceRelations,
            rule_departments: [],
          };
        })
      );

      console.log('Access rules with multiple relationships fetched:', rulesWithRelations);
      return rulesWithRelations;
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (ruleData: {
      name: string;
      description?: string;
      selected_employees: string[];
      selected_devices: string[];
      start_time?: string;
      end_time?: string;
      days: string[];
    }) => {
      console.log('Creating access rule with multiple selections:', ruleData);
      
      const projectId = projectIds.length > 0 ? projectIds[0] : null;

      // Ana kuralı oluştur
      const { data: rule, error: ruleError } = await supabase
        .from('access_rules')
        .insert([{
          name: ruleData.name,
          description: ruleData.description || null,
          start_time: ruleData.start_time || null,
          end_time: ruleData.end_time || null,
          days: ruleData.days,
          is_active: true,
          project_id: projectId,
          // Çoklu seçim kullanıyorsak tekil alanları null bırak
          employee_id: ruleData.selected_employees.length === 1 ? parseInt(ruleData.selected_employees[0]) : null,
          device_id: ruleData.selected_devices.length === 1 ? parseInt(ruleData.selected_devices[0]) : null,
        }])
        .select()
        .single();

      if (ruleError) {
        console.error('Error creating access rule:', ruleError);
        throw ruleError;
      }

      console.log('Rule created:', rule);

      // Çoklu çalışan ilişkilerini ekle (eğer birden fazla seçilmişse)
      if (ruleData.selected_employees.length > 1) {
        const employeeRelations = ruleData.selected_employees.map(empId => ({
          group_id: rule.id,
          employee_id: parseInt(empId),
          project_id: projectId
        }));

        const { error: empError } = await supabase
          .from('group_members')
          .insert(employeeRelations);

        if (empError) {
          console.error('Error creating employee relations:', empError);
          throw empError;
        }
      }

      // Çoklu cihaz ilişkilerini ekle (eğer birden fazla seçilmişse)
      if (ruleData.selected_devices.length > 1) {
        const deviceRelations = ruleData.selected_devices.map(deviceId => ({
          group_id: rule.id,
          device_id: parseInt(deviceId),
          project_id: projectId
        }));

        const { error: deviceError } = await supabase
          .from('group_devices')
          .insert(deviceRelations);

        if (deviceError) {
          console.error('Error creating device relations:', deviceError);
          throw deviceError;
        }
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
      
      // İlk olarak ilişkili kayıtları sil
      const { error: groupMembersError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', ruleId);

      if (groupMembersError) {
        console.error('Error deleting group members:', groupMembersError);
        throw groupMembersError;
      }

      const { error: groupDevicesError } = await supabase
        .from('group_devices')
        .delete()
        .eq('group_id', ruleId);

      if (groupDevicesError) {
        console.error('Error deleting group devices:', groupDevicesError);
        throw groupDevicesError;
      }

      // Sonra ana kuralı sil
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
        selected_employees: string[];
        selected_devices: string[];
        start_time?: string;
        end_time?: string;
        days: string[];
      };
    }) => {
      console.log('Updating access rule:', id, ruleData);
      
      const projectId = projectIds.length > 0 ? projectIds[0] : null;

      // Ana kuralı güncelle
      const { data: rule, error: ruleError } = await supabase
        .from('access_rules')
        .update({
          name: ruleData.name,
          description: ruleData.description || null,
          start_time: ruleData.start_time || null,
          end_time: ruleData.end_time || null,
          days: ruleData.days,
          employee_id: ruleData.selected_employees.length === 1 ? parseInt(ruleData.selected_employees[0]) : null,
          device_id: ruleData.selected_devices.length === 1 ? parseInt(ruleData.selected_devices[0]) : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (ruleError) {
        console.error('Error updating access rule:', ruleError);
        throw ruleError;
      }

      // Mevcut ilişkileri sil
      await supabase.from('group_members').delete().eq('group_id', id);
      await supabase.from('group_devices').delete().eq('group_id', id);

      // Çoklu çalışan ilişkilerini yeniden ekle
      if (ruleData.selected_employees.length > 1) {
        const employeeRelations = ruleData.selected_employees.map(empId => ({
          group_id: id,
          employee_id: parseInt(empId),
          project_id: projectId
        }));

        const { error: empError } = await supabase
          .from('group_members')
          .insert(employeeRelations);

        if (empError) {
          console.error('Error updating employee relations:', empError);
          throw empError;
        }
      }

      // Çoklu cihaz ilişkilerini yeniden ekle
      if (ruleData.selected_devices.length > 1) {
        const deviceRelations = ruleData.selected_devices.map(deviceId => ({
          group_id: id,
          device_id: parseInt(deviceId),
          project_id: projectId
        }));

        const { error: deviceError } = await supabase
          .from('group_devices')
          .insert(deviceRelations);

        if (deviceError) {
          console.error('Error updating device relations:', deviceError);
          throw deviceError;
        }
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
