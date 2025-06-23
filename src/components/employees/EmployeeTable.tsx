
'use client';

import { Employee } from '@/types/employee';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Mail } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useEmployeeTable } from '@/hooks/useEmployeeTable';
import { EmployeeBulkActions } from './EmployeeBulkActions';
import { EmployeeDeleteDialog } from './EmployeeDeleteDialog';
import { EmployeePasswordResetDialog } from './EmployeePasswordResetDialog';
import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
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
  } = useEmployeeTable(employees);

  const handlePasswordResetClick = (employee: Employee) => {
    setSelectedEmployeeForReset(employee);
    setShowPasswordResetDialog(true);
  };

  const handleIndividualDeleteClick = (employee: Employee) => {
    setSelectedEmployeeForDelete(employee);
    setShowIndividualDeleteDialog(true);
  };

  const handleIndividualDeleteConfirm = async () => {
    if (!selectedEmployeeForDelete) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', selectedEmployeeForDelete.id);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Personel silindi",
      });
      
      setShowIndividualDeleteDialog(false);
      setSelectedEmployeeForDelete(null);
      onRefresh?.();
    } catch (error) {
      toast({
        title: "Hata",
        description: "Personel silinirken bir hata oluştu",
        variant: "destructive",
      });
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

      <div className="rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-white border-b-2 border-gray-200">
            <TableRow>
              <TableHead className="w-[50px] bg-gray-50 font-semibold">
                <Checkbox
                  checked={selectedEmployees.length === employees.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="bg-gray-50 font-semibold">Fotoğraf</TableHead>
              <TableHead onClick={() => requestSort('first_name')} className="cursor-pointer bg-gray-50 font-semibold">
                Ad Soyad
              </TableHead>
              <TableHead onClick={() => requestSort('email')} className="cursor-pointer bg-gray-50 font-semibold">
                E-posta
              </TableHead>
              <TableHead onClick={() => requestSort('department_id')} className="cursor-pointer bg-gray-50 font-semibold">
                Departman
              </TableHead>
              <TableHead onClick={() => requestSort('position_id')} className="cursor-pointer bg-gray-50 font-semibold">
                Pozisyon
              </TableHead>
              <TableHead onClick={() => requestSort('card_number')} className="cursor-pointer bg-gray-50 font-semibold">
                Kart No
              </TableHead>
              <TableHead onClick={() => requestSort('is_active')} className="cursor-pointer bg-gray-50 font-semibold">
                Durum
              </TableHead>
              <TableHead className="text-right bg-gray-50 font-semibold">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEmployees.map(employee => (
              <TableRow 
                key={employee.id}
                className="cursor-pointer"
                onClick={(e) => {
                  // Prevent row click when clicking on checkbox or buttons
                  if ((e.target as HTMLElement).closest('button, input[type="checkbox"]')) return;
                  onEdit(employee);
                }}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedEmployees.includes(employee.id)}
                    onCheckedChange={(checked) => handleSelectEmployee(checked as boolean, employee.id)}
                  />
                </TableCell>
                <TableCell>
                  <Avatar>
                    <AvatarImage src={employee.photo_url || ''} alt={`${employee.first_name} ${employee.last_name}`} />
                    <AvatarFallback>{employee.first_name?.[0]}{employee.last_name?.[0]}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>{employee.first_name} {employee.last_name}</TableCell>
                <TableCell>{employee.email}</TableCell>
                <TableCell>{employee.departments?.name}</TableCell>
                <TableCell>{employee.positions?.name}</TableCell>
                <TableCell>{employee.card_number}</TableCell>
                <TableCell>
                  <Badge variant={employee.is_active ? "success" : "secondary"}>
                    {employee.is_active ? 'Aktif' : 'Pasif'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePasswordResetClick(employee)}
                      className="h-8 w-8"
                      title="Şifre Sıfırlama Maili Gönder"
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(employee)}
                      className="h-8 w-8"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleIndividualDeleteClick(employee)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
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
