import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface PDKSRecord {
  id: string;
  employee_first_name: string;
  employee_last_name: string;
  date: string;
  entry_time: string;
  exit_time: string;
  status: string;
}

export function usePdksRecords() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const rawRecords = useQuery(api.cardReadings.list, {}) ?? [];

  const records: PDKSRecord[] = rawRecords.map((r: {
    _id: string;
    employeeFirstName?: string;
    employeeLastName?: string;
    readingDate?: string;
    readingTime?: string;
    exitTime?: string;
    status?: string;
  }) => ({
    id: r._id,
    employee_first_name: r.employeeFirstName ?? "",
    employee_last_name: r.employeeLastName ?? "",
    date: r.readingDate ?? "",
    entry_time: r.readingTime ?? "",
    exit_time: r.exitTime ?? "",
    status: r.status ?? "",
  }));

  const filteredRecords = records.filter((record) => {
    const fullName = `${record.employee_first_name} ${record.employee_last_name}`.toLowerCase();
    const matchesSearch = searchTerm === "" || fullName.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return {
    records,
    filteredRecords,
    loading: rawRecords === undefined,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    handleRefresh: () => {},
  };
}
