import { useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { Id } from "../../../../convex/_generated/dataModel";
import { FormValues, type DeviceBrand } from "./useDeviceFormSchema";

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
  brand?: DeviceBrand;
  ehomeID?: string;
  ehomeKey?: string;
  hikTransport?: "gateway" | "localBridge";
  hikDoorCount?: number;
  hikPort?: number;
  ideUuid?: string;
  ideUser?: string;
  idePassword?: string;
  ideHttpPort?: number;
  ideDoorCount?: number;
}

interface UseDeviceDataLoaderProps {
  device?: DeviceData | null;
  open: boolean;
  defaultBrand?: DeviceBrand;
  form: UseFormReturn<FormValues>;
}

export function useDeviceDataLoader({ device, open, defaultBrand, form }: UseDeviceDataLoaderProps) {
  useEffect(() => {
    if (device && open) {
      const formData: FormValues = {
        brand: device.brand ?? "other",
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
        ehome_id: device.ehomeID ?? "",
        ehome_key: device.ehomeKey ?? "",
        hik_transport: device.hikTransport ?? "gateway",
        hik_door_count: device.hikDoorCount,
        hik_port: device.hikPort,
        ide_uuid: device.ideUuid ?? "",
        ide_user: device.ideUser ?? "",
        ide_password: device.idePassword ?? "",
        ide_http_port: device.ideHttpPort,
        ide_door_count: device.ideDoorCount,
      };
      form.reset(formData);
    } else if (!device && open) {
      form.reset({
        brand: defaultBrand ?? "other",
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
        ehome_id: "",
        ehome_key: "",
        hik_transport: "gateway",
        // IDE Smart paneli ön-tanımlı kimliği (MQTT login token'ı için).
        ide_user: "admin",
        ide_password: "admin12345",
      });
    }
  }, [device, open, defaultBrand, form]);
}
