import { useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useActiveProjectScope } from "./useActiveProjectScope";
import { toLocalDateString } from "@/lib/date";
import { useDebouncedValue } from "./useDebouncedValue";

export const useCardReadings = (pageSize: number = 100) => {
  const { projectId, loading: projectLoading } = useActiveProjectScope();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [endDateFilter, setEndDateFilter] = useState<Date | undefined>();
  const [deviceId, setDeviceId] = useState<Id<"devices"> | undefined>();
  const [accessFilter, setAccessFilter] = useState<"all" | "granted" | "denied">("all");
  const devices = useQuery(api.devices.list, !projectLoading && projectId ? { projectId } : "skip");
  // Proje değiştiğinde önceki projenin okuyucusu sorguya taşınmaz.
  const selectedDeviceId = devices?.some(device => device._id === deviceId) ? deviceId : undefined;
  const startDate = dateFilter ? toLocalDateString(dateFilter) : undefined;
  const endDate = endDateFilter ? toLocalDateString(endDateFilter) : startDate;
  const dateRangeError = startDate && endDate && startDate > endDate ? "Bitiş tarihi başlangıçtan önce olamaz." : null;
  const { results, status, loadMore } = usePaginatedQuery(
    api.cardReadings.list,
    !projectLoading && projectId && !dateRangeError
      ? { projectId, deviceId: selectedDeviceId, startDate, endDate, accessFilter }
      : "skip",
    { initialNumItems: pageSize },
  );
  const term = debouncedSearchTerm.trim().toLocaleLowerCase("tr-TR");
  const readings = term ? results.filter(reading =>
    reading.employeeName?.toLocaleLowerCase("tr-TR").includes(term) || reading.cardNo.toLocaleLowerCase("tr-TR").includes(term),
  ) : results;

  return {
    data: { readings, loadedCount: results.length },
    isLoading: projectLoading || (!!projectId && !dateRangeError && status === "LoadingFirstPage"),
    hasProject: !!projectId,
    dateRangeError,
    hasMore: status === "CanLoadMore" || status === "LoadingMore",
    isLoadingMore: status === "LoadingMore",
    loadMore: () => { if (status === "CanLoadMore") loadMore(pageSize); },
    searchTerm, setSearchTerm, dateFilter, setDateFilter, endDateFilter, setEndDateFilter,
    accessFilter, setAccessFilter, deviceId: selectedDeviceId, setDeviceId, devices: devices ?? [],
  };
};
