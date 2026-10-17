import { ACCOUNT_CTA } from "./marketingFacts";
import { Link } from 'react-router-dom';
import Logo from '@/components/ui/logo';

const LandingFooter = () => <footer id="contact" className="border-t bg-card py-10 px-4 text-foreground">
  <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
    <div><Logo size="md" variant="full" tone="dark" /><p className="mt-4 text-sm text-muted-foreground">Bulut tabanlı personel devam ve geçiş kontrol sistemi.</p></div>
    <nav aria-label="Alt menü" className="flex flex-col gap-3 text-sm">
      <a href="/#features">Özellikler</a><a href="/#how-it-works">Nasıl çalışır?</a><a href="/#pricing">Fiyatlandırma</a><a href="/#faq">Sıkça sorulan sorular</a><Link to="/register">{ACCOUNT_CTA}</Link>
    </nav>
    <div className="space-y-3 text-sm"><p>İletişim</p><a className="block underline" href="mailto:info@ngsplus.app">info@ngsplus.app</a><a className="block underline" href="tel:+902125773572">0 (212) 577 35 72</a><p className="text-muted-foreground">Yasal bilgilendirme metinleri henüz bu sitede yayımlanmamıştır. Bilgi için iletişime geçebilirsiniz.</p></div>
  </div><p className="mx-auto mt-8 max-w-7xl text-xs text-muted-foreground">© {new Date().getFullYear()} NGS Plus</p>
</footer>;
export default LandingFooter;
