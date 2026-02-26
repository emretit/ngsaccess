import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

const DemoRequestForm = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error: signUpError } = await signUp(email, password, `${firstName} ${lastName}`);
      if (signUpError) {
        toast({
          title: "Kayıt hatası",
          description: (signUpError as Error)?.message ?? "Kayıt olurken bir hata oluştu.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Demo kaydı başarılı!",
        description: "Hesabınız oluşturuldu. Giriş yapabilirsiniz.",
      });
      navigate("/login");
    } catch (error: unknown) {
      toast({
        title: "Kayıt hatası",
        description: (error as Error)?.message ?? "Kayıt olurken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full shadow-lg border-0">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Demo Talep Formu</CardTitle>
        <CardDescription className="text-center">
          PDKS sistemi demo sürümüne erişim için bilgilerinizi giriniz.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Input id="firstName" type="text" placeholder="Ad" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              <Input id="lastName" type="text" placeholder="Soyad" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
            <Input id="email" type="email" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input id="companyName" type="text" placeholder="Firma Adı" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            <Input id="password" type="password" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <Button type="submit" className="w-full h-11 bg-[#711A1A] hover:bg-[#5a1515]" disabled={isLoading}>
              {isLoading ? "Demo erişimi oluşturuluyor..." : "Demo Talep Et"}
            </Button>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <div className="text-sm text-center text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <button onClick={() => navigate("/login")} className="text-[#711A1A] cursor-pointer hover:underline">
            Giriş yapın
          </button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default DemoRequestForm;
