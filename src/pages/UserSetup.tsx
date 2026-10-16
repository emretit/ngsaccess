import { useAuth } from "@/components/auth/AuthProvider";
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { Eye, EyeOff, Lock, CheckCircle, XCircle } from "lucide-react";
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
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    if (!token) throw new Error("Davet bağlantısı eksik.");
    if (!existingAccount && (!isPasswordValid || password !== confirmPassword)) {
      throw new Error("Şifre gereksinimlerini ve şifre tekrarını kontrol edin.");
    }
    try {
      await runSetup(async () => {
        await signIn("password", { email, password, flow: existingAccount ? "signIn" : "signUp" });
        await consumeInvite({ token, email });
      });
    } catch {
      throw new Error("Kurulum tamamlanamadı. Hesabınız oluştuysa mevcut hesabınızla devam edin; davet için yöneticinizden yeni bağlantı isteyebilirsiniz.");
    }
    setCompleted(true);
  });
  const isLoading = setup.pending;
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void setup.run();
  };

  if (completed) return <div className="min-h-screen flex flex-col items-center justify-center gap-4"><h1>Hesabınız etkinleştirildi</h1><Button disabled={!user || user.verified === false} onClick={() => navigate("/home")}>{!user || user.verified === false ? "Oturum hazırlanıyor..." : "Ana sayfaya geç"}</Button></div>;
  if (!token || inviteData === null || inviteData?.type === "reset") return <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4"><h1>Bu bağlantıyla kurulum yapılamıyor</h1><p>Bağlantı eksik, kullanılmış veya süresi dolmuş olabilir. Yöneticinizden yeni davet isteyin. Şifre sıfırlama bu ekranda desteklenmiyor.</p><Link to="/login" className="text-primary underline">Mevcut hesabımla giriş yap</Link></div>;

  // Davet verisi yüklenirken bekle
  if (token && inviteData === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Davet kontrol ediliyor...</p>
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
          <Button type="button" variant="outline" className="mb-4 w-full" disabled={isLoading} onClick={() => setExistingAccount((value) => !value)}>{existingAccount ? "Yeni hesap oluştur" : "Mevcut hesabımla devam et"}</Button>
          <form onSubmit={handleSubmit}><fieldset disabled={isLoading} className="space-y-4">
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
              <Label htmlFor="password">Şifre</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  className="absolute right-3 top-2.5"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
                    : <XCircle className="h-4 w-4 text-muted-foreground/60" />}
                  <span className={passwordChecks[k as keyof typeof passwordChecks] ? "text-primary" : "text-muted-foreground/70"}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div hidden={existingAccount}>
              <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={!existingAccount}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || (!existingAccount && !isPasswordValid)}>
              {isLoading ? "Hesap oluşturuluyor..." : "Hesabı Aktif Et"}
            </Button>
          </fieldset></form>
        </CardContent>
      </Card>
    </div>
  );
}
