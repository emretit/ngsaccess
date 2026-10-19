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
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export default function UserSetup() {
  usePageTitle('Daveti kabul et');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { runSetup, user } = useAuth();
  const token = searchParams.get('token');
  const { signIn } = useAuthActions();
  const consumeInvite = useMutation(api.invites.consume);

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

  // Davet emailini otomatik doldur
  useEffect(() => {
    if (inviteData?.email) {
      setEmail(inviteData.email);
    }
  }, [inviteData]);

  const validatePassword = (pwd: string) => ({
    minLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasNumber: /\d/.test(pwd),
  });

  const passwordChecks = validatePassword(password);
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const setup = useAsyncAction(async () => {
    setFormError(null);
    if (!password) fail('Şifrenizi girin.');
    if (!token) fail('Davet bağlantısı eksik.');
    if (!existingAccount && (!isPasswordValid || password !== confirmPassword)) {
      fail('Şifre gereksinimlerini ve şifre tekrarını kontrol edin.');
    }
    try {
      await runSetup(async () => {
        await signIn('password', { email, password, flow: existingAccount ? 'signIn' : 'signUp' });
        await consumeInvite({ token, email });
      });
    } catch {
      fail(
        'Davet kabul edilemedi. Bilgilerinizi kontrol edin. Hesabınız oluştuysa mevcut hesap seçeneğiyle devam edin; sorun sürerse yöneticinizden yeni davet isteyin.',
      );
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
        secondaryAction={{ label: 'Destek: info@ngsplus.app', href: 'mailto:info@ngsplus.app' }}
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
            Yeni şifre en az 8 karakter, büyük harf, küçük harf ve rakam içermelidir.
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
