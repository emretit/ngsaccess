import { FormFieldWrapper } from '@/components/shared/FormFieldWrapper';
import { PasswordField } from '@/components/shared/PasswordField';
import { loginSchema, emailSchema, fieldMessages } from '@/components/shared/authFormSchemas';
import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { MailCheck } from 'lucide-react';

import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthShell } from '@/components/public/AuthShell';
import { StatusScreen } from '@/components/public/StatusScreen';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api } from '@/lib/convexApi';

export default function Login() {
  usePageTitle('Giriş yap');
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
  const [showConfirmBanner] = useState(searchParams.get('confirmEmail') === 'true');
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
      throw new Error('Gönderim istenemedi. Birkaç dakika sonra yeniden deneyin.');
    }
    setResendDone(true);
    setCooldown(60);
  });
  const resending = resend.pending;
  const handleResend = () => {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setFieldErrors({ email: result.error.issues[0]?.message ?? 'E-posta adresinizi kontrol edin.' });
      document.getElementById('email')?.focus();
      return;
    }
    setFieldErrors({});
    void resend.run();
  };

  const login = useAsyncAction(async () => {
    if (!email || !password) throw new Error('E-posta ve şifre alanlarını doldurun.');
    setError(null);
    const result = await signIn(email.trim().toLowerCase(), password);
    if (result.error) {
      const message = 'Giriş yapılamadı. E-posta adresinizi ve şifrenizi kontrol edin.';
      setError(message);
      document.getElementById('email')?.focus();
      throw new Error(message);
    }
  });
  const submitting = login.pending;
  useEffect(() => {
    if (error && !submitting) document.getElementById('email')?.focus();
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

  if (loading)
    return (
      <StatusScreen
        tone="loading"
        title="Oturumunuz kontrol ediliyor."
        description="Bu sayfayı açık tutun."
      />
    );

  const verificationQueued: unknown = location.state?.verificationQueued;
  return (
    <AuthShell
      title="NGS Plus’a giriş yapın."
      description="İşyerinizin yönetim alanına devam edin."
      footer={
        <>
          <p>
            Hesabınız yok mu? <Link to="/register">Hesap oluştur</Link>
          </p>
          {hasAdmin === false && (
            <Link to="/admin-setup" className="mt-3 inline-flex min-h-11 items-center">
              İlk yönetici kurulumu
            </Link>
          )}
        </>
      }
    >
      {(showConfirmBanner || emailNotConfirmed) && (
        <div
          className="mb-6 flex items-start gap-3 rounded-md border border-line bg-subtle p-4"
          data-testid="verification-notice"
        >
          <MailCheck aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 text-sm leading-relaxed">
            <strong className="mb-1 block font-semibold">E-posta doğrulaması bekleniyor</strong>
            <p>
              {showConfirmBanner
                ? verificationQueued === false
                  ? 'Hesabınız oluşturuldu. Doğrulama e-postasının gönderimi tamamlanamadı. E-posta adresinizle yeni bağlantı isteyin; yeniden kayıt olmanız gerekmez.'
                  : 'Hesabınız oluşturuldu. Giriş yapmak için e-posta adresinizi doğrulayın. Gelen kutunuzu ve spam klasörünü kontrol edin; yeniden kayıt olmanız gerekmez.'
                : 'Giriş yapmak için e-posta adresinizi doğrulayın. Gelen kutunuzdaki doğrulama bağlantısını açın veya yeni bağlantı isteyin.'}
            </p>
            <button
              type="button"
              disabled={resending || cooldown > 0 || !email.trim()}
              onClick={handleResend}
              className="inline-flex min-h-11 items-center text-left font-semibold text-primary underline underline-offset-4 disabled:opacity-50"
            >
              {cooldown > 0
                ? `${cooldown} saniye sonra tekrar isteyin`
                : resending
                  ? 'Gönderiliyor…'
                  : 'Doğrulama bağlantısını tekrar iste'}
            </button>
            {!email.trim() && (
              <p className="text-xs text-muted-foreground">
                Doğrulama bağlantısı istemek için e-posta adresinizi girin.
              </p>
            )}
            {resendDone && (
              <p role="status">
                Doğrulama gerekiyorsa bağlantı gönderimi istendi. Gelen kutunuzu ve spam klasörünü kontrol
                edin.
              </p>
            )}
          </div>
        </div>
      )}
      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        <fieldset disabled={submitting} className="space-y-5">
          <FormFieldWrapper htmlFor="email" label="E-posta" error={fieldErrors.email}>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={error ? 'form-error' : undefined}
              aria-invalid={Boolean(error || fieldErrors.email)}
            />
          </FormFieldWrapper>
          <FormFieldWrapper htmlFor="password" label="Şifre" error={fieldErrors.password}>
            <PasswordField
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={error ? 'form-error' : undefined}
              aria-invalid={Boolean(error || fieldErrors.password)}
            />
          </FormFieldWrapper>
        </fieldset>
        <details className="text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center text-primary underline underline-offset-4">
            Şifremi unuttum
          </summary>
          <p className="pb-3 text-[13px] leading-relaxed text-muted-foreground">
            Şifrenizi yöneticiniz sıfırlayabilir. Yöneticinize ulaşamıyorsanız{' '}
            <a href="mailto:info@ngsplus.app" className="underline">
              info@ngsplus.app
            </a>{' '}
            adresine yazın.
          </p>
        </details>
        {error && (
          <div
            id="form-error"
            role="alert"
            className="rounded-md border border-line bg-danger-bg p-4 text-sm text-danger"
          >
            <strong className="mb-1 block">Bilgilerinizi kontrol edin</strong>
            {error}
          </div>
        )}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </Button>
      </form>
    </AuthShell>
  );
}
