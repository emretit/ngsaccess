import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import VerifyEmail, { isVerificationExpired } from './VerifyEmail';

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
vi.mock('@/lib/notify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
describe('VerifyEmail', () => {
  it.each(['/verify-email', '/verify-email?token=test'])(
    'starts in the verification state before effects run at %s',
    (path) => {
      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
          <VerifyEmail />
        </MemoryRouter>,
      );
      expect(html).toContain('E-postanız doğrulanıyor.');
      expect(html).not.toContain('E-postanız doğrulandı.');
      expect(html).toContain('role="status"');
    },
  );
  it('recognizes EXPIRED errors', () => {
    expect(isVerificationExpired(new Error('EXPIRED'))).toBe(true);
  });
  it.each([new Error('INVALID'), 'EXPIRED', null, { message: 'EXPIRED' }])(
    'does not classify other thrown values as expired',
    (error) => {
      expect(isVerificationExpired(error)).toBe(false);
    },
  );
});
