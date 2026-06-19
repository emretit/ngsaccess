import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { Zone, Door } from "@/types/access-control";

export type { Zone, Door };

export function useZonesAndDoors() {
  const { projectId, loading: projectLoading } = useActiveProject();

  const queryArgs = !projectLoading && projectId ? { projectId } : "skip";
  const zones = useQuery(api.zones.list, queryArgs);
  const doors = useQuery(api.doors.list, queryArgs);

  const loading =
    projectLoading ||
    (!!projectId && (zones === undefined || doors === undefined));

  return {
    zones: (zones ?? []) as Zone[],
    doors: (doors ?? []) as Door[],
    loading,
    error: null,
    refreshData: () => {},
  };
}
