
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ServerDevice } from "@/types/device";
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
      const deviceData = {
        name: values.name,
        device_serial: values.device_serial,
        device_type: values.device_type,
        project_id: currentProjectId,
        zone_id: values.zone_id || null,
        door_id: values.door_id || null,
        access_direction: values.access_direction,
        device_ip: values.device_ip || null,
        description: values.description || null,
        status: values.status,
      };

      console.log('Device data to be saved:', deviceData);

      if (device?.id) {
        const { error } = await supabase
          .from("devices")
          .update(deviceData)
          .eq("id", parseInt(device.id));

        if (error) throw error;
        
        console.log('Device updated successfully');
        
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
        
        toast({
          title: "Başarılı",
          description: "Yeni cihaz eklendi",
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['devices'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
      await queryClient.invalidateQueries({ queryKey: ['devices', projectIds] });
      await queryClient.invalidateQueries({ queryKey: ['server-devices'] });

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
