import Section from '@/components/public/Section';
import { marketingFacts as copy } from './marketingFacts';
import { LandingTitle } from './LandingTitle';
export default function SecuritySection() {
  const [privacyIntro] = copy.privacyContact.split(copy.email);
  return (
    <Section id="guvenlik" className="pub-security pub-band">
      <div className="pub-security-intro">
        <h2>
          <LandingTitle text={copy.securityTitle} />
        </h2>
        <p>{copy.securityDescription}</p>
        <p className="pub-small">
          {privacyIntro}
          <a href={`mailto:${copy.email}`}>{copy.email}</a>.
        </p>
      </div>
      <div>
        {copy.securityItems.map((item) => (
          <article className="pub-security-item" key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}
