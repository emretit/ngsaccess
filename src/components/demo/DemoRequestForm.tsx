
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const DemoRequestForm = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Kullanıcıyı kayıt et
      const { error: signUpError } = await signUp(email, password, `${firstName} ${lastName}`);
      
      if (signUpError) {
        toast({
          title: "Kayıt hatası",
          description: signUpError.message || "Kayıt olurken bir hata oluştu.",
          variant: "destructive",
        });
        return;
      }

      // Demo proje bilgilerini users tablosuna ekle
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Kullanıcı bilgilerini güncelle
        const { error: updateError } = await supabase
          .from('users')
          .update({
            first_name: firstName,
            last_name: lastName,
            company_name: companyName,
            role: 'project_user'
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Kullanıcı bilgileri güncellenirken hata:', updateError);
        }

        // Demo projesi oluştur veya mevcut demo projesine ata
        await assignDemoProject(user.id);
      }

      toast({
        title: "Demo kaydı başarılı!",
        description: "Demo projenize erişim hakkınız oluşturuldu. Giriş yapabilirsiniz.",
      });
      
      navigate('/login');
      
    } catch (error: any) {
      toast({
        title: "Kayıt hatası",
        description: error.message || "Kayıt olurken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const assignDemoProject = async (userId: string) => {
    try {
      // Demo projesi var mı kontrol et
      const { data: demoProject, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('name', 'Demo Projesi')
        .single();

      let projectId;

      if (projectError || !demoProject) {
        // Demo proje yoksa oluştur
        const { data: newProject, error: createError } = await supabase
          .from('projects')
          .insert({
            name: 'Demo Projesi',
            description: 'PDKS sistemi demo projesi',
            created_by: userId
          })
          .select('id')
          .single();

        if (createError) {
          console.error('Demo projesi oluşturulurken hata:', createError);
          return;
        }
        projectId = newProject.id;
      } else {
        projectId = demoProject.id;
      }

      // Kullanıcıyı demo projesine ata
      const { error: assignError } = await supabase
        .from('user_projects')
        .insert({
          user_id: userId,
          project_id: projectId,
          role: 'project_user'
        });

      if (assignError) {
        console.error('Kullanıcı projeye atanırken hata:', assignError);
      }

    } catch (error) {
      console.error('Demo proje atama hatası:', error);
    }
  };

  return (
    <Card className="w-full shadow-lg border-0">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Demo Talep Formu</CardTitle>
        <CardDescription className="text-center">
          PDKS sistemi demo sürümüne erişim için bilgilerinizi giriniz.
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
                id="companyName"
                type="text"
                placeholder="Firma Adı"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                id="password"
                type="password"
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 bg-[#711A1A] hover:bg-[#5a1515]" 
              disabled={isLoading}
            >
              {isLoading ? "Demo erişimi oluşturuluyor..." : "Demo Talep Et"}
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <div className="text-sm text-center text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <button 
            onClick={() => navigate('/login')}
            className="text-[#711A1A] cursor-pointer hover:underline"
          >
            Giriş yapın
          </button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default DemoRequestForm;
