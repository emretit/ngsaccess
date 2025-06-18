
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ServerDevice, Project, AccessDirection } from "@/types/device";
import { DeviceBasicInfo } from "./form-fields/DeviceBasicInfo";
import { DeviceLocationInfo } from "./form-fields/DeviceLocationInfo";
import { DeviceNetworkInfo } from "./form-fields/DeviceNetworkInfo";
import { DeviceAccessInfo } from "./form-fields/DeviceAccessInfo";
import { DeviceAdditionalInfo } from "./form-fields/DeviceAdditionalInfo";

const formSchema = z.object({
  name: z.string().min(1, "Cihaz adı gereklidir"),
  serial_number: z.string().min(1, "Seri numarası gereklidir"),
  device_model_enum: z.enum(["QR Reader", "Fingerprint Reader", "RFID Reader", "Access Control Terminal", "Other"]),
  project_id: z.number().optional(),
  zone_id: z.number().optional(),
  door_id: z.number().optional(),
  access_direction: z.enum(["entry", "exit", "both"]).default("both"),
  device_mac: z.string().optional(),
  device_ip: z.string().optional(),
  device_firmware: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

type FormValues = z.infer<typeof formSchema>;

interface ServerDeviceFormProps {
  open: boolean;
  onClose: () => void;
  device?: ServerDevice | null;
  projects: Project[];
  onSuccess: () => void;
}

export function ServerDeviceForm({
  open,
  onClose,
  device,
  projects,
  onSuccess,
}: ServerDeviceFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      serial_number: "",
      device_model_enum: "Other",
      access_direction: "both",
      status: "active",
    },
  });

  useEffect(() => {
    if (device && open) {
      form.reset({
        name: device.name || "",
        serial_number: device.serial_number || "",
        device_model_enum: device.device_model_enum || "Other",
        project_id: device.project_id,
        zone_id: device.zone_id,
        door_id: device.door_id,
        access_direction: (device.access_direction as AccessDirection) || "both",
        device_mac: device.device_mac || "",
        device_ip: device.device_ip || "",
        device_firmware: device.device_firmware || "",
        status: (device.status === "active" || device.status === "inactive") ? device.status : "active",
      });
    } else if (open) {
      form.reset({
        name: "",
        serial_number: "",
        device_model_enum: "Other",
        access_direction: "both",
        status: "active",
      });
    }
  }, [device, open, form]);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    
    try {
      const deviceData = {
        name: values.name,
        type: values.device_model_enum,
        serial_number: values.serial_number,
        device_model_enum: values.device_model_enum,
        project_id: values.project_id || null,
        zone_id: values.zone_id || null,
        door_id: values.door_id || null,
        access_direction: values.access_direction,
        device_mac: values.device_mac || null,
        device_ip: values.device_ip || null,
        device_firmware: values.device_firmware || null,
        status: values.status,
      };

      if (device?.id) {
        const { error } = await supabase
          .from("devices")
          .update(deviceData)
          .eq("id", parseInt(device.id));

        if (error) throw error;
        
        toast({
          title: "Cihaz güncellendi",
          description: "Cihaz bilgileri başarıyla güncellendi",
        });
      } else {
        const { error } = await supabase
          .from("devices")
          .insert(deviceData);

        if (error) throw error;
        
        toast({
          title: "Cihaz eklendi",  
          description: "Yeni cihaz başarıyla eklendi",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <DeviceBasicInfo 
          name={form.watch("name")}
          onNameChange={(value) => form.setValue("name", value)}
          serialNumber={form.watch("serial_number")}
          onSerialNumberChange={(value) => form.setValue("serial_number", value)}
          deviceModel={form.watch("device_model_enum")}
          onDeviceModelChange={(value) => form.setValue("device_model_enum", value)}
          isActive={form.watch("status") === "active"}
          onIsActiveChange={(value) => form.setValue("status", value ? "active" : "inactive")}
        />
        
        <DeviceLocationInfo 
          projectId={form.watch("project_id")?.toString() || ""}
          onProjectChange={(value) => {
            const numValue = value ? parseInt(value, 10) : undefined;
            form.setValue("project_id", numValue);
          }}
          zoneId={form.watch("zone_id")?.toString() || ""}
          onZoneChange={(value) => {
            const numValue = value ? parseInt(value, 10) : undefined;
            form.setValue("zone_id", numValue);
          }}
          doorId={form.watch("door_id")?.toString() || ""}
          onDoorChange={(value) => {
            const numValue = value ? parseInt(value, 10) : undefined;
            form.setValue("door_id", numValue);
          }}
          projects={projects}
          zones={[]}
          doors={[]}
          loading={false}
        />

        <DeviceAccessInfo
          accessDirection={form.watch("access_direction")}
          onAccessDirectionChange={(value) => form.setValue("access_direction", value)}
        />
        
        <DeviceNetworkInfo 
          ipAddress={form.watch("device_ip") || ""}
          onIpAddressChange={(value) => form.setValue("device_ip", value)}
          macAddress={form.watch("device_mac") || ""}
          onMacAddressChange={(value) => form.setValue("device_mac", value)}
          firmwareVersion={form.watch("device_firmware") || ""}
          onFirmwareVersionChange={(value) => form.setValue("device_firmware", value)}
        />
        
        <DeviceAdditionalInfo 
          description=""
          onDescriptionChange={() => {}}
          expiryDate=""
          onExpiryDateChange={() => {}}
        />

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            İptal
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Kaydediliyor..." : device ? "Güncelle" : "Kaydet"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
