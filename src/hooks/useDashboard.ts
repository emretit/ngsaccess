
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { CardReading } from '@/types/access-control';
import { toast } from '@/hooks/use-toast';
import { fetchDashboardStats, DashboardStats, fetchRecentReadings } from '@/utils/dashboardUtils';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { useQuery } from '@tanstack/react-query';

export const useDashboard = () => {
  const [userName, setUserName] = useState("Kullanıcı");
  const [session, setSession] = useState<any>(null);
  const navigate = useNavigate();
  
  // Get project access information
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  // Dashboard stats ve recent readings için React Query kullanın
  const { data: stats = { employees: 0, devices: 0, cardReadings: 0, pendingRequests: 0 }, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboardStats', projectIds],
    queryFn: () => fetchDashboardStats(projectIds, isSuperAdmin),
    enabled: !!session && !projectLoading && (isSuperAdmin || projectIds.length > 0),
    staleTime: 5 * 60 * 1000, // 5 dakika fresh
    gcTime: 10 * 60 * 1000, // 10 dakika cache
    refetchOnWindowFocus: false,
    refetchInterval: 60 * 1000, // 1 dakikada bir otomatik güncelleme
  });

  const { data: recentReadings = [], isLoading: readingsLoading, refetch: refetchReadings } = useQuery({
    queryKey: ['dashboardReadings', projectIds],
    queryFn: () => fetchRecentReadings(projectIds, isSuperAdmin),
    enabled: !!session && !projectLoading && (isSuperAdmin || projectIds.length > 0),
    staleTime: 2 * 60 * 1000, // 2 dakika fresh
    gcTime: 5 * 60 * 1000, // 5 dakika cache
    refetchOnWindowFocus: false,
    refetchInterval: 30 * 1000, // 30 saniyede bir otomatik güncelleme
  });

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

  const refreshData = async () => {
    if (projectLoading) return;
    
    try {
      await Promise.all([refetchStats(), refetchReadings()]);
      
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
    }
  };

  return {
    stats,
    recentReadings,
    loading: statsLoading || readingsLoading || projectLoading,
    userName,
    session,
    refreshData
  };
};
