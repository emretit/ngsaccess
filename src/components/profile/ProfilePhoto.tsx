
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Camera } from 'lucide-react';

interface ProfilePhotoProps {
  photoUrl: string;
  userInitials: string;
  userId: string;
  onPhotoUpdated: (newUrl: string) => void;
}

export default function ProfilePhoto({ photoUrl, userInitials, userId, onPhotoUpdated }: ProfilePhotoProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Dosya çok büyük",
        description: "Profil fotoğrafı 2MB'dan küçük olmalıdır.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Benzersiz dosya adı oluştur
      const fileExtension = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExtension}`;
      
      // Dosyayı Supabase storage'a yükle
      const { data, error } = await supabase.storage
        .from('profile_photos')
        .upload(fileName, file, {
          upsert: true,
        });
        
      if (error) throw error;
      
      // Yüklenen dosyanın public URL'ini al
      const { data: urlData } = await supabase.storage
        .from('profile_photos')
        .getPublicUrl(fileName);
        
      const publicUrl = urlData.publicUrl;
      
      // Profil bilgilerini veritabanında güncelle
      await supabase
        .from('users')
        .update({ 
          photo_url: publicUrl 
        })
        .eq('id', userId);
      
      // Parent component'e bildir
      onPhotoUpdated(publicUrl);
      
      toast({
        title: "Fotoğraf güncellendi",
        description: "Profil fotoğrafınız başarıyla güncellendi.",
      });
      
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Fotoğraf yüklenirken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil Fotoğrafı</CardTitle>
        <CardDescription>
          Profil fotoğrafınızı buradan değiştirebilirsiniz
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-4">
        <div className="relative">
          <Avatar className="w-32 h-32">
            <AvatarImage 
              src={photoUrl || ''} 
              alt="Profil fotoğrafı" 
            />
            <AvatarFallback className="bg-[#711A1A] text-white text-2xl">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          
          <label 
            htmlFor="photo-upload" 
            className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#711A1A] text-white cursor-pointer hover:bg-[#8a2020] transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </label>
          <input 
            type="file" 
            id="photo-upload" 
            accept="image/*" 
            className="hidden" 
            onChange={handlePhotoUpload}
            disabled={isLoading}
          />
        </div>
        
        <p className="text-sm text-gray-500 mt-4">
          Önerilen: 200x200px, maksimum 2MB
        </p>
      </CardContent>
    </Card>
  );
}
