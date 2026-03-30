import { useState, useMemo, useEffect } from "react";
import DepartmentTree from "@/components/departments/DepartmentTree";
import SlideOverPanel from "@/components/employees/SlideOverPanel";
import { Employee } from "@/types/employee";
import EmployeeTable from "@/components/employees/EmployeeTable";
import { EmployeeStats } from "@/components/employees/EmployeeStats";
import { EmployeeFilters } from "@/components/employees/EmployeeFilters";
import { EmployeePagination } from "@/components/employees/EmployeePagination";
import { useEmployees } from "@/hooks/useEmployees";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AccessDenied } from "@/components/shared/AccessDenied";

export default function Employees() {
  const { loading: projectLoading } = useProjectAccess();
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
      filtered = filtered.filter(emp => String(emp.department_id ?? emp.departmentId) === String(selectedDepartment));
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

  // Loading durumunda (hem project hem employees loading) loading göster
  if (projectLoading || isLoading) {
    return <LoadingSpinner text="Personel bilgileri yükleniyor..." />;
  }

  // Proje erişimi yoksa ve loading de tamamlandıysa mesaj göster
  if (!projectLoading && !isLoading && !hasProjectAccess) {
    return <AccessDenied />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-red-500">{error.toString()}</div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 min-h-full">
      <DepartmentTree onSelectDepartment={setSelectedDepartment} />

      <div className="flex-1 min-w-0 space-y-3">
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

        <div className="rounded-xl border bg-card shadow-sm">
          <EmployeeTable
            employees={paginatedEmployees}
            onEdit={handleEditEmployee}
            onDelete={handleDeleteEmployee}
            onViewDetails={handleViewEmployeeDetails}
            onRefresh={refetch}
          />
        </div>

        {totalPages > 1 && (
          <EmployeePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}

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
