
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AccessRule } from "@/types/access-control";
import { useToast } from "@/hooks/use-toast";

export const useAccessRuleMutations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createAccessRule = useMutation({
    mutationFn: async (newRule: { 
      name: string;
      description?: string;
      target_type: string;
      start_time?: string;
      end_time?: string;
      days: string[];
      access_direction: string;
      priority: number;
      project_id?: number;
    }) => {
      const { data, error } = await supabase
        .from('access_rules')
        .insert([newRule])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Erişim kuralı oluşturuldu.",
      });
    },
    onError: (error) => {
      console.error('Error creating access rule:', error);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Erişim kuralı oluşturulurken bir hata oluştu.",
      });
    }
  });

  const updateAccessRule = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<AccessRule> }) => {
      const { data, error } = await supabase
        .from('access_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Erişim kuralı güncellendi.",
      });
    },
    onError: (error) => {
      console.error('Error updating access rule:', error);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Erişim kuralı güncellenirken bir hata oluştu.",
      });
    }
  });

  const deleteAccessRule = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('access_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Erişim kuralı silindi.",
      });
    },
    onError: (error) => {
      console.error('Error deleting access rule:', error);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Erişim kuralı silinirken bir hata oluştu.",
      });
    }
  });

  return {
    createAccessRule,
    updateAccessRule,
    deleteAccessRule
  };
};
