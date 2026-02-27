import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";

export const usePdksStats = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const stats = useQuery(api.dashboard.getPdksStats, !projectLoading ? {} : "skip");

  return {
    stats:
      stats ??
      {
        totalEmployees: 0,
        presentToday: 0,
        lateArrivals: 0,
        overtimeHours: 0,
        insideBuilding: 0,
        leaveToday: 0,
        devamOrani: 0,
        topLateDepartment: "-",
        topLateDepartmentCount: 0,
      },
    isLoading: projectLoading || stats === undefined,
    error: null,
  };
};
