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
            employees!group_members_employee_id_fkey (
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
            devices!group_devices_device_id_fkey (
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

  const createAccessRuleWithMembers = useMutation({
    mutationFn: async (params: { 
      rule: {
        name: string;
        description?: string;
        target_type: string;
        start_time?: string;
        end_time?: string;
        days: string[];
        access_direction: string;
        priority: number;
        project_id?: number;
      };
      employeeIds?: number[];
      deviceIds?: number[];
    }) => {
      console.log('Creating access rule with members:', params);
      
      // First create the access rule
      const { data: ruleData, error: ruleError } = await supabase
        .from('access_rules')
        .insert([params.rule])
        .select()
        .single();

      if (ruleError) throw ruleError;

      console.log('Created rule:', ruleData);

      const promises = [];

      // Add group members if provided
      if (params.employeeIds && params.employeeIds.length > 0) {
        const memberInserts = params.employeeIds.map(employeeId => ({
          group_id: ruleData.id,
          employee_id: employeeId,
          project_id: params.rule.project_id
        }));

        console.log('Adding group members:', memberInserts);

        const memberPromise = supabase
          .from('group_members')
          .insert(memberInserts);
        promises.push(memberPromise);
      }

      // Add group devices if provided
      if (params.deviceIds && params.deviceIds.length > 0) {
        const deviceInserts = params.deviceIds.map(deviceId => ({
          group_id: ruleData.id,
          device_id: deviceId,
          project_id: params.rule.project_id
        }));

        console.log('Adding group devices:', deviceInserts);

        const devicePromise = supabase
          .from('group_devices')
          .insert(deviceInserts);
        promises.push(devicePromise);
      }

      // Execute all inserts
      const results = await Promise.all(promises);
      
      // Check for errors in batch operations
      results.forEach((result, index) => {
        if (result.error) {
          console.error(`Error in batch operation ${index}:`, result.error);
          throw result.error;
        }
      });

      return ruleData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Erişim kuralı ve üyeleri oluşturuldu.",
      });
    },
    onError: (error) => {
      console.error('Error creating access rule with members:', error);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Erişim kuralı oluşturulurken bir hata oluştu.",
      });
    }
  });

  const updateAccessRuleWithAdditionalMembers = useMutation({
    mutationFn: async (params: {
      id: number;
      updates: Partial<AccessRule>;
      employeeIds?: number[];
      deviceIds?: number[];
    }) => {
      console.log('Updating access rule with additional members:', params);
      
      // First update the access rule
      const { data: ruleData, error: ruleError } = await supabase
        .from('access_rules')
        .update(params.updates)
        .eq('id', params.id)
        .select()
        .single();

      if (ruleError) throw ruleError;

      console.log('Updated rule:', ruleData);

      const promises = [];

      // Add new group members if provided
      if (params.employeeIds && params.employeeIds.length > 0) {
        // First, get existing member IDs to avoid duplicates
        const { data: existingMembers } = await supabase
          .from('group_members')
          .select('employee_id')
          .eq('group_id', params.id);

        const existingEmployeeIds = existingMembers?.map(m => m.employee_id) || [];
        
        // Filter out employees that are already members
        const newEmployeeIds = params.employeeIds.filter(id => !existingEmployeeIds.includes(id));
        
        console.log('Existing employee IDs:', existingEmployeeIds);
        console.log('New employee IDs to add:', newEmployeeIds);

        if (newEmployeeIds.length > 0) {
          const memberInserts = newEmployeeIds.map(employeeId => ({
            group_id: params.id,
            employee_id: employeeId,
            project_id: params.updates.project_id
          }));

          console.log('Adding new group members:', memberInserts);

          const memberPromise = supabase
            .from('group_members')
            .insert(memberInserts);
          promises.push(memberPromise);
        }
      }

      // Add new group devices if provided
      if (params.deviceIds && params.deviceIds.length > 0) {
        // First, get existing device IDs to avoid duplicates
        const { data: existingDevices } = await supabase
          .from('group_devices')
          .select('device_id')
          .eq('group_id', params.id);

        const existingDeviceIds = existingDevices?.map(d => d.device_id) || [];
        
        // Filter out devices that are already in the group
        const newDeviceIds = params.deviceIds.filter(id => !existingDeviceIds.includes(id));
        
        console.log('Existing device IDs:', existingDeviceIds);
        console.log('New device IDs to add:', newDeviceIds);

        if (newDeviceIds.length > 0) {
          const deviceInserts = newDeviceIds.map(deviceId => ({
            group_id: params.id,
            device_id: deviceId,
            project_id: params.updates.project_id
          }));

          console.log('Adding new group devices:', deviceInserts);

          const devicePromise = supabase
            .from('group_devices')
            .insert(deviceInserts);
          promises.push(devicePromise);
        }
      }

      // Execute all inserts
      if (promises.length > 0) {
        const results = await Promise.all(promises);
        
        // Check for errors in batch operations
        results.forEach((result, index) => {
          if (result.error) {
            console.error(`Error in batch operation ${index}:`, result.error);
            throw result.error;
          }
        });
      }

      return ruleData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-rules'] });
      toast({
        title: "Başarılı",
        description: "Erişim kuralı güncellendi ve yeni üyeler eklendi.",
      });
    },
    onError: (error) => {
      console.error('Error updating access rule with additional members:', error);
      toast({
        variant: "destructive",
        title: "Hata",
        description: "Erişim kuralı güncellenirken bir hata oluştu.",
      });
    }
  });

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
  const isUpdating = updateAccessRule.isPending || updateAccessRuleWithAdditionalMembers.isPending;
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
    createAccessRuleWithMembers,
    createRule, // Legacy alias
    isCreating,
    updateAccessRule,
    updateAccessRuleWithAdditionalMembers, // New function
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
