import { PasswordField } from "@/components/shared/PasswordField";
import { registrationSchema, fieldMessages } from "@/components/shared/authFormSchemas";
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormFieldWrapper } from '@/components/shared/FormFieldWrapper';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { ACCOUNT_CTA, ACCOUNT_DESCRIPTION } from '@/components/landing/publicCopy';

const EnhancedDemoRequestForm = () => {
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', companyName: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const createAccount = useAsyncAction(async () => {
    setFormError(null);
    const name = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();
    const result = await signUp(formData.email, formData.password, name, formData.companyName);
    if (result.error) {
      const message = 'Hesap oluşturulamadı. Bilgilerinizi kontrol edin; mevcut hesabınız varsa giriş yapın.';
      setFormError(message);
      throw new Error(message);
    }
    navigate('/login?confirmEmail=true', { state: { email: formData.email.trim().toLowerCase(), verificationQueued: result.verificationQueued } });
  });

  return <section id="account-form" className="scroll-mt-20 py-8 px-4 bg-muted/50">
    <Card className="max-w-xl mx-auto">
      <CardHeader><CardTitle tabIndex={-1} id="account-form-title">{ACCOUNT_CTA}</CardTitle><CardDescription>{ACCOUNT_DESCRIPTION}</CardDescription></CardHeader>
      <CardContent>
        <form noValidate className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          const parsed = registrationSchema.safeParse(formData);
          if (!parsed.success) {
            setFieldErrors(fieldMessages(parsed.error));
            document.getElementById(`account-${String(parsed.error.issues[0]?.path[0])}`)?.focus();
            return;
          }
          setFieldErrors({});
          void createAccount.run();
        }}>
          {([
            ['firstName', 'Ad', 'text', 'given-name'],
            ['lastName', 'Soyad', 'text', 'family-name'],
            ['email', 'E-posta', 'email', 'email'],
            ['companyName', 'Firma adı', 'text', 'organization'],
            ['password', 'Şifre (en az 8 karakter)', 'password', 'new-password'],
          ] as const).map(([name, label, type, autoComplete]) => <FormFieldWrapper key={name} htmlFor={`account-${name}`} label={label} error={fieldErrors[name]}>
            {name === "password" ? <PasswordField autoComplete="new-password" disabled={createAccount.pending} value={formData.password} aria-invalid={Boolean(formError)} aria-describedby={formError ? "account-error" : undefined} onChange={(event) => setFormData(previous => ({ ...previous, password: event.target.value }))} /> :
            <Input name={name} type={type} autoComplete={autoComplete} disabled={createAccount.pending} value={formData[name]} aria-invalid={Boolean(formError)} aria-describedby={formError ? "account-error" : undefined} onChange={(event) => setFormData((previous) => ({ ...previous, [name]: event.target.value }))} />}

          </FormFieldWrapper>)}
          {formError && <p id="account-error" role="alert" className="text-sm text-destructive">{formError}</p>}
          <Button type="submit" className="w-full" disabled={createAccount.pending}>{createAccount.pending ? 'Hesap oluşturuluyor...' : ACCOUNT_CTA}</Button>
        </form>
        <p className="mt-5 text-sm">Zaten hesabınız var mı? <Link to="/login" className="text-primary underline">Giriş yapın</Link></p>
      </CardContent>
    </Card>
  </section>;
};
export default EnhancedDemoRequestForm;
