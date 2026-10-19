import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthShell } from './AuthShell';

describe('AuthShell', () => {
  it('provides one main heading, home link, form slot and real product image', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthShell title="Giriş yap" description="Açıklama" footer={<a href="/register">Hesap oluştur</a>}>
          <form>
            <input aria-label="E-posta" />
          </form>
        </AuthShell>
      </MemoryRouter>,
    );
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain('aria-label="NGS Plus ana sayfa"');
    expect(html).toContain('<form>');
    expect(html).toContain('/marketing/ana-sayfa-800.webp 800w');
    expect(html).toContain('Ana Sayfa: proje özeti ve son kart okumaları');
    expect(html).not.toContain('NGS ACCESS');
    expect(html).toContain('Hesap oluştur');
  });
});
