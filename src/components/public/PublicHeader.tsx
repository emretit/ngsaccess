import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import Logo from '@/components/ui/logo';
import { marketingFacts as copy } from '@/components/landing/marketingFacts';
import '@/components/public/public.css';

export type PublicHeaderProps = { tone?: 'light' | 'burgundy' };

export function PublicHeader({ tone = 'light' }: PublicHeaderProps) {
  const [open, setOpen] = useState(false);
  const burgundy = tone === 'burgundy';
  const close = () => setOpen(false);
  const accountActions = (
    <>
      <Link to="/login" onClick={close}>
        {copy.loginCta}
      </Link>
      <Link className="pub-btn" to="/register" onClick={close}>
        {copy.accountCta}
      </Link>
    </>
  );
  return (
    <div className={burgundy ? 'pub-scene' : 'bg-canvas text-text'}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:bg-surface focus:p-3 focus:text-text"
      >
        {copy.skipLabel}
      </a>
      <header className="pub-site-header pub-wrap">
        <Link to="/" aria-label="NGS Plus ana sayfa">
          <Logo variant="compact" tone={burgundy ? 'light' : 'dark'} size="md" />
        </Link>
        <nav className="pub-site-nav" aria-label="Ana menü">
          {copy.nav.map((link) => (
            <Link key={link.href} to={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="pub-header-actions">{accountActions}</div>
        <div className="ml-auto lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={copy.menuLabel}
                aria-controls="public-mobile-menu"
                aria-expanded={open}
                className="flex min-h-11 items-center gap-3 px-2 text-[14px]"
              >
                {copy.menuLabel}
                <Menu size={18} aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent
              id="public-mobile-menu"
              aria-describedby={undefined}
              className="w-[min(340px,100vw)] border-line bg-canvas text-text shadow-none duration-0 data-[state=open]:animate-none data-[state=closed]:animate-none [&>button]:size-11"
            >
              <SheetTitle className="text-text">{copy.menuLabel}</SheetTitle>
              <nav
                aria-label="Mobil menü"
                className="mt-8 flex flex-col [&>a]:flex [&>a]:min-h-12 [&>a]:items-center [&>a]:px-3 [&>a]:text-[15px]"
              >
                {copy.nav.map((link) => (
                  <Link key={link.href} to={link.href} onClick={close}>
                    {link.label}
                  </Link>
                ))}
                {accountActions}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    </div>
  );
}
export default PublicHeader;
