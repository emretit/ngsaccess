
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';

interface ProjectAccess {
  projectIds: number[];
  isSuperAdmin: boolean;
  loading: boolean;
}

export const useProjectAccess = (): ProjectAccess => {
  const { user, profile } = useAuth();
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjectAccess = async () => {
      if (!user || !profile) {
        setLoading(false);
        return;
      }

      try {
        // Super admin tüm projelere erişebilir
        if (profile.role === 'super_admin') {
          const { data: projects } = await supabase
            .from('projects')
            .select('id')
            .eq('is_active', true);
          
          setProjectIds(projects?.map(p => p.id) || []);
        } else {
          // Diğer kullanıcılar sadece atandıkları projelere erişebilir
          const { data: userProjects } = await supabase
            .from('project_users')
            .select('project_id')
            .eq('user_id', user.id);
          
          setProjectIds(userProjects?.map(up => up.project_id) || []);
        }
      } catch (error) {
        console.error('Error fetching project access:', error);
        setProjectIds([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectAccess();
  }, [user, profile]);

  return {
    projectIds,
    isSuperAdmin: profile?.role === 'super_admin',
    loading
  };
};
