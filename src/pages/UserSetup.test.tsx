import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConvexError } from 'convex/values';
import UserSetup, { inviteSetupError } from './UserSetup';

const mocks = vi.hoisted(() => ({ invite: undefined as undefined | null | { email: string; type: string } }));
vi.mock('convex/react', () => ({
  useQuery: () => mocks.invite, useMutation: () => vi.fn(),
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
  it('identifies a reset link as a different kind of link', () => {
    mocks.invite = { email: 'person@example.test', type: 'reset' };
    const html = render();
    expect(html).toContain('Bu bağlantı hesap daveti değil.');
    expect(html).toContain('Bu ekran yalnız hesap davetleri içindir.');
    expect(html).not.toContain('Davet bağlantısı geçersiz.');
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
