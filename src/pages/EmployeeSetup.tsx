
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Lock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function EmployeeSetup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<{email: string, first_name: string, last_name: string} | null>(null);

  useEffect(() => {
    if (!token) {
      toast({
        title: "Geçersiz bağlantı",
        description: "Şifre belirleme bağlantısı geçersiz.",
        variant: "destructive",
      });
      navigate('/login');
      return;
    }
    
    validateToken();
  }, [token, navigate]);

  const validateToken = async () => {
    try {
      const { data: authData, error: authError } = await supabase
        .from('employee_auth')
        .select('email, token_expires_at, employee_id')
        .eq('setup_token', token)
        .single();

      if (authError || !authData) {
        setTokenValid(false);
        return;
      }

      // Check if token is expired
      const expiresAt = new Date(authData.token_expires_at);
      const now = new Date();
      
      if (now > expiresAt) {
        setTokenValid(false);
        toast({
          title: "Bağlantı süresi dolmuş",
          description: "Şifre belirleme bağlantısının süresi dolmuş. Yeni bağlantı talep ediniz.",
          variant: "destructive",
        });
        return;
      }

      // Get employee info
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('first_name, last_name, email')
        .eq('id', authData.employee_id)
        .single();

      if (employeeError || !employeeData) {
        setTokenValid(false);
        return;
      }

      setTokenValid(true);
      setEmployeeInfo({
        email: authData.email,
        first_name: employeeData.first_name,
        last_name: employeeData.last_name
      });
    } catch (error) {
      console.error('Token validation error:', error);
      setTokenValid(false);
    }
  };

  const validatePassword = (pwd: string) => {
    const minLength = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    
    return {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      isValid: minLength && hasUpper && hasLower && hasNumber
    };
  };

  const passwordValidation = validatePassword(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordValidation.isValid) {
      toast({
        title: "Geçersiz şifre",
        description: "Lütfen şifre gereksinimlerini kontrol ediniz.",
        variant: "destructive",
      });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({
        title: "Şifreler eşleşmiyor",
        description: "Lütfen şifrelerin aynı olduğundan emin olunuz.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Use the employee password setting function
      const { data, error } = await supabase.functions.invoke('set-employee-password', {
        body: {
          token: token,
          password: password
        }
      });

      if (error) {
        throw new Error(error.message || 'Şifre belirlenirken bir hata oluştu');
      }

      if (!data.success) {
        throw new Error(data.error || 'Şifre belirlenirken bir hata oluştu');
      }

      toast({
        title: "Şifre belirlendi",
        description: "Şifreniz başarıyla belirlendi. Giriş sayfasına yönlendiriliyorsunuz.",
      });

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Şifre belirlenirken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-primary rounded-md flex items-center justify-center text-white font-bold mx-auto mb-4">
            N
          </div>
          <p className="text-lg font-medium">Kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-500 rounded-md flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
              <XCircle />
            </div>
            <CardTitle className="text-red-600">Geçersiz Bağlantı</CardTitle>
            <CardDescription>
              Şifre belirleme bağlantısı geçersiz veya süresi dolmuş.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/login')} 
              className="w-full"
            >
              Giriş Sayfasına Dön
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-md flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            N
          </div>
          <h1 className="text-2xl font-bold">Şifre Belirleme</h1>
          <p className="text-muted-foreground mt-2">
            Merhaba {employeeInfo?.first_name}, hesabınızı aktifleştirin
          </p>
        </div>

        <Card className="w-full shadow-lg border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Yeni Şifre Oluştur</CardTitle>
            <CardDescription className="text-center">
              {employeeInfo?.first_name} {employeeInfo?.last_name} - {employeeInfo?.email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Yeni şifrenizi girin"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {password && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Şifre Gereksinimleri:</Label>
                  <div className="space-y-1 text-sm">
                    <div className={`flex items-center gap-2 ${passwordValidation.minLength ? 'text-green-600' : 'text-red-600'}`}>
                      {passwordValidation.minLength ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      En az 8 karakter
                    </div>
                    <div className={`flex items-center gap-2 ${passwordValidation.hasUpper ? 'text-green-600' : 'text-red-600'}`}>
                      {passwordValidation.hasUpper ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      En az bir büyük harf
                    </div>
                    <div className={`flex items-center gap-2 ${passwordValidation.hasLower ? 'text-green-600' : 'text-red-600'}`}>
                      {passwordValidation.hasLower ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      En az bir küçük harf
                    </div>
                    <div className={`flex items-center gap-2 ${passwordValidation.hasNumber ? 'text-green-600' : 'text-red-600'}`}>
                      {passwordValidation.hasNumber ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      En az bir rakam
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Şifrenizi tekrar girin"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Şifreler eşleşmiyor
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-primary hover:bg-primary/90" 
                disabled={isLoading || !passwordValidation.isValid || password !== confirmPassword}
              >
                {isLoading ? "Şifre belirleniyor..." : "Şifreyi Belirle"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
