import { getPasswordChecks, isPasswordValid, PASSWORD_POLICY_MESSAGE } from '../../convex/lib/passwordPolicy';
import { StatusScreen } from '@/components/public/StatusScreen';
import { usePageTitle } from '@/hooks/usePageTitle';
import { PasswordField } from '@/components/shared/PasswordField';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { CheckCircle, XCircle } from 'lucide-react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

export default function EmployeeSetup() {
  usePageTitle('Şifre belirle');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [formError, setFormError] = useState<string | null>(null);
  const fail: (message: string) => never = (message) => {
    setFormError(message);
    document.getElementById('password')?.focus();
    throw new Error(message);
  };
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const authRecord = useQuery(api.employeeAuth.getByToken, token ? { token } : 'skip');

  const setPasswordAction = useAction(api.actions.setPassword.setEmployeePassword);

  const tokenValid =
    authRecord !== undefined && authRecord !== null && authRecord.tokenExpiresAt
      ? new Date(authRecord.tokenExpiresAt) > new Date()
      : false;

  const passwordChecks = getPasswordChecks(password);
  const passwordValid = isPasswordValid(password);

  const savePassword = useAsyncAction(async () => {
    setFormError(null);
    if (!token || !passwordValid || password !== confirmPassword)
      fail('Şifre gereksinimlerini ve şifre tekrarını kontrol edin.');
    try {
      const result = await setPasswordAction({ token, password });
      if (!result.success) fail('Şifre belirlenemedi.');
    } catch {
      fail(
        'Şifre belirlenemedi. Bağlantınızın süresi dolmuş veya kullanılmış olabilir. Yöneticinizden yeni bağlantı isteyin.',
      );
    }
    setIsSuccess(true);
  });
  const isLoading = savePassword.pending;
  useEffect(() => {
    if (formError && !isLoading) document.getElementById('password')?.focus();
  }, [formError, isLoading]);
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void savePassword.run();
  };

  const support = { label: 'Destek: info@ngsteknoloji.com', href: 'mailto:info@ngsteknoloji.com' };
  if (!token)
    return (
      <StatusScreen
        tone="error"
        title="Şifre bağlantısı geçersiz."
        description="Bağlantı eksik, kullanılmış veya süresi dolmuş olabilir. Yöneticinizden yeni bir şifre belirleme bağlantısı isteyin."
        secondaryAction={support}
      />
    );
  if (authRecord === undefined)
    return (
      <StatusScreen
        tone="loading"
        title="Bağlantınız kontrol ediliyor."
        description="Şifre belirleme bağlantısı doğrulanıyor."
      />
    );
  if (isSuccess)
    return (
      <StatusScreen
        tone="success"
        title="Şifreniz belirlendi."
        description="Personel hesabınız etkinleştirildi. QR giriş adresi ve kurulum yardımı için yöneticinize başvurun."
      >
        <p className="text-xs leading-relaxed text-muted-foreground">
          Mobil uygulama yakında. Şimdilik işyerinizin web QR girişini kullanın; erişim için yöneticinize
          başvurun.
        </p>
      </StatusScreen>
    );
  if (!tokenValid)
    return (
      <StatusScreen
        tone="error"
        title="Şifre bağlantısı geçersiz."
        description={
          authRecord
            ? 'Bu şifre belirleme bağlantısının süresi dolmuş. Yöneticinizden yeni bağlantı isteyin.'
            : 'Bağlantı eksik, kullanılmış veya süresi dolmuş olabilir. Yöneticinizden yeni bir şifre belirleme bağlantısı isteyin.'
        }
        secondaryAction={support}
      />
    );
  return (
    <StatusScreen
      tone="info"
      title="Şifrenizi belirleyin."
      description="Personel hesabınız için bir şifre oluşturun."
    >
      {authRecord?.email && <p className="mb-5 text-sm text-muted-foreground">E-posta: {authRecord.email}</p>}
      <form noValidate onSubmit={handleSubmit}>
        <fieldset disabled={isLoading} className="space-y-4">
          <div>
            <Label htmlFor="password">Yeni şifre</Label>
            <PasswordField
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? 'setup-error' : 'password-help'}
              disabled={isLoading}
              autoComplete="new-password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1 text-sm">
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
          <div>
            <Label htmlFor="confirmPassword">Şifre tekrarı</Label>
            <PasswordField
              aria-invalid={Boolean(formError)}
              aria-describedby={formError ? 'setup-error' : 'password-help'}
              disabled={isLoading}
              autoComplete="new-password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <p id="password-help" className="text-xs text-muted-foreground">
            {PASSWORD_POLICY_MESSAGE}
          </p>
          {formError && (
            <p id="setup-error" role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Kaydediliyor…' : 'Şifremi belirle'}
          </Button>
        </fieldset>
      </form>
    </StatusScreen>
  );
}
