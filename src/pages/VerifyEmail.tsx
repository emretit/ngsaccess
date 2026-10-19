import { emailSchema } from '@/components/shared/authFormSchemas';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormFieldWrapper } from '@/components/shared/FormFieldWrapper';
import { StatusScreen } from '@/components/public/StatusScreen';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { notify } from '@/lib/notify';
import { api } from '@/lib/convexApi';

export function isVerificationExpired(error: unknown) {
  return error instanceof Error && error.message.includes('EXPIRED');
}

export default function VerifyEmail() {
  usePageTitle('E-posta doğrulama');
  const [params] = useSearchParams();
  const token = params.get('token');
  const verifyEmail = useMutation(api.emailVerification.verifyEmail);
  const requestVerification = useMutation(api.emailVerification.requestVerification);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [expired, setExpired] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [cooldown, setCooldown] = useState(0);
  const ran = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      ran.current = null;
      setStatus('error');

      return;
    }
    if (ran.current === token) return;
    ran.current = token;
    setStatus('loading');
    void verifyEmail({ token })
      .then(() => {
        if (ran.current === token) setStatus('success');
      })
      .catch((error: unknown) => {
        if (ran.current !== token) return;
        const isExpired = isVerificationExpired(error);
        setExpired(isExpired);
        setStatus('error');
      });
  }, [token, verifyEmail]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = useAsyncAction(async () => {
    if (!email.trim() || cooldown > 0) return;
    try {
      await requestVerification({ email: email.trim().toLowerCase() });
    } catch {
      throw new Error('Gönderim istenemedi. Birkaç dakika sonra yeniden deneyin.');
    }
    setCooldown(60);
    notify.success(
      'Bağlantı gönderimi istendi',
      'Doğrulama gerekiyorsa e-postanızı ve spam klasörünü kontrol edin.',
    );
  });

  if (status === 'loading')
    return (
      <StatusScreen
        tone="loading"
        title="E-postanız doğrulanıyor."
        description="Doğrulama bağlantınız kontrol ediliyor. Bu sayfayı açık tutun."
      />
    );
  if (status === 'success')
    return (
      <StatusScreen
        tone="success"
        title="E-postanız doğrulandı."
        description="Artık NGS Plus hesabınızla giriş yapabilirsiniz."
        primaryAction={{ label: 'Giriş yap', href: '/login' }}
      />
    );
  return (
    <StatusScreen
      tone="error"
      title={
        !token
          ? 'Doğrulama bağlantısı eksik.'
          : expired
            ? 'Bağlantınızın süresi dolmuş.'
            : 'Doğrulama tamamlanamadı.'
      }
      description={
        !token || expired
          ? 'E-posta adresinizi yazın ve yeni doğrulama bağlantısı isteyin.'
          : 'Bağlantı geçersiz veya daha önce kullanılmış. Hesabınız doğrulanmışsa giriş yapın; aksi halde yeni bağlantı isteyin.'
      }
      secondaryAction={{ label: 'Zaten doğruladıysanız giriş yapın', href: '/login' }}
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = emailSchema.safeParse(email);
          setEmailError(parsed.success ? undefined : parsed.error.issues[0]?.message);
          if (!parsed.success) {
            document.getElementById('verification-email')?.focus();
            return;
          }
          void resend.run();
        }}
      >
        <fieldset disabled={resend.pending} className="space-y-4">
          <FormFieldWrapper htmlFor="verification-email" label="E-posta" error={emailError}>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormFieldWrapper>
          <Button disabled={resend.pending || cooldown > 0 || !email.trim()} type="submit" className="w-full">
            {resend.pending
              ? 'Gönderiliyor…'
              : cooldown
                ? `${cooldown} saniye sonra tekrar isteyin`
                : 'Yeni doğrulama bağlantısı iste'}
          </Button>
        </fieldset>
      </form>
    </StatusScreen>
  );
}
