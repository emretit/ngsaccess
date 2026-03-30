
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import ProfilePhoto from '@/components/profile/ProfilePhoto';
import ProfileForm from '@/components/profile/ProfileForm';
import SecurityCard from '@/components/profile/SecurityCard';
import { useProfileUtils } from '@/hooks/useProfileUtils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function Profile() {
  const { user, profile, refreshProfile, signOut } = useAuth() as { user: any; profile: any; refreshProfile: () => Promise<void>; signOut: () => Promise<void> };
  const { formData, getUserInitials, updateFormData } = useProfileUtils();
  const navigate = useNavigate();

  const handlePhotoUpdated = (newUrl: string) => {
    updateFormData('photoUrl', newUrl);
  };

  if (!user || !profile) {
    return <LoadingSpinner text="Profil bilgileri yükleniyor..." />;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Profil Bilgilerim</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sol Kart: Profil Fotoğrafı */}
        <ProfilePhoto 
          photoUrl={formData.photoUrl} 
          userInitials={getUserInitials()} 
          userId={user!.id}
          onPhotoUpdated={handlePhotoUpdated}
        />
        
        {/* Sağ Kart: Profil Bilgileri */}
        <ProfileForm 
          email={formData.email}
          fullName={formData.fullName}
          role={profile?.role || 'Kullanıcı'}
          userId={user!.id}
          onProfileUpdated={refreshProfile}
          onSignOut={signOut}
        />
      </div>
      
      {/* Güvenlik Kartı */}
      <SecurityCard />
    </div>
  );
}
