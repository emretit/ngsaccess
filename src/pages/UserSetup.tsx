import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, CheckCircle, XCircle } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function UserSetup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [isLoading, setIsLoading] = useState(false);

  // Davet emailini otomatik doldur
  useEffect(() => {
    if (inviteData?.email) {
      setEmail(inviteData.email);
    }
  }, [inviteData]);

  // Token yoksa veya geçersizse login'e yönlendir
  useEffect(() => {
    if (!token) {
      toast({
        title: "Geçersiz bağlantı",
        description: "Davet bağlantısı geçersiz.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }
    // inviteData null ise (yüklenmiş ama geçersiz)
    if (inviteData === null) {
      toast({
        title: "Davet bulunamadı",
        description: "Davet geçersiz veya süresi dolmuş.",
        variant: "destructive",
      });
      navigate("/login");
    }
  }, [token, inviteData, navigate]);

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
      // Yeni hesap oluştur
      await signIn("password", { email, password, flow: "signUp" });

      // Daveti kullan: rol + proje ata
      await consumeInvite({ token: token!, email });

      toast({ title: "Hesap oluşturuldu", description: "Sisteme başarıyla kaydoldunuz." });
      navigate("/home");
    } catch (error: unknown) {
      const msg = (error as Error)?.message ?? "Bir hata oluştu.";
      // Kullanıcı zaten varsa signIn dene
      if (msg.includes("already") || msg.includes("mevcut")) {
        try {
          await signIn("password", { email, password, flow: "signIn" });
          await consumeInvite({ token: token!, email });
          toast({ title: "Giriş yapıldı", description: "Davet uygulandı." });
          navigate("/home");
        } catch (err2: unknown) {
          toast({ title: "Hata", description: (err2 as Error)?.message ?? "Hata.", variant: "destructive" });
        }
      } else {
        toast({ title: "Hata", description: msg, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Davet verisi yüklenirken bekle
  if (token && inviteData === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Davet kontrol ediliyor...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
            <Lock className="h-6 w-6" />
            Hesap Kurulumu
          </CardTitle>
          <CardDescription className="text-center">
            Davetiniz doğrulandı. Şifrenizi belirleyin.
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
                  className="absolute right-3 top-2.5"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              {Object.entries({
                minLength: "En az 8 karakter",
                hasUpper: "Büyük harf",
                hasLower: "Küçük harf",
                hasNumber: "Rakam",
              }).map(([k, label]) => (
                <div key={k} className="flex items-center gap-2">
                  {passwordChecks[k as keyof typeof passwordChecks]
                    ? <CheckCircle className="h-4 w-4 text-green-500" />
                    : <XCircle className="h-4 w-4 text-gray-300" />}
                  <span className={passwordChecks[k as keyof typeof passwordChecks] ? "text-green-600" : "text-gray-400"}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !isPasswordValid}>
              {isLoading ? "Hesap oluşturuluyor..." : "Hesabı Aktif Et"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
