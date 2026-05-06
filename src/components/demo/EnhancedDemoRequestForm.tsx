
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

import { Building, Users, Mail, Phone, MessageSquare } from 'lucide-react';

const EnhancedDemoRequestForm = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    employeeCount: '',
    message: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Kullanıcıyı kayıt et
      const { error: signUpError } = await signUp(
        formData.email, 
        formData.password, 
        `${formData.firstName} ${formData.lastName}`
      );
      
      if (signUpError) {
        toast({
          title: "Kayıt hatası",
          description: (signUpError as Error)?.message ?? "Kayıt olurken bir hata oluştu.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Demo kaydı başarılı!",
        description: "Hesabınız oluşturuldu. Giriş yapabilirsiniz.",
      });
      navigate("/login");
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
    <div className="py-16 px-4 bg-muted/50">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-3xl font-bold text-foreground">
              Ücretsiz Demo Talep Edin
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              15 dakikada kurulum tamamlayın, hemen kullanmaya başlayın
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium text-foreground">
                    Ad *
                  </Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="Adınız"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium text-foreground">
                    Soyad *
                  </Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    placeholder="Soyadınız"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className="h-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  E-posta Adresi *
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="ornek@sirket.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Telefon Numarası
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="0555 123 45 67"
                  value={formData.phone}
                  onChange={handleChange}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Firma Adı *
                </Label>
                <Input
                  id="companyName"
                  name="companyName"
                  type="text"
                  placeholder="Şirket Adı A.Ş."
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeCount" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Personel Sayısı
                </Label>
                <Input
                  id="employeeCount"
                  name="employeeCount"
                  type="text"
                  placeholder="Yaklaşık personel sayınız"
                  value={formData.employeeCount}
                  onChange={handleChange}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Ek Notlar
                </Label>
                <Textarea
                  id="message"
                  name="message"
                  placeholder="Özel ihtiyaçlarınız veya sorularınız..."
                  value={formData.message}
                  onChange={handleChange}
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Şifre *
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="En az 6 karakter"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="h-12"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-14 bg-primary hover:bg-primary/90 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300" 
                disabled={isLoading}
              >
                {isLoading ? "Demo erişimi oluşturuluyor..." : "Ücretsiz Demo Başlat"}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Zaten hesabınız var mı?{" "}
                <button 
                  onClick={() => navigate('/login')}
                  className="text-primary font-medium hover:underline"
                >
                  Giriş yapın
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnhancedDemoRequestForm;
