import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, CheckCircle, XCircle } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";

export default function UserSetup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const { signIn } = useAuthActions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      toast({
        title: "Geçersiz bağlantı",
        description: "Şifre belirleme bağlantısı geçersiz.",
        variant: "destructive",
      });
      navigate("/login");
    }
  }, [token, navigate]);

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
    if (!email) {
      toast({ title: "Hata", description: "E-posta adresi gereklidir.", variant: "destructive" });
      return;
    }
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
      await signIn("password", { email, password, flow: "signIn" });
      toast({ title: "Başarılı", description: "Hesabınız aktif edildi." });
      navigate("/home");
    } catch (error: unknown) {
      toast({ title: "Hata", description: (error as Error)?.message ?? "Bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
            <Lock className="h-6 w-6" />
            Hesap Kurulumu
          </CardTitle>
          <CardDescription className="text-center">
            E-posta adresinizi ve şifrenizi belirleyin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Şifre</Label>
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
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || !isPasswordValid}>
              {isLoading ? "Kaydediliyor..." : "Hesabı Aktif Et"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
