import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import type { Device } from "@/types/device";

export const useProjectFilteredDevices = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const devicesRaw = useQuery(api.devices.list, !projectLoading ? {} : "skip");

  // eslint-disable-next-line react-hooks/purity
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  const devices: Device[] = ((devicesRaw ?? []) as Device[]).map((dev) => {
    const lastSeen = dev.lastSeen;
    let computedStatus: "online" | "offline" = "offline";
    if (lastSeen) {
      computedStatus = new Date(lastSeen).getTime() > fiveMinutesAgo ? "online" : "offline";
    }
    return {
      ...dev,
      status: computedStatus,
    };
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
