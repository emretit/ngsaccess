import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import DepartmentTree from "@/components/departments/DepartmentTree";
import SlideOverPanel from "@/components/employees/SlideOverPanel";
import { Employee } from "@/types/employee";
import EmployeeTable from "@/components/employees/EmployeeTable";
import { EmployeeStats } from "@/components/employees/EmployeeStats";
import { EmployeeFilters } from "@/components/employees/EmployeeFilters";
import { EmployeePagination } from "@/components/employees/EmployeePagination";

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const employeeStats = useMemo(() => ({
    total: employees.length,
    active: employees.filter(emp => emp.is_active).length,
    inactive: employees.filter(emp => !emp.is_active).length
  }), [employees]);

  useEffect(() => {
    fetchEmployees();
  }, [selectedDepartment]);

  async function fetchEmployees() {
    try {
      let query = supabase
        .from('employees')
        .select(`
          *,
          departments (id, name),
          positions (id, name)
        `)
        .order('created_at', { ascending: false });

      if (selectedDepartment) {
        query = query.eq('department_id', selectedDepartment);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEmployees(data || []);
      setFilteredEmployees(data || []);
    } catch (err) {
      setError('Personel listesi alınırken bir hata oluştu');
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let filtered = employees;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(emp =>
        emp.first_name.toLowerCase().includes(query) ||
        emp.last_name.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query) ||
        emp.tc_no.includes(query) ||
        emp.card_number.includes(query)
      );
    }

    setFilteredEmployees(filtered);
    setCurrentPage(1);
  }, [employees, searchQuery]);

  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEmployees, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsPanelOpen(true);
  };

  const handleDeleteEmployee = (employee: Employee) => {
    if (window.confirm(`Personeli silmek istediğinize emin misiniz: ${employee.first_name} ${employee.last_name}?`)) {
      supabase
        .from('employees')
        .delete()
        .eq('id', employee.id)
        .then(() => {
          fetchEmployees();
        });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] gap-6 p-6">
      <DepartmentTree onSelectDepartment={setSelectedDepartment} />

      <div className="flex-1 space-y-6">
        <EmployeeFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={(value) => {
            setItemsPerPage(value);
            setCurrentPage(1);
          }}
          onNewEmployee={() => {
            setEditingEmployee(null);
            setIsPanelOpen(true);
          }}
        />

        <EmployeeStats employees={employees} />

        <div className="glass-card overflow-hidden">
          <EmployeeTable 
            employees={paginatedEmployees} 
            onEdit={handleEditEmployee} 
            onDelete={handleDeleteEmployee} 
          />
        </div>

        <EmployeePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />

        <SlideOverPanel
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          employee={editingEmployee}
          onSave={() => {
            fetchEmployees();
            setIsPanelOpen(false);
          }}
        />
      </div>
    </div>
  );
}
