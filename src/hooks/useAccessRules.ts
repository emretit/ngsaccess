
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { AccessRule } from '@/types/access-control';

export const useAccessRules = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['access-rules'],
    queryFn: async () => {
      console.log('Fetching access rules...');
      const { data, error } = await supabase
        .from('access_rules')
        .select(`
          *,
          employees(first_name, last_name),
          devices(name, location)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching access rules:', error);
        throw error;
      }

      console.log('Access rules fetched:', data);
      return data || [];
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (newRule: Omit<AccessRule, 'id' | 'created_at' | 'updated_at'>) => {
      console.log('Creating access rule:', newRule);
      const { data, error } = await supabase
        .from('access_rules')
        .insert([newRule])
        .select()
        .single();

      if (error) {
        console.error('Error creating access rule:', error);
        throw error;
      }

      return data;
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
