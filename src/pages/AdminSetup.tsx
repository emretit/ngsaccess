import { useAuth } from "@/components/auth/AuthProvider";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convexApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Lock, Shield } from "lucide-react";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export default function AdminSetup() {
  const navigate = useNavigate();
  const { runSetup, user } = useAuth();
  const { signIn: convexSignIn } = useAuthActions();
  const hasAdmin = useQuery(api.users.hasSuperAdmin);
  const initializeAdmin = useMutation(api.users.initializeAdmin);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [existingAccount, setExistingAccount] = useState(false);
  const [completed, setCompleted] = useState(false);

  const setup = useAsyncAction(async () => {
    if (!email || password.length < 8 || !secret) throw new Error("E-posta, en az 8 karakterlik şifre ve kurulum kodu gereklidir.");
    try {
      await runSetup(async () => {
        await convexSignIn("password", { email: email.trim().toLowerCase(), password, name: email.split("@")[0], flow: existingAccount ? "signIn" : "signUp" });
        await initializeAdmin({ secret });
      });
    } catch {
      throw new Error("Kurulum tamamlanamadı. Bilgilerinizi ve kurulum kodunu kontrol edin. Hesabınız oluştuysa mevcut hesap seçeneğiyle devam edin veya kurulum sorumlusuna başvurun.");
    }
    setCompleted(true);
  });
  const isLoading = setup.pending;
  const handleSubmit = (event: React.FormEvent) => { event.preventDefault(); void setup.run(); };

  if (completed) return <div className="min-h-screen flex flex-col items-center justify-center gap-4"><h1>Yönetici kurulumu tamamlandı</h1><Button disabled={!user || user.verified === false} onClick={() => navigate("/home")}>{!user || user.verified === false ? "Oturum hazırlanıyor..." : "Ana sayfaya geç"}</Button></div>;

  if (hasAdmin === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Kontrol ediliyor...</p>
      </div>
    );
  }

  if (hasAdmin === true) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4"><h1>{isLoading ? "Kurulum tamamlanıyor..." : "İlk yönetici kurulumu tamamlanmış"}</h1><Button disabled={isLoading} onClick={() => navigate("/login")}>Giriş yap</Button></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            İlk Yönetici Kurulumu
          </CardTitle>
          <CardDescription className="text-center">
            İlk yönetici hesabını kurulum sorumlusundan aldığınız kodla etkinleştirin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="mb-4 w-full" disabled={isLoading} onClick={() => setExistingAccount((value) => !value)}>{existingAccount ? "Yeni hesap oluştur" : "Mevcut hesabımla devam et"}</Button>
          <form onSubmit={handleSubmit}><fieldset disabled={isLoading} className="space-y-4">
            <div>
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@firma.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="En az 8 karakter"
              />
            </div>
            <div>
              <Label htmlFor="secret" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Kurulum kodu
              </Label>
              <Input
                id="secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                required
                placeholder="Kurulum kodunuz"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Kurulum kodunu bilmiyorsanız kurulum sorumlusuna başvurun.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Kuruluyor..." : "Süper Admin Oluştur"}
            </Button>
          </fieldset></form>
        </CardContent>
      </Card>
    </div>
  );
}
