
import { Users } from "lucide-react";
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

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="glass-card flex items-center justify-between p-6">
        <Users className="h-8 w-8 text-burgundy opacity-75" />
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Toplam Personel</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
      </div>
      <div className="glass-card flex items-center justify-between p-6">
        <Users className="h-8 w-8 text-green-500 opacity-75" />
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Aktif Personel</p>
          <p className="text-2xl font-bold">{stats.active}</p>
        </div>
      </div>
      <div className="glass-card flex items-center justify-between p-6">
        <Users className="h-8 w-8 text-red-500 opacity-75" />
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Pasif Personel</p>
          <p className="text-2xl font-bold">{stats.inactive}</p>
        </div>
      </div>
    </div>
  );
}
