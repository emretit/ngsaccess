
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Device, ServerDevice } from "@/types/device";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { deviceTypeMapping, DatabaseDeviceType } from "@/utils/deviceTypeMapping";

export function useDevices() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Setup a regular refresh for the device status
  useEffect(() => {
    const timer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(timer);
  }, [queryClient]);

  // Main query to get all devices
  const devicesQuery = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*');
      
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
    }
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

      // Type assertion to include zone_id and door_id
      const serverDevice = existingDevice as ServerDevice;

      // Map the device type to database enum
      const deviceType = deviceTypeMapping[serverDevice.device_model_enum || "Other"] as DatabaseDeviceType;

      // If it exists, add it to devices table
      const { error: insertError } = await supabase
        .from('devices')
        .insert({ 
          name: serverDevice.name,
          device_serial: serverDevice.serial_number,
          type: deviceType,
          device_model: serverDevice.device_model || "",
          device_location: "",
          zone_id: serverDevice.zone_id,
          door_id: serverDevice.door_id
        });

      if (insertError) {
        throw new Error("Failed to add device. Please try again.");
      }

      return serverDevice;
    },
    onSuccess: () => {
      // Refresh the devices list
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast({
        title: "Device added successfully",
        description: "The device has been added",
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
