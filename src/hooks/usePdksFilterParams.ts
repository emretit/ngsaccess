import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  FilterValues,
  ReportType,
  StatusFilter,
} from "@/components/pdks/dashboard/PDKSFilterBar";
import type { Id, TableNames } from "../../convex/_generated/dataModel";
import { projectScopedPdksParams } from "@/components/pdks/lib/filterParams";
import { parseDateString, toLocalDateString } from "@/lib/date";

export const REPORT_TYPES: ReportType[] = [
  "daily",
  "weekly",
  "monthly",
  "custom",
];
export const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "present",
  "late",
  "absent",
  "leave",
  "overtime",
  "weekend",
  "holiday",
  "future",
  "noData",
];

/** Geçersiz biçim ve taşan tarihleri (2026-02-31) reddeder. */
function parseDate(s: string | null): Date | undefined {
  const d = parseDateString(s);
  return d && toLocalDateString(d) === s ? d : undefined;
}

export function usePdksFilterParams(defaults: FilterValues, projectId?: string): {
  filters: FilterValues;
  setFilters: (next: FilterValues) => void;
} {
  const [urlParams, setParams] = useSearchParams();
  const [previousProjectId, setPreviousProjectId] = useState(projectId);
  // Derive clean filters during render, before children can query the new project.
  const params = useMemo(
    () => projectScopedPdksParams(urlParams, previousProjectId, projectId),
    [urlParams, previousProjectId, projectId],
  );
  useEffect(() => {
    if (previousProjectId === projectId) return;
    if (params !== urlParams) setParams(params, { replace: true });
    setPreviousProjectId(projectId);
  }, [params, urlParams, previousProjectId, projectId, setParams]);

  const filters = useMemo<FilterValues>(() => {
    const reportRaw = params.get("report");
    const statusRaw = params.get("status");
    const getId = <T extends TableNames>(key: string) =>
      (params.get(key) ?? undefined) as Id<T> | undefined;
    return {
      anchorDate:
        parseDate(params.get("date")) ?? defaults.anchorDate ?? new Date(),
      dateRange: {
        from: parseDate(params.get("from")) ?? defaults.dateRange.from,
        to: parseDate(params.get("to")) ?? defaults.dateRange.to,
      },
      reportType: REPORT_TYPES.includes(reportRaw as ReportType)
        ? (reportRaw as ReportType)
        : defaults.reportType,
      companyId: getId<"companies">("company"),
      departmentId: getId<"departments">("dept"),
      positionId: getId<"positions">("pos"),
      shiftId: getId<"shifts">("shift"),
      statusFilter: STATUS_FILTERS.includes(statusRaw as StatusFilter)
        ? (statusRaw as StatusFilter)
        : defaults.statusFilter,
      person: params.get("person") ?? defaults.person,
    };
  }, [params, defaults]);

  const setFilters = useCallback(
    (next: FilterValues) => {
      const sp = new URLSearchParams(params);
      for (const key of [
        "date",
        "from",
        "to",
        "report",
        "company",
        "dept",
        "pos",
        "shift",
        "status",
        "person",
      ])
        sp.delete(key);
      const anchorKey = toLocalDateString(next.anchorDate ?? new Date());
      if (anchorKey !== toLocalDateString(new Date()))
        sp.set("date", anchorKey);
      if (next.dateRange.from)
        sp.set("from", toLocalDateString(next.dateRange.from));
      if (next.dateRange.to) sp.set("to", toLocalDateString(next.dateRange.to));
      if (next.reportType !== "daily") sp.set("report", next.reportType);
      if (next.companyId) sp.set("company", next.companyId);
      if (next.departmentId) sp.set("dept", next.departmentId);
      if (next.positionId) sp.set("pos", next.positionId);
      if (next.shiftId) sp.set("shift", next.shiftId);
      if (next.statusFilter !== "all") sp.set("status", next.statusFilter);
      if (next.person) sp.set("person", next.person);
      setParams(sp, { replace: true });
    },
    [params, setParams],
  );

  return { filters, setFilters };
}
