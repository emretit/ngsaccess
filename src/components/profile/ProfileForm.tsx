
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProfileFormProps {
  email: string;
  fullName: string;
  role: string;
  userId: string;
  onProfileUpdated: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export default function ProfileForm({ email, fullName, role, userId, onProfileUpdated, onSignOut }: ProfileFormProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [name, setName] = useState(fullName);
  const navigate = useNavigate();
  const updateProfile = useMutation(api.users.updateProfile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsUpdating(true);
      
      await updateProfile({ fullName: name });
      
      // Context'teki profil bilgisini güncelle
      await onProfileUpdated();
      
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

  const handleSignOut = async () => {
    await onSignOut();
    navigate('/login');
  };

  return (
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
              value={email} 
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
              value={name} 
              onChange={(e) => setName(e.target.value)}
              placeholder="Ad Soyad" 
              disabled={isUpdating}
            />
          </div>
          
          <Separator className="my-4" />
          
          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Input 
              id="role" 
              value={role || 'Kullanıcı'} 
              disabled 
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between flex-col sm:flex-row gap-4">
          <Button 
            variant="destructive" 
            type="button"
            onClick={handleSignOut}
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
  );
}
