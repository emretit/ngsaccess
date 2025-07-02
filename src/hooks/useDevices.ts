
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
          status
        };
      });
    }
  });

  // Function to add a device directly
  const addDeviceMutation = useMutation({
    mutationFn: async (deviceData: Partial<Device>) => {
      const { error } = await supabase
        .from('devices')
        .insert(deviceData);

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
