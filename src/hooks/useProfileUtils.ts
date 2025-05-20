
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

interface ProfileData {
  email: string;
  fullName: string;
  photoUrl: string;
}

export function useProfileUtils() {
  const { user, profile } = useAuth();
  const [formData, setFormData] = useState<ProfileData>({
    email: '',
    fullName: '',
    photoUrl: '',
  });

  useEffect(() => {
    if (user && profile) {
      setFormData({
        email: user.email || '',
        fullName: profile.full_name || user.email?.split('@')[0] || '',
        photoUrl: profile.photo_url || '',
      });
    }
  }, [user, profile]);

  const getUserInitials = () => {
    if (formData.fullName) {
      const nameParts = formData.fullName.split(' ');
      if (nameParts.length >= 2) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
      }
      return formData.fullName.substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'KU';
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return {
    formData,
    getUserInitials,
    updateFormData,
  };
}
