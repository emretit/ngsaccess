
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AccessRule, GroupMember, GroupDevice } from "@/types/access-control";
import { useToast } from "@/hooks/use-toast";

export const useAccessRules = (projectId?: number) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accessRules, isLoading, error } = useQuery({
    queryKey: ['access-rules', projectId],
    queryFn: async () => {
      let query = supabase
        .from('access_rules')
        .select(`
          *,
          group_members!group_members_group_id_fkey (
            id,
            group_id,
            employee_id,
            project_id,
            created_at,
            employees (
              id,
              first_name,
              last_name,
              email
            )
          ),
          group_devices!group_devices_group_id_fkey (
            id,
            group_id,
            device_id,
            project_id,
            created_at,
            devices (
              id,
              name,
              location,
              serial_number
            )
          )
        `)
        .order('priority', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching access rules:', error);
        throw error;
      }

      return data as AccessRule[];
    }
  });

  const createAccessRule = useMutation({
    mutationFn: async (newRule: Partial<AccessRule>) => {
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

  // Legacy API compatibility - aliasing new names to old ones
  const rules = accessRules || [];
  const createRule = createAccessRule;
  const isCreating = createAccessRule.isPending;
  const updateRule = updateAccessRule;
  const isUpdating = updateAccessRule.isPending;
  const deleteRule = deleteAccessRule;
  const isDeleting = deleteAccessRule.isPending;
  const toggleRule = updateAccessRule;
  const isToggling = updateAccessRule.isPending;

  return {
    accessRules,
    rules, // Legacy alias
    isLoading,
    error,
    createAccessRule,
    createRule, // Legacy alias
    isCreating,
    updateAccessRule,
    updateRule, // Legacy alias
    isUpdating,
    deleteAccessRule,
    deleteRule, // Legacy alias
    isDeleting,
    toggleRule, // Legacy alias
    isToggling,
    addGroupMember,
    removeGroupMember,
    addGroupDevice,
    removeGroupDevice
  };
};
