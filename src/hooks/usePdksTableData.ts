import { usePermissions } from "@/hooks/usePermissions";
import { pdksToday } from "@/components/pdks/lib/calendar";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from "date-fns";
import { filterPdksRows } from "@/components/pdks/lib/presentation";
import { tr } from "date-fns/locale";
import type { Id } from "../../convex/_generated/dataModel";

export type ExportFormat = "daily" | "weekly" | "monthly" | "custom";
export type PdksStatusFilter =
  | "all"
  | "present"
  | "late"
  | "absent"
  | "leave"
  | "overtime"
  | "weekend"
  | "holiday"
  | "future"
  | "noData"
  | "notEmployed";

export interface PdksTableFilters {
  anchorDate?: Date;
  dateRange?: { from?: Date; to?: Date };
  reportType?: ExportFormat;
  companyId?: Id<"companies">;
  departmentId?: Id<"departments">;
  positionId?: Id<"positions">;
  shiftId?: Id<"shifts">;
  statusFilter?: PdksStatusFilter;
  person?: string;
  employeeId?: Id<"employees">;
}

export const usePdksTableData = (filters?: PdksTableFilters) => {
  const { loading: projectLoading, projectId } = useActiveProject();
  const { can } = usePermissions();
  const canRead = can("reports.view");
  const selectedDate = filters?.anchorDate ?? pdksToday();

  const reportType = filters?.reportType ?? "daily";
  const isMatrix = reportType !== "daily";

  const getQueryArgs = (selectedProjectId: Id<"projects"> | undefined) => {
    const dateRange = filters?.dateRange;

    const baseArgs = {
      projectId: selectedProjectId,
      companyId: filters?.companyId,
      departmentId: filters?.departmentId,
      positionId: filters?.positionId,
      shiftId: filters?.shiftId,
      person: filters?.person,
      employeeId: filters?.employeeId,
      // Even a daily report needs its day cell for scoped analysis / late minutes.
      viewMode: "matrix" as const,
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
    !projectLoading && projectId && canRead ? { ...getQueryArgs(projectId), projectId } : "skip",
  );

  const dateRangeLabel = () => {
    const range = filters?.dateRange;
    if (reportType === "custom" && range?.from && range?.to) {
      return `${format(range.from, "d MMM", { locale: tr })} – ${format(range.to, "d MMM yyyy", { locale: tr })}`;
    }
    if (reportType === "weekly") {
      const w = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const we = endOfWeek(selectedDate, { weekStartsOn: 1 });
      return `${format(w, "d MMM", { locale: tr })} – ${format(we, "d MMM yyyy", { locale: tr })}`;
    }
    if (reportType === "monthly") {
      return format(selectedDate, "MMMM yyyy", { locale: tr });
    }
    return format(selectedDate, "d MMMM yyyy", { locale: tr });
  };

  const args = getQueryArgs(projectId);
  const startDate = "startDate" in args ? args.startDate : args.date;
  const endDate = "endDate" in args ? args.endDate : args.date;

  return {
    tableData: tableData ?? [],
    allRecords: tableData ?? [],
    tableRecords: filterPdksRows(tableData ?? [], filters?.statusFilter),
    isLoading:
      projectLoading || (Boolean(projectId) && canRead && tableData === undefined),
    selectedDate,
    dateRangeLabel: dateRangeLabel(),
    isMatrix,
    startDate,
    endDate,
  };
};
