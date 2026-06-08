import { Users, UserCheck, UserX } from "lucide-react";
import { Employee } from "@/types/employee";
import { useMemo } from "react";
import { StatCard } from "@/components/shared/StatCard";

interface EmployeeStatsProps {
  employees: Employee[];
}

export function EmployeeStats({ employees }: EmployeeStatsProps) {
  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter(emp => emp.isActive).length,
    inactive: employees.filter(emp => !emp.isActive).length,
  }), [employees]);

  const activeRate = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard label="Toplam"  value={stats.total}    Icon={Users}      tone="info" />
      <StatCard label="Aktif"   value={stats.active}   Icon={UserCheck}  tone="success"
        meta={stats.total > 0 ? `%${activeRate}` : undefined} />
      <StatCard label="Pasif"   value={stats.inactive} Icon={UserX}      tone="danger"
        meta={stats.total > 0 ? `%${100 - activeRate}` : undefined} />
    </div>
  );
}
