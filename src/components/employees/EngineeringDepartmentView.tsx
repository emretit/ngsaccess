import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function EngineeringDepartmentView() {
  const allDepartments = useQuery(api.departments.list) ?? [];
  const allEmployees = useQuery(api.employees.list) ?? [];

  const engineeringDept = allDepartments.find((d: { name: string }) => d.name === "Engineering");
  const employees = engineeringDept
    ? allEmployees.filter((e: { departmentId?: string }) => e.departmentId === engineeringDept._id)
    : [];

  const loading = allDepartments === undefined || allEmployees === undefined;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Engineering Departmanı Çalışanları</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : !engineeringDept ? (
          <div className="text-red-500 p-4">Engineering departmanı sistemde kayıtlı değil</div>
        ) : employees.length === 0 ? (
          <div className="text-center p-4">Engineering departmanında çalışan bulunamadı</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adı Soyadı</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Pozisyon</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee: { _id: string; firstName?: string; lastName?: string; email?: string; positionName?: string }) => (
                <TableRow key={employee._id}>
                  <TableCell>{employee.firstName} {employee.lastName}</TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>{employee.positionName ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
