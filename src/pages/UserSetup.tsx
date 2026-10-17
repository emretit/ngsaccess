import { PasswordField } from "@/components/shared/PasswordField";
import { ErrorState } from "@/components/shared/ErrorState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useAuth } from "@/components/auth/AuthProvider";
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { Lock, CheckCircle, XCircle } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function UserSetup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { runSetup, user } = useAuth();
  const token = searchParams.get("token");
  const { signIn } = useAuthActions();
  const consumeInvite = useMutation(api.invites.consume);

  // Token ile davet bilgisini al (email pre-fill)
  const inviteData = useQuery(
    api.invites.verify,
    token ? { token } : "skip"
  );

  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const fail: (message: string) => never = (message) => { setFormError(message); document.getElementById("password")?.focus(); throw new Error(message); };
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [existingAccount, setExistingAccount] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Davet emailini otomatik doldur
  useEffect(() => {
    if (inviteData?.email) {
      setEmail(inviteData.email);
    }
  }, [inviteData]);

  const validatePassword = (pwd: string) => ({
    minLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasNumber: /\d/.test(pwd),
  });

  const passwordChecks = validatePassword(password);
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const setup = useAsyncAction(async () => {
    setFormError(null);
    if (!password) fail("Şifrenizi girin.");
    if (!token) fail("Davet bağlantısı eksik.");
    if (!existingAccount && (!isPasswordValid || password !== confirmPassword)) {
      fail("Şifre gereksinimlerini ve şifre tekrarını kontrol edin.");
    }
    try {
      await runSetup(async () => {
        await signIn("password", { email, password, flow: existingAccount ? "signIn" : "signUp" });
        await consumeInvite({ token, email });
      });
    } catch {
      fail("Kurulum tamamlanamadı. Hesabınız oluştuysa mevcut hesabınızla devam edin; davet için yöneticinizden yeni bağlantı isteyebilirsiniz.");
    }
    setCompleted(true);
  });
  const isLoading = setup.pending;
  useEffect(() => {
    if (formError && !isLoading) document.getElementById("password")?.focus();
  }, [formError, isLoading]);
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void setup.run();
  };

  if (completed) return <div className="min-h-screen flex flex-col items-center justify-center gap-4"><h1>Hesabınız etkinleştirildi</h1><Button disabled={!user || user.verified === false} onClick={() => navigate("/home")}>{!user || user.verified === false ? "Oturum hazırlanıyor..." : "Ana sayfaya geç"}</Button></div>;
  if (!token || inviteData === null || inviteData?.type === "reset") return <div className="min-h-screen flex flex-col items-center justify-center p-4">
    <ErrorState title={inviteData?.type === "reset" ? "Şifre sıfırlama henüz desteklenmiyor" : "Davet bağlantısı geçersiz"}
      description={inviteData?.type === "reset" ? "Bu ekran yalnız hesap davetleri içindir. Şifre yardımı için yöneticinizle iletişime geçin." : "Bağlantı eksik, kullanılmış veya süresi dolmuş olabilir. Yöneticinizden yeni davet isteyin."} />
    <Link to="/login" className="text-primary underline">Mevcut hesabımla giriş yap</Link>
  </div>;

  // Davet verisi yüklenirken bekle
  if (token && inviteData === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <SectionSkeleton label="Davet kontrol ediliyor" className="w-full max-w-md p-4" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
            <Lock className="h-6 w-6" />
            Hesap Kurulumu
          </CardTitle>
          <CardDescription className="text-center">
            Davetiniz doğrulandı. Mevcut hesabınızla devam edin veya yeni hesap oluşturun.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p role="status" className="mb-3 text-sm font-medium">{existingAccount ? "Mevcut hesapla daveti kabul et" : "Yeni hesap oluştur ve daveti kabul et"}</p>
          <Button type="button" variant="outline" className="mb-4 w-full" disabled={isLoading} onClick={() => setExistingAccount((value) => !value)}>{existingAccount ? "Yeni hesap oluştur" : "Mevcut hesabımla devam et"}</Button>
          <form noValidate onSubmit={handleSubmit}><fieldset disabled={isLoading} className="space-y-4">
            <div>
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!!inviteData?.email}
                className={inviteData?.email ? "bg-muted" : ""}
              />
            </div>
            <div>
              <Label htmlFor="password">{existingAccount ? "Mevcut şifreniz" : "Yeni şifre"}</Label>
              <PasswordField aria-invalid={Boolean(formError)} aria-describedby={formError ? "setup-error" : "password-help"} disabled={isLoading}
                  id="password"

                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
            </div>
            <div hidden={existingAccount} className="space-y-1 text-sm">
              {Object.entries({
                minLength: "En az 8 karakter",
                hasUpper: "Büyük harf",
                hasLower: "Küçük harf",
                hasNumber: "Rakam",
              }).map(([k, label]) => (
                <div key={k} className="flex items-center gap-2">
                  {passwordChecks[k as keyof typeof passwordChecks]
                    ? <CheckCircle className="h-4 w-4 text-primary" />
                    : <XCircle className="h-4 w-4 text-muted-foreground" />}
                  <span className={passwordChecks[k as keyof typeof passwordChecks] ? "text-primary" : "text-muted-foreground"}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div hidden={existingAccount}>
              <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
              <PasswordField disabled={isLoading} aria-invalid={Boolean(formError)} aria-describedby={formError ? "setup-error" : "password-help"}
                id="confirmPassword"

                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={!existingAccount}
              />
            </div>
            <p id="password-help" className="text-xs text-muted-foreground">Yeni şifre en az 8 karakter, büyük harf, küçük harf ve rakam içermelidir.</p>
            {formError && <p id="setup-error" role="alert" className="text-sm text-destructive">{formError}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Hesap oluşturuluyor..." : "Hesabı Aktif Et"}
            </Button>
          </fieldset></form>
        </CardContent>
      </Card>
    </div>
  );
}
