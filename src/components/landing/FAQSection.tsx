import Section from '@/components/public/Section';
import { marketingFacts as copy } from './marketingFacts';
export default function FAQSection() {
  return (
    <Section id="sorular" className="pub-faq">
      <h2>{copy.faqTitle}</h2>
      <div>
        {copy.faq.map((item, i) => (
          <details key={item.question} open={i === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
