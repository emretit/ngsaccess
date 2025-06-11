import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CardReading } from '@/types/access-control';

export interface DashboardStats {
  employees: number;
  devices: number;
  cardReadings: number;
  pendingRequests: number;
}

export const fetchDashboardStats = async (projectIds: number[], isSuperAdmin: boolean): Promise<DashboardStats> => {
  // Get today's date range for filtering
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    // Build queries with project filtering
    let employeesQuery = supabase.from('employees').select('*');
    let devicesQuery = supabase.from('devices').select('*').eq('status', 'active');
    let cardReadingsQuery = supabase.from('card_readings')
      .select('*')
      .gte('access_time', today.toISOString())
      .lt('access_time', tomorrow.toISOString());
    let pendingRequestsQuery = supabase.from('access_rules').select('*').eq('is_active', false);

    // Apply project filtering if not super admin
    if (!isSuperAdmin && projectIds.length > 0) {
      employeesQuery = employeesQuery.in('project_id', projectIds);
      devicesQuery = devicesQuery.in('project_id', projectIds);
      cardReadingsQuery = cardReadingsQuery.in('project_id', projectIds);
      pendingRequestsQuery = pendingRequestsQuery.in('project_id', projectIds);
    } else if (!isSuperAdmin && projectIds.length === 0) {
      // User has no project access, return zeros
      return { employees: 0, devices: 0, cardReadings: 0, pendingRequests: 0 };
    }

    const [
      { data: employees },
      { data: devices },
      { data: cardReadings },
      { data: pendingRequests }
    ] = await Promise.all([
      employeesQuery,
      devicesQuery,
      cardReadingsQuery,
      pendingRequestsQuery
    ]);

    return {
      employees: employees?.length || 0,
      devices: devices?.length || 0,
      cardReadings: cardReadings?.length || 0,
      pendingRequests: pendingRequests?.length || 0,
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    toast({
      title: "Veri yükleme hatası",
      description: "Dashboard istatistikleri yüklenirken bir hata oluştu.",
      variant: "destructive"
    });
    return { employees: 0, devices: 0, cardReadings: 0, pendingRequests: 0 };
  }
};

export const fetchRecentReadings = async (projectIds: number[], isSuperAdmin: boolean): Promise<CardReading[]> => {
  try {
    let query = supabase
      .from('card_readings')
      .select('*')
      .order('access_time', { ascending: false })
      .limit(5);

    // Apply project filtering if not super admin
    if (!isSuperAdmin && projectIds.length > 0) {
      query = query.in('project_id', projectIds);
    } else if (!isSuperAdmin && projectIds.length === 0) {
      // User has no project access, return empty array
      return [];
    }

    const { data: recent, error } = await query;

    if (error) {
      throw error;
    }

    // Map the data to match the CardReading type
    return recent?.map((reading: any) => ({
      ...reading,
      status: reading.access_granted ? 'success' : 'denied'
    })) || [];
  } catch (error) {
    console.error('Error fetching recent readings:', error);
    toast({
      title: "Veri yükleme hatası",
      description: "Son kart okutma kayıtları yüklenirken bir hata oluştu.",
      variant: "destructive"
    });
    return [];
  }
};
