import { useId, type ReactNode } from 'react';
import '@/components/public/public.css';
export type SectionProps = {
  id?: string;
  title?: string;
  description?: string;
  tone?: 'light' | 'burgundy';
  className?: string;
  children: ReactNode;
};
export function Section({ id, title, description, tone = 'light', className = '', children }: SectionProps) {
  const titleId = useId();
  return (
    <section
      id={id}
      aria-labelledby={title ? titleId : undefined}
      className={`pub-section pub-wrap ${tone === 'burgundy' ? 'pub-scene' : ''} ${className}`}
    >
      {title && (
        <div className="pub-section-intro">
          <h2 id={titleId}>
            {title.split('<br>').map((line, i) => (
              <span key={line}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </h2>
          {description && <p>{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
export default Section;
