import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

const auth = vi.hoisted(() => ({
  loading: false,
  signIn: vi.fn(),
  verificationEmail: undefined as string | undefined,
}));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('convex/react', () => ({ useQuery: () => true, useMutation: () => vi.fn() }));
vi.mock('@/hooks/useAsyncAction', () => ({ useAsyncAction: () => ({ pending: false, run: vi.fn() }) }));

function render(path = '/login', state?: { email: string; verificationQueued?: boolean }) {
  return renderToStaticMarkup(
    <MemoryRouter
      initialEntries={[
        { pathname: '/login', search: path.includes('?') ? path.slice(path.indexOf('?')) : '', state },
      ]}
    >
      <Login />
    </MemoryRouter>,
  );
}

describe('Login', () => {
  it('renders one MailCheck notice and one resend button after registration', () => {
    const html = render('/login?confirmEmail=true', { email: 'person@example.test' });
    expect(html.match(/data-testid="verification-notice"/g)).toHaveLength(1);
    expect(html.match(/lucide-mail-check/g)).toHaveLength(1);
    expect(html.match(/Doğrulama bağlantısını tekrar iste/g)).toHaveLength(1);
    expect(html).toContain('Hesabınız oluşturuldu.');
    expect(html).not.toContain('Giriş yapmak için e-posta adresinizi doğrulayın. Gelen kutunuzdaki');
  });
  it('shows recovery for failed email delivery without another notice', () => {
    const html = render('/login?confirmEmail=true', {
      email: 'person@example.test',
      verificationQueued: false,
    });
    expect(html.match(/data-testid="verification-notice"/g)).toHaveLength(1);
    expect(html).toContain('Doğrulama e-postasının gönderimi tamamlanamadı.');
  });
  it('keeps resend out of normal login and disables it when email is missing', () => {
    expect(render()).not.toContain('Doğrulama bağlantısını tekrar iste');
    expect(render('/login?confirmEmail=true')).toMatch(
      /<button[^>]*disabled=""[^>]*>Doğrulama bağlantısını tekrar iste/,
    );
  });
  it('offers password help through a native disclosure that starts closed', () => {
    const html = render();
    expect(html).toMatch(/<details[^>]*><summary[^>]*>Şifremi unuttum<\/summary><p/);
    expect(html).not.toMatch(/<details[^>]*open/);
    expect(html).toContain('Şifrenizi yöneticiniz sıfırlayabilir. Yöneticinize ulaşamıyorsanız');
    expect(html).toContain('href="mailto:info@ngsteknoloji.com"');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });
});
