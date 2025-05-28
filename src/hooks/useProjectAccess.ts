
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
    if (!user || !profile) {
      setLoading(false);
      return;
    }

    const fetchUserProjects = async () => {
      try {
        // Super admin tüm projelere erişebilir
        if (profile.role === 'super_admin') {
          const { data: allProjects, error } = await supabase
            .from('projects')
            .select('id')
            .eq('is_active', true);

          if (error) throw error;
          
          setProjectIds(allProjects?.map(p => p.id) || []);
        } else {
          // Diğer kullanıcılar sadece atandıkları projelere erişebilir
          const { data: userProjects, error } = await supabase
            .from('user_projects')
            .select('project_id')
            .eq('user_id', user.id);

          if (error) throw error;
          
          setProjectIds(userProjects?.map(up => up.project_id) || []);
        }
      } catch (error) {
        console.error('Error fetching user projects:', error);
        setProjectIds([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProjects();
  }, [user, profile]);

  return {
    projectIds,
    isSuperAdmin: profile?.role === 'super_admin',
    loading
  };
};
