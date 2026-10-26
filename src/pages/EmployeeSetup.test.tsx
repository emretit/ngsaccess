import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmployeeSetup from './EmployeeSetup';

const mocks = vi.hoisted(() => ({ success: false, auth: { tokenExpiresAt: '2099-01-01' } as { tokenExpiresAt: string } | null | undefined }));
vi.mock('react', async importOriginal => {
  const original = await importOriginal<typeof import('react')>();
  return { ...original, useState: (initial: unknown) => original.useState(initial === false ? mocks.success : initial) };
});
vi.mock('convex/react', () => ({ useQuery: () => mocks.auth, useAction: () => vi.fn() }));
vi.mock('@/hooks/useAsyncAction', () => ({ useAsyncAction: () => ({ pending: false, run: vi.fn() }) }));
const render = (path = '/employee-setup?token=test') => renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><EmployeeSetup /></MemoryRouter>);
beforeEach(() => { mocks.success = false; mocks.auth = { tokenExpiresAt: '2099-01-01' }; });
describe('EmployeeSetup mobile guidance', () => {
  it('directs a completed setup to NGS Plus mobile', () => {
    mocks.success = true;
    const html = render();
    expect(html).toContain('Şifreniz hazır. NGS Plus mobil uygulamasıyla giriş yapabilirsiniz.');
    expect(html).not.toContain('web QR');
    expect(html).not.toContain('yakında');
  });
  it('keeps missing, invalid and pending tokens out of the success screen', () => {
    expect(render('/employee-setup')).toContain('Şifre bağlantısı geçersiz.');
    mocks.auth = null;
    expect(render()).toContain('Şifre bağlantısı geçersiz.');
    mocks.auth = undefined;
    expect(render()).toContain('Bağlantınız kontrol ediliyor.');
    expect(render()).not.toContain('Şifreniz hazır.');
  });
});
