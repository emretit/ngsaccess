import { useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { Id } from "../../../../convex/_generated/dataModel";
import { FormValues } from "./useDeviceFormSchema";

type AccessDirection = "entry" | "exit" | "both";

interface DeviceData {
  _id?: Id<"devices">;
  name?: string;
  deviceSerial?: string;
  deviceType?: string;
  zoneId?: Id<"zones">;
  doorId?: Id<"doors">;
  accessDirection?: AccessDirection;
  deviceIp?: string;
  deviceUsername?: string;
  devicePassword?: string;
  description?: string;
  status?: string;
}

interface UseDeviceDataLoaderProps {
  device?: DeviceData | null;
  open: boolean;
  form: UseFormReturn<FormValues>;
}

export function useDeviceDataLoader({ device, open, form }: UseDeviceDataLoaderProps) {
  useEffect(() => {
    if (device && open) {
      const formData: FormValues = {
        name: device.name ?? "",
        device_serial: device.deviceSerial ?? "",
        device_type: (device.deviceType ?? "Kart Okuyucu") as FormValues["device_type"],
        zone_id: device.zoneId as string | undefined,
        door_id: device.doorId as string | undefined,
        access_direction: (device.accessDirection ?? "both") as AccessDirection,
        device_ip: device.deviceIp ?? "",
        device_username: device.deviceUsername ?? "",
        device_password: device.devicePassword ?? "",
        description: device.description ?? "",
        status: (device.status === "active" || device.status === "inactive" ? device.status : "active") as "active" | "inactive",
      };
      form.reset(formData);
    } else if (!device && open) {
      form.reset({
        name: "",
        device_serial: "",
        device_type: "Kart Okuyucu",
        zone_id: undefined,
        door_id: undefined,
        access_direction: "both",
        device_ip: "",
        device_username: "",
        device_password: "",
        description: "",
        status: "active",
      });
    }
  }, [device, open, form]);
}
