// @ts-nocheck
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
  // Legacy aliases
  serial_number?: string;
  device_type?: string;
  zone_id?: Id<"zones">;
  door_id?: Id<"doors">;
  access_direction?: AccessDirection;
  device_ip?: string;
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
        device_serial: device.deviceSerial ?? device.serial_number ?? "",
        device_type: (device.deviceType ?? device.device_type ?? "Kart Okuyucu") as FormValues["device_type"],
        zone_id: (device.zoneId ?? device.zone_id) as string | undefined,
        door_id: (device.doorId ?? device.door_id) as string | undefined,
        access_direction: (device.accessDirection ?? device.access_direction ?? "both") as AccessDirection,
        device_ip: device.deviceIp ?? device.device_ip ?? "",
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
