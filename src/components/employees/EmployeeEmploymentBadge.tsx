import { StatusBadge } from "@/components/shared/StatusBadge";
import { trTodayKey } from "../../../convex/lib/trDate";
import type { EmploymentEmployee } from "./lib/employment";

export function EmployeeEmploymentBadge({ employee }: { employee: EmploymentEmployee }) {
  if (!employee.employmentEndDate) return <StatusBadge tone={employee.isActive ? "success" : "neutral"}>{employee.isActive ? "Aktif" : "Pasif"}</StatusBadge>;
  const [year, month, day] = employee.employmentEndDate.split("-");
  if (employee.terminationType === "transfer") return <StatusBadge tone="neutral">Taşındı · {day}.{month}.{year}</StatusBadge>;
  return <StatusBadge tone="neutral">{employee.employmentEndDate >= trTodayKey() ? "Ayrılacak" : "Ayrıldı"} · {day}.{month}.{year}</StatusBadge>;
}
