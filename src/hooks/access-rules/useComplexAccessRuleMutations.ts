
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AccessRule } from "@/types/access-control";
import { useToast } from "@/hooks/use-toast";

export const useComplexAccessRuleMutations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  return {
    createAccessRuleWithMembers,
    updateAccessRuleWithAdditionalMembers
  };
};
