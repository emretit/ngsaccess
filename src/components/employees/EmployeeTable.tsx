// @ts-nocheck

'use client';

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { Employee } from "@/types/employee";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Mail, Upload, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useEmployeeTable } from "@/hooks/useEmployeeTable";
import { EmployeeBulkActions } from "./EmployeeBulkActions";
import { EmployeeDeleteDialog } from "./EmployeeDeleteDialog";
import { EmployeePasswordResetDialog } from "./EmployeePasswordResetDialog";
import { toast } from "@/hooks/use-toast";

interface EmployeeTableProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onViewDetails: (employee: Employee) => void;
  onRefresh?: () => void;
}

export default function EmployeeTable({ 
  employees, 
  onEdit, 
  onDelete,
  onViewDetails,
  onRefresh 
}: EmployeeTableProps) {
  const [selectedEmployeeForReset, setSelectedEmployeeForReset] = useState<Employee | null>(null);
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState(false);
  const [showIndividualDeleteDialog, setShowIndividualDeleteDialog] = useState(false);
  const [selectedEmployeeForDelete, setSelectedEmployeeForDelete] = useState<Employee | null>(null);
  
  const {
    sortedEmployees,
    selectedEmployees,
    selectedDepartment,
    showDeleteDialog,
    setShowDeleteDialog,
    setSelectedDepartment,
    handleSelectAll,
    handleSelectEmployee,
    handleBulkDelete: originalHandleBulkDelete,
    handleBulkDepartmentUpdate: originalHandleBulkDepartmentUpdate,
    requestSort
  } = useEmployeeTable(employees as any);

  const handlePasswordResetClick = (employee: Employee) => {
    setSelectedEmployeeForReset(employee);
    setShowPasswordResetDialog(true);
  };

  const handleIndividualDeleteClick = (employee: Employee) => {
    setSelectedEmployeeForDelete(employee);
    setShowIndividualDeleteDialog(true);
  };

  const removeEmployee = useMutation(api.employees.remove);

  const handleIndividualDeleteConfirm = async () => {
    if (!selectedEmployeeForDelete) return;
    try {
      const empId = (selectedEmployeeForDelete._id || selectedEmployeeForDelete.id) as unknown as Id<"employees">;
      await removeEmployee({ employeeId: empId });
      toast({ title: "Başarılı", description: "Personel silindi" });
      setShowIndividualDeleteDialog(false);
      setSelectedEmployeeForDelete(null);
      onRefresh?.();
    } catch {
      toast({ title: "Hata", description: "Personel silinirken bir hata oluştu", variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    await originalHandleBulkDelete();
    onRefresh?.();
  };

  const handleBulkDepartmentUpdate = async () => {
    await originalHandleBulkDepartmentUpdate();
    onRefresh?.();
  };

  return (
    <div className="space-y-4">
      {selectedEmployees.length > 0 && (
        <EmployeeBulkActions
          selectedCount={selectedEmployees.length}
          departments={Array.from(new Set(employees.map(emp => emp.departments)))}
          selectedDepartment={selectedDepartment}
          onDepartmentChange={setSelectedDepartment}
          onUpdateDepartment={handleBulkDepartmentUpdate}
          onDelete={() => setShowDeleteDialog(true)}
        />
      )}

      <div className="overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[50px] font-semibold text-foreground">
                <Checkbox
                  checked={selectedEmployees.length === employees.length && employees.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="font-semibold text-foreground w-[56px]">Foto</TableHead>
              <TableHead onClick={() => requestSort('first_name' as any)} className="cursor-pointer font-semibold text-foreground select-none hover:text-primary transition-colors">
                Ad Soyad
              </TableHead>
              <TableHead onClick={() => requestSort('email' as any)} className="cursor-pointer font-semibold text-foreground select-none hover:text-primary transition-colors">
                E-posta
              </TableHead>
              <TableHead onClick={() => requestSort('department_id' as any)} className="cursor-pointer font-semibold text-foreground select-none hover:text-primary transition-colors">
                Departman
              </TableHead>
              <TableHead onClick={() => requestSort('position_id' as any)} className="cursor-pointer font-semibold text-foreground select-none hover:text-primary transition-colors">
                Pozisyon
              </TableHead>
              <TableHead onClick={() => requestSort('card_number' as any)} className="cursor-pointer font-semibold text-foreground select-none hover:text-primary transition-colors">
                Kart No
              </TableHead>
              <TableHead onClick={() => requestSort('is_active' as any)} className="cursor-pointer font-semibold text-foreground select-none hover:text-primary transition-colors">
                Durum
              </TableHead>
              <TableHead className="text-right font-semibold text-foreground">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-muted-foreground text-sm">
                  Personel bulunamadı.
                </TableCell>
              </TableRow>
            ) : sortedEmployees.map((employee: any) => (
              <TableRow
                key={employee._id || employee.id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button, input[type="checkbox"]')) return;
                  onEdit(employee);
                }}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedEmployees.includes(employee._id || employee.id)}
                    onCheckedChange={(checked) => handleSelectEmployee(checked as boolean, employee._id || employee.id)}
                  />
                </TableCell>
                <TableCell>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={employee.photo_url || employee.photoUrl || ''} alt={`${employee.first_name || employee.firstName} ${employee.last_name || employee.lastName}`} />
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {(employee.first_name || employee.firstName)?.[0]}{(employee.last_name || employee.lastName)?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-medium">{employee.first_name || employee.firstName} {employee.last_name || employee.lastName}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{employee.email}</TableCell>
                <TableCell>
                  {employee.departments?.name ? (
                    <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                      {employee.departments.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {employee.positions?.name ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="font-mono text-sm">{employee.card_number || employee.cardNumber || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <Badge variant={(employee.is_active ?? employee.isActive) ? "success" : "secondary"} className="text-xs">
                    {(employee.is_active ?? employee.isActive) ? 'Aktif' : 'Pasif'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePasswordResetClick(employee)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Şifre Sıfırlama Maili Gönder"
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(employee)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleIndividualDeleteClick(employee)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EmployeeDeleteDialog
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        selectedCount={selectedEmployees.length}
        onConfirm={handleBulkDelete}
      />

      <EmployeeDeleteDialog
        isOpen={showIndividualDeleteDialog}
        onOpenChange={setShowIndividualDeleteDialog}
        selectedCount={1}
        onConfirm={handleIndividualDeleteConfirm}
      />

      <EmployeePasswordResetDialog
        isOpen={showPasswordResetDialog}
        onOpenChange={setShowPasswordResetDialog}
        employee={selectedEmployeeForReset}
      />
    </div>
  );
}
