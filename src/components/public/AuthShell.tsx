import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Logo from '@/components/ui/logo';
import { usePublicTheme } from '@/hooks/usePublicTheme';
import { PublicFooter } from './PublicFooter';

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  usePublicTheme();
  return (
    <div className="min-h-screen bg-canvas text-text [color-scheme:light]">
      <a
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:bg-surface focus:p-3"
      >
        İçeriğe geç
      </a>
      <main id="main" tabIndex={-1} className="outline-none grid lg:min-h-[860px] lg:grid-cols-2">
        <section className="flex min-w-0 flex-col px-[var(--public-gutter)] py-5 sm:px-8 sm:py-6 lg:px-12 lg:py-8">
          <header className="flex items-center justify-between gap-4">
            <Link to="/" aria-label="NGS Plus ana sayfa" className="inline-flex min-h-11 items-center">
              <Logo variant="compact" tone="dark" size="md" />
            </Link>
            <Link to="/" className="inline-flex min-h-11 items-center text-[13px]">
              Ana sayfa
            </Link>
          </header>
          <div className="mx-auto my-10 w-full max-w-[var(--public-form-max)] sm:my-12 lg:my-[72px] [&_input]:min-h-12 [&_input]:border-control [&_input]:bg-surface [&_input]:text-base [&_label]:text-sm [&_button[type=submit]]:min-h-12 [&_button[type=submit]]:text-[15px] [&_button]:font-semibold [&_button]:shadow-none">
            <h1 className="mb-3.5 text-[30px] font-semibold leading-[1.12] tracking-[-.035em] sm:text-4xl">
              {title}
            </h1>
            <p className="mb-7 text-[15px] leading-[1.6] text-muted-foreground sm:mb-8 sm:text-base">
              {description}
            </p>
            {children}
            {footer && (
              <div className="mt-6 border-t border-line pt-6 text-sm [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:font-semibold [&_a]:text-primary">
                {footer}
              </div>
            )}
          </div>
          <p className="mt-auto text-[13px] leading-relaxed text-muted-foreground">
            Yardıma ihtiyacınız varsa{' '}
            <a href="mailto:info@ngsplus.app" className="underline underline-offset-4">
              info@ngsplus.app
            </a>
          </p>
        </section>
        <aside className="hidden min-w-0 flex-col justify-center gap-10 bg-side-bg px-8 py-18 text-side-text lg:flex xl:px-12">
          <div>
            <h2 className="max-w-[520px] text-[40px] font-semibold leading-[1.12] tracking-[-.035em]">
              İşyerinizin günlük akışı,
              <br />
              aynı ekranda.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-side-muted">
              Giriş kayıtlarından çalışma planlarına, yetkili olduğunuz projenin verileriyle çalışın.
            </p>
          </div>
          <figure>
            <a
              href="/marketing/ana-sayfa-1600.webp"
              aria-label="Ana Sayfa: proje özeti ve son kart okumaları: büyük görseli aç"
              className="block overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--public-shot-shadow)] focus-visible:outline-side-indicator"
            >
              <img
                src="/marketing/ana-sayfa-1600.webp"
                srcSet="/marketing/ana-sayfa-800.webp 800w, /marketing/ana-sayfa-1600.webp 1600w"
                sizes="(min-width: 1024px) 50vw, 650px"
                width={1600}
                height={1000}
                alt="Ana Sayfa: proje özeti ve son kart okumaları"
                className="h-auto w-full"
              />
            </a>
            <figcaption className="pt-3 text-xs text-side-muted">
              NGS Plus ürün ekranı · Örnek proje ve kayıtlar
            </figcaption>
          </figure>
          <p className="text-[13px] text-side-muted">Personel ve geçiş yönetimi · NGS Plus</p>
        </aside>
      </main>
      <PublicFooter />
    </div>
  );
}
