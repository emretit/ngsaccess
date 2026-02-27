import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convexApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Lock, Shield } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function AdminSetup() {
  const navigate = useNavigate();
  const { signIn: convexSignIn } = useAuthActions();
  const hasAdmin = useQuery(api.users.hasSuperAdmin);
  const initializeAdmin = useMutation(api.users.initializeAdmin);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (hasAdmin === true) {
      navigate("/login");
    }
  }, [hasAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !secret) {
      toast({ title: "Hata", description: "Tüm alanları doldurun.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      try {
        await convexSignIn("password", { email, password, name: email.split("@")[0], flow: "signUp" });
      } catch {
        await convexSignIn("password", { email, password, flow: "signIn" });
      }
      await initializeAdmin({ secret });
      toast({ title: "Kurulum tamamlandı", description: "Süper admin olarak giriş yaptınız." });
      navigate("/home");
    } catch (error: unknown) {
      const msg = (error as Error)?.message ?? "Bir hata oluştu.";
      toast({ title: "Kurulum başarısız", description: msg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (hasAdmin === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Kontrol ediliyor...</p>
      </div>
    );
  }

  if (hasAdmin === true) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            İlk Yönetici Kurulumu
          </CardTitle>
          <CardDescription className="text-center">
            Henüz sistemde yönetici yok. ADMIN_SETUP_SECRET ile ilk süper admini oluşturun.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="••••••••"
              />
            </div>
            <div>
              <Label htmlFor="secret" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Kurulum Gizli Kodu
              </Label>
              <Input
                id="secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                required
                placeholder="Convex env: ADMIN_SETUP_SECRET"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Convex Dashboard → Settings → Environment Variables
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Kuruluyor..." : "Süper Admin Oluştur"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
