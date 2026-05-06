import { useState, useMemo, useEffect } from "react";
import type { Id } from "../../convex/_generated/dataModel";
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
  const [selectedDepartment, setSelectedDepartment] = useState<Id<"departments"> | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState(false);

  // Filtreleme işlemini useMemo ile optimize et
  const filteredEmployees = useMemo(() => {
    let filtered = employees;

    if (selectedDepartment) {
      filtered = filtered.filter(emp => String(emp.departmentId) === String(selectedDepartment));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(emp =>
        emp.firstName.toLowerCase().includes(query) ||
        emp.lastName.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query) ||
        (emp.tcNo ?? '').includes(query) ||
        emp.cardNumber.includes(query)
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

  const handleDeleteEmployee = (_employee: Employee) => {
    // Bireysel silme akışı EmployeeTable içinde dialog ile yönetiliyor.
  };

  const handleSaveEmployee = (_savedEmployee?: unknown) => {
    if (viewMode) {
      setViewMode(false);
      return;
    }
    refetch();
    setIsPanelOpen(false);
    setEditingEmployee(null);
  };

  const handleNewEmployee = () => {
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
        <div className="text-red-500">{String(error)}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 min-h-full">
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

        <div className="rounded-xl border bg-card shadow-xs">
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
