import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import type { Device } from "@/types/device";
import { deviceConnection } from "@/lib/deviceStatus";
import type { FunctionReturnType } from "convex/server";

type DeviceRow = FunctionReturnType<typeof api.devices.list>[number];

export const useProjectFilteredDevices = () => {
  const { projectIds, isSuperAdmin, projectId, loading: projectLoading } = useActiveProjectScope();

  // Aktif projeye göre filtrele — super_admin dahil yalnızca seçili projenin cihazları.
  const devicesRaw = useQuery(
    api.devices.list,
    !projectLoading && projectId ? { projectId } : "skip",
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const devices: Device[] = (devicesRaw ?? []).map((dev: DeviceRow) => ({
    ...dev,
    connectionStatus: deviceConnection(dev, nowMs),
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
