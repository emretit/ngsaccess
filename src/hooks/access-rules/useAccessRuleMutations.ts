
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { AccessRuleFormData } from '@/types/access-rule';

export const useAccessRuleMutations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    createRule: createRuleMutation.mutate,
    isCreating: createRuleMutation.isPending,
    toggleRule: toggleRuleMutation.mutate,
    isToggling: toggleRuleMutation.isPending
  };
};
