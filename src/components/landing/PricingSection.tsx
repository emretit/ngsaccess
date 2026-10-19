import Section from '@/components/public/Section';
import { marketingFacts as copy } from './marketingFacts';
import { LandingTitle } from './LandingTitle';
export default function PricingSection() {
  return (
    <Section id="iletisim" className="pub-contact">
      <div className="pub-contact-copy">
        <h2>
          <LandingTitle text={copy.contactTitle} />
        </h2>
        <p>{copy.planDescription}</p>
        <p className="pub-small">{copy.contactNote}</p>
      </div>
      <div className="pub-contact-lines">
        <a href={`mailto:${copy.email}`}>{copy.email}</a>
        <a href={copy.phoneHref}>{copy.phone}</a>
        <p className="pub-small">{copy.contactHelp}</p>
      </div>
    </Section>
  );
}
