
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Device } from "@/types/device";
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
        
        // Check if device was seen in the last 5 minutes
        if (device.last_seen) {
          const lastSeen = new Date(device.last_seen);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          status = lastSeen > fiveMinutesAgo ? 'online' : 'offline';
        }
        
        return { 
          ...device,
          status,
          // Map database field names to Device interface
          device_name: device.name,
          device_serial: device.device_serial,
          device_type: device.device_type,
          device_location: device.description
        };
      });
    }
  });

  // Function to add a device directly
  const addDeviceMutation = useMutation({
    mutationFn: async (deviceData: Partial<Device>) => {
      // Map Device interface fields to database fields
      const dbData = {
        name: deviceData.name || deviceData.device_name,
        device_serial: deviceData.device_serial || deviceData.serial_number,
        device_type: deviceData.device_type,
        device_ip: deviceData.device_ip,
        description: deviceData.description || deviceData.device_location,
        zone_id: deviceData.zone_id,
        door_id: deviceData.door_id,
        access_direction: deviceData.access_direction || 'both',
        status: 'active',
        is_active: true
      };

      const { error } = await supabase
        .from('devices')
        .insert(dbData);

      if (error) {
        throw new Error("Cihaz eklenirken hata oluştu. Lütfen tekrar deneyin.");
      }

      return deviceData;
    },
    onSuccess: () => {
      // Refresh the devices list
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast({
        title: "Cihaz başarıyla eklendi",
        description: "Cihaz sisteme kaydedildi",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Cihaz eklenirken hata oluştu",
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
