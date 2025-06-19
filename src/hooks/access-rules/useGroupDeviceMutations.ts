
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useGroupDeviceMutations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addGroupDevice = useMutation({
    mutationFn: async ({ groupId, deviceId, projectId }: { groupId: number; deviceId: number; projectId?: number }) => {
      const { data, error } = await supabase
        .from('group_devices')
        .insert([{ group_id: groupId, device_id: deviceId, project_id: projectId }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Cihaz gruba eklendi.",
      });
    },
    onError: (error) => {
      console.error('Error adding group device:', error);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Cihaz gruba eklenirken bir hata oluştu.",
      });
    }
  });

  const removeGroupDevice = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('group_devices')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Cihaz gruptan çıkarıldı.",
      });
    },
    onError: (error) => {
      console.error('Error removing group device:', error);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Cihaz gruptan çıkarılırken bir hata oluştu.",
      });
    }
  });

  return {
    addGroupDevice,
    removeGroupDevice
  };
};
