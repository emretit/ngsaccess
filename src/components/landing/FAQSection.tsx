import { Plus } from 'lucide-react';
import Section from '@/components/public/Section';
import { marketingFacts as copy } from './marketingFacts';
export default function FAQSection() {
  return (
    <Section id="sorular" className="pub-faq">
      <div className="pub-faq-intro">
        <h2>{copy.faqTitle}</h2>
        <p>
          {copy.faqHelp} <a href={`mailto:${copy.email}`}>{copy.email}</a>
        </p>
      </div>
      <div className="pub-faq-list">
        {copy.faq.map((item, i) => (
          <details key={item.question} open={i === 0}>
            <summary>
              <span>{item.question}</span>
              <span className="pub-faq-icon" aria-hidden="true">
                <Plus size={18} />
              </span>
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
