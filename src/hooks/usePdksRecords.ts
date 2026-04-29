import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface PDKSRecord {
  _id: string;
  employeeFirstName: string;
  employeeLastName: string;
  date: string;
  entryTime: string;
  exitTime: string;
  status: string;
}

interface CardReadingRow {
  _id: string;
  employeeName?: string;
  accessTime?: string;
  status?: string;
}

export function usePdksRecords() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const result = useQuery(api.cardReadings.list, {});
  const rawRecords: CardReadingRow[] = (
    Array.isArray(result)
      ? (result as CardReadingRow[])
      : ((result as { readings?: CardReadingRow[] } | undefined)?.readings ?? [])
  );

  const records: PDKSRecord[] = rawRecords.map((r) => {
    const nameParts = (r.employeeName ?? "").split(" ");
    const lastName = nameParts.length > 1 ? nameParts.pop()! : "";
    const firstName = nameParts.join(" ");
    const date = r.accessTime ? r.accessTime.split("T")[0] : "";
    const time = r.accessTime
      ? new Date(r.accessTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
      : "";
    return {
      _id: r._id,
      employeeFirstName: firstName,
      employeeLastName: lastName,
      date,
      entryTime: time,
      exitTime: "",
      status: r.status ?? "",
    };
  });

  const filteredRecords = records.filter((record) => {
    const fullName = `${record.employeeFirstName} ${record.employeeLastName}`.toLowerCase();
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
