import {
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';
import Logo from '@/components/ui/logo';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  {
    title: 'Ürün',
    links: [
      { label: 'Özellikler', href: '#features' },
      { label: 'Nasıl Çalışır', href: '#how-it-works' },
      { label: 'Fiyatlandırma', href: '#pricing' },
      { label: 'Mobil Uygulama', href: '#features' },
      { label: 'Demo İste', href: '/demo-request' },
    ],
  },
  {
    title: 'Şirket',
    links: [
      { label: 'Hakkımızda', href: '/about' },
      { label: 'Müşteriler', href: '#testimonials' },
      { label: 'Blog', href: '/blog' },
      { label: 'İletişim', href: '#contact' },
    ],
  },
  {
    title: 'Yasal',
    links: [
      { label: 'Gizlilik Politikası', href: '/legal/privacy' },
      { label: 'Kullanım Koşulları', href: '/legal/terms' },
      { label: 'Çerez Politikası', href: '/legal/cookies' },
      { label: 'KVKK Aydınlatma', href: '/legal/kvkk' },
    ],
  },
];

const SOCIAL_LINKS = [
  { icon: Facebook, label: 'Facebook', href: '#' },
  { icon: Twitter, label: 'Twitter', href: '#' },
  { icon: Linkedin, label: 'LinkedIn', href: '#' },
  { icon: Instagram, label: 'Instagram', href: '#' },
];

const LandingFooter = () => {
  const handleAnchor = (href: string) => (e: React.MouseEvent) => {
    if (!href.startsWith('#')) return;
    e.preventDefault();
    const id = href.replace('#', '');
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="bg-burgundy-900 text-white">
      <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-14 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          {/* Brand column */}
          <div className="lg:col-span-4">
            <Logo size="md" variant="full" tone="light" />
            <p className="mt-4 text-sm text-white/75 leading-relaxed max-w-sm">
              Modern işletmeler için bulut tabanlı PDKS ve geçiş kontrol sistemi.
              QR, kart ve mobil — tek platformda.
            </p>

            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-yellow-300" />
                <span className="text-white/80">
                  Hasanpaşa Mh. Mandıra Cd. No:4/39
                  <br />
                  Kadıköy / İstanbul
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0 text-yellow-300" />
                <a
                  href="tel:+902125773572"
                  className="text-white/80 hover:text-white transition-colors"
                >
                  0 (212) 577 35 72
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-yellow-300" />
                <a
                  href="mailto:info@ngsplus.app"
                  className="text-white/80 hover:text-white transition-colors"
                >
                  info@ngsplus.app
                </a>
              </li>
            </ul>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title} className="lg:col-span-2">
              <h4 className="font-semibold mb-4 text-white text-sm uppercase tracking-wide">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={handleAnchor(link.href)}
                      className="text-sm text-white/75 hover:text-white transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Social column */}
          <div className="lg:col-span-2">
            <h4 className="font-semibold mb-4 text-white text-sm uppercase tracking-wide">
              Bizi Takip Edin
            </h4>
            <div className="flex gap-2">
              {SOCIAL_LINKS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="rounded-full bg-white/10 hover:bg-yellow-300 hover:text-burgundy-900 p-2.5 transition-colors"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <p className="text-xs text-white/60">
            &copy; {new Date().getFullYear()} NGS Plus. Tüm hakları saklıdır.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <a
              href="/legal/privacy"
              className="text-white/60 hover:text-white transition-colors"
            >
              Gizlilik
            </a>
            <a
              href="/legal/terms"
              className="text-white/60 hover:text-white transition-colors"
            >
              Koşullar
            </a>
            <a
              href="/legal/cookies"
              className="text-white/60 hover:text-white transition-colors"
            >
              Çerezler
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
