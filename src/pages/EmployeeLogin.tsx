
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeeLogin, LoginCredentials } from '@/services/employeeAuthService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react';

export default function EmployeeLogin() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'email' | 'phone'>('email');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const credentials: LoginCredentials = {
        password,
        ...(activeTab === 'email' ? { email } : { phone })
      };

      const { user, error } = await employeeLogin(credentials);
      
      if (error) {
        toast({
          title: "Giriş hatası",
          description: error,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      toast({
        title: "Giriş başarılı",
        description: `Hoş geldiniz, ${user?.name}`,
      });

      // Redirect to employee dashboard
      navigate('/employee-dashboard');
    } catch (error: any) {
      toast({
        title: "Giriş hatası",
        description: error.message || "Giriş yapılırken bir hata oluştu.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const toggleShowPassword = () => setShowPassword(!showPassword);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-md flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            P
          </div>
          <h1 className="text-2xl font-bold">PDKS Personel Girişi</h1>
          <p className="text-muted-foreground mt-2">
            Personel Devam Kontrol Sistemi
          </p>
        </div>

        <Card className="w-full shadow-lg border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Personel Girişi</CardTitle>
            <CardDescription className="text-center">
              PDKS sistemine giriş yapmak için bilgilerinizi giriniz
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="email" onValueChange={(v) => setActiveTab(v as 'email' | 'phone')}>
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="email">E-posta</TabsTrigger>
                <TabsTrigger value="phone">Telefon</TabsTrigger>
              </TabsList>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <TabsContent value="email" className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="E-posta"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required={activeTab === 'email'}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="phone" className="space-y-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="Telefon"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                        required={activeTab === 'phone'}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <div className="space-y-2">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Şifre"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={toggleShowPassword}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-11 bg-primary hover:bg-primary/90" 
                  disabled={isLoading}
                >
                  {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
                </Button>
              </form>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <div className="text-sm text-center text-muted-foreground">
              Bu giriş, sadece personel içindir. Yönetim girişi için{" "}
              <Button 
                variant="link" 
                className="p-0 h-auto text-primary" 
                onClick={() => navigate('/login')}
              >
                buraya tıklayın
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
