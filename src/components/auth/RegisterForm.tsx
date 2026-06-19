
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

const RegisterForm = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Kullanıcıyı kayıt et
      const { error: signUpError } = await signUp(
        email,
        password,
        `${firstName.trim()} ${lastName.trim()}`,
        companyName.trim(),
      );
      
      if (signUpError) {
        toast({
          title: "Kayıt hatası",
          description: (signUpError as Error)?.message ?? "Kayıt olurken bir hata oluştu.",
          variant: "destructive",
        });
        return;
      }

      // Convex Auth kayıt sırasında kullanıcı oluşturur
      // Rol ve proje ataması auth callback'te veya admin panelinden yapılır

      toast({
        title: "Kayıt başarılı!",
        description: "Projeniz oluşturuldu. Giriş yapabilirsiniz.",
      });
      
      navigate('/login?confirmEmail=true');
      
    } catch (error: unknown) {
      toast({
        title: "Kayıt hatası",
        description: (error as Error)?.message ?? "Kayıt olurken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full shadow-lg border-0">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Kayıt Ol</CardTitle>
        <CardDescription className="text-center">
          PDKS sistemi demo hesabına erişim için kayıt olun.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Ad"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Soyad"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Input
                id="companyName"
                type="text"
                autoComplete="organization"
                placeholder="Firma adı"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                id="email"
                type="email"
                placeholder="E-posta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="En az 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 bg-primary hover:bg-primary/90" 
              disabled={isLoading}
            >
              {isLoading ? "Kayıt oluşturuluyor..." : "Kayıt Ol"}
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <div className="text-sm text-center text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <button 
            onClick={() => navigate('/login')}
            className="text-primary cursor-pointer hover:underline"
          >
            Giriş yapın
          </button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default RegisterForm;
