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

  const result = useQuery(api.cardReadings.list, {});
  const rawRecords: { _id: string; employeeName?: string; accessTime?: string; status?: string; }[] =
    ((Array.isArray(result) ? result : (result as any)?.readings) ?? []) as any[];

  const records: PDKSRecord[] = rawRecords.map((r: {
    _id: string;
    employeeName?: string;
    accessTime?: string;
    status?: string;
  }) => {
    const nameParts = (r.employeeName ?? "").split(" ");
    const lastName = nameParts.length > 1 ? nameParts.pop()! : "";
    const firstName = nameParts.join(" ");
    const date = r.accessTime ? r.accessTime.split("T")[0] : "";
    const time = r.accessTime
      ? new Date(r.accessTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
      : "";
    return {
      id: r._id,
      employee_first_name: firstName,
      employee_last_name: lastName,
      date,
      entry_time: time,
      exit_time: "",
      status: r.status ?? "",
    };
  });

  const filteredRecords = records.filter((record) => {
    const fullName = `${record.employee_first_name} ${record.employee_last_name}`.toLowerCase();
    const matchesSearch = searchTerm === "" || fullName.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return {
    records,
    filteredRecords,
    loading: result === undefined,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    handleRefresh: () => {},
  };
}
