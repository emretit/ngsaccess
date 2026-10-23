import { Mail, MapPin, Phone } from 'lucide-react';
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
      <div className="pub-contact-card">
        <a className="pub-contact-row" href={`mailto:${copy.email}`}>
          <span className="pub-contact-icon" aria-hidden="true">
            <Mail size={20} />
          </span>
          <span className="pub-contact-text">
            <small>{copy.contactLabels.email}</small>
            <strong>{copy.email}</strong>
          </span>
        </a>
        <a className="pub-contact-row" href={copy.phoneHref}>
          <span className="pub-contact-icon" aria-hidden="true">
            <Phone size={20} />
          </span>
          <span className="pub-contact-text">
            <small>{copy.contactLabels.phone}</small>
            <strong>{copy.phone}</strong>
          </span>
        </a>
        <div className="pub-contact-row">
          <span className="pub-contact-icon" aria-hidden="true">
            <MapPin size={20} />
          </span>
          <span className="pub-contact-text">
            <small>{copy.contactLabels.location}</small>
            <strong>{copy.footerLocation}</strong>
          </span>
        </div>
        <p className="pub-contact-help">{copy.contactHelp}</p>
      </div>
    </Section>
  );
}
