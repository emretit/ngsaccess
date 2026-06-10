import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { ArrowRight, Eye, EyeOff, Home, Lock, Mail, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';

import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from '@/hooks/use-toast';
import { api } from '@/lib/convexApi';

export default function Login() {
  const navigate = useNavigate();
  const { user, loading, signIn } = useAuth();
  const hasAdmin = useQuery(api.users.hasSuperAdmin);
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Kayıttan yeni gelindi mi? (Register → /login?confirmEmail=true)
  const [showConfirmBanner, setShowConfirmBanner] = useState(
    searchParams.get('confirmEmail') === 'true',
  );
  // Doğrulanmamış hesapla giriş denendi mi? (signIn guard tetikledi)
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const requestVerification = useMutation(api.emailVerification.requestVerification);

  useEffect(() => {
    // Yalnızca DOĞRULANMIŞ kullanıcıyı /home'a yönlendir. Doğrulanmamış (verified=false)
    // kullanıcı signUp sonrası bir an oturumlu görünebilir; onu /home'a atma (dashboard
    // flash'ı) — AuthProvider zaten signOut edip burada tutacak.
    if (!loading && user && user.verified !== false) {
      navigate('/home');
    }
  }, [user, loading, navigate]);

  const handleResend = async () => {
    if (!email || resending || resendDone) return;
    setResending(true);
    try {
      await requestVerification({ email: email.trim().toLowerCase() });
      setResendDone(true);
      toast({ title: 'Doğrulama maili gönderildi', description: 'Gelen kutunuzu kontrol edin.' });
    } catch {
      toast({ title: 'Gönderilemedi', description: 'Lütfen birkaç dakika sonra tekrar deneyin.', variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('E-posta ve şifre alanlarını doldurun.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setShowConfirmBanner(false);
    setEmailNotConfirmed(false);
    try {
      const { error: signInError } = await signIn(email.trim().toLowerCase(), password);
      if (signInError) {
        const message =
          (signInError as Error)?.message ?? 'Giriş yapılırken bir hata oluştu.';
        // Doğrulanmamış hesap → sarı bilgi banner'ı göster, kırmızı hata değil.
        if (message.includes('doğrula')) {
          setEmailNotConfirmed(true);
          return;
        }
        setError(message);
        toast({
          title: 'Giriş hatası',
          description: message,
          variant: 'destructive',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Giriş kontrol ediliyor..." />;
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
            <h1 className="mb-2 text-3xl font-bold text-foreground">PDKS Sistemine Giriş</h1>
            <p className="text-base text-muted-foreground">
              Hesabınıza erişmek için bilgilerinizi girin
            </p>
          </div>

          {/* Kayıt sonrası: doğrulama maili gönderildi bilgisi */}
          {showConfirmBanner && !emailNotConfirmed && (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/40">
              <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Hesabınız oluşturuldu. E-posta adresinize bir{' '}
                <span className="font-semibold">doğrulama linki</span> gönderdik. Giriş yapmadan
                önce maildeki <span className="font-semibold">Hesabı Doğrula</span> butonuna tıklayın.
                Mail birkaç dakika içinde gelmezse spam klasörünü kontrol edin.
              </p>
            </div>
          )}

          {/* Doğrulanmamış hesapla giriş denendi */}
          {emailNotConfirmed && (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950/40">
              <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  E-posta adresiniz henüz doğrulanmamış. Size gönderdiğimiz maildeki{' '}
                  <span className="font-semibold">Hesabı Doğrula</span> butonuna tıkladıktan sonra
                  giriş yapabilirsiniz.
                </p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || resendDone || !email}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-yellow-300"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                  {resendDone ? 'Mail gönderildi' : resending ? 'Gönderiliyor...' : 'Tekrar gönder'}
                </button>
              </div>
            </div>
          )}

          {/* Giriş formu */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
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
                  autoComplete="current-password"
                  placeholder="Şifreniz"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-border bg-card pl-10 pr-12 text-base focus:border-primary focus:ring-primary"
                  required
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
              disabled={!email || !password || submitting}
              className="h-12 w-full bg-primary text-base font-semibold text-white shadow-lg transition-all duration-200 hover:bg-primary/90 hover:shadow-xl"
            >
              {submitting ? (
                'Giriş yapılıyor...'
              ) : (
                <span className="flex items-center justify-center">
                  Giriş Yap
                  <ArrowRight className="ml-2 h-5 w-5" />
                </span>
              )}
            </Button>
          </form>

          {/* Alt linkler */}
          <div className="space-y-3 text-center text-sm">
            <p className="text-muted-foreground">
              Hesabınız yok mu?{' '}
              <Link
                to="/register"
                className="font-semibold text-primary transition-colors hover:text-primary/80"
              >
                Hemen kayıt olun
              </Link>
            </p>
            {hasAdmin === false && (
              <p className="text-muted-foreground">
                Henüz yönetici yok mu?{' '}
                <Link
                  to="/admin-setup"
                  className="font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  İlk kurulumu yapın
                </Link>
              </p>
            )}
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
