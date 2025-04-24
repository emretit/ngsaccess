
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Device, ServerDevice } from "@/types/device";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

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

      // If it exists, add it to devices table
      // Using fields that match the database schema
      const { error: insertError } = await supabase
        .from('devices')
        .insert({ 
          name: serverDevice.name,
          serial_number: serverDevice.serial_number,
          location: "",  // Required field based on schema
          type: "",      // Required field based on schema
          device_model: serverDevice.device_model || "",
          device_type: serverDevice.device_type || "",
          device_serial: serverDevice.serial_number,
          device_location: "",
          // Add zone_id and door_id for location display
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
