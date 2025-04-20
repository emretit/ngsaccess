
import { useState, useMemo, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, Edit2 } from "lucide-react"; // Added Edit2 import
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarInset
} from "@/components/ui/sidebar";
import DepartmentTree from '@/components/DepartmentTree';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // Added Button import
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import SlideOverPanel from '@/components/employees/SlideOverPanel';
import { Employee } from '@/types/employee';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

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

  const ITEMS_PER_PAGE = 10;

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
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEmployees.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredEmployees, currentPage]);

  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);

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
    <SidebarProvider>
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar variant="inset" collapsible="icon">
          <SidebarContent>
            <DepartmentTree onSelectDepartment={setSelectedDepartment} />
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">Personel Listesi</h1>
              <div className="flex gap-4">
                <Input
                  type="search"
                  placeholder="Personel ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64"
                />
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

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-card rounded-lg p-4 shadow-md">
                <div className="flex items-center justify-between">
                  <Users className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Toplam Personel</p>
                    <p className="text-2xl font-bold">{employeeStats.total}</p>
                  </div>
                </div>
              </div>
              <div className="bg-card rounded-lg p-4 shadow-md">
                <div className="flex items-center justify-between">
                  <Users className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Aktif Personel</p>
                    <p className="text-2xl font-bold">{employeeStats.active}</p>
                  </div>
                </div>
              </div>
              <div className="bg-card rounded-lg p-4 shadow-md">
                <div className="flex items-center justify-between">
                  <Users className="h-6 w-6 text-red-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pasif Personel</p>
                    <p className="text-2xl font-bold">{employeeStats.inactive}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border shadow-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fotoğraf</TableHead>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>E-posta</TableHead>
                    <TableHead>Departman</TableHead>
                    <TableHead>Vardiya</TableHead>
                    <TableHead>Kart No</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <Avatar>
                          <AvatarImage src={employee.photo_url || ''} alt={`${employee.first_name} ${employee.last_name}`} />
                          <AvatarFallback>{employee.first_name?.[0]}{employee.last_name?.[0]}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>{employee.first_name} {employee.last_name}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.departments?.name || '-'}</TableCell>
                      <TableCell>{employee.shift || '-'}</TableCell>
                      <TableCell>{employee.card_number}</TableCell>
                      <TableCell>
                        <Badge variant={employee.is_active ? 'success' : 'secondary'}>
                          {employee.is_active ? 'Aktif' : 'Pasif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setEditingEmployee(employee);
                            setIsPanelOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
