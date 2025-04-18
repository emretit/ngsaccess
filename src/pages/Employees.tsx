import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import DepartmentTree from '@/components/DepartmentTree';
import SlideOverPanel from '@/components/employees/SlideOverPanel';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, UserPlus } from "lucide-react";
import type { Employee } from '@/types/employee';

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          departments (id, name),
          positions (id, name)
        `)
        .order('created_at', { ascending: false });

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

    if (selectedDepartment !== null) {
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

    setFilteredEmployees(filtered);
  }, [selectedDepartment, employees, searchQuery]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedEmployees(filteredEmployees.map(emp => emp.id));
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleSelectEmployee = (employeeId: number) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleBulkDelete = async () => {
    if (!selectedEmployees.length) return;
    
    if (window.confirm(`${selectedEmployees.length} personeli silmek istediğinizden emin misiniz?`)) {
      try {
        const { error } = await supabase
          .from('employees')
          .delete()
          .in('id', selectedEmployees);

        if (error) throw error;

        const updatedEmployees = employees.filter(emp => !selectedEmployees.includes(emp.id));
        setEmployees(updatedEmployees);
        setFilteredEmployees(updatedEmployees);
        setSelectedEmployees([]);
      } catch (err) {
        console.error('Toplu silme işlemi sırasında hata:', err);
        alert('Personeller silinirken bir hata oluştu');
      }
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
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1">
        <aside className="w-64 border-r border-border bg-card p-4">
          <DepartmentTree onSelectDepartment={setSelectedDepartment} />
        </aside>

        <main className="flex-1 p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Personel Listesi</h1>
            <div className="flex gap-4">
              <Input
                type="search"
                placeholder="Personel ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              <Button onClick={() => {
                setEditingEmployee(null);
                setIsPanelOpen(true);
              }}>
                <UserPlus className="mr-2 h-4 w-4" />
                Yeni Personel
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-4 text-left font-medium">Ad Soyad</th>
                    <th className="p-4 text-left font-medium">TC No</th>
                    <th className="p-4 text-left font-medium">E-posta</th>
                    <th className="p-4 text-left font-medium">Departman</th>
                    <th className="p-4 text-left font-medium">Kart No</th>
                    <th className="p-4 text-left font-medium">Durum</th>
                    <th className="p-4 text-left font-medium">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b">
                      <td className="p-4">{employee.first_name} {employee.last_name}</td>
                      <td className="p-4">{employee.tc_no}</td>
                      <td className="p-4">{employee.email}</td>
                      <td className="p-4">{employee.departments?.name || '-'}</td>
                      <td className="p-4">{employee.card_number}</td>
                      <td className="p-4">
                        <Badge variant={employee.is_active ? "success" : "secondary"}>
                          {employee.is_active ? 'Aktif' : 'Pasif'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingEmployee(employee);
                            setIsPanelOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

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
  );
}
