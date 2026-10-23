import { getPasswordChecks, isPasswordValid, PASSWORD_POLICY_MESSAGE } from '../../convex/lib/passwordPolicy';
import { StatusScreen } from '@/components/public/StatusScreen';
import { usePageTitle } from '@/hooks/usePageTitle';
import { PasswordField } from '@/components/shared/PasswordField';
import { useAuth } from '@/components/auth/AuthProvider';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { CheckCircle, XCircle } from 'lucide-react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '../../convex/_generated/api';

export function inviteSetupError(error: unknown): string {
  const data: unknown = error instanceof ConvexError ? error.data : null;
  const code = data && typeof data === 'object' && 'code' in data ? data.code : null;
  switch (code) {
    case 'INVITE_AUTH_REQUIRED':
    case 'INVITE_AUTH_TIMEOUT':
      return 'Oturumunuz hazırlanamadı. Mevcut hesap seçeneğiyle yeniden giriş yapıp daveti kabul edin.';
    case 'INVITE_EMAIL_MISMATCH':
      return 'Oturum açtığınız hesabın e-posta adresi davetle eşleşmiyor. Davet edilen hesabınızla giriş yapın.';
    case 'INVITE_WRONG_TYPE':
      return 'Bu bağlantı hesap daveti değil. Yöneticinizden yeni bir davet bağlantısı isteyin.';
    case 'INVITE_INVALID':
      return 'Davet kullanılmış veya süresi dolmuş olabilir. Yöneticinizden yeni bir davet bağlantısı isteyin.';
    case 'INVITE_ACCOUNT_EXISTS':
      return "Bu e-postayla doğrulanmış bir hesap var; 'Mevcut hesabım var' ile giriş yapın.";
    case 'INVITE_WEAK_PASSWORD':
      return PASSWORD_POLICY_MESSAGE;
    default:
      return 'Davet kabul edilemedi. Bilgilerinizi kontrol edin. Hesabınız oluştuysa mevcut hesap seçeneğiyle devam edin; sorun sürerse yöneticinizden yeni davet isteyin.';
  }
}

