import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import Logo from '@/components/ui/logo';

const NAV_LINKS = [
  { href: '#features', label: 'Özellikler' },
  { href: '#how-it-works', label: 'Nasıl Çalışır' },
  { href: '#pricing', label: 'Fiyatlandırma' },
  { href: '#testimonials', label: 'Müşteriler' },
  { href: '#faq', label: 'SSS' },
];

const LandingHeader = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleAnchor = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileOpen(false);
    const id = href.replace('#', '');
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <a href="#main" className="skip-link">
        İçeriğe atla
      </a>
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-card/80 backdrop-blur-md border-b border-border shadow-sm'
            : 'bg-card/60 backdrop-blur-sm border-b border-transparent'
        }`}
      >
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" aria-label="Anasayfa" className="flex items-center">
              <Logo variant="compact" tone="dark" size="md" />
            </Link>

            <nav className="hidden lg:flex items-center gap-1" aria-label="Ana menü">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={handleAnchor(link.href)}
                  className="px-3 py-2 text-sm font-medium text-foreground/80 hover:text-primary transition-colors rounded-md hover:bg-primary/5"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => navigate('/login')}
                className="text-foreground/80 hover:text-primary"
              >
                Giriş Yap
              </Button>
              <Button
                onClick={() => navigate('/demo-request')}
                className="bg-primary hover:bg-primary/90 shadow-sm"
              >
                Ücretsiz Demo
              </Button>
            </div>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Menüyü aç"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[380px]">
                <SheetHeader className="text-left">
                  <SheetTitle>
                    <Logo variant="compact" tone="dark" size="md" />
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-8 flex flex-col gap-1" aria-label="Mobil menü">
                  {NAV_LINKS.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={handleAnchor(link.href)}
                      className="px-3 py-3 text-base font-medium text-foreground rounded-md hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>
                <div className="mt-8 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMobileOpen(false);
                      navigate('/login');
                    }}
                  >
                    Giriş Yap
                  </Button>
                  <Button
                    onClick={() => {
                      setMobileOpen(false);
                      navigate('/demo-request');
                    }}
                    className="bg-primary hover:bg-primary/90"
                  >
                    Ücretsiz Demo
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </>
  );
};

export default LandingHeader;
