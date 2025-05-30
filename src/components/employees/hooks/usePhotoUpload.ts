
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePhotoUpload() {
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onPhotoChange: (url: string) => void,
    onPreviewChange: (preview: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Dosya boyutu 5MB\'dan küçük olmalıdır');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      onPreviewChange(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      setIsLoading(true);
      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(fileName);

      onPhotoChange(urlData.publicUrl);
    } catch (error) {
      console.error('Fotoğraf yüklenirken hata:', error);
      alert('Fotoğraf yüklenemedi. Lütfen daha sonra tekrar deneyiniz.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    handleFileChange,
  };
}
