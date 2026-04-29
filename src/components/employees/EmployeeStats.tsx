
import { Users, UserCheck, UserX } from "lucide-react";
import { Employee } from "@/types/employee";
import { useMemo } from "react";

interface EmployeeStatsProps {
  employees: Employee[];
}

export function EmployeeStats({ employees }: EmployeeStatsProps) {
  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter(emp => emp.is_active).length,
    inactive: employees.filter(emp => !emp.is_active).length
  }), [employees]);

  const activeRate = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border bg-card shadow-xs px-4 py-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Toplam</p>
          <p className="text-xl font-bold tabular-nums leading-tight">{stats.total}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-xs px-4 py-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950">
          <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Aktif</p>
          <p className="text-xl font-bold tabular-nums leading-tight">{stats.active}</p>
          {stats.total > 0 && <p className="text-xs text-green-600 font-medium leading-none">%{activeRate}</p>}
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-xs px-4 py-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950">
          <UserX className="h-4 w-4 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Pasif</p>
          <p className="text-xl font-bold tabular-nums leading-tight">{stats.inactive}</p>
          {stats.total > 0 && <p className="text-xs text-red-500 font-medium leading-none">%{100 - activeRate}</p>}
        </div>
      </div>
    </div>
  );
}
