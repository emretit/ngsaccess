import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import UserSetup, { inviteSetupError } from './UserSetup';

const mocks = vi.hoisted(() => ({ invite: undefined as undefined | null | { email: string; type: string } }));
vi.mock('convex/react', () => ({
  useQuery: () => mocks.invite, useMutation: () => vi.fn(), useAction: () => vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
}));
vi.mock('@convex-dev/auth/react', () => ({ useAuthActions: () => ({ signIn: vi.fn() }) }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ user: null, runSetup: vi.fn() }) }));
const render = (path = '/user-setup?token=test') =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <UserSetup />
    </MemoryRouter>,
  );
beforeEach(() => {
  mocks.invite = undefined;
});
describe('UserSetup', () => {
  it.each([
    ['INVITE_AUTH_REQUIRED', 'Oturumunuz hazırlanamadı.'],
    ['INVITE_AUTH_TIMEOUT', 'Oturumunuz hazırlanamadı.'],
    ['INVITE_EMAIL_MISMATCH', 'Oturum açtığınız hesabın e-posta adresi davetle eşleşmiyor.'],
    ['INVITE_WRONG_TYPE', 'Bu bağlantı hesap daveti değil.'],
    ['INVITE_INVALID', 'Davet kullanılmış veya süresi dolmuş olabilir.'],
    ['INVITE_ACCOUNT_EXISTS', "Bu e-postayla doğrulanmış bir hesap var; 'Mevcut hesabım var' ile giriş yapın."],
    ['INVITE_WEAK_PASSWORD', 'Şifre en az 8 karakter, büyük harf, küçük harf ve rakam içermelidir.'],
  ])('maps %s to fixed Turkish recovery copy', (code, message) => {
    const result = inviteSetupError(new ConvexError({ code, detail: 'PRIVATE_BACKEND_DETAIL' }));
    expect(result).toContain(message);
    expect(result).not.toContain(code);
    expect(result).not.toContain('PRIVATE_BACKEND_DETAIL');
  });
  it.each([
    new Error('PRIVATE_BACKEND_DETAIL'),
    new ConvexError({ code: 'UNKNOWN', detail: 'PRIVATE_BACKEND_DETAIL' }),
    new ConvexError('PRIVATE_BACKEND_DETAIL'),
    null,
  ])('does not expose raw or unexpected errors: %j', (error) => {
    const result = inviteSetupError(error);
    expect(result).toContain('Davet kabul edilemedi.');
    expect(result).toContain('mevcut hesap seçeneğiyle devam edin');
    expect(result).not.toContain('PRIVATE_BACKEND_DETAIL');
  });
  it('distinguishes loading, missing and invalid invites', () => {
    expect(render()).toContain('Davetiniz kontrol ediliyor.');
    expect(render('/user-setup')).toContain('Davet bağlantısı geçersiz.');
    mocks.invite = null;
    expect(render()).toContain('Davet bağlantısı geçersiz.');
  });
  it('offers a new-password reset form without account creation or existing-password mode', () => {
    mocks.invite = { email: 'person@example.test', type: 'reset' };
    const html = render();
    expect(html).toContain('Yeni şifre belirle');
    expect(html).toMatch(/<input[^>]*id="email"[^>]*disabled=""[^>]*value="person@example.test"/);
    expect(html).toContain('Şifreyi yenile');
    expect(html).toContain('Şifre tekrarı');
    expect(html).not.toContain('Mevcut hesabımla devam et');
    expect(html).not.toContain('Mevcut şifreniz');
    expect(html).not.toMatch(/id="(?:name|firstName|lastName)"/);
    expect(html).not.toContain('Davet bağlantısı geçersiz.');
  });
  it('uses reset recovery messages without suggesting the unavailable existing-account mode', () => {
    for (const error of [new ConvexError({ code: 'INVITE_ACCOUNT_EXISTS' }), new ConvexError({ code: 'INVITE_EMAIL_MISMATCH' }), new Error('PRIVATE')]) {
      const message = inviteSetupError(error, true);
      expect(message).toContain('sıfırlama bağlantısı isteyin');
      expect(message).not.toContain('Mevcut hesabım var');
      expect(message).not.toContain('PRIVATE');
    }
  });
  it('locks the invited email and offers existing-account mode', () => {
    mocks.invite = { email: 'person@example.test', type: 'invite' };
    const html = render();
    expect(html).toMatch(/<input[^>]*id="email"[^>]*disabled=""/);
    expect(html).toContain('Mevcut hesabımla devam et');
    expect(html).toContain('Şifre tekrarı');
    expect(html).toContain('password-help');
  });
});
