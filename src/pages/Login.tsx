
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isRegister) {
        // Register new user
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (error) throw error;
        
        toast({
          title: "Kayıt başarılı",
          description: "Lütfen email adresinizi kontrol edin ve hesabınızı onaylayın.",
          variant: "default"
        });
        
        // Switch to login mode after successful registration
        setIsRegister(false);
      } else {
        // Login existing user
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        
        toast({
          title: "Giriş başarılı",
          description: "Hoş geldiniz!",
          variant: "default"
        });
        
        // Redirect to dashboard after successful login
        navigate('/');
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      toast({
        title: "İşlem başarısız",
        description: error.message || "Bir hata oluştu. Lütfen tekrar deneyin.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-white to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#711A1A] rounded-md flex items-center justify-center text-white font-bold mx-auto mb-4">
            P
          </div>
          <h1 className="text-3xl font-bold">PDKS Sistemi</h1>
          <p className="text-muted-foreground mt-2">Personel Devam Kontrol Sistemi</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isRegister ? 'Hesap Oluştur' : 'Giriş Yap'}</CardTitle>
            <CardDescription>
              {isRegister 
                ? 'PDKS sistemine kayıt olmak için bilgilerinizi girin.'
                : 'PDKS sistemine giriş yapmak için bilgilerinizi girin.'}
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleAuth}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="ornek@firma.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input 
                  id="password" 
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading 
                  ? 'İşlem yapılıyor...' 
                  : (isRegister ? 'Kayıt Ol' : 'Giriş Yap')}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full"
                onClick={() => setIsRegister(!isRegister)}
                disabled={loading}
              >
                {isRegister 
                  ? 'Zaten hesabım var. Giriş yapmak istiyorum.' 
                  : 'Hesabım yok. Kayıt olmak istiyorum.'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
