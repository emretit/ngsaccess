
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AttendanceTableProps {
  dateRange: { start: string; end: string };
  department?: string;
  shift?: string;
}

interface AttendanceRecord {
  id: number;
  date: string;
  entry_time: string;
  exit_time: string | null;
  status: 'present' | 'absent' | 'late';
  employee_first_name: string;
  employee_last_name: string;
}

type SortField = 'employee' | 'date' | 'status';
type SortDirection = 'asc' | 'desc';

export function AttendanceTable({ dateRange, department, shift }: AttendanceTableProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const recordsPerPage = 10;
  const totalPages = Math.ceil(records.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const currentRecords = records.slice(startIndex, endIndex);

  useEffect(() => {
    fetchRecords();
  }, [dateRange, department, shift, sortField, sortDirection]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('pdks_records')
        .select(`
          id,
          date,
          entry_time,
          exit_time,
          status,
          employee_first_name,
          employee_last_name
        `)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

      if (department) {
        query = query.eq('employees.department_id', department);
      }

      if (shift) {
        query = query.eq('employees.shift_id', shift);
      }

      const { data, error } = await query;

      if (error) throw error;

      const sortedData = [...(data || [])].sort((a, b) => {
        switch (sortField) {
          case 'employee':
            const nameA = `${a.employee_first_name} ${a.employee_last_name}`;
            const nameB = `${b.employee_first_name} ${b.employee_last_name}`;
            return sortDirection === 'asc' 
              ? nameA.localeCompare(nameB)
              : nameB.localeCompare(nameA);
          case 'date':
            return sortDirection === 'asc'
              ? new Date(a.date).getTime() - new Date(b.date).getTime()
              : new Date(b.date).getTime() - new Date(a.date).getTime();
          case 'status':
            return sortDirection === 'asc'
              ? a.status.localeCompare(b.status)
              : b.status.localeCompare(a.status);
          default:
            return 0;
        }
      });

      setRecords(sortedData);
    } catch (err) {
      console.error('Error fetching records:', err);
      setError('Failed to fetch attendance records');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    setSortDirection(current => 
      sortField === field 
        ? current === 'asc' ? 'desc' : 'asc'
        : 'asc'
    );
    setSortField(field);
  };

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'present':
        return <Badge variant="success">Mevcut</Badge>;
      case 'absent':
        return <Badge variant="destructive">Yok</Badge>;
      case 'late':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Geç</Badge>;
      default:
        return null;
    }
  };

  const exportToCsv = () => {
    const headers = ['Ad Soyad', 'Tarih', 'Giriş', 'Çıkış', 'Durum'];
    const csvRows = [
      headers.join(','),
      ...currentRecords.map(record => {
        const values = [
          `${record.employee_first_name} ${record.employee_last_name}`,
          format(new Date(record.date), 'dd.MM.yyyy'),
          record.entry_time || '—',
          record.exit_time || '—',
          record.status === 'present' ? 'Mevcut' 
            : record.status === 'late' ? 'Geç' 
            : 'Yok'
        ];
        return values.join(',');
      })
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex space-x-2">
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce delay-100"></div>
          <div className="w-3 h-3 bg-primary rounded-full animate-bounce delay-200"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Bu tarih aralığında kayıt bulunamadı
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          {format(new Date(dateRange.start), 'dd.MM.yyyy')} - {format(new Date(dateRange.end), 'dd.MM.yyyy')} 
          {department && `, Departman: ${department}`}
          {shift && `, Vardiya: ${shift}`}
        </p>
        <Button variant="outline" size="sm" onClick={exportToCsv}>
          <Download className="h-4 w-4 mr-2" />
          CSV İndir
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-white dark:bg-gray-800 sticky top-0">
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => handleSort('employee')}
              >
                Personel {sortField === 'employee' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => handleSort('date')}
              >
                Tarih {sortField === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead>Giriş</TableHead>
              <TableHead>Çıkış</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => handleSort('status')}
              >
                Durum {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentRecords.map((record) => (
              <TableRow 
                key={record.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                <TableCell className="font-medium">
                  {record.employee_first_name} {record.employee_last_name}
                </TableCell>
                <TableCell>
                  {format(new Date(record.date), 'dd.MM.yyyy')}
                </TableCell>
                <TableCell>
                  {record.entry_time || '—'}
                </TableCell>
                <TableCell>
                  {record.exit_time || '—'}
                </TableCell>
                <TableCell>
                  {getStatusBadge(record.status)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          Toplam {records.length} kayıt, Sayfa {currentPage}/{totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Önceki
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Sonraki
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
