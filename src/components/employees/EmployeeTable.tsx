'use client';

import { useState } from 'react';
import { Employee } from '@/types/employee';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useEmployeeTable } from '@/hooks/useEmployeeTable';
import { EmployeeBulkActions } from './EmployeeBulkActions';
import { EmployeeDeleteDialog } from './EmployeeDeleteDialog';

interface EmployeeTableProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

export default function EmployeeTable({ employees, onEdit, onDelete }: EmployeeTableProps) {
  const {
    sortedEmployees,
    selectedEmployees,
    selectedDepartment,
    showDeleteDialog,
    setShowDeleteDialog,
    setSelectedDepartment,
    handleSelectAll,
    handleSelectEmployee,
    handleBulkDelete,
    handleBulkDepartmentUpdate,
    requestSort
  } = useEmployeeTable(employees);

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
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedEmployees.length === employees.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Fotoğraf</TableHead>
              <TableHead onClick={() => requestSort('first_name')} className="cursor-pointer">
                Ad Soyad
              </TableHead>
              <TableHead onClick={() => requestSort('email')} className="cursor-pointer">
                E-posta
              </TableHead>
              <TableHead onClick={() => requestSort('department_id')} className="cursor-pointer">
                Departman
              </TableHead>
              <TableHead onClick={() => requestSort('position_id')} className="cursor-pointer">
                Pozisyon
              </TableHead>
              <TableHead onClick={() => requestSort('card_number')} className="cursor-pointer">
                Kart No
              </TableHead>
              <TableHead onClick={() => requestSort('is_active')} className="cursor-pointer">
                Durum
              </TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEmployees.map(employee => (
              <TableRow key={employee.id}>
                <TableCell>
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
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(employee)}
                    className="mr-2"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(employee)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
    </div>
  );
}
