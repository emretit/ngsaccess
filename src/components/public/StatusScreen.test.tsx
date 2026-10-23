import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { StatusScreen } from './StatusScreen';

const render = (tone: 'loading' | 'success' | 'error' | 'info') =>
  renderToStaticMarkup(
    <MemoryRouter>
      <StatusScreen
        tone={tone}
        title="Durum başlığı"
        description="Durum açıklaması"
        primaryAction={{ label: 'Giriş yap', href: '/login' }}
        secondaryAction={{ label: 'Destek', href: 'mailto:info@ngsteknoloji.com' }}
      >
        <p>Ek içerik</p>
      </StatusScreen>
    </MemoryRouter>,
  );

describe('StatusScreen', () => {
  it.each(['loading', 'success', 'error', 'info'] as const)(
    '%s state has exactly one h1 and actionable navigation',
    (tone) => {
      const html = render(tone);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html.match(/<main\b/g)).toHaveLength(1);
      expect(html).toContain('href="/login"');
      expect(html).toContain('href="mailto:info@ngsteknoloji.com"');
      expect(html).toContain('Ek içerik');
      expect(html).not.toMatch(/<main[^>]*aria-live/);
    },
  );
  it('places the skip link before its focusable main target', () => {
    const html = render('info');
    expect(html).toContain('href="#main"');
    expect(html).toMatch(/<main[^>]*id="main"[^>]*tabindex="-1"/);
    expect(html.indexOf('href="#main"')).toBeLessThan(html.indexOf('<main'));
    expect(html).not.toContain('status-content');
  });
  it('announces loading, success and error without making the entire page live', () => {
    expect(render('loading')).toContain('role="status"');
    expect(render('loading')).toContain('aria-busy="true"');
    expect(render('success')).toContain('aria-live="polite"');
    expect(render('error')).toContain('role="alert"');
  });
  it('keeps pending session navigation disabled', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <StatusScreen
          tone="success"
          title="Tamamlandı"
          primaryAction={{ label: 'Oturum hazırlanıyor…', href: '/home', disabled: true }}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('href="/home"');
  });
});
