
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useGroupMemberMutations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addGroupMember = useMutation({
    mutationFn: async ({ groupId, employeeId, projectId }: { groupId: number; employeeId: number; projectId?: number }) => {
      const { data, error } = await supabase
        .from('group_members')
        .insert([{ group_id: groupId, employee_id: employeeId, project_id: projectId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Çalışan gruba eklendi.",
      });
    },
    onError: (error) => {
      console.error('Error adding group member:', error);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Çalışan gruba eklenirken bir hata oluştu.",
      });
    }
  });

  const removeGroupMember = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Çalışan gruptan çıkarıldı.",
      });
    },
    onError: (error) => {
      console.error('Error removing group member:', error);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Çalışan gruptan çıkarılırken bir hata oluştu.",
      });
    }
  });

  return {
    addGroupMember,
    removeGroupMember
  };
};
