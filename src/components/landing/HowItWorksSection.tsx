import Section from '@/components/public/Section';
import { marketingFacts as copy } from './marketingFacts';
export default function HowItWorksSection() {
  return (
    <Section id="kurulum" title={copy.setupTitle}>
      <div className="pub-steps">
        {copy.steps.map((step, i) => (
          <article className="pub-step" key={step.title}>
            <span className="pub-step-number">{i + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="pub-mobile-note">{copy.mobileDescription}</p>
    </Section>
  );
}
