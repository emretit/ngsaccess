
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Camera } from 'lucide-react';

export default function Profile() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    photoUrl: '',
  });
  const navigate = useNavigate();

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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
      const fileName = `${user!.id}-${Date.now()}.${fileExtension}`;
      
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
      
      // Formdata ve profil bilgilerini güncelle
      setFormData(prev => ({ ...prev, photoUrl: publicUrl }));
      
      // Profil bilgilerini veritabanında güncelle
      await supabase
        .from('users')
        .update({ 
          photo_url: publicUrl 
        })
        .eq('id', user!.id);
      
      // Context'teki profil bilgisini güncelle
      await refreshProfile();
      
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsUpdating(true);
      
      // Profil bilgilerini güncelle
      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.fullName,
        })
        .eq('id', user!.id);
        
      if (error) throw error;
      
      // Context'teki profil bilgisini güncelle
      await refreshProfile();
      
      toast({
        title: "Profil güncellendi",
        description: "Profil bilgileriniz başarıyla güncellendi.",
      });
      
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Profil güncellenirken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Profil Bilgilerim</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sol Kart: Profil Fotoğrafı */}
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
                  src={formData.photoUrl || ''} 
                  alt="Profil fotoğrafı" 
                />
                <AvatarFallback className="bg-[#711A1A] text-white text-2xl">
                  {getUserInitials()}
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
        
        {/* Sağ Kart: Profil Bilgileri */}
        <Card className="md:col-span-2">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Hesap Bilgileri</CardTitle>
              <CardDescription>
                Kişisel bilgilerinizi buradan güncelleyebilirsiniz
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input 
                  id="email" 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  disabled 
                />
                <p className="text-xs text-gray-500">
                  E-posta adresi değiştirilemez
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fullName">Ad Soyad</Label>
                <Input 
                  id="fullName" 
                  name="fullName" 
                  value={formData.fullName} 
                  onChange={handleChange}
                  placeholder="Ad Soyad" 
                  disabled={isUpdating}
                />
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Input 
                  id="role" 
                  value={profile?.role || 'Kullanıcı'} 
                  disabled 
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between flex-col sm:flex-row gap-4">
              <Button 
                variant="destructive" 
                type="button" 
                onClick={async () => {
                  await signOut();
                  navigate('/login');
                }}
              >
                Çıkış Yap
              </Button>
              <Button 
                type="submit" 
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Güncelleniyor
                  </>
                ) : 'Bilgileri Güncelle'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
      
      {/* Güvenlik Kartı */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Güvenlik</CardTitle>
          <CardDescription>
            Hesap güvenliği ayarlarınızı yönetin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Şifre Değiştir</h4>
                <p className="text-sm text-gray-500">Hesap şifrenizi güncellemeyi düşünüyor musunuz?</p>
              </div>
              <Button variant="outline">Şifre Değiştir</Button>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">İki Faktörlü Doğrulama</h4>
                <p className="text-sm text-gray-500">Ekstra güvenlik için iki faktörlü doğrulamayı açın</p>
              </div>
              <Button variant="outline" disabled>Yakında</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
