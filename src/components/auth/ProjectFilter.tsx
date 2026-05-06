
import React from 'react';
import { useProjectAccess } from '@/hooks/useProjectAccess';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ProjectFilterProps {
  children: React.ReactNode;
  requiredRole?: 'super_admin' | 'project_admin' | 'project_user' | 'admin';
  showNoAccess?: boolean;
}

const ProjectFilter: React.FC<ProjectFilterProps> = ({ 
  children, 
  requiredRole = 'project_user',
  showNoAccess = true 
}) => {
  const { projectIds, isSuperAdmin, loading } = useProjectAccess();

  // Loading sırasında loading göster
  if (loading) {
    return <LoadingSpinner text="Proje erişimi kontrol ediliyor..." />;
  }

  // Admin role için özel kontrol (super_admin veya project_admin)
  if (requiredRole === 'admin') {
    const hasAdminAccess = isSuperAdmin || projectIds.length > 0;
    if (!hasAdminAccess) {
      if (!showNoAccess) return null;
      
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">🔒</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Yönetici Erişimi Gerekli</h3>
              <p className="text-muted-foreground mt-2">
                Bu sayfaya erişim için yönetici yetkisine sahip olmanız gerekiyor.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return <>{children}</>;
  }

  // Loading tamamlandıktan sonra erişim kontrolü yap
  // Eğer super admin değilse ve hiç proje erişimi yoksa
  if (!loading && !isSuperAdmin && projectIds.length === 0) {
    if (!showNoAccess) return null;
    
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">🔒</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Proje Erişimi Yok</h3>
            <p className="text-muted-foreground mt-2">
              Bu sayfaya erişim için size atanmış bir proje bulunmuyor. 
              Lütfen sistem yöneticinizle iletişime geçin.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProjectFilter;
