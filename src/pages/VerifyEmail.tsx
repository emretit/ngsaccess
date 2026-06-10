import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { CheckCircle2, Home, Loader2, Mail, RefreshCw, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { api } from '@/lib/convexApi';

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const verifyEmail = useMutation(api.emailVerification.verifyEmail);
  const requestVerification = useMutation(api.emailVerification.requestVerification);

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!token) {
      setStatus('error');
      setMessage('Doğrulama linki eksik veya hatalı.');
      return;
    }

    void verifyEmail({ token })
      .then(() => {
        setStatus('success');
      })
      .catch((error: unknown) => {
        const msg = (error as Error)?.message ?? 'Doğrulama sırasında bir hata oluştu.';
        setStatus('error');
        setMessage(msg);
        if (msg.includes('EXPIRED:')) setIsExpired(true);
      });
  }, [token, verifyEmail]);

  const handleResend = async () => {
    if (!resendEmail || resending || resendDone) return;
    setResending(true);
    try {
      await requestVerification({ email: resendEmail.trim().toLowerCase() });
      setResendDone(true);
      toast({ title: 'Yeni doğrulama maili gönderildi', description: 'Gelen kutunuzu kontrol edin.' });
    } catch {
      toast({ title: 'Gönderilemedi', description: 'Lütfen birkaç dakika sonra tekrar deneyin.', variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
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

      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        {status === 'loading' && (
          <>
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Doğrulanıyor...</h1>
            <p className="text-muted-foreground">Lütfen bekleyin, hesabınız etkinleştiriliyor.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Hesabınız doğrulandı!</h1>
            <p className="text-muted-foreground">
              E-posta adresiniz başarıyla doğrulandı. Artık giriş yapabilirsiniz.
            </p>
            <Button
              asChild
              className="h-12 w-full bg-primary text-base font-semibold text-white shadow-lg transition-all duration-200 hover:bg-primary/90 hover:shadow-xl"
            >
              <Link to="/login">Giriş Yap</Link>
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Doğrulama başarısız</h1>
            <p className="text-muted-foreground">{message}</p>

            {isExpired && !resendDone && (
              <div className="space-y-3 text-left">
                <p className="text-sm text-muted-foreground">
                  Yeni bir doğrulama maili göndermek için e-posta adresinizi girin:
                </p>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="ornek@firma.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="pl-9"
                    disabled={resending}
                  />
                </div>
                <Button
                  onClick={handleResend}
                  disabled={!resendEmail || resending}
                  className="w-full"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
                  {resending ? 'Gönderiliyor...' : 'Yeni link iste'}
                </Button>
              </div>
            )}

            {resendDone && (
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Yeni doğrulama maili gönderildi. Gelen kutunuzu kontrol edin.
              </p>
            )}

            {!isExpired && (
              <Button
                asChild
                variant="outline"
                className="h-12 w-full text-base font-semibold"
              >
                <Link to="/register">Yeniden kayıt ol</Link>
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
