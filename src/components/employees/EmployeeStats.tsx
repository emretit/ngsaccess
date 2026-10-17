import type { Employee } from "@/types/employee";
import { StatInline } from "@/components/shared/StatInline";
export function EmployeeStats({
  employees,
  loading = false,
}: {
  employees: Employee[];
  loading?: boolean;
}) {
  const active = employees.filter((employee) => employee.isActive).length;
  return (
    <StatInline
      loading={loading}
      items={[
        { label: "Toplam", value: employees.length },
        { label: "Aktif", value: active },
        { label: "Pasif", value: employees.length - active },
      ]}
    />
  );
}
