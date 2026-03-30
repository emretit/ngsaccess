import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { useProjectAccess } from "./useProjectAccess";
import { Id } from "../../convex/_generated/dataModel";

export interface Device {
  _id: Id<"devices">;
  id?: string;
  name: string;
  projectId?: Id<"projects">;
  zoneId?: Id<"zones">;
  doorId?: Id<"doors">;
  deviceType?: string;
  deviceIp?: string;
  deviceSerial?: string;
  accessDirection?: "entry" | "exit" | "both";
  status?: string;
  isActive?: boolean;
  description?: string;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
  zone?: { name: string } | null;
  door?: { name: string } | null;
  device_name?: string;
  device_serial?: string;
  device_type?: string;
  device_location?: string;
  [key: string]: unknown;
}

export function useDevices() {
  const { toast } = useToast();
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const devicesRaw = useQuery(api.devices.list, !projectLoading ? {} : "skip");

  const createDevice = useMutation(api.devices.create);
  const updateDevice = useMutation(api.devices.update);
  const deleteDevice = useMutation(api.devices.remove);

  const devices: Device[] = (devicesRaw ?? []).map((d: unknown) => {
    const dev = d as Device;
    const lastSeen = dev.lastSeen;
    let computedStatus: string = "offline";
    if (lastSeen) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      computedStatus = new Date(lastSeen) > fiveMinutesAgo ? "online" : "offline";
    }
    return {
      ...dev,
      status: computedStatus,
      device_name: dev.name,
      device_serial: dev.deviceSerial,
      device_type: dev.deviceType,
      device_location: dev.description,
    };
  });

  const addDevice = async (deviceData: Partial<Device>) => {
    const projectId = projectIds[0] as Id<"projects"> | undefined;
    try {
      const id = await createDevice({
        name: deviceData.name ?? deviceData.device_name ?? "Yeni Cihaz",
        projectId,
        zoneId: deviceData.zoneId,
        doorId: deviceData.doorId,
        deviceType: deviceData.deviceType ?? deviceData.device_type,
        deviceIp: deviceData.deviceIp,
        deviceSerial: deviceData.deviceSerial ?? deviceData.device_serial,
        accessDirection: deviceData.accessDirection,
        isActive: deviceData.isActive ?? true,
        description: deviceData.description ?? deviceData.device_location,
      });
      toast({ title: "Cihaz eklendi" });
      return id;
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Cihaz eklenemedi",
        variant: "destructive",
      });
    }
  };

  const editDevice = async (deviceId: Id<"devices">, updates: Partial<Device>) => {
    try {
      await updateDevice({
        deviceId,
        name: updates.name,
        zoneId: updates.zoneId,
        doorId: updates.doorId,
        deviceType: updates.deviceType,
        deviceIp: updates.deviceIp,
        deviceSerial: updates.deviceSerial,
        accessDirection: updates.accessDirection,
        isActive: updates.isActive,
        description: updates.description,
        lastSeen: updates.lastSeen,
      });
      toast({ title: "Cihaz güncellendi" });
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Cihaz güncellenemedi",
        variant: "destructive",
      });
    }
  };

  const removeDevice = async (deviceId: Id<"devices">) => {
    try {
      await deleteDevice({ deviceId });
      toast({ title: "Cihaz silindi" });
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Cihaz silinemedi",
        variant: "destructive",
      });
    }
  };

  return {
    devices,
    isLoading: projectLoading || devicesRaw === undefined,
    error: null,
    addDevice,
    editDevice,
    removeDevice,
    devicesQuery: { data: devices, isLoading: devicesRaw === undefined },
  };
}
