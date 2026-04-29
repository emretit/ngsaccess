
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
  const [syncingEmployeeId, setSyncingEmployeeId] = useState<string | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  const syncEmployeeToDevices = useAction(api.actions.hikvisionSync.syncEmployeeToDevices);

  const handleSyncToDevice = async (employee: Employee) => {
    const empId = employee._id;
    setSyncingEmployeeId(empId);
    try {
      const result = await syncEmployeeToDevices({ employeeId: empId });
      if (result.synced > 0) {
        toast({
          title: "Senkronizasyon Başarılı",
          description: `${employee.firstName} ${employee.lastName} — ${result.synced} cihaza gönderildi.`,
        });
      } else if (result.errors.length > 0) {
        toast({
          title: "Senkronizasyon Hatası",
          description: result.errors.join(", "),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Bilgi",
          description: "Bu çalışanın bağlı olduğu cihaz veya kart numarası bulunamadı.",
        });
      }
    } catch (err) {
      toast({
        title: "Hata",
        description: (err as Error).message || "Senkronizasyon sırasında bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setSyncingEmployeeId(null);
    }
  };

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
  } = useEmployeeTable(employees);

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
      await removeEmployee({ employeeId: selectedEmployeeForDelete._id });
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

  const handleBulkSyncToDevices = async () => {
    setIsBulkSyncing(true);
    let totalSynced = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];

    for (const empId of selectedEmployees) {
      try {
        const result = await syncEmployeeToDevices({ employeeId: empId as Id<"employees"> });
        totalSynced += result.synced;
        totalFailed += result.failed;
        allErrors.push(...result.errors);
      } catch (err) {
        totalFailed++;
        allErrors.push((err as Error).message);
      }
    }

    setIsBulkSyncing(false);

    if (totalSynced > 0) {
      toast({
        title: "Toplu Senkronizasyon Tamamlandı",
        description: `${totalSynced} cihaza gönderildi${totalFailed > 0 ? `, ${totalFailed} hata` : ""}.`,
      });
    } else if (allErrors.length > 0) {
      toast({
        title: "Senkronizasyon Hatası",
        description: allErrors.slice(0, 3).join("; "),
        variant: "destructive",
      });
    } else {
      toast({ title: "Bilgi", description: "Seçili çalışanlar için bağlı cihaz bulunamadı." });
    }
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
          onSyncToDevices={handleBulkSyncToDevices}
          isSyncing={isBulkSyncing}
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
              <TableHead onClick={() => requestSort('firstName')} className="cursor-pointer font-semibold text-foreground select-none hover:text-primary transition-colors">
                Ad Soyad
              </TableHead>
              <TableHead onClick={() => requestSort('email')} className="cursor-pointer font-semibold text-foreground select-none hover:text-primary transition-colors">
                E-posta
              </TableHead>
              <TableHead onClick={() => requestSort('departmentId')} className="cursor-pointer font-semibold text-foreground select-none hover:text-primary transition-colors">
                Departman
              </TableHead>
              <TableHead onClick={() => requestSort('positionId')} className="cursor-pointer font-semibold text-foreground select-none hover:text-primary transition-colors">
                Pozisyon
              </TableHead>
              <TableHead onClick={() => requestSort('cardNumber')} className="cursor-pointer font-semibold text-foreground select-none hover:text-primary transition-colors">
                Kart No
              </TableHead>
              <TableHead onClick={() => requestSort('isActive')} className="cursor-pointer font-semibold text-foreground select-none hover:text-primary transition-colors">
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
            ) : sortedEmployees.map((employee: Employee) => (
              <TableRow
                key={employee._id}
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button, input[type="checkbox"]')) return;
                  onEdit(employee);
                }}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedEmployees.includes(employee._id)}
                    onCheckedChange={(checked) => handleSelectEmployee(checked as boolean, employee._id)}
                  />
                </TableCell>
                <TableCell>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={employee.photoUrl || ''} alt={`${employee.firstName} ${employee.lastName}`} />
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {employee.firstName?.[0]}{employee.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-medium">{employee.firstName} {employee.lastName}</TableCell>
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
                <TableCell className="font-mono text-sm">{employee.cardNumber || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <Badge variant={employee.isActive ? "success" : "secondary"} className="text-xs">
                    {employee.isActive ? 'Aktif' : 'Pasif'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSyncToDevice(employee)}
                      disabled={syncingEmployeeId === employee._id}
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      title="Cihaza Senkronize Et"
                    >
                      {syncingEmployeeId === employee._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </Button>
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
