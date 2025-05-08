
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { CardReading } from '@/types/access-control';
import { toast } from '@/hooks/use-toast';
import { fetchDashboardStats, DashboardStats, fetchRecentReadings } from '@/utils/dashboardUtils';

export const useDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    employees: 0,
    devices: 0,
    cardReadings: 0,
    pendingRequests: 0,
  });
  const [recentReadings, setRecentReadings] = useState<CardReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Kullanıcı");
  const [session, setSession] = useState<any>(null);
  const navigate = useNavigate();

  // Check authentication status
  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
        navigate('/login');
        return;
      }
      
      if (!data.session) {
        // Not logged in, redirect to login
        navigate('/login');
        return;
      }
      
      setSession(data.session);
      
      // Get user email if available and use it for display
      if (data.session?.user) {
        // Extract username from email (part before @)
        const email = data.session.user.email;
        const displayName = email ? email.split('@')[0] : "Kullanıcı";
        setUserName(displayName);
      }
    };
    
    checkSession();
    
    // Setup auth state change listener
    const { data: { subscription }} = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/login');
      }
      setSession(session);
    });
    
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Fetch dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      if (!session) return;
      
      try {
        const [statsData, readingsData] = await Promise.all([
          fetchDashboardStats(),
          fetchRecentReadings()
        ]);
        
        setStats(statsData);
        setRecentReadings(readingsData);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      loadDashboardData();
      const interval = setInterval(loadDashboardData, 30000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [statsData, readingsData] = await Promise.all([
        fetchDashboardStats(),
        fetchRecentReadings()
      ]);
      
      setStats(statsData);
      setRecentReadings(readingsData);
      
      toast({
        title: "Veriler güncellendi",
        description: "Dashboard verileri başarıyla güncellendi.",
        variant: "default"
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: "Veri yükleme hatası",
        description: "Dashboard verisi yüklenirken bir hata oluştu.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    stats,
    recentReadings,
    loading,
    userName,
    session,
    refreshData
  };
};
