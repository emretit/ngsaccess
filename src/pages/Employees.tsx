
import { useState, useMemo, useEffect } from "react";
import DepartmentTree from "@/components/departments/DepartmentTree";
import SlideOverPanel from "@/components/employees/SlideOverPanel";
import { Employee } from "@/types/employee";
import EmployeeTable from "@/components/employees/EmployeeTable";
import { EmployeeStats } from "@/components/employees/EmployeeStats";
import { EmployeeFilters } from "@/components/employees/EmployeeFilters";
import { EmployeePagination } from "@/components/employees/EmployeePagination";
import { useEmployees } from "@/hooks/useEmployees";

export default function Employees() {
  const { employees, isLoading, error, refetch, hasProjectAccess } = useEmployees();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState(false);

  const employeeStats = useMemo(() => ({
    total: employees.length,
    active: employees.filter(emp => emp.is_active).length,
    inactive: employees.filter(emp => !emp.is_active).length
  }), [employees]);

  // Filtreleme işlemini useMemo ile optimize et
  const filteredEmployees = useMemo(() => {
    let filtered = employees;

    if (selectedDepartment) {
      filtered = filtered.filter(emp => emp.department_id === selectedDepartment);
    }

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

    return filtered;
  }, [employees, searchQuery, selectedDepartment]);

  // Sayfalama için useMemo kullan
  const paginatedEmployees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEmployees, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

  // Filtreleme değiştiğinde sayfa numarasını sıfırla
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDepartment]);

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setViewMode(false);
    setIsPanelOpen(true);
  };

  const handleViewEmployeeDetails = (employee: Employee) => {
    setEditingEmployee(employee);
    setViewMode(true);
    setIsPanelOpen(true);
  };

  const handleDeleteEmployee = (employee: Employee) => {
    console.log('Delete employee:', employee);
  };

  const handleSaveEmployee = (savedEmployee: Employee) => {
    console.log('Employee saved:', savedEmployee);
    
    if (viewMode) {
      // If in view mode, just switch to edit mode
      setViewMode(false);
    } else {
      // If editing/creating, refresh data and close panel
      refetch();
      setIsPanelOpen(false);
      setEditingEmployee(null);
    }
  };

  const handleNewEmployee = () => {
    console.log('Creating new employee');
    setEditingEmployee(null);
    setViewMode(false);
    setIsPanelOpen(true);
  };

  if (!hasProjectAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">🔒</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Proje Erişimi Yok</h3>
            <p className="text-gray-600 mt-2">
              Bu sayfaya erişim için size atanmış bir proje bulunmuyor. 
              Lütfen sistem yöneticinizle iletişime geçin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-red-500">{error.toString()}</div>
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
          onNewEmployee={handleNewEmployee}
        />

        <EmployeeStats employees={employees} />

        <div className="glass-card overflow-hidden">
          <EmployeeTable 
            employees={paginatedEmployees} 
            onEdit={handleEditEmployee} 
            onDelete={handleDeleteEmployee}
            onViewDetails={handleViewEmployeeDetails}
            onRefresh={refetch}
          />
        </div>

        <EmployeePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />

        <SlideOverPanel
          isOpen={isPanelOpen}
          onClose={() => {
            setIsPanelOpen(false);
            setEditingEmployee(null);
            setViewMode(false);
          }}
          employee={editingEmployee}
          viewMode={viewMode}
          onSave={handleSaveEmployee}
        />
      </div>
    </div>
  );
}
