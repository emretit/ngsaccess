
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ServerDevice } from "@/types/device";
import { deviceTypeMapping, DatabaseDeviceType } from "@/utils/deviceTypeMapping";
import { FormValues } from "./useDeviceFormSchema";

interface UseDeviceFormSubmissionProps {
  device?: ServerDevice | null;
  currentProjectId: number | null;
  projectIds: number[];
  onSuccess: () => void;
}

export function useDeviceFormSubmission({ 
  device, 
  currentProjectId, 
  projectIds, 
  onSuccess 
}: UseDeviceFormSubmissionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    console.log('Submitting form with values:', values);
    
    try {
      const deviceType = deviceTypeMapping[values.device_model_enum] as DatabaseDeviceType;
      
      const deviceData = {
        name: values.name,
        type: deviceType,
        device_serial: values.serial_number,
        device_model_enum: values.device_model_enum,
        project_id: currentProjectId,
        zone_id: values.zone_id || null,
        door_id: values.door_id || null,
        access_direction: values.access_direction,
        device_mac: values.device_mac || null,
        device_ip: values.device_ip || null,
        device_firmware: values.device_firmware || null,
        status: values.status,
        description: values.description || null,
      };

      console.log('Device data to be saved:', deviceData);

      if (device?.id) {
        const { error } = await supabase
          .from("devices")
          .update(deviceData)
          .eq("id", parseInt(device.id));

        if (error) throw error;
        
        console.log('Device updated successfully');
        
        await queryClient.invalidateQueries({ queryKey: ['devices'] });
        await queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
        await queryClient.invalidateQueries({ queryKey: ['devices', projectIds] });
        await queryClient.invalidateQueries({ queryKey: ['server-devices'] });
        
        toast({
          title: "Başarılı",
          description: "Cihaz bilgileri güncellendi",
        });
      } else {
        const { error } = await supabase
          .from("devices")
          .insert(deviceData);

        if (error) throw error;
        
        console.log('Device created successfully');
        
        await queryClient.invalidateQueries({ queryKey: ['devices'] });
        await queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
        await queryClient.invalidateQueries({ queryKey: ['devices', projectIds] });
        await queryClient.invalidateQueries({ queryKey: ['server-devices'] });
        
        toast({
          title: "Başarılı",
          description: "Yeni cihaz eklendi",
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving device:', error);
      toast({
        title: "Hata",
        description: error.message || "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    onSubmit,
    isLoading,
  };
}
