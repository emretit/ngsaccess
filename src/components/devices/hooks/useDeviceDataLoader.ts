
import { useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { ServerDevice, AccessDirection } from "@/types/device";
import { FormValues } from "./useDeviceFormSchema";

interface UseDeviceDataLoaderProps {
  device?: ServerDevice | null;
  open: boolean;
  form: UseFormReturn<FormValues>;
}

export function useDeviceDataLoader({ device, open, form }: UseDeviceDataLoaderProps) {
  useEffect(() => {
    const loadDeviceData = async () => {
      if (device && open) {
        console.log('Loading device data:', device);
        
        let deviceData = device;
        
        // Eğer device'da zone_id veya door_id yoksa, Supabase'den tam veriyi al
        if (device.id && (!device.zone_id && !device.door_id)) {
          try {
            const { data: fullDevice, error } = await supabase
              .from('devices')
              .select('*')
              .eq('id', parseInt(device.id))
              .single();
              
            if (error) {
              console.error('Error fetching full device data:', error);
            } else if (fullDevice) {
              console.log('Fetched full device data from Supabase:', fullDevice);
              deviceData = {
                ...device,
                zone_id: fullDevice.zone_id,
                door_id: fullDevice.door_id,
              };
            }
          } catch (error) {
            console.error('Error in device data fetch:', error);
          }
        }
        
        const formData: FormValues = {
          name: deviceData.name || "",
          device_serial: deviceData.serial_number || "",
          device_type: (deviceData.device_type as any) || "Kart Okuyucu",
          zone_id: deviceData.zone_id || undefined,
          door_id: deviceData.door_id || undefined,
          access_direction: (deviceData.access_direction as AccessDirection) || "both",
          device_ip: deviceData.device_ip || "",
          description: deviceData.description || "",
          status: (deviceData.status === "active" || deviceData.status === "inactive") ? deviceData.status : "active",
        };
        
        console.log('Setting form data:', formData);
        form.reset(formData);
        
      } else if (open && !device) {
        console.log('Resetting form for new device');
        form.reset({
          name: "",
          device_serial: "",
          device_type: "Kart Okuyucu",
          zone_id: undefined,
          door_id: undefined,
          access_direction: "both",
          status: "active",
          description: "",
        });
      }
    };

    loadDeviceData();
  }, [device, open, form]);
}
