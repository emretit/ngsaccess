
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CardReading } from '@/types/access-control';

export interface DashboardStats {
  employees: number;
  devices: number;
  cardReadings: number;
  pendingRequests: number;
}

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  // Get today's date range for filtering
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const [
      { data: employees },
      { data: devices },
      { data: cardReadings },
      { data: pendingRequests }
    ] = await Promise.all([
      supabase.from('employees').select('*'),
      supabase.from('devices').select('*').eq('status', 'active'),
      supabase.from('card_readings')
        .select('*')
        .gte('access_time', today.toISOString())
        .lt('access_time', tomorrow.toISOString()),
      supabase.from('access_permissions').select('*').eq('has_access', false)
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

export const fetchRecentReadings = async (): Promise<CardReading[]> => {
  try {
    const { data: recent, error } = await supabase
      .from('card_readings')
      .select('*')
      .order('access_time', { ascending: false })
      .limit(5);

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
