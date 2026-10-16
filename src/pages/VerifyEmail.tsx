import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormFieldWrapper } from '@/components/shared/FormFieldWrapper';
import { SectionSkeleton } from '@/components/shared/SectionSkeleton';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { notify } from '@/lib/notify';
import { api } from '@/lib/convexApi';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const verifyEmail = useMutation(api.emailVerification.verifyEmail);
  const requestVerification = useMutation(api.emailVerification.requestVerification);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const ran = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      ran.current = null;
      setStatus('error');
      setMessage('Doğrulama bağlantısı eksik. Yeni bağlantı isteyebilirsiniz.');
      return;
    }
    if (ran.current === token) return;
    ran.current = token;
    setStatus('loading');
    void verifyEmail({ token }).then(() => { if (ran.current === token) setStatus('success'); }).catch((error: unknown) => {
      if (ran.current !== token) return;
      const expired = error instanceof Error && error.message.includes('EXPIRED');
      setMessage(expired ? 'Bağlantının süresi dolmuş. Yeni bağlantı isteyin.' : 'Bağlantı geçersiz veya daha önce kullanılmış. Hesabınız doğrulanmışsa giriş yapın; aksi halde yeni bağlantı isteyin.');
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
    notify.success('Bağlantı gönderimi istendi', 'Doğrulama gerekiyorsa e-postanızı ve spam klasörünü kontrol edin.');
  });

  return <main className="min-h-screen flex items-center justify-center bg-background p-4">
    <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6">
      {status === 'loading' ? <SectionSkeleton label="E-posta doğrulanıyor" /> : <>
        <h1 className="text-2xl font-bold">{status === 'success' ? 'Hesabınız doğrulandı' : 'Doğrulama tamamlanamadı'}</h1>
        <p role="status" className="text-muted-foreground">{status === 'success' ? 'Artık mevcut hesabınızla giriş yapabilirsiniz.' : message}</p>
        {status === 'error' && <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void resend.run(); }}>
          <FormFieldWrapper htmlFor="verification-email" label="E-posta adresi">
            <Input id="verification-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={resend.pending} />
          </FormFieldWrapper>
          <Button disabled={resend.pending || cooldown > 0 || !email.trim()} type="submit" className="w-full">{resend.pending ? 'Gönderiliyor...' : cooldown ? `${cooldown} saniye sonra tekrar isteyin` : 'Yeni doğrulama bağlantısı iste'}</Button>
        </form>}
        <Button asChild variant="outline" className="w-full"><Link to="/login">Mevcut hesabımla giriş yap</Link></Button>
      </>}
      <Link to="/" className="block text-center text-sm text-primary underline">Ana sayfa</Link>
    </div>
  </main>;
}
