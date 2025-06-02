
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
      console.log('Fetching access rules...');
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
          // Çalışan ilişkilerini getir
          const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('id, first_name, last_name')
            .eq('id', rule.employee_id || 0);

          // Cihaz ilişkilerini getir
          const { data: devices, error: deviceError } = await supabase
            .from('devices')
            .select('id, name, location')
            .eq('id', rule.device_id || 0);

          if (empError) console.error('Error fetching employees:', empError);
          if (deviceError) console.error('Error fetching devices:', deviceError);

          return {
            ...rule,
            rule_employees: (employees || []).map(emp => ({ employees: emp })),
            rule_devices: (devices || []).map(dev => ({ devices: dev })),
            rule_departments: [],
          };
        })
      );

      console.log('Access rules with relationships fetched:', rulesWithRelations);
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
      console.log('Creating access rule:', ruleData);
      
      const projectId = projectIds.length > 0 ? projectIds[0] : null;
      
      // Şimdilik sadece ilk seçilen çalışan ve cihazla çalışalım
      const firstEmployeeId = ruleData.selected_employees.length > 0 
        ? parseInt(ruleData.selected_employees[0]) 
        : null;
      const firstDeviceId = ruleData.selected_devices.length > 0 
        ? parseInt(ruleData.selected_devices[0]) 
        : null;

      // Ana kuralı oluştur
      const { data: rule, error: ruleError } = await supabase
        .from('access_rules')
        .insert([{
          name: ruleData.name,
          description: ruleData.description || null,
          employee_id: firstEmployeeId,
          device_id: firstDeviceId,
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

      console.log('Rule created:', rule);
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

  return {
    rules,
    isLoading,
    createRule: createRuleMutation.mutate,
    isCreating: createRuleMutation.isPending,
    toggleRule: toggleRuleMutation.mutate,
    isToggling: toggleRuleMutation.isPending
  };
};
