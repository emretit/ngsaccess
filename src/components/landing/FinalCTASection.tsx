import { Link } from 'react-router-dom';
import { marketingFacts as copy } from './marketingFacts';
import { LandingTitle } from './LandingTitle';
export default function FinalCTASection() {
  return (
    <section className="pub-final-cta pub-scene">
      <div className="pub-wrap">
        <div>
          <h2>
            <LandingTitle text={copy.finalTitle} />
          </h2>
          <p>{copy.accountDescription}</p>
        </div>
        <div className="pub-actions">
          <Link className="pub-btn" to="/register">
            {copy.accountCta}
          </Link>
        </div>
      </div>
    </section>
  );
}
