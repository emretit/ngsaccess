import { getPasswordError, PASSWORD_POLICY_MESSAGE } from '../../convex/lib/passwordPolicy';
import { StatusScreen } from '@/components/public/StatusScreen';
import { usePageTitle } from '@/hooks/usePageTitle';
import { emailSchema } from '@/components/shared/authFormSchemas';
import { PasswordField } from '@/components/shared/PasswordField';
import { useAuth } from '@/components/auth/AuthProvider';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/lib/convexApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';
import { useAsyncAction } from '@/hooks/useAsyncAction';

export default function AdminSetup() {
  usePageTitle('Yönetici kurulumu');
  const navigate = useNavigate();
  const { runSetup, user } = useAuth();
  const { signIn: convexSignIn } = useAuthActions();
  const hasAdmin = useQuery(api.users.hasSuperAdmin);
  const initializeAdmin = useMutation(api.users.initializeAdmin);

  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const fail: (message: string) => never = (message) => {
    setFormError(message);
    document.getElementById('password')?.focus();
    throw new Error(message);
  };
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState('');
  const [existingAccount, setExistingAccount] = useState(false);
  const [completed, setCompleted] = useState(false);

  const setup = useAsyncAction(async () => {
    setFormError(null);
    if (
      !emailSchema.safeParse(email).success ||
      !password ||
      !secret
    )
      fail('E-posta, şifre ve kurulum kodunu kontrol edin.');
    const passwordError = existingAccount ? null : getPasswordError(password);
    if (passwordError) fail(passwordError);
    try {
      await runSetup(async () => {
        await convexSignIn('password', {
          email: email.trim().toLowerCase(),
          password,
          name: email.split('@')[0],
          flow: existingAccount ? 'signIn' : 'signUp',
        });
        await initializeAdmin({ secret });
      });
    } catch {
      fail(
        'Kurulum tamamlanamadı. Bilgilerinizi ve kurulum kodunu kontrol edin. Hesabınız oluştuysa mevcut hesap seçeneğiyle devam edin veya kurulum sorumlusuna başvurun.',
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
        title="Yönetici kurulumu tamamlandı."
        description="NGS Plus yönetim alanına geçebilirsiniz."
        primaryAction={{
          label: !user || user.verified === false ? 'Oturum hazırlanıyor…' : 'Yönetim alanına geç',
          disabled: !user || user.verified === false,
          onClick: () => navigate('/home'),
        }}
      />
    );
  if (hasAdmin === undefined)
    return (
      <StatusScreen
        tone="loading"
        title="Kurulum kontrol ediliyor."
        description="Yönetici hesabının durumu yükleniyor."
      />
    );
  if (hasAdmin === true)
    return (
      <StatusScreen
        tone={isLoading ? 'loading' : 'info'}
        title={isLoading ? 'Kurulum tamamlanıyor…' : 'İlk yönetici kurulumu tamamlanmış.'}
        description="Mevcut yönetici hesabınızla giriş yapabilirsiniz."
        primaryAction={{ label: 'Giriş yap', href: '/login', disabled: isLoading }}
      />
    );
  return (
    <StatusScreen
      tone="info"
      title="İlk yöneticiyi oluşturun."
      description="İlk yönetici hesabını kurulum sorumlusundan aldığınız kodla etkinleştirin."
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
              placeholder="admin@firma.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Şifre</Label>
            <PasswordField
              disabled={isLoading}
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? 'setup-error' : 'password-help'}
              autoComplete={existingAccount ? 'current-password' : 'new-password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={existingAccount ? undefined : 8}
              placeholder="En az 8 karakter"
            />
          </div>
          <div>
            <Label htmlFor="secret" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Kurulum kodu
            </Label>
            <PasswordField
              disabled={isLoading}
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? 'setup-error secret-help' : 'secret-help'}
              autoComplete="off"
              id="secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              required
              placeholder="Kurulum kodunuz"
            />
            <p id="secret-help" className="text-xs text-muted-foreground mt-1">
              Kurulum kodunu bilmiyorsanız kurulum sorumlusuna başvurun.
            </p>
          </div>
          <p id="password-help" className="text-xs text-muted-foreground">
            {existingAccount
              ? 'Mevcut hesabınızın şifresini kullanın.'
              : PASSWORD_POLICY_MESSAGE}
          </p>
          {formError && (
            <p id="setup-error" role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Kurulum tamamlanıyor…' : 'Yönetici hesabını etkinleştir'}
          </Button>
        </fieldset>
      </form>
    </StatusScreen>
  );
}
