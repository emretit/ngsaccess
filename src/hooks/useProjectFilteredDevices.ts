import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { Device } from "@/types/device";
import { computeDeviceStatus } from "@/lib/deviceStatus";

export const useProjectFilteredDevices = () => {
  const { projectIds, isSuperAdmin, projectId, loading: projectLoading } = useActiveProject();

  // Aktif projeye göre filtrele — super_admin dahil yalnızca seçili projenin cihazları.
  const devicesRaw = useQuery(
    api.devices.list,
    !projectLoading && projectId ? { projectId } : "skip",
  );

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const devices: Device[] = ((devicesRaw ?? []) as Device[]).map((dev) => ({
    ...dev,
    status: computeDeviceStatus(dev.lastSeen, nowMs),
  }));

  // Super admin veya en az bir projesi olan kullanıcı erişebilir
  const hasProjectAccess = isSuperAdmin || projectIds.length > 0;

  return {
    devices,
    isLoading: projectLoading || (!!projectId && devicesRaw === undefined),
    hasProjectAccess,
    error: null,
    refetch: () => {},
  };
};
