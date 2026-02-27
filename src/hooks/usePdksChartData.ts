import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import { subDays, format } from "date-fns";

export const usePdksChartData = (daysBack = 7) => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const endDate = new Date();
  const startDate = subDays(endDate, daysBack);

  const chartData = useQuery(
    api.cardReadings.getPdksChartData,
    !projectLoading
      ? {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
        }
      : "skip"
  );

  return {
    dailyAttendance: chartData?.dailyAttendance ?? [],
    departmentAbsence: chartData?.departmentAbsence ?? [],
    lateDistribution: chartData?.lateDistribution ?? [],
    hourlyTrend: chartData?.hourlyTrend ?? [],
    isLoading: projectLoading || chartData === undefined,
  };
};
