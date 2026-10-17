import { ErrorState } from "@/components/shared/ErrorState";
import { PasswordField } from "@/components/shared/PasswordField";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { Lock, CheckCircle, XCircle, Smartphone } from "lucide-react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function EmployeeSetup() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [formError, setFormError] = useState<string | null>(null);
  const fail: (message: string) => never = (message) => { setFormError(message); document.getElementById("password")?.focus(); throw new Error(message); };
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    setFormError(null);
    if (!token || !isPasswordValid || password !== confirmPassword) fail("Şifre gereksinimlerini ve şifre tekrarını kontrol edin.");
    try {
      const result = await setPasswordAction({ token, password });
      if (!result.success) fail("Şifre belirlenemedi.");
    } catch {
      fail("Şifre belirlenemedi. Bağlantınızın süresi dolmuş veya kullanılmış olabilir. Yöneticinizden yeni bağlantı isteyin.");
    }
    setIsSuccess(true);
  });
  const isLoading = savePassword.pending;
  useEffect(() => {
    if (formError && !isLoading) document.getElementById("password")?.focus();
  }, [formError, isLoading]);
  const handleSubmit = (event: React.FormEvent) => { event.preventDefault(); void savePassword.run(); };

  if (!token) return <main className="min-h-screen flex items-center justify-center p-4"><ErrorState title="Geçersiz veya eksik bağlantı" description="Yöneticinizden yeni bir şifre belirleme bağlantısı isteyin." /></main>;

  if (authRecord === undefined) {
    return <div className="flex items-center justify-center min-h-screen"><SectionSkeleton label="Bağlantı kontrol ediliyor" className="w-full max-w-md p-4" /></div>;
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
              Hesabınız etkinleştirildi. Mobil uygulama dağıtım bağlantısı henüz sunulmuyor.
            </p>
            <p className="text-sm text-muted-foreground">
              Şimdilik işyerinizin web QR girişini kullanın. QR giriş adresi ve kurulum yardımı için yöneticinize başvurun.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tokenValid) return <main className="min-h-screen flex items-center justify-center p-4"><ErrorState title="Geçersiz bağlantı" description={authRecord ? "Bu şifre belirleme bağlantısının süresi dolmuş. Yöneticinizden yeni bağlantı isteyin." : "Bu bağlantı geçersiz veya kullanılmış. Yöneticinizden yeni bağlantı isteyin."} /></main>;

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
            <Lock className="h-6 w-6" />
            Şifre Belirle
          </CardTitle>
          <CardDescription className="text-center">
            {authRecord?.email && <span>E-posta: <strong>{authRecord.email}</strong></span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={handleSubmit}><fieldset disabled={isLoading} className="space-y-4">
            <div>
              <Label htmlFor="password">Yeni Şifre</Label>
              <PasswordField aria-invalid={Boolean(formError)} aria-describedby={formError ? "setup-error" : "password-help"} disabled={isLoading} id="password"  value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-1 text-sm">
              {Object.entries({ minLength: "En az 8 karakter", hasUpper: "Büyük harf", hasLower: "Küçük harf", hasNumber: "Rakam" }).map(([k, label]) => (
                <div key={k} className="flex items-center gap-2">
                  {passwordChecks[k as keyof typeof passwordChecks] ? <CheckCircle className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}
                  <span className={passwordChecks[k as keyof typeof passwordChecks] ? "text-primary" : "text-muted-foreground"}>{label}</span>
                </div>
              ))}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
              <PasswordField aria-invalid={Boolean(formError)} aria-describedby={formError ? "setup-error" : "password-help"} disabled={isLoading} id="confirmPassword"  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <p id="password-help" className="text-xs text-muted-foreground">Yeni şifre en az 8 karakter, büyük harf, küçük harf ve rakam içermelidir.</p>
            {formError && <p id="setup-error" role="alert" className="text-sm text-destructive">{formError}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Kaydediliyor..." : "Şifremi Belirle"}
            </Button>
          </fieldset></form>
        </CardContent>
      </Card>
    </div>
  );
}