export default function UserSetup() {
  usePageTitle('Daveti kabul et');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { runSetup, user } = useAuth();
  const token = searchParams.get('token');
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const consumeInvite = useMutation(api.invites.consume);
  const claimSetupAccount = useAction(api.invites.claimSetupAccount);

  // Token ile davet bilgisini al (email pre-fill)
  const inviteData = useQuery(api.invites.verify, token ? { token } : 'skip');

  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const fail: (message: string) => never = (message) => {
    setFormError(message);
    document.getElementById('password')?.focus();
    throw new Error(message);
  };
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [existingAccount, setExistingAccount] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [authWaiter, setAuthWaiter] = useState<{
    resolve: () => void;
    reject: (error: unknown) => void;
  } | null>(null);

  useEffect(() => {
    if (!authWaiter) return;
    const reject = () => authWaiter.reject(new ConvexError({ code: 'INVITE_AUTH_TIMEOUT' }));
    const timer = window.setTimeout(reject, 15_000);
    // Temizlikte reject: waiter değişince/unmount'ta bekleyen promise asılı kalmaz (çözülmüşse no-op).
    return () => {
      window.clearTimeout(timer);
      reject();
    };
  }, [authWaiter]);

  useEffect(() => {
    if (!authWaiter) return;
    // signIn dönüşü transport'un hazır olduğunu garanti etmez. Profil eşleşmesi
    // önceki başka bir hesabın hazır oturumunu da yanlışlıkla kullanmayı önler.
    if (isAuthenticated && user?.email?.toLowerCase() === email.toLowerCase()) {
      authWaiter.resolve();
    }
  }, [authWaiter, isAuthenticated, user?.email, email]);

  // Davet emailini otomatik doldur
  useEffect(() => {
    if (inviteData?.email) {
      setEmail(inviteData.email);
    }
  }, [inviteData]);

  const passwordChecks = getPasswordChecks(password);
  const passwordValid = isPasswordValid(password);

  const setup = useAsyncAction(async () => {
    setFormError(null);
    if (!password) fail('Şifrenizi girin.');
    if (!token) fail('Davet bağlantısı eksik.');
    if (!existingAccount && (!passwordValid || password !== confirmPassword)) {
      fail('Şifre gereksinimlerini ve şifre tekrarını kontrol edin.');
    }
    try {
      // Mevcut hesapta davet hatası oturumu kapatmaz (doğrulanmamışsa AuthProvider guard'ı kapatır).
      await runSetup(async () => {
        const flow = existingAccount
          ? 'signIn'
          : (await claimSetupAccount({ token, password })).flow;
        await signIn('password', { email, password, flow });
        try {
          await new Promise<void>((resolve, reject) => setAuthWaiter({ resolve, reject }));
        } finally {
          setAuthWaiter(null);
        }
        await consumeInvite({ token, email });
      }, { signOutOnError: !existingAccount });
    } catch (error: unknown) {
      fail(inviteSetupError(error));
    }
    setCompleted(true);
  });
  const isLoading = setup.pending;
  useEffect(() => {
    if (formError && !isLoading) document.getElementById('password')?.focus();
  }, [formError, isLoading]);
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void setup.run();
  };

  if (completed)
    return (
      <StatusScreen
        tone="success"
        title="Hesabınız etkinleştirildi."
        description="Projenizin yönetim alanına geçebilirsiniz."
        primaryAction={{
          label: !user || user.verified === false ? 'Oturum hazırlanıyor…' : 'Yönetim alanına geç',
          disabled: !user || user.verified === false,
          onClick: () => navigate('/home'),
        }}
      />
    );
  if (!token || inviteData === null || inviteData?.type === 'reset')
    return (
      <StatusScreen
        tone="error"
        title={
          inviteData?.type === 'reset' ? 'Bu bağlantı hesap daveti değil.' : 'Davet bağlantısı geçersiz.'
        }
        description={
          inviteData?.type === 'reset'
            ? 'Bu ekran yalnız hesap davetleri içindir. Şifre yardımı için yöneticinizle iletişime geçin.'
            : 'Bağlantı eksik, kullanılmış veya süresi dolmuş olabilir. Yöneticinizden yeni davet isteyin.'
        }
        primaryAction={{ label: 'Giriş yap', href: '/login' }}
        secondaryAction={{ label: 'Destek: info@ngsteknoloji.com', href: 'mailto:info@ngsteknoloji.com' }}
      />
    );
  if (inviteData === undefined)
    return (
      <StatusScreen
        tone="loading"
        title="Davetiniz kontrol ediliyor."
        description="Davet bilgileri yükleniyor. Bu sayfayı açık tutun."
      />
    );
  return (
    <StatusScreen
      tone="info"
      title="Davetinizi kabul edin."
      description={
        existingAccount
          ? 'Davet edilen e-posta adresine ait mevcut hesabınızla devam edin.'
          : 'Davetiniz doğrulandı. Yeni bir hesap oluşturun veya mevcut hesabınızla devam edin.'
      }
    >
      <Button
        type="button"
        variant="link"
        className="mb-5 min-h-11 p-0"
        disabled={isLoading}
        onClick={() => setExistingAccount((value) => !value)}
      >
        {existingAccount ? 'Yeni hesap oluştur' : 'Mevcut hesabımla devam et'}
      </Button>
      <form noValidate onSubmit={handleSubmit}>
        <fieldset disabled={isLoading} className="space-y-4">
          <div>
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!!inviteData?.email}
              className={inviteData?.email ? 'bg-muted' : ''}
            />
          </div>
          <div>
            <Label htmlFor="password">{existingAccount ? 'Mevcut şifreniz' : 'Yeni şifre'}</Label>
            <PasswordField
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? 'setup-error' : 'password-help'}
              disabled={isLoading}
              autoComplete={existingAccount ? 'current-password' : 'new-password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div hidden={existingAccount} className="space-y-1 text-sm">
            {Object.entries({
              minLength: 'En az 8 karakter',
              hasUpper: 'Büyük harf',
              hasLower: 'Küçük harf',
              hasNumber: 'Rakam',
            }).map(([k, label]) => (
              <div key={k} className="flex items-center gap-2">
                {passwordChecks[k as keyof typeof passwordChecks] ? (
                  <CheckCircle aria-hidden="true" className="h-4 w-4 text-success" />
                ) : (
                  <XCircle aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                )}
                <span
                  className={
                    passwordChecks[k as keyof typeof passwordChecks]
                      ? 'text-success'
                      : 'text-muted-foreground'
                  }
                >
                  {label}
                  <span className="sr-only">
                    {passwordChecks[k as keyof typeof passwordChecks] ? ': karşılandı' : ': karşılanmadı'}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div hidden={existingAccount}>
            <Label htmlFor="confirmPassword">Şifre tekrarı</Label>
            <PasswordField
              disabled={isLoading}
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? 'setup-error' : 'password-help'}
              autoComplete="new-password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required={!existingAccount}
            />
          </div>
          <p hidden={existingAccount} id="password-help" className="text-xs text-muted-foreground">
            {PASSWORD_POLICY_MESSAGE}
          </p>
          {formError && (
            <p id="setup-error" role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Davet kabul ediliyor…' : 'Daveti kabul et'}
          </Button>
        </fieldset>
      </form>
    </StatusScreen>
  );
}
