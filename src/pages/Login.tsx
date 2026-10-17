import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { PasswordField } from "@/components/shared/PasswordField";
import { loginSchema, emailSchema, fieldMessages } from "@/components/shared/authFormSchemas";
import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { ArrowRight, Home, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';

import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { api } from '@/lib/convexApi';

export default function Login() {
  const { loading, signIn, verificationEmail } = useAuth();
  const hasAdmin = useQuery(api.users.hasSuperAdmin);
  const [searchParams] = useSearchParams();

  const location = useLocation();
  const savedEmail: unknown = location.state?.email;
  const [email, setEmail] = useState(typeof savedEmail === 'string' ? savedEmail : '');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // Kayıttan yeni gelindi mi? (Register → /login?confirmEmail=true)
  const [showConfirmBanner] = useState(
    searchParams.get('confirmEmail') === 'true',
  );
  // Doğrulanmamış hesapla giriş denendi mi? (signIn guard tetikledi)
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resendDone, setResendDone] = useState(false);
  const requestVerification = useMutation(api.emailVerification.requestVerification);

  useEffect(() => {
    if (!verificationEmail) return;
    setEmail(verificationEmail);
    setEmailNotConfirmed(true);
  }, [verificationEmail]);

  useEffect(() => {
    setResendDone(false);
    setCooldown(0);
  }, [email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = useAsyncAction(async () => {
    if (!email || cooldown > 0) return;
    try {
      await requestVerification({ email: email.trim().toLowerCase() });
    } catch {
      throw new Error('Gönderim istenemedi. Birkaç dakika sonra tekrar deneyin.');
    }
    setResendDone(true);
    setCooldown(60);
  });
  const resending = resend.pending;
  const handleResend = () => {
    const result = emailSchema.safeParse(email);
    if (!result.success) { setFieldErrors({ email: result.error.issues[0]?.message ?? "E-posta adresinizi kontrol edin." }); document.getElementById("email")?.focus(); return; }
    setFieldErrors({});
    void resend.run();
  };

  const login = useAsyncAction(async () => {
    if (!email || !password) throw new Error('E-posta ve şifre alanlarını doldurun.');
    setError(null);
    const result = await signIn(email.trim().toLowerCase(), password);
    if (result.error) {
      const message = 'Giriş yapılamadı. E-posta ve şifrenizi kontrol edin; hesabınız doğrulanmadıysa yeni bağlantı isteyin.';
      setError(message);
      document.getElementById("email")?.focus();
      throw new Error(message);
    }
  });
  const submitting = login.pending;
  useEffect(() => {
    if (error && !submitting) document.getElementById("email")?.focus();
  }, [error, submitting]);
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setFieldErrors(fieldMessages(result.error));
      document.getElementById(String(result.error.issues[0]?.path[0]))?.focus();
      return;
    }
    setFieldErrors({});
    void login.run();
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
        className="group absolute left-6 top-6 z-50 inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:border-primary/30 hover:shadow-xl"
      >
        <Home className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
        <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">
          Ana sayfa
        </span>
      </Link>

      {/* Sol taraf - Form */}
      <div className="flex flex-1 items-center justify-center px-6 pb-12 pt-28 sm:px-8">
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
            <div className="flex items-start gap-3 rounded-lg border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning-subtle))] p-4  ">
              <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-[hsl(var(--warning))] " />
              <p className="text-sm text-[hsl(var(--warning))] ">
                Hesabınız oluşturuldu. Giriş için e-posta adresinizi doğrulayın. Mail ulaşmadıysa aşağıdan yeni bağlantı isteyin; yeniden kayıt olmanız gerekmez.
              </p>
            </div>
          )}

          {/* Doğrulanmamış hesapla giriş denendi */}
          {(emailNotConfirmed || showConfirmBanner) && (
            <div className="flex items-start gap-3 rounded-lg border border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning-subtle))] p-4  ">
              <MailCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-[hsl(var(--warning))] " />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-[hsl(var(--warning))] ">
                  E-posta adresiniz henüz doğrulanmamış. Size gönderdiğimiz maildeki{' '}
                  <span className="font-semibold">Hesabı Doğrula</span> butonuna tıkladıktan sonra
                  giriş yapabilirsiniz.
                </p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || cooldown > 0 || !email}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--warning))] underline-offset-2 hover:underline disabled:opacity-50 "
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                  {cooldown > 0 ? `${cooldown} saniye sonra tekrar isteyin` : resending ? 'Gönderiliyor...' : 'Doğrulama bağlantısını tekrar iste'}
                </button>
              </div>
            </div>
          )}

          {!emailNotConfirmed && !showConfirmBanner && <Button variant="outline" disabled={resending || cooldown > 0 || !email} onClick={handleResend}>Doğrulama bağlantısı iste</Button>}
          {resendDone && <p role="status" className="text-sm text-muted-foreground">Doğrulama gerekiyorsa bağlantı gönderimi istendi. Gelen kutunuzu ve spam klasörünü kontrol edin.</p>}
          {/* Giriş formu */}
          <form noValidate onSubmit={handleSubmit} className="space-y-5">
            <fieldset disabled={submitting} className="space-y-4">
              <FormFieldWrapper htmlFor="email" label="E-posta" error={fieldErrors.email}>
                <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} aria-describedby={error ? "form-error" : undefined} aria-invalid={Boolean(error || fieldErrors.email)} />
              </FormFieldWrapper>
              <FormFieldWrapper htmlFor="password" label="Şifre" error={fieldErrors.password}>
                <PasswordField autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} aria-describedby={error ? "form-error" : undefined} aria-invalid={Boolean(error || fieldErrors.password)} />
              </FormFieldWrapper>
            </fieldset>

            {error && (
              <div id="form-error" role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full bg-primary text-base font-semibold text-primary-foreground shadow-lg transition-all duration-200 hover:bg-primary/90 hover:shadow-xl"
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
      <div className="relative hidden flex-1 overflow-hidden bg-primary lg:flex">
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
                    <ShieldCheck className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="text-sm font-bold tracking-wide text-foreground">
                    NGS ACCESS
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--success-subtle))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--success))]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
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
                  <div className="mt-2 h-1.5 w-2/3 rounded-full bg-[hsl(var(--success))]" />
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
          <p className="text-sm font-medium text-primary-foreground">
            Personel devam kontrol sistemi
          </p>
          <p className="mt-1 text-xs text-primary-foreground">Güvenli · Hızlı · Akıllı</p>
        </div>
      </div>
    </div>
  );
}
