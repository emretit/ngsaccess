import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";

export const usePdksTableData = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const dateStr = selectedDate.toISOString().split("T")[0];

  const tableData = useQuery(
    api.cardReadings.getPdksTableData,
    !projectLoading ? { projectIds, isSuperAdmin, date: dateStr } : "skip"
  );

  return {
    tableData: tableData ?? [],
    isLoading: projectLoading || tableData === undefined,
    error: null,
    selectedDate,
    setSelectedDate,
    refetch: () => {},
  };
};
