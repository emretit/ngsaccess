import { Link } from 'react-router-dom';
import ProductShot from '@/components/public/ProductShot';
import { marketingFacts as copy } from './marketingFacts';
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
          </div>
          <div>
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
        </div>
      </section>
      <div className="pub-hero-shot pub-wrap">
        <ProductShot
          name="ana-sayfa"
          alt={copy.heroAlt}
          priority
          elevated
          caption={copy.productCaption}
          sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 1264px) calc(100vw - 64px), 1200px"
        />
      </div>
      <div className="pub-wrap">
        <div className="pub-hardware">
          <p>{copy.hardware[0]}</p>
          <div className="pub-hardware-brands">
            {copy.hardwareBrands.map((brand) => (
              <span key={brand}>{brand}</span>
            ))}
          </div>
          <p>{copy.hardware[1]}</p>
        </div>
      </div>
    </>
  );
}
