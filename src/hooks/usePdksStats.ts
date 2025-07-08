import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectAccess } from '@/hooks/useProjectAccess';

export interface PDKSStats {
  totalEmployees: number;
  presentToday: number;
  lateArrivals: number;
  overtimeHours: number;
  insideBuilding: number;
}

export function usePdksStats() {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['pdksStats', projectIds],
    queryFn: async (): Promise<PDKSStats> => {
      const today = new Date().toISOString().split('T')[0];
      
      // Get total employees count
      let employeesQuery = supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      if (!isSuperAdmin && projectIds.length > 0) {
        employeesQuery = employeesQuery.in('project_id', projectIds);
      }

      const { count: totalEmployees } = await employeesQuery;

      // Get today's card readings to calculate statistics
      let cardReadingsQuery = supabase
        .from('card_readings')
        .select(`
          id,
          employee_id,
          access_time,
          access_status,
          employee_name
        `)
        .gte('access_time', `${today}T00:00:00`)
        .lt('access_time', `${today}T23:59:59`);

      if (!isSuperAdmin && projectIds.length > 0) {
        cardReadingsQuery = cardReadingsQuery.in('project_id', projectIds);
      }

      const { data: todayReadings, error: readingsError } = await cardReadingsQuery;
      
      if (readingsError) throw readingsError;

      // Calculate statistics from today's readings
      const uniqueEmployeesToday = new Set();
      const lateEmployees = new Set();
      const presentEmployees = new Set();

      if (todayReadings) {
        todayReadings.forEach(reading => {
          if (reading.access_status === 'izin_verildi') {
            uniqueEmployeesToday.add(reading.employee_id);
            presentEmployees.add(reading.employee_id);
            
            // Check if arrival is late (after 9:00 AM)
            const accessTime = new Date(reading.access_time);
            const accessHour = accessTime.getHours();
            const accessMinute = accessTime.getMinutes();
            
            if (accessHour > 9 || (accessHour === 9 && accessMinute > 0)) {
              lateEmployees.add(reading.employee_id);
            }
          }
        });
      }

      return {
        totalEmployees: totalEmployees || 0,
        presentToday: presentEmployees.size,
        lateArrivals: lateEmployees.size,
        overtimeHours: 0, // This would need work_hours_summary table calculation
        insideBuilding: Math.floor(presentEmployees.size * 0.7) // Estimate based on present employees
      };
    },
    enabled: !projectLoading && (isSuperAdmin || projectIds.length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    stats: stats || {
      totalEmployees: 0,
      presentToday: 0,
      lateArrivals: 0,
      overtimeHours: 0,
      insideBuilding: 0
    },
    loading: isLoading || projectLoading,
    error,
    refetch
  };
}