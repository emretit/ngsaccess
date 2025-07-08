import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectAccess } from '@/hooks/useProjectAccess';

export interface PDKSTableRecord {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  firstEntry: string;
  lastExit: string;
  totalHours: string;
  overtime: string;
  leaveType: string;
  status: 'present' | 'late' | 'absent' | 'leave';
  detailedLogs: Array<{
    time: string;
    action: string;
    location: string;
  }>;
}

export function usePdksTableData(selectedDate?: string) {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();
  const today = selectedDate || new Date().toISOString().split('T')[0];

  const { data: tableRecords = [], isLoading, error, refetch } = useQuery({
    queryKey: ['pdksTableData', projectIds, today],
    queryFn: async (): Promise<PDKSTableRecord[]> => {
      // Get today's card readings with employee and device information
      let cardReadingsQuery = supabase
        .from('card_readings')
        .select(`
          id,
          employee_id,
          employee_name,
          access_time,
          access_status,
          employees (
            first_name,
            last_name,
            department_id,
            departments (
              name
            )
          ),
          devices (
            name
          )
        `)
        .gte('access_time', `${today}T00:00:00`)
        .lt('access_time', `${today}T23:59:59`)
        .order('access_time', { ascending: true });

      if (!isSuperAdmin && projectIds.length > 0) {
        cardReadingsQuery = cardReadingsQuery.in('project_id', projectIds);
      }

      const { data: readings, error: readingsError } = await cardReadingsQuery;
      
      if (readingsError) throw readingsError;

      // Group readings by employee
      const employeeReadings = new Map();
      
      if (readings) {
        readings.forEach(reading => {
          const employeeId = reading.employee_id;
          if (!employeeReadings.has(employeeId)) {
            employeeReadings.set(employeeId, []);
          }
          employeeReadings.get(employeeId).push(reading);
        });
      }

      // Convert to table format
      const tableData: PDKSTableRecord[] = [];

      employeeReadings.forEach((empReadings, employeeId) => {
        const firstReading = empReadings[0];
        const lastReading = empReadings[empReadings.length - 1];
        
        // Calculate entry and exit times
        const entryReadings = empReadings.filter((r: any) => r.access_status === 'izin_verildi');
        const firstEntry = entryReadings[0];
        const lastExit = entryReadings[entryReadings.length - 1];

        // Calculate status based on entry time
        let status: 'present' | 'late' | 'absent' | 'leave' = 'present';
        if (firstEntry) {
          const entryTime = new Date(firstEntry.access_time);
          const entryHour = entryTime.getHours();
          const entryMinute = entryTime.getMinutes();
          
          if (entryHour > 9 || (entryHour === 9 && entryMinute > 15)) {
            status = 'late';
          }
        } else {
          status = 'absent';
        }

        // Calculate total hours
        let totalHours = '0h 0m';
        if (firstEntry && lastExit && firstEntry.id !== lastExit.id) {
          const entryTime = new Date(firstEntry.access_time);
          const exitTime = new Date(lastExit.access_time);
          const diffMs = exitTime.getTime() - entryTime.getTime();
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          totalHours = `${diffHours}h ${diffMinutes}m`;
        }

        // Create detailed logs
        const detailedLogs = empReadings.map((reading: any) => ({
          time: new Date(reading.access_time).toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          action: reading.access_status === 'izin_verildi' ? 'Giriş' : 'Reddedildi',
          location: reading.devices?.name || 'Bilinmiyor'
        }));

        const employee = firstReading.employees;
        const employeeName = firstReading.employee_name || 
          (employee ? `${employee.first_name} ${employee.last_name}` : 'Bilinmiyor');

        tableData.push({
          id: employeeId.toString(),
          name: employeeName,
          employeeId: employeeId.toString(),
          department: employee?.departments?.name || 'Bilinmiyor',
          firstEntry: firstEntry ? new Date(firstEntry.access_time).toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : '-',
          lastExit: lastExit && lastExit.id !== firstEntry?.id ? 
            new Date(lastExit.access_time).toLocaleTimeString('tr-TR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }) : '-',
          totalHours,
          overtime: '0m', // Would need work_hours_summary calculation
          leaveType: '-',
          status,
          detailedLogs
        });
      });

      return tableData;
    },
    enabled: !projectLoading && (isSuperAdmin || projectIds.length > 0),
    staleTime: 2 * 60 * 1000, // 2 minutes fresh
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    tableRecords,
    loading: isLoading || projectLoading,
    error,
    refetch
  };
}