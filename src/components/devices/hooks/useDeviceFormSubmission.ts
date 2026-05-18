import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { FormValues } from "./useDeviceFormSchema";

interface UseDeviceFormSubmissionProps {
  device?: { _id?: Id<"devices">; hikDevIndex?: string } | null;
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
  const registerOnGateway = useAction(api.actions.hikGatewayDevice.registerDeviceOnGateway);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      const hikFields =
        values.brand === "hikvision"
          ? {
              ehomeID: values.ehome_id?.trim() || undefined,
              ehomeKey: values.ehome_key?.trim() || undefined,
            }
          : {};
      let deviceId: Id<"devices"> | undefined;
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
          brand: values.brand,
          ...hikFields,
        });
        deviceId = device._id;
        toast({ title: "Başarılı", description: "Cihaz bilgileri güncellendi" });
      } else {
        deviceId = await createDevice({
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
          brand: values.brand,
          ...hikFields,
        });
        toast({ title: "Başarılı", description: "Cihaz başarıyla eklendi" });
      }

      // Hikvision cihazlar için otomatik gateway registration (zaten kayıtlıysa skip).
      const alreadyRegistered = !!device?.hikDevIndex;
      if (
        values.brand === "hikvision" &&
        deviceId &&
        values.ehome_id?.trim() &&
        !alreadyRegistered
      ) {
        const reg = await registerOnGateway({ deviceId });
        if (reg.ok) {
          toast({
            title: "Gateway",
            description: `Gateway'e kaydedildi: ${reg.devIndex?.slice(0, 8)}…`,
          });
        } else {
          toast({
            title: "Gateway kaydı başarısız",
            description: reg.error ?? "Bilinmeyen hata",
            variant: "destructive",
          });
        }
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
