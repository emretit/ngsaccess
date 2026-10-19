import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserSetup from './UserSetup';

const mocks = vi.hoisted(() => ({ invite: undefined as undefined | null | { email: string; type: string } }));
vi.mock('convex/react', () => ({ useQuery: () => mocks.invite, useMutation: () => vi.fn() }));
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
