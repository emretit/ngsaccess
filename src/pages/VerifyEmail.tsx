import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { CheckCircle2, Home, Loader2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/convexApi';

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const verifyEmail = useMutation(api.emailVerification.verifyEmail);

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string>('');
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
        setStatus('error');
        setMessage(
          (error as Error)?.message ?? 'Doğrulama sırasında bir hata oluştu.',
        );
      });
  }, [token, verifyEmail]);

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
            <Button
              asChild
              variant="outline"
              className="h-12 w-full text-base font-semibold"
            >
              <Link to="/register">Yeniden kayıt ol</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
