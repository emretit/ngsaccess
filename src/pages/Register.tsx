import { FormFieldWrapper } from '@/components/shared/FormFieldWrapper';
import { PasswordField } from '@/components/shared/PasswordField';
import { registrationSchema, fieldMessages } from '@/components/shared/authFormSchemas';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthShell } from '@/components/public/AuthShell';
import { StatusScreen } from '@/components/public/StatusScreen';
import { usePageTitle } from '@/hooks/usePageTitle';
import { notify } from '@/lib/notify';

export default function Register() {
  usePageTitle('Hesap oluştur');
  const navigate = useNavigate();
  const { loading, signUp } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // NOT: "girişli kullanıcıyı /home'a at" effect'i KASITLI olarak yok.
  // signUp anında Convex Auth oturum açar; o effect kullanıcıyı bir an dashboard'a
  // atıp (flash) sonra signOut'a takılıyordu. Kayıt sonrası yönlendirmeyi yalnızca
  // handleSubmit yapar → /login?confirmEmail=true. Doğrulanmamış erişim backend
  // guard'ı + AuthProvider tarafından zaten engelleniyor.

  const registration = useAsyncAction(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedCompanyName = companyName.trim();

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !normalizedCompanyName ||
      !normalizedEmail ||
      !password
    ) {
      setError('Lütfen tüm alanları doldurun.');
      throw new Error('Lütfen tüm alanları doldurun.');
    }
    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır.');
      throw new Error('Şifre en az 8 karakter olmalıdır.');
    }
    setError(null);
    const fullName = `${normalizedFirstName} ${normalizedLastName}`;
    const { error: signUpError, verificationQueued } = await signUp(
      normalizedEmail,
      password,
      fullName,
      normalizedCompanyName,
    );
    if (signUpError) {
      const message = 'Hesap oluşturulamadı. Bilgilerinizi kontrol edin; mevcut hesabınız varsa giriş yapın.';
      setError(message);
      throw new Error(message);
    }
    // Hesap ve mail talebi ayrı sonuçlardır; kurtarma giriş ekranında sürer.
    notify.success(
      'Kayıt başarılı',
      verificationQueued
        ? 'Doğrulama bağlantısı gönderimi istendi.'
        : 'Hesabınız oluşturuldu ancak doğrulama maili istenemedi. Giriş ekranından yeni bağlantı isteyin.',
    );
    navigate('/login?confirmEmail=true', { state: { email: normalizedEmail, verificationQueued } });
  });
  const submitting = registration.pending;
  useEffect(() => {
    if (error && !submitting) document.getElementById('form-error')?.focus();
  }, [error, submitting]);
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const result = registrationSchema.safeParse({ firstName, lastName, companyName, email, password });
    if (!result.success) {
      setFieldErrors(fieldMessages(result.error));
      document.getElementById(String(result.error.issues[0]?.path[0]))?.focus();
      return;
    }
    setFieldErrors({});
    void registration.run();
  };

  if (loading)
    return (
      <StatusScreen
        tone="loading"
        title="Hesap bilgileri kontrol ediliyor."
        description="Bu sayfayı açık tutun."
      />
    );
  return (
    <AuthShell
      title="NGS Plus hesabınızı oluşturun."
      description="Hesabınızı oluşturun, projenizi adım adım hazırlayın."
      footer={
        <p>
          Zaten hesabınız var mı? <Link to="/login">Giriş yap</Link>
        </p>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        <fieldset disabled={submitting} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <FormFieldWrapper htmlFor="firstName" label="Ad" error={fieldErrors.firstName}>
              <Input
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </FormFieldWrapper>
            <FormFieldWrapper htmlFor="lastName" label="Soyad" error={fieldErrors.lastName}>
              <Input
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </FormFieldWrapper>
          </div>
          <FormFieldWrapper htmlFor="companyName" label="Firma adı" error={fieldErrors.companyName}>
            <Input
              autoComplete="organization"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </FormFieldWrapper>
          <FormFieldWrapper htmlFor="email" label="E-posta" error={fieldErrors.email}>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormFieldWrapper>
          <FormFieldWrapper
            htmlFor="password"
            label="Şifre"
            hint="En az 8 karakter kullanın."
            error={fieldErrors.password}
          >
            <PasswordField
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormFieldWrapper>
        </fieldset>
        {error && (
          <p
            id="form-error"
            role="alert"
            tabIndex={-1}
            className="rounded-md border border-line bg-danger-bg p-4 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Hesap oluşturuluyor…' : 'Hesap oluştur'}
        </Button>
      </form>
      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Bu işlem bir kullanıcı hesabı oluşturur. Satış talebi göndermez ve ücretli plan satın almaz.
      </p>
      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Kişisel verileriniz hesap oluşturmak için işlenir. Aydınlatma metnini talep etmek için{' '}
        <a href="mailto:info@ngsplus.app" className="underline underline-offset-4">
          info@ngsplus.app
        </a>{' '}
        adresine yazabilirsiniz.
      </p>
    </AuthShell>
  );
}
