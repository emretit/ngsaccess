
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
      console.log('Fetching access rules with relationships...');
      const { data, error } = await supabase
        .from('access_rules')
        .select(`
          *,
          rule_employees!inner(
            employees(first_name, last_name, id)
          ),
          rule_devices!inner(
            devices(name, location, id)
          ),
          rule_departments!inner(
            departments(name, id)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching access rules:', error);
        throw error;
      }

      console.log('Access rules with relationships fetched:', data);
      return data || [];
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
        }])
        .select()
        .single();

      if (ruleError) {
        console.error('Error creating access rule:', ruleError);
        throw ruleError;
      }

      console.log('Rule created:', rule);

      // Çalışan ilişkilerini ekle
      if (ruleData.selected_employees.length > 0) {
        const employeeRelations = ruleData.selected_employees.map(empId => ({
          rule_id: rule.id,
          employee_id: parseInt(empId)
        }));

        const { error: empError } = await supabase
          .from('rule_employees')
          .insert(employeeRelations);

        if (empError) {
          console.error('Error creating employee relations:', empError);
          throw empError;
        }
      }

      // Cihaz ilişkilerini ekle
      if (ruleData.selected_devices.length > 0) {
        const deviceRelations = ruleData.selected_devices.map(deviceId => ({
          rule_id: rule.id,
          device_id: parseInt(deviceId)
        }));

        const { error: deviceError } = await supabase
          .from('rule_devices')
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

  return {
    rules,
    isLoading,
    createRule: createRuleMutation.mutate,
    isCreating: createRuleMutation.isPending,
    toggleRule: toggleRuleMutation.mutate,
    isToggling: toggleRuleMutation.isPending
  };
};
