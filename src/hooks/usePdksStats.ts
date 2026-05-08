import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import type { Id } from "../../convex/_generated/dataModel";

export interface PdksStatsFilters {
  companyId?: Id<"companies">;
  departmentId?: Id<"departments">;
  positionId?: Id<"positions">;
  shiftId?: Id<"shifts">;
  compareWithPrevious?: boolean;
}

const FALLBACK = {
  totalEmployees: 0,
  presentToday: 0,
  lateArrivals: 0,
  overtimeHours: 0,
  insideBuilding: 0,
  leaveToday: 0,
  devamOrani: 0,
  topLateDepartment: "-",
  topLateDepartmentCount: 0,
  previous: undefined,
};

export const usePdksStats = (filters?: PdksStatsFilters) => {
  const { loading: projectLoading } = useProjectAccess();

  const stats = useQuery(
    api.dashboard.getPdksStats,
    !projectLoading
      ? {
          companyId: filters?.companyId,
          departmentId: filters?.departmentId,
          positionId: filters?.positionId,
          shiftId: filters?.shiftId,
          compareWithPrevious: filters?.compareWithPrevious ?? true,
        }
      : "skip"
  );

  return {
    stats: stats ?? FALLBACK,
    isLoading: projectLoading || stats === undefined,
    error: null,
  };
};
