import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Eye, EyeOff, Home, Lock, Mail, ShieldCheck, User } from 'lucide-react';

import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from '@/hooks/use-toast';

export default function Register() {
  const navigate = useNavigate();
  const { loading, signUp } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // NOT: "girişli kullanıcıyı /home'a at" effect'i KASITLI olarak yok.
  // signUp anında Convex Auth oturum açar; o effect kullanıcıyı bir an dashboard'a
  // atıp (flash) sonra signOut'a takılıyordu. Kayıt sonrası yönlendirmeyi yalnızca
  // handleSubmit yapar → /login?confirmEmail=true. Doğrulanmamış erişim backend
  // guard'ı + AuthProvider tarafından zaten engelleniyor.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedCompanyName = companyName.trim();

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !normalizedCompanyName ||
      !normalizedEmail ||
      !password
    ) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }
    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fullName = `${normalizedFirstName} ${normalizedLastName}`;
      const { error: signUpError } = await signUp(
        normalizedEmail,
        password,
        fullName,
        normalizedCompanyName,
      );
      if (signUpError) {
        const rawMessage =
          (signUpError as Error)?.message ?? 'Kayıt olurken bir hata oluştu.';
        // Convex Auth'un ham "Invalid password" hatasını anlaşılır Türkçe'ye çevir.
        const message = rawMessage.includes('Invalid password')
          ? 'Şifre en az 8 karakter olmalıdır.'
          : rawMessage;
        setError(message);
        toast({
          title: 'Kayıt hatası',
          description: message,
          variant: 'destructive',
        });
        return;
      }
      // Hesap oluştu ve doğrulama maili gönderildi; oturum açılmadı.
      // Pafta modeli: giriş ekranına geç + "mailinizi onaylayın" bilgisi göster.
      toast({
        title: 'Kayıt başarılı',
        description: 'E-posta adresinize bir doğrulama linki gönderdik. Hesabınızı onaylayın.',
      });
      navigate('/login?confirmEmail=true');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Kayıt işlemi kontrol ediliyor..." />;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sol üst - Ana sayfa butonu */}
      <Link
        to="/"
        aria-label="Ana sayfa"
        className="group fixed left-6 top-6 z-50 inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:border-primary/30 hover:shadow-xl"
      >
        <Home className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
        <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">
          Ana sayfa
        </span>
      </Link>

      {/* Sol taraf - Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo ve başlık */}
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <Link
                to="/"
                aria-label="NGS Plus ana sayfa"
                className="transition-transform duration-200 hover:scale-105"
              >
                <img
                  src="/logo.svg"
                  alt="NGS Plus"
                  className="h-24 w-24 cursor-pointer object-contain"
                />
              </Link>
            </div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">PDKS Sistemine Kayıt</h1>
            <p className="text-base text-muted-foreground">
              Yeni hesap oluşturmak için bilgilerinizi girin
            </p>
          </div>

          {/* Kayıt formu */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    autoComplete="given-name"
                    placeholder="Ad"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="h-12 border-border bg-card pl-10 text-base focus:border-primary focus:ring-primary"
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    autoComplete="family-name"
                    placeholder="Soyad"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="h-12 border-border bg-card pl-10 text-base focus:border-primary focus:ring-primary"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  autoComplete="organization"
                  placeholder="Firma adı"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-12 border-border bg-card pl-10 text-base focus:border-primary focus:ring-primary"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="ornek@firma.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 border-border bg-card pl-10 text-base focus:border-primary focus:ring-primary"
                  required
                  disabled={submitting}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="En az 8 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-border bg-card pl-10 pr-12 text-base focus:border-primary focus:ring-primary"
                  required
                  minLength={8}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!firstName || !lastName || !companyName || !email || !password || submitting}
              className="h-12 w-full bg-primary text-base font-semibold text-white shadow-lg transition-all duration-200 hover:bg-primary/90 hover:shadow-xl"
            >
              {submitting ? (
                'Kayıt oluşturuluyor...'
              ) : (
                <span className="flex items-center justify-center">
                  Kayıt Ol
                  <ArrowRight className="ml-2 h-5 w-5" />
                </span>
              )}
            </Button>
          </form>

          {/* Alt linkler */}
          <div className="space-y-3 text-center text-sm">
            <p className="text-muted-foreground">
              Zaten hesabınız var mı?{' '}
              <Link
                to="/login"
                className="font-semibold text-primary transition-colors hover:text-primary/80"
              >
                Giriş yapın
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Sağ taraf - Görsel panel */}
      <div className="relative hidden flex-1 overflow-hidden bg-linear-to-br from-primary to-[#5a1414] lg:flex">
        <div className="absolute inset-0 bg-black/10" />

        {/* Dekoratif daireler */}
        <div className="absolute right-12 top-12 h-28 w-28 rounded-full bg-white/10" />
        <div className="absolute bottom-24 left-16 h-20 w-20 rounded-full bg-white/10" />
        <div className="absolute right-24 top-1/2 h-16 w-16 rounded-full bg-white/5" />

        {/* Mock dashboard kart */}
        <div className="relative z-10 flex w-full items-center justify-center px-12">
          <div className="w-full max-w-md rotate-2 transform rounded-2xl bg-card p-6 shadow-2xl">
            <div className="rounded-xl border border-border bg-muted/50 p-5">
              {/* Header */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                    <ShieldCheck className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-sm font-bold tracking-wide text-foreground">
                    NGS ACCESS
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Çevrimiçi
                </span>
              </div>

              {/* İstatistik kartları */}
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Bugün giriş</div>
                  <div className="mt-1 text-xl font-bold text-foreground">142</div>
                  <div className="mt-2 h-1.5 w-3/4 rounded-full bg-primary/70" />
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Aktif personel</div>
                  <div className="mt-1 text-xl font-bold text-foreground">38</div>
                  <div className="mt-2 h-1.5 w-2/3 rounded-full bg-emerald-400" />
                </div>
              </div>

              {/* Tablo satırları */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-12 rounded bg-muted-foreground/30" />
                  <div className="h-2 flex-1 rounded bg-muted" />
                  <div className="h-2 w-10 rounded bg-muted" />
                </div>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-1.5 w-1/2 rounded bg-muted" />
                      <div className="h-1.5 w-1/3 rounded bg-muted/70" />
                    </div>
                    <div className="h-1.5 w-10 rounded bg-primary/30" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Alt slogan */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-sm font-medium text-white/90">
            Personel devam kontrol sistemi
          </p>
          <p className="mt-1 text-xs text-white/60">Güvenli · Hızlı · Akıllı</p>
        </div>
      </div>
    </div>
  );
}
