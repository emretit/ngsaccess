import { TableStateRow } from "@/components/shared/TableStateRow";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function EngineeringDepartmentView() {
  const { projectId, loading: projectLoading } = useActiveProjectScope();
  const scope = !projectLoading && projectId ? { projectId } : "skip";
  const allDepartmentsData = useQuery(api.departments.list, scope);
  const allEmployeesData = useQuery(api.employees.list, scope);
  const loading =
    allDepartmentsData === undefined || allEmployeesData === undefined;
  const allDepartments = allDepartmentsData ?? [];
  const allEmployees = allEmployeesData ?? [];

  const engineeringDept = allDepartments.find(
    (d: { name: string }) => d.name === "Engineering",
  );
  const employees = engineeringDept
    ? allEmployees.filter(
        (e: { departmentId?: string }) =>
          e.departmentId === engineeringDept._id,
      )
    : [];

  if (projectLoading) return <p role="status">Yükleniyor</p>;
  if (!projectId)
    return <p>Engineering çalışanlarını görmek için proje seçin.</p>;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Engineering Departmanı Çalışanları</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Adı Soyadı</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Pozisyon</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableStateRow colSpan={3} state="loading" label="Yükleniyor" />
            ) : !engineeringDept ? (
              <TableStateRow colSpan={3} state="custom">
                <div className="text-destructive p-4">
                  Engineering departmanı sistemde kayıtlı değil
                </div>
              </TableStateRow>
            ) : employees.length === 0 ? (
              <TableStateRow
                colSpan={3}
                state="empty"
                title="Engineering departmanında çalışan bulunamadı"
              />
            ) : (
              employees.map(
                (employee: {
                  _id: string;
                  firstName?: string;
                  lastName?: string;
                  email?: string;
                  positionName?: string;
                }) => (
                  <TableRow key={employee._id}>
                    <TableCell>
                      {employee.firstName} {employee.lastName}
                    </TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.positionName ?? "-"}</TableCell>
                  </TableRow>
                ),
              )
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
