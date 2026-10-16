import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAsyncAction } from "@/hooks/useAsyncAction";
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

  const validatePassword = (pwd: string) => ({
    minLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasNumber: /\d/.test(pwd),
  });

  const passwordChecks = validatePassword(password);
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const savePassword = useAsyncAction(async () => {
    if (!token || !isPasswordValid || password !== confirmPassword) throw new Error("Şifre gereksinimlerini ve şifre tekrarını kontrol edin.");
    try {
      const result = await setPasswordAction({ token, password });
      if (!result.success) throw new Error("Şifre belirlenemedi.");
    } catch {
      throw new Error("Şifre belirlenemedi. Bağlantınızın süresi dolmuş veya kullanılmış olabilir. Yöneticinizden yeni bağlantı isteyin.");
    }
    setIsSuccess(true);
  });
  const isLoading = savePassword.pending;
  const handleSubmit = (event: React.FormEvent) => { event.preventDefault(); void savePassword.run(); };

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle className="text-center">Geçersiz veya eksik bağlantı</CardTitle></CardHeader>
          <CardContent className="text-center">
            Yöneticinizden yeni bir şifre belirleme bağlantısı isteyin.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authRecord === undefined) {
    return <div className="flex items-center justify-center min-h-screen"><p>Yükleniyor...</p></div>;
  }

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-2xl flex items-center justify-center gap-2 text-primary">
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
            <p className="text-base text-foreground">
              Hesabınız başarıyla aktifleştirildi. Artık <strong>NGS+ mobil uygulaması</strong> üzerinden
              e-posta ve şifrenizle giriş yapabilirsiniz.
            </p>
            <p className="text-sm text-muted-foreground">
              Bu sekmeyi kapatabilirsiniz.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive">Geçersiz Bağlantı</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p>{authRecord ? "Bu şifre belirleme bağlantısının süresi dolmuş." : "Bu şifre belirleme bağlantısı geçersiz."}</p>
            <p className="text-sm text-muted-foreground">
              Yöneticinizden yeni bir kurulum bağlantısı isteyin. Bu sekmeyi kapatabilirsiniz.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/50 p-4">
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
          <form onSubmit={handleSubmit}><fieldset disabled={isLoading} className="space-y-4">
            <div>
              <Label htmlFor="password">Yeni Şifre</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="absolute right-3 top-2.5" aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              {Object.entries({ minLength: "En az 8 karakter", hasUpper: "Büyük harf", hasLower: "Küçük harf", hasNumber: "Rakam" }).map(([k, label]) => (
                <div key={k} className="flex items-center gap-2">
                  {passwordChecks[k as keyof typeof passwordChecks] ? <CheckCircle className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-muted-foreground/60" />}
                  <span className={passwordChecks[k as keyof typeof passwordChecks] ? "text-primary" : "text-muted-foreground/70"}>{label}</span>
                </div>
              ))}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
              <div className="relative">
                <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                <button type="button" className="absolute right-3 top-2.5" aria-label={showConfirmPassword ? "Şifre tekrarını gizle" : "Şifre tekrarını göster"} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !isPasswordValid}>
              {isLoading ? "Kaydediliyor..." : "Şifremi Belirle"}
            </Button>
          </fieldset></form>
        </CardContent>
      </Card>
    </div>
  );
}
