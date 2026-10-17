import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { Zone, Door } from "@/types/access-control";

export type { Zone, Door };

// Sabit boş diziler: yüklenirken her render'da yeni [] dönerse diziye bağlı effect'ler sonsuz döngüye girer.
const NO_ZONES: Zone[] = [];
const NO_DOORS: Door[] = [];

export function useZonesAndDoors() {
  const { projectId, loading: projectLoading } = useActiveProject();

  const queryArgs = !projectLoading && projectId ? { projectId } : "skip";
  const zones = useQuery(api.zones.list, queryArgs);
  const doors = useQuery(api.doors.list, queryArgs);

  const loading =
    projectLoading ||
    (!!projectId && (zones === undefined || doors === undefined));

  return {
    zones: (zones as Zone[] | undefined) ?? NO_ZONES,
    doors: (doors as Door[] | undefined) ?? NO_DOORS,
    loading,
    error: null,
    refreshData: () => {},
  };
}
