
'use client';

import { useState } from 'react';
import { Employee } from '@/types/employee';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EmployeeTableProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

export default function EmployeeTable({ employees, onEdit, onDelete }: EmployeeTableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Employee;
    direction: 'asc' | 'desc';
  } | null>(null);

  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");

  // Add the missing requestSort function
  const requestSort = (key: keyof Employee) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key, direction });
  };

  const sortedEmployees = [...employees].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal === null || bVal === null) return 0;
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployees(employees.map(emp => emp.id));
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleSelectEmployee = (checked: boolean, employeeId: number) => {
    if (checked) {
      setSelectedEmployees([...selectedEmployees, employeeId]);
    } else {
      setSelectedEmployees(selectedEmployees.filter(id => id !== employeeId));
    }
  };

  const handleBulkDelete = async () => {
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .in('id', selectedEmployees);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Seçili personeller silindi",
      });
      
      // Clear selection after successful deletion
      setSelectedEmployees([]);
      setShowDeleteDialog(false);
      
      // Refresh the page to update the list
      window.location.reload();
    } catch (error) {
      toast({
        title: "Hata",
        description: "Personeller silinirken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  const handleBulkDepartmentUpdate = async () => {
    if (!selectedDepartment || selectedEmployees.length === 0) return;

    try {
      const { error } = await supabase
        .from('employees')
        .update({ department_id: parseInt(selectedDepartment) })
        .in('id', selectedEmployees);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Departman güncellendi",
      });
      
      // Clear selection after successful update
      setSelectedEmployees([]);
      setSelectedDepartment("");
      
      // Refresh the page to update the list
      window.location.reload();
    } catch (error) {
      toast({
        title: "Hata",
        description: "Departman güncellenirken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {selectedEmployees.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selectedEmployees.length} personel seçildi</span>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Departman seç" />
            </SelectTrigger>
            <SelectContent>
              {Array.from(new Set(employees.map(emp => emp.departments))).map(dept => (
                dept && <SelectItem key={dept.id} value={dept.id.toString()}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            onClick={handleBulkDepartmentUpdate}
            disabled={!selectedDepartment}
          >
            Departmanı Güncelle
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            Seçilenleri Sil
          </Button>
        </div>
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Seçili personelleri silmek istediğinize emin misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz. Seçili {selectedEmployees.length} personel kalıcı olarak silinecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
