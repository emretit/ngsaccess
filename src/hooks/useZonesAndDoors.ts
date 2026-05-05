import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import type { Zone, Door } from "@/types/access-control";

export type { Zone, Door };

export function useZonesAndDoors() {
  const { loading: projectLoading } = useProjectAccess();

  const zones = useQuery(api.zones.list, !projectLoading ? {} : "skip");
  const doors = useQuery(api.doors.list, !projectLoading ? {} : "skip");

  const loading = projectLoading || zones === undefined || doors === undefined;

  return {
    zones: (zones ?? []) as Zone[],
    doors: (doors ?? []) as Door[],
    loading,
    error: null,
    refreshData: () => {},
  };
}
