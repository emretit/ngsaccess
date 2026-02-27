import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";

export type ExportFormat = "daily" | "weekly" | "monthly" | "custom";

export interface PdksTableFilters {
  dateRange?: { from?: Date; to?: Date };
  reportType?: ExportFormat;
}

export const usePdksTableData = (filters?: PdksTableFilters) => {
  const { loading: projectLoading } = useProjectAccess();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const getQueryArgs = () => {
    const reportType = filters?.reportType ?? "daily";
    const dateRange = filters?.dateRange;

    if (reportType === "custom" && dateRange?.from && dateRange?.to) {
      return {
        startDate: format(dateRange.from, "yyyy-MM-dd"),
        endDate: format(dateRange.to, "yyyy-MM-dd"),
      };
    }

    if (reportType === "weekly") {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
      return {
        startDate: format(weekStart, "yyyy-MM-dd"),
        endDate: format(weekEnd, "yyyy-MM-dd"),
      };
    }

    if (reportType === "monthly") {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      return {
        startDate: format(monthStart, "yyyy-MM-dd"),
        endDate: format(monthEnd, "yyyy-MM-dd"),
      };
    }

    return {
      date: format(selectedDate, "yyyy-MM-dd"),
    };
  };

  const tableData = useQuery(
    api.cardReadings.getPdksTableData,
    !projectLoading ? getQueryArgs() : "skip"
  );

  const dateRangeLabel = () => {
    const reportType = filters?.reportType ?? "daily";
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

  return {
    tableData: tableData ?? [],
    tableRecords: tableData ?? [],
    isLoading: projectLoading || tableData === undefined,
    error: null,
    selectedDate,
    setSelectedDate,
    dateRangeLabel: dateRangeLabel(),
    refetch: () => {},
  };
};
