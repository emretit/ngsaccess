import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PublicHeader } from './PublicHeader';

function renderHeader() {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/other']}>
      <PublicHeader />
    </MemoryRouter>,
  );
}

describe('PublicHeader', () => {
  it('links to all four landing sections from another page', () => {
    const html = renderHeader();
    for (const [href, label] of [
      ['/#ozellikler', 'Özellikler'],
      ['/#kurulum', 'Nasıl çalışır?'],
      ['/#guvenlik', 'Güvenlik'],
      ['/#iletisim', 'İletişim'],
    ]) {
      expect(html).toContain(`href="${href}"`);
      expect(html).toContain(label);
    }
    expect(html).toContain('aria-label="Ana menü"');
  });
  it('includes both account actions and the main content skip link', () => {
    const html = renderHeader();
    expect(html).toMatch(/href="\/login"[^>]*>Giriş yap<\/a>/);
    expect(html).toMatch(/href="\/register"[^>]*>Hesap oluştur<\/a>/);
    expect(html).toContain('href="#main"');
    expect(html).toContain('İçeriğe geç');
  });
  it('starts with an accessible closed mobile menu', () => {
    const html = renderHeader();
    expect(html).toContain('aria-label="Menü"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="public-mobile-menu"');
    expect(html).not.toContain('role="dialog"');
  });
});
