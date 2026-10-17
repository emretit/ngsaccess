import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { PasswordField } from "@/components/shared/PasswordField";
import { registrationSchema, fieldMessages } from "@/components/shared/authFormSchemas";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Home, ShieldCheck } from 'lucide-react';

import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { notify } from '@/lib/notify';

export default function Register() {
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
      document.getElementById("email")?.focus();
      throw new Error(message);
    }
    // Hesap ve mail talebi ayrı sonuçlardır; kurtarma giriş ekranında sürer.
    notify.success('Kayıt başarılı', verificationQueued ? 'Doğrulama bağlantısı gönderimi istendi.' : 'Hesabınız oluşturuldu ancak doğrulama maili istenemedi. Giriş ekranından yeni bağlantı isteyin.');
    navigate('/login?confirmEmail=true', { state: { email: normalizedEmail, verificationQueued } });
  });
  const submitting = registration.pending;
  useEffect(() => {
    if (error && !submitting) document.getElementById("email")?.focus();
  }, [error, submitting]);
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = registrationSchema.safeParse({ firstName, lastName, companyName, email, password });
    if (!result.success) {
      setFieldErrors(fieldMessages(result.error));
      document.getElementById(String(result.error.issues[0]?.path[0]))?.focus();
      return;
    }
    setFieldErrors({});
    void registration.run();
  };

  if (loading) {
    return <LoadingSpinner text="Kayıt işlemi kontrol ediliyor..." />;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sol üst - Ana sayfa butonu */}
      <Link
        to="/"
        aria-label="Ana sayfa"
        className="group absolute left-6 top-6 z-50 inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-2.5 shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:border-primary/30 hover:shadow-xl"
      >
        <Home className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
        <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">
          Ana sayfa
        </span>
      </Link>

      {/* Sol taraf - Form */}
      <div className="flex flex-1 items-center justify-center px-6 pb-12 pt-28 sm:px-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo ve başlık */}
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <Link
                to="/"
                aria-label="NGS Plus ana sayfa"
                className="transition-transform duration-200 hover:scale-105"
              >
                <img
                  src="/logo.svg"
                  alt="NGS Plus"
                  className="h-24 w-24 cursor-pointer object-contain"
                />
              </Link>
            </div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">PDKS Sistemine Kayıt</h1>
            <p className="text-base text-muted-foreground">
              Yeni hesap oluşturmak için bilgilerinizi girin
            </p>
          </div>

          {/* Kayıt formu */}
          <form noValidate onSubmit={handleSubmit} className="space-y-5">
            <fieldset disabled={submitting} className="space-y-4">
              <FormFieldWrapper htmlFor="firstName" label="Ad" error={fieldErrors.firstName}>
                <Input type="text" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={submitting} aria-describedby={error ? "form-error" : undefined} aria-invalid={Boolean(error || fieldErrors.firstName)} />
              </FormFieldWrapper>
              <FormFieldWrapper htmlFor="lastName" label="Soyad" error={fieldErrors.lastName}>
                <Input type="text" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={submitting} aria-describedby={error ? "form-error" : undefined} aria-invalid={Boolean(error || fieldErrors.lastName)} />
              </FormFieldWrapper>
              <FormFieldWrapper htmlFor="companyName" label="Firma adı" error={fieldErrors.companyName}>
                <Input type="text" autoComplete="organization" value={companyName} onChange={(event) => setCompanyName(event.target.value)} disabled={submitting} aria-describedby={error ? "form-error" : undefined} aria-invalid={Boolean(error || fieldErrors.companyName)} />
              </FormFieldWrapper>
              <FormFieldWrapper htmlFor="email" label="E-posta" error={fieldErrors.email}>
                <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} aria-describedby={error ? "form-error" : undefined} aria-invalid={Boolean(error || fieldErrors.email)} />
              </FormFieldWrapper>
              <FormFieldWrapper htmlFor="password" label="Şifre" error={fieldErrors.password} hint="En az 8 karakter kullanın.">
                <PasswordField autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} aria-describedby={error ? "form-error" : undefined} aria-invalid={Boolean(error || fieldErrors.password)} />
              </FormFieldWrapper>
            </fieldset>

            {error && (
              <div id="form-error" role="alert" tabIndex={-1} className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full bg-primary text-base font-semibold text-primary-foreground shadow-lg transition-all duration-200 hover:bg-primary/90 hover:shadow-xl"
            >
              {submitting ? (
                'Kayıt oluşturuluyor...'
              ) : (
                <span className="flex items-center justify-center">
                  Kayıt Ol
                  <ArrowRight className="ml-2 h-5 w-5" />
                </span>
              )}
            </Button>
          </form>

          {/* Alt linkler */}
          <div className="space-y-3 text-center text-sm">
            <p className="text-muted-foreground">
              Zaten hesabınız var mı?{' '}
              <Link
                to="/login"
                className="font-semibold text-primary transition-colors hover:text-primary/80"
              >
                Giriş yapın
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Sağ taraf - Görsel panel */}
      <div className="relative hidden flex-1 overflow-hidden bg-primary lg:flex">
        <div className="absolute inset-0 bg-black/10" />

        {/* Dekoratif daireler */}
        <div className="absolute right-12 top-12 h-28 w-28 rounded-full bg-white/10" />
        <div className="absolute bottom-24 left-16 h-20 w-20 rounded-full bg-white/10" />
        <div className="absolute right-24 top-1/2 h-16 w-16 rounded-full bg-white/5" />

        {/* Mock dashboard kart */}
        <div className="relative z-10 flex w-full items-center justify-center px-12">
          <div className="w-full max-w-md rotate-2 transform rounded-2xl bg-card p-6 shadow-2xl">
            <div className="rounded-xl border border-border bg-muted/50 p-5">
              {/* Header */}
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                    <ShieldCheck className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="text-sm font-bold tracking-wide text-foreground">
                    NGS ACCESS
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--success-subtle))] px-2.5 py-1 text-xs font-medium text-[hsl(var(--success))]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
                  Çevrimiçi
                </span>
              </div>

              {/* İstatistik kartları */}
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Bugün giriş</div>
                  <div className="mt-1 text-xl font-bold text-foreground">142</div>
                  <div className="mt-2 h-1.5 w-3/4 rounded-full bg-primary/70" />
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground">Aktif personel</div>
                  <div className="mt-1 text-xl font-bold text-foreground">38</div>
                  <div className="mt-2 h-1.5 w-2/3 rounded-full bg-[hsl(var(--success))]" />
                </div>
              </div>

              {/* Tablo satırları */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-12 rounded bg-muted-foreground/30" />
                  <div className="h-2 flex-1 rounded bg-muted" />
                  <div className="h-2 w-10 rounded bg-muted" />
                </div>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-1.5 w-1/2 rounded bg-muted" />
                      <div className="h-1.5 w-1/3 rounded bg-muted/70" />
                    </div>
                    <div className="h-1.5 w-10 rounded bg-primary/30" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Alt slogan */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-sm font-medium text-primary-foreground">
            Personel devam kontrol sistemi
          </p>
          <p className="mt-1 text-xs text-primary-foreground">Güvenli · Hızlı · Akıllı</p>
        </div>
      </div>
    </div>
  );
}
