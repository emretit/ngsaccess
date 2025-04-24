
import { useState } from 'react';
import { Employee } from '@/types/employee';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useEmployeeTable(employees: Employee[]) {
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Employee;
    direction: 'asc' | 'desc';
  } | null>(null);

  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
      
      setSelectedEmployees([]);
      setShowDeleteDialog(false);
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
      
      setSelectedEmployees([]);
      setSelectedDepartment("");
      window.location.reload();
    } catch (error) {
      toast({
        title: "Hata",
        description: "Departman güncellenirken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

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

  return {
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
  };
}
