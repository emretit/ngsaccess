
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

interface ProjectAccess {
  projectIds: number[];
  isSuperAdmin: boolean;
  loading: boolean;
}

export const useProjectAccess = (): ProjectAccess => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }

    setLoading(false);
  }, [user, profile]);

  return {
    projectIds: [], // Artık project tabanlı erişim yok
    isSuperAdmin: profile?.role === 'super_admin',
    loading
  };
};
