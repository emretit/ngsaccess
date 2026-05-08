import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import type { Id } from "../../convex/_generated/dataModel";

export type ExportFormat = "daily" | "weekly" | "monthly" | "custom";
export type PdksStatusFilter = "all" | "present" | "late" | "absent" | "leave" | "overtime";

export interface PdksTableFilters {
  dateRange?: { from?: Date; to?: Date };
  reportType?: ExportFormat;
  companyId?: Id<"companies">;
  departmentId?: Id<"departments">;
  positionId?: Id<"positions">;
  shiftId?: Id<"shifts">;
  statusFilter?: PdksStatusFilter;
  person?: string;
}

export const usePdksTableData = (filters?: PdksTableFilters) => {
  const { loading: projectLoading } = useProjectAccess();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const reportType = filters?.reportType ?? "daily";
  const isMatrix = reportType !== "daily";

  const getQueryArgs = () => {
    const dateRange = filters?.dateRange;

    const baseArgs = {
      companyId: filters?.companyId,
      departmentId: filters?.departmentId,
      positionId: filters?.positionId,
      shiftId: filters?.shiftId,
      statusFilter: filters?.statusFilter,
      person: filters?.person,
      viewMode: (isMatrix ? "matrix" : "single") as "matrix" | "single",
    };

    if (reportType === "custom" && dateRange?.from && dateRange?.to) {
      return {
        ...baseArgs,
        startDate: format(dateRange.from, "yyyy-MM-dd"),
        endDate: format(dateRange.to, "yyyy-MM-dd"),
      };
    }

    if (reportType === "weekly") {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
      return {
        ...baseArgs,
        startDate: format(weekStart, "yyyy-MM-dd"),
        endDate: format(weekEnd, "yyyy-MM-dd"),
      };
    }

    if (reportType === "monthly") {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      return {
        ...baseArgs,
        startDate: format(monthStart, "yyyy-MM-dd"),
        endDate: format(monthEnd, "yyyy-MM-dd"),
      };
    }

    return {
      ...baseArgs,
      date: format(selectedDate, "yyyy-MM-dd"),
    };
  };

  const tableData = useQuery(
    api.cardReadings.getPdksTableData,
    !projectLoading ? getQueryArgs() : "skip"
  );

  const dateRangeLabel = () => {
    const range = filters?.dateRange;
    if (reportType === "custom" && range?.from && range?.to) {
      return `${format(range.from, "dd.MM.yyyy")} - ${format(range.to, "dd.MM.yyyy")}`;
    }
    if (reportType === "weekly") {
      const w = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const we = endOfWeek(selectedDate, { weekStartsOn: 1 });
      return `${format(w, "dd.MM.yyyy")} - ${format(we, "dd.MM.yyyy")}`;
    }
    if (reportType === "monthly") {
      return format(selectedDate, "MMMM yyyy");
    }
    return format(selectedDate, "dd.MM.yyyy");
  };

  const args = getQueryArgs();
  const startDate = "startDate" in args ? args.startDate : args.date;
  const endDate = "endDate" in args ? args.endDate : args.date;

  return {
    tableData: tableData ?? [],
    tableRecords: tableData ?? [],
    isLoading: projectLoading || tableData === undefined,
    error: null,
    selectedDate,
    setSelectedDate,
    dateRangeLabel: dateRangeLabel(),
    isMatrix,
    startDate,
    endDate,
    refetch: () => {},
  };
};
