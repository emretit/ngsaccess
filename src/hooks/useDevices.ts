
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Device, ServerDevice } from "@/types/device";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export function useDevices(projectId: number | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Setup a regular refresh for the device status
  useEffect(() => {
    const timer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['devices', projectId] });
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(timer);
  }, [queryClient, projectId]);

  // Main query to get devices for the current project
  const devicesQuery = useQuery({
    queryKey: ['devices', projectId],
    queryFn: async () => {
      let query = supabase
        .from('devices')
        .select('*')
        .eq('project_id', projectId);
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Process the data to determine status
      return (data || []).map((device: any): Device => {
        let status: 'online' | 'offline' | 'expired' = 'offline';
        
        // For demonstration, we'll randomly set some devices as online
        if (Math.random() > 0.5) {
          status = 'online';
        }
        
        return { 
          ...device,
          status
        };
      });
    },
    enabled: !!projectId,
  });

  // Function to validate and add a device by serial number
  const addDeviceMutation = useMutation({
    mutationFn: async (serialNumber: string) => {
      // First, check if the device exists in server_devices
      const { data: existingDevice, error: lookupError } = await supabase
        .from('server_devices')
        .select('*')
        .eq('serial_number', serialNumber)
        .single();

      if (lookupError) {
        throw new Error("Device not found. Please check serial number or contact support.");
      }

      // Check if it's already assigned to a project
      if (existingDevice.project_id) {
        throw new Error("Device already assigned. Contact support.");
      }

      // If it exists and is unassigned, update it with the current project_id
      const { error: updateError } = await supabase
        .from('server_devices')
        .update({ project_id: projectId })
        .eq('id', existingDevice.id);

      if (updateError) {
        throw new Error("Failed to assign device. Please try again.");
      }

      return existingDevice;
    },
    onSuccess: () => {
      // Refresh the devices list
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast({
        title: "Device added successfully",
        description: "The device has been added to your project",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding device",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return {
    devices: devicesQuery.data || [],
    isLoading: devicesQuery.isLoading,
    error: devicesQuery.error,
    addDevice: addDeviceMutation.mutate,
    isAddingDevice: addDeviceMutation.isPending,
  };
}
