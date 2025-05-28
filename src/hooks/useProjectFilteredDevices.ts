
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Device } from '@/types/device';
import { useProjectAccess } from './useProjectAccess';

export const useProjectFilteredDevices = () => {
  const { projectIds, isSuperAdmin, loading: projectLoading } = useProjectAccess();

  const { data: devices = [], isLoading, error, refetch } = useQuery({
    queryKey: ['devices', projectIds],
    queryFn: async (): Promise<Device[]> => {
      console.log('Fetching devices for projects:', projectIds);
      
      let query = supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      // Super admin değilse proje filtrelemesi uygula
      if (!isSuperAdmin && projectIds.length > 0) {
        query = query.in('project_id', projectIds);
      } else if (!isSuperAdmin && projectIds.length === 0) {
        // Kullanıcının hiç projesi yoksa boş sonuç döndür
        return [];
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching devices:', error);
        throw error;
      }

      // Device status'larını hesapla
      return (data || []).map((device: any): Device => {
        let status: 'online' | 'offline' | 'expired' = 'offline';
        
        if (device.last_seen) {
          const lastSeen = new Date(device.last_seen);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          status = lastSeen > fiveMinutesAgo ? 'online' : 'offline';
        }
        
        return { 
          ...device,
          status
        };
      });
    },
    enabled: !projectLoading && (isSuperAdmin || projectIds.length > 0),
  });

  return {
    devices,
    isLoading: isLoading || projectLoading,
    error,
    refetch,
    hasProjectAccess: isSuperAdmin || projectIds.length > 0
  };
};
