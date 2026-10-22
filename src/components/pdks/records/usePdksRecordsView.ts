import { usePermissions } from "@/hooks/usePermissions";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { todayInTurkey } from "@/lib/date";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { usePdksTableData } from "@/hooks/usePdksTableData";
import { usePdksFilterOptions } from "@/hooks/usePdksFilterOptions";
import type { FilterValues } from "@/components/pdks/dashboard/PDKSFilterBar";
import type { SmartPresetSelection } from "@/components/pdks/dashboard/PDKSSmartPresets";
import type { Id } from "../../../../convex/_generated/dataModel";
import { derivePdksRecordsView, type RecordsSelection, type RecordsDrilldown } from "./recordsView";
export function usePdksRecordsView(filters: FilterValues, setFilters: (values: FilterValues) => void) {
  const navigate = useNavigate();
  const { departments, companies, positions, shifts } = usePdksFilterOptions();
  const { projectId,
    activeProject,
    loading: projectLoading } = useActiveProject();
  const { can } = usePermissions();
  const canManage = can("attendance.approve");
  const [ai, setAi] = useState(false),
    [importOpen, setImport] = useState(false),
    [datesOpen, setDatesOpen] = useState(false),
    [analysis, setAnalysis] = useState(false),
    [warningsOpen, setWarningsOpen] = useState(false);
  const [rangeError, setRangeError] = useState("");
  const [smartPreset, setSmartPreset] = useState<SmartPresetSelection | null>(
    null,
  );
  const [selection, setSelection] = useState<RecordsSelection>({ scope: "", ids: new Set() });
  const [drilldown, setDrilldown] = useState<RecordsDrilldown>(null);
  const {
    tableRecords: rawRecords,
    allRecords: rawAllRecords,
    isLoading,
    selectedDate,
    dateRangeLabel,
    startDate,
    endDate,
  } = usePdksTableData(filters);
  const derived = derivePdksRecordsView({ projectId, filters, smartPreset, selection, drilldown, rawRecords, rawAllRecords, selectedDate, todayKey: todayInTurkey(), departments, companies, positions, shifts });
  const { scope } = derived;
  const [detailTrigger, setDetailTrigger] = useState<HTMLElement | null>(null);
  const openDetail = (employeeId: string, date: string) => {
    setDetailTrigger(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setDrilldown({ scope, employeeId: employeeId as Id<"employees">, date });
  };
  return { ...derived, filters, setFilters, navigate, projectId, activeProject, canManage, projectLoading, ai, setAi, importOpen, setImport, datesOpen, setDatesOpen, analysis, setAnalysis, warningsOpen, setWarningsOpen, rangeError, setRangeError, setSmartPreset, setSelection, setDrilldown, isLoading, selectedDate, dateRangeLabel, startDate, endDate, detailTrigger, openDetail };
}
export type PdksRecordsView = ReturnType<typeof usePdksRecordsView>;
