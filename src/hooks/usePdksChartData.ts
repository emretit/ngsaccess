import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";

export const usePdksChartData = (startDate: string, endDate: string) => {
  const { loading: projectLoading } = useProjectAccess();

  const chartData = useQuery(
    api.cardReadings.getPdksChartData,
    !projectLoading
      ? {
          startDate,
          endDate,
        }
      : "skip"
  );

  return {
    dailyAttendance: chartData?.dailyAttendance ?? [],
    departmentAbsence: chartData?.departmentAbsence ?? [],
    lateDistribution: chartData?.lateDistribution ?? [],
    hourlyTrend: chartData?.hourlyTrend ?? [],
    lateMinutesSamples: chartData?.lateMinutesSamples ?? [],
    isLoading: projectLoading || chartData === undefined,
  };
};
