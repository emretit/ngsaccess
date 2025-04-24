import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DepartmentTree from "@/components/departments/DepartmentTree";
import SlideOverPanel from "@/components/employees/SlideOverPanel";
import { Employee } from "@/types/employee";
import EmployeeTable from "@/components/employees/EmployeeTable";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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

  const PAGE_SIZE_OPTIONS = [10, 50, 100];
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
    // Single employee delete functionality
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Personel Listesi</h1>
          <div className="flex gap-4">
            {/* Existing search input */}
            <Input
              type="search"
              placeholder="Personel ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />

            {/* Page size selector */}
            <Select 
              value={String(itemsPerPage)} 
              onValueChange={(value) => {
                setItemsPerPage(Number(value));
                setCurrentPage(1); // Reset to first page when changing page size
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Sayfa Boyutu" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} Kayıt
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => {
                setEditingEmployee(null);
                setIsPanelOpen(true);
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Yeni Personel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card flex items-center justify-between p-6">
            <Users className="h-8 w-8 text-burgundy opacity-75" />
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Toplam Personel</p>
              <p className="text-2xl font-bold">{employeeStats.total}</p>
            </div>
          </div>
          <div className="glass-card flex items-center justify-between p-6">
            <Users className="h-8 w-8 text-green-500 opacity-75" />
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Aktif Personel</p>
              <p className="text-2xl font-bold">{employeeStats.active}</p>
            </div>
          </div>
          <div className="glass-card flex items-center justify-between p-6">
            <Users className="h-8 w-8 text-red-500 opacity-75" />
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Pasif Personel</p>
              <p className="text-2xl font-bold">{employeeStats.inactive}</p>
            </div>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          {/* Replace the old table with our new EmployeeTable component */}
          <EmployeeTable 
            employees={paginatedEmployees} 
            onEdit={handleEditEmployee} 
            onDelete={handleDeleteEmployee} 
          />
        </div>

        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) setCurrentPage(currentPage - 1);
                }}
                isActive={currentPage > 1}
              />
            </PaginationItem>
            {[...Array(totalPages)].map((_, index) => (
              <PaginationItem key={index}>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage(index + 1);
                  }}
                  isActive={currentPage === index + 1}
                >
                  {index + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                }}
                isActive={currentPage < totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>

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
