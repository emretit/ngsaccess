import { Link } from 'react-router-dom';
import ProductShot from '@/components/public/ProductShot';
import { marketingFacts as copy } from './marketingFacts';
import LiveFeedDemo from './LiveFeedDemo';
import HardwareStrip from './HardwareStrip';
import { LandingTitle } from './LandingTitle';
export default function HeroSection() {
  return (
    <>
      <section className="pub-hero pub-scene">
        <div className="pub-wrap pub-hero-copy">
          <div>
            <h1>
              <LandingTitle text={copy.heroTitle} />
            </h1>
            <p className="pub-lead">{copy.heroDescription}</p>
            <div className="pub-actions">
              <Link className="pub-btn" to="/register">
                {copy.accountCta}
              </Link>
              <Link className="pub-btn pub-secondary" to="/#ozellikler">
                {copy.heroSecondary}
              </Link>
            </div>
            <p className="pub-small">{copy.accountDescription}</p>
          </div>
          <LiveFeedDemo />
        </div>
      </section>
      <div className="pub-hero-shot pub-wrap">
        <ProductShot
          src="/marketing/ana-sayfa-2400.webp"
          srcSet="/marketing/ana-sayfa-2400.webp 2400w"
          width={2400}
          height={1500}
          mobile={{
            media: '(max-width: 600px)',
            src: '/marketing/ana-sayfa-m-1400.webp',
            srcSet: '/marketing/ana-sayfa-m-700.webp 700w, /marketing/ana-sayfa-m-1400.webp 1400w',
            width: 1400,
            height: 1835,
          }}
          alt={copy.heroAlt}
          priority
          elevated
          caption={copy.heroCaption}
          sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 1264px) calc(100vw - 64px), 1200px"
        />
      </div>
      <HardwareStrip />
    </>
  );
}
