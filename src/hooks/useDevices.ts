import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { Id } from "../../convex/_generated/dataModel";
import type { Device } from "@/types/device";

export type { Device };

export function useDevices() {
  const { toast } = useToast();
  const { projectId, loading: projectLoading } = useActiveProject();

  const devicesRaw = useQuery(api.devices.list, !projectLoading ? {} : "skip");

  const createDevice = useMutation(api.devices.create);
  const updateDevice = useMutation(api.devices.update);
  const deleteDevice = useMutation(api.devices.remove);

  // Date.now() render içinde "şimdi" eşiği için kullanılır; her devices güncellemesinde
  // yeniden hesaplanması istenen davranıştır (stale online/offline gösterimini önler).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  const devices: Device[] = (devicesRaw ?? []).map((d: unknown) => {
    const dev = d as Device & { lastSeen?: string };
    let computedStatus: Device["status"] = "offline";
    if (dev.lastSeen) {
      computedStatus = new Date(dev.lastSeen).getTime() > fiveMinutesAgo ? "online" : "offline";
    }
    return { ...dev, status: computedStatus };
  });

  const addDevice = async (deviceData: Partial<Device>) => {
    try {
      const id = await createDevice({
        name: deviceData.name ?? "Yeni Cihaz",
        projectId,
        zoneId: deviceData.zoneId,
        doorId: deviceData.doorId,
        deviceType: deviceData.deviceType,
        deviceIp: deviceData.deviceIp,
        deviceSerial: deviceData.deviceSerial,
        accessDirection: deviceData.accessDirection,
        isActive: deviceData.isActive ?? true,
        description: deviceData.description,
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
