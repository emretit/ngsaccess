import { Link } from 'react-router-dom';
import Logo from '@/components/ui/logo';
import { marketingFacts as copy } from '@/components/landing/marketingFacts';
import '@/components/public/public.css';
export function PublicFooter() {
  return (
    <footer className="pub-site-footer pub-wrap">
      <div className="pub-footer-main">
        <div>
          <Link to="/" aria-label="NGS Plus ana sayfa">
            <Logo tone="dark" size="md" />
          </Link>
          <p>{copy.footerDescription}</p>
          <p>{copy.footerLocation}</p>
        </div>
        <nav className="pub-footer-links" aria-label="Alt menü">
          <Link to="/#ozellikler">{copy.nav[0].label}</Link>
          <Link to="/#iletisim">{copy.nav[3].label}</Link>
          <Link to="/login">{copy.loginCta}</Link>
        </nav>
      </div>
      <div className="pub-footer-bottom">
        <p>© {new Date().getFullYear()} NGS Plus</p>
        <p>
          <span>{copy.footerPrivacy}</span>
          <a href={`mailto:${copy.email}`}>{copy.email}</a>
          <a href={copy.phoneHref}>{copy.phone}</a>
        </p>
      </div>
    </footer>
  );
}
export default PublicFooter;
