import Section from '@/components/public/Section';
import ProductShot from '@/components/public/ProductShot';
import { marketingFacts as copy } from './marketingFacts';
export default function FeaturesSection() {
  return (
    <Section id="ozellikler" title={copy.featuresTitle} description={copy.featuresDescription}>
      {copy.features.map((feature, index) => (
        <article key={feature.shot} className={`pub-feature-row${index % 2 ? ' pub-reverse' : ''}`}>
          <div className="pub-feature-copy">
            <div className="pub-feature-name">{feature.name}</div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
            <ul className="pub-feature-list">
              {feature.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <ProductShot name={feature.shot} alt={feature.alt} caption={copy.productCaption} />
            {feature.shot === 'vardiyalar' && (
              <a className="pub-text-link pub-extra-shot" href="/marketing/izinler-1600.webp">
                {copy.extraShot}
              </a>
            )}
          </div>
        </article>
      ))}
    </Section>
  );
}
