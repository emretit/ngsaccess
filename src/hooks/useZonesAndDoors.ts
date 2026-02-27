import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import { Id } from "../../convex/_generated/dataModel";

export interface Zone {
  _id: Id<"zones">;
  name: string;
  description?: string;
  projectId?: Id<"projects">;
}

export interface Door {
  _id: Id<"doors">;
  name: string;
  zoneId?: Id<"zones">;
  location?: string;
  status?: string;
  projectId?: Id<"projects">;
}

export function useZonesAndDoors() {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const zones = useQuery(api.zones.list, !projectLoading ? {} : "skip");

  const doors = useQuery(api.doors.list, !projectLoading ? {} : "skip");

  const loading = projectLoading || zones === undefined || doors === undefined;

  const refreshData = () => {};

  return {
    zones: (zones ?? []) as Zone[],
    doors: (doors ?? []) as Door[],
    loading,
    error: null,
    refreshData,
  };
}
