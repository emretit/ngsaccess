
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ServerDevice, Project, AccessDirection } from "@/types/device";
import { deviceTypeMapping, DatabaseDeviceType } from "@/utils/deviceTypeMapping";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  name: z.string().min(1, "Cihaz adı gereklidir"),
  serial_number: z.string().min(1, "Seri numarası gereklidir"),
  device_model_enum: z.enum(["QR Reader", "Fingerprint Reader", "RFID Reader", "Access Control Terminal", "Other"]),
  zone_id: z.number().optional(),
  door_id: z.number().optional(),
  access_direction: z.enum(["entry", "exit", "both"]).default("both"),
  device_mac: z.string().optional(),
  device_ip: z.string().optional(),
  device_firmware: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface UseDeviceFormLogicProps {
  device?: ServerDevice | null;
  open: boolean;
  onSuccess: () => void;
}

export function useDeviceFormLogic({ device, open, onSuccess }: UseDeviceFormLogicProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { projectIds } = useProjectAccess();
  const { zones, doors, loading: locationLoading } = useZonesAndDoors();
  const queryClient = useQueryClient();
  
  const currentProjectId = projectIds[0] || null;
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      serial_number: "",
      device_model_enum: "Other",
      access_direction: "both",
      status: "active",
      description: "",
    },
  });

  const selectedZoneId = form.watch("zone_id");
  const filteredDoors = doors.filter(door => door.zone_id === selectedZoneId);

  useEffect(() => {
    if (device && open) {
      console.log('Setting form data with device:', device);
      console.log('Device zone_id:', device.zone_id, 'Device door_id:', device.door_id);
      
      // Mevcut cihazın zone_id ve door_id değerlerini koruyarak form'u reset et
      const resetData = {
        name: device.name || "",
        serial_number: device.serial_number || "",
        device_model_enum: device.device_model_enum || "Other",
        zone_id: device.zone_id,
        door_id: device.door_id,
        access_direction: (device.access_direction as AccessDirection) || "both",
        device_mac: device.device_mac || "",
        device_ip: device.device_ip || "",
        device_firmware: device.device_firmware || "",
        status: (device.status === "active" || device.status === "inactive") ? device.status : "active",
        description: device.description || "",
      };
      
      console.log('Reset data for form:', resetData);
      
      // Form'u reset et
      form.reset(resetData);
      
      // Zone ve door değerlerini ayrı ayrı set et (güvenlik için)
      if (device.zone_id !== undefined) {
        console.log('Setting zone_id explicitly:', device.zone_id);
        form.setValue("zone_id", device.zone_id);
      }
      
      if (device.door_id !== undefined) {
        console.log('Setting door_id explicitly:', device.door_id);
        form.setValue("door_id", device.door_id);
      }
      
    } else if (open && !device) {
      console.log('Resetting form for new device');
      // Yeni cihaz için form'u temizle
      form.reset({
        name: "",
        serial_number: "",
        device_model_enum: "Other",
        zone_id: undefined,
        door_id: undefined,
        access_direction: "both",
        status: "active",
        description: "",
      });
    }
  }, [device, open, form]);

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
    form,
    isLoading,
    zones,
    doors,
    locationLoading,
    selectedZoneId,
    filteredDoors,
    onSubmit,
  };
}
