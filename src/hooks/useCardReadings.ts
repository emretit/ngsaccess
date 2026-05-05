import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "./useProjectAccess";

export const useCardReadings = (pageSize: number = 100) => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [accessFilter, setAccessFilter] = useState<"all" | "granted" | "denied">("all");

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, accessFilter]);

  const result = useQuery(
    api.cardReadings.list,
    !projectLoading
      ? {
          projectIds,
          isSuperAdmin,
          page: currentPage,
          pageSize,
          searchTerm: searchTerm || undefined,
          dateFilter: dateFilter
            ? dateFilter.toISOString().split("T")[0]
            : undefined,
          accessFilter,
        }
      : "skip"
  );

  const readings = result?.readings ?? [];
  const totalCount = result?.totalCount ?? 0;

  return {
    data: { readings, totalCount },
    isLoading: projectLoading || result === undefined,
    error: null,
    refetch: () => {},
    currentPage,
    setCurrentPage,
    searchTerm,
    setSearchTerm,
    dateFilter,
    setDateFilter,
    accessFilter,
    setAccessFilter,
    autoRefresh: false,
    setAutoRefresh: (_: boolean) => {},
    refreshInterval: 30000,
    setRefreshInterval: (_: number) => {},
    totalPages: Math.ceil(totalCount / pageSize),
  };
};
