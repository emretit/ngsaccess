import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import { Device } from "./useDevices";

export const useProjectFilteredDevices = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const devicesRaw = useQuery(api.devices.list, !projectLoading ? {} : "skip");

  const devices: Device[] = (devicesRaw ?? []).map((d: any) => {
    const dev = d as Record<string, any>;
    const lastSeen = dev.lastSeen;
    let computedStatus: "online" | "offline" = "offline";
    if (lastSeen) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      computedStatus = new Date(lastSeen) > fiveMinutesAgo ? "online" : "offline";
    }
    return {
      ...dev,
      id: String(dev._id ?? dev.id ?? ""),
      zone_id: String(dev.zoneId ?? dev.zone_id ?? ""),
      door_id: String(dev.doorId ?? dev.door_id ?? ""),
      device_serial: String(dev.deviceSerial ?? dev.device_serial ?? dev.serial_number ?? ""),
      device_type: String(dev.deviceType ?? dev.device_type ?? ""),
      access_direction: String(dev.accessDirection ?? dev.access_direction ?? "both"),
      device_name: String(dev.name ?? dev.device_name ?? ""),
      status: computedStatus,
    } as unknown as Device;
  });

  // Super admin veya en az bir projesi olan kullanıcı erişebilir
  const hasProjectAccess = isSuperAdmin || projectIds.length > 0;

  return {
    devices,
    isLoading: projectLoading || devicesRaw === undefined,
    hasProjectAccess,
    error: null,
    refetch: () => {},
  };
};
