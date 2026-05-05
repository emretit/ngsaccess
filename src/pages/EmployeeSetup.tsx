import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, CheckCircle, XCircle, Smartphone } from "lucide-react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function EmployeeSetup() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const authRecord = useQuery(
    api.employeeAuth.getByToken,
    token ? { token } : "skip"
  );

  const setPasswordAction = useAction(api.actions.setPassword.setEmployeePassword);

  const tokenValid =
    authRecord !== undefined &&
    authRecord !== null &&
    authRecord.tokenExpiresAt
      ? new Date(authRecord.tokenExpiresAt) > new Date()
      : false;

  useEffect(() => {
    if (!token) {
      toast({
        title: "Geçersiz bağlantı",
        description: "Şifre belirleme bağlantısı geçersiz.",
        variant: "destructive",
      });
    }
  }, [token]);

  const validatePassword = (pwd: string) => ({
    minLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasNumber: /\d/.test(pwd),
  });

  const passwordChecks = validatePassword(password);
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!isPasswordValid) {
      toast({ title: "Hata", description: "Şifre gereksinimleri karşılanmıyor.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Hata", description: "Şifreler eşleşmiyor.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const result = await setPasswordAction({ token, password });
      if (!result.success) {
        toast({ title: "Hata", description: result.error ?? "Şifre belirlenemedi.", variant: "destructive" });
        return;
      }
      setIsSuccess(true);
    } catch (error: unknown) {
      toast({ title: "Hata", description: (error as Error)?.message ?? "Bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (authRecord === undefined) {
    return <div className="flex items-center justify-center min-h-screen"><p>Yükleniyor...</p></div>;
  }

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-2xl flex items-center justify-center gap-2 text-green-600">
              <CheckCircle className="h-7 w-7" />
              Şifreniz Belirlendi
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Smartphone className="h-10 w-10 text-primary" />
              </div>
            </div>
            <p className="text-base text-gray-700">
              Hesabınız başarıyla aktifleştirildi. Artık <strong>NGS+ mobil uygulaması</strong> üzerinden
              e-posta ve şifrenizle giriş yapabilirsiniz.
            </p>
            <p className="text-sm text-gray-500">
              Bu sekmeyi kapatabilirsiniz.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Geçersiz Bağlantı</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p>Bu şifre belirleme bağlantısı geçersiz veya süresi dolmuş.</p>
            <p className="text-sm text-muted-foreground">
              Yöneticinizden yeni bir kurulum bağlantısı isteyin. Bu sekmeyi kapatabilirsiniz.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
            <Lock className="h-6 w-6" />
            Şifre Belirle
          </CardTitle>
          <CardDescription className="text-center">
            {authRecord?.email && <p>E-posta: <strong>{authRecord.email}</strong></p>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Yeni Şifre</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="absolute right-3 top-2.5" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              {Object.entries({ minLength: "En az 8 karakter", hasUpper: "Büyük harf", hasLower: "Küçük harf", hasNumber: "Rakam" }).map(([k, label]) => (
                <div key={k} className="flex items-center gap-2">
                  {passwordChecks[k as keyof typeof passwordChecks] ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-gray-300" />}
                  <span className={passwordChecks[k as keyof typeof passwordChecks] ? "text-green-600" : "text-gray-400"}>{label}</span>
                </div>
              ))}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
              <div className="relative">
                <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                <button type="button" className="absolute right-3 top-2.5" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !isPasswordValid}>
              {isLoading ? "Kaydediliyor..." : "Şifremi Belirle"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
