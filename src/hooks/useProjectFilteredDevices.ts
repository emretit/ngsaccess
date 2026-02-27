import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import { Device } from "./useDevices";

export const useProjectFilteredDevices = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const devicesRaw = useQuery(api.devices.list, !projectLoading ? {} : "skip");

  const devices: Device[] = (devicesRaw ?? []).map((d: unknown) => {
    const dev = d as Device;
    const lastSeen = dev.lastSeen;
    let computedStatus = "offline";
    if (lastSeen) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      computedStatus = new Date(lastSeen) > fiveMinutesAgo ? "online" : "offline";
    }
    return { ...dev, status: computedStatus };
  });

  return {
    devices,
    isLoading: projectLoading || devicesRaw === undefined,
    error: null,
    refetch: () => {},
  };
};
