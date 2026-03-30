// @ts-nocheck
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { FormValues } from "./useDeviceFormSchema";

interface UseDeviceFormSubmissionProps {
  device?: { _id?: Id<"devices"> } | null;
  currentProjectId: Id<"projects"> | null;
  onSuccess: () => void;
}

export function useDeviceFormSubmission({
  device,
  currentProjectId,
  onSuccess,
}: UseDeviceFormSubmissionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const createDevice = useMutation(api.devices.create);
  const updateDevice = useMutation(api.devices.update);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      if (device?._id) {
        await updateDevice({
          deviceId: device._id,
          name: values.name,
          deviceSerial: values.device_serial,
          deviceType: values.device_type,
          zoneId: (values.zone_id || undefined) as Id<"zones"> | undefined,
          doorId: (values.door_id || undefined) as Id<"doors"> | undefined,
          accessDirection: values.access_direction as "entry" | "exit" | "both",
          deviceIp: values.device_ip || undefined,
          deviceUsername: values.device_username || undefined,
          devicePassword: values.device_password || undefined,
          description: values.description || undefined,
          status: values.status,
        });
        toast({ title: "Başarılı", description: "Cihaz bilgileri güncellendi" });
      } else {
        await createDevice({
          name: values.name,
          deviceSerial: values.device_serial,
          deviceType: values.device_type,
          projectId: currentProjectId ?? undefined,
          zoneId: (values.zone_id || undefined) as Id<"zones"> | undefined,
          doorId: (values.door_id || undefined) as Id<"doors"> | undefined,
          accessDirection: values.access_direction as "entry" | "exit" | "both",
          deviceIp: values.device_ip || undefined,
          deviceUsername: values.device_username || undefined,
          devicePassword: values.device_password || undefined,
          description: values.description || undefined,
          status: values.status,
        });
        toast({ title: "Başarılı", description: "Cihaz başarıyla eklendi" });
      }
      onSuccess();
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Cihaz kaydedilirken hata oluştu",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, onSubmit };
}
