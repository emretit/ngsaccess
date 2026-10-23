import { useEffect, useRef, useState } from 'react';
import { marketingFacts } from './marketingFacts';

type FeedEvent = {
  readonly name: string;
  readonly door: string;
  readonly result: 'allowed' | 'denied';
  readonly reason?: string;
};

type FeedRow = FeedEvent & { id: number; time: string };

/** A deterministic timeline: initial rows go back 2–3 minutes; new rows advance 1–3. */
export function feedRows(events: readonly FeedEvent[], step: number, count: number): FeedRow[] {
  if (events.length === 0) return [];
  const currentStep = Math.max(0, Math.floor(step));
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => {
    const id = currentStep - index;
    const eventIndex = id <= 0 ? -id : 3 + id;
    const elapsed = id <= 0
      ? -(-id * 2 + Math.floor(-id / 2))
      : Math.floor(id / 3) * 6 + [0, 3, 4][id % 3];
    const minutes = ((554 + elapsed) % 1440 + 1440) % 1440;
    return {
      ...events[eventIndex % events.length],
      id,
      time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
    };
  });
}

export default function LiveFeedDemo() {
  const copy = marketingFacts.liveFeed;
  const cardRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [control, setControl] = useState<'auto' | 'paused' | 'playing'>('auto');
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReducedMotion(media.matches);
    const syncVisibility = () => setHidden(document.hidden);
    syncMotion();
    syncVisibility();
    media.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncVisibility);
    const card = cardRef.current;
    const observer = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false));
    if (card && observer) observer.observe(card);
    else setVisible(true);
    return () => {
      media.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncVisibility);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const interacting = control === 'auto' && (hovered || focused);
    if (reducedMotion !== false || control === 'paused' || interacting || hidden || !visible) return;
    const timer = window.setInterval(() => setStep((previous) => previous + 1), 3000);
    return () => window.clearInterval(timer);
  }, [reducedMotion, control, hovered, focused, hidden, visible]);
  const paused = control === 'paused';

  return (
    <div
      ref={cardRef}
      className="pub-live-feed"
      role="group"
      aria-label={copy.label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className="pub-feed-header">
        <span className="pub-feed-title">{copy.title}</span>
        <span className="pub-feed-live">
          <span aria-hidden="true" />
          {copy.badge}
        </span>
      </div>
      <ul className="pub-feed-rows" aria-hidden="true">
        {feedRows(copy.events, step, 4).map((row) => (
          <li className={`pub-feed-row${row.id > 0 ? ' pub-feed-enter' : ''}`} key={row.id}>
            <time>{row.time}</time>
            <div className="pub-feed-person">
              <span>{row.name}</span>
              <small>{row.door}</small>
            </div>
            <div className="pub-feed-result">
              <span className={`pub-feed-chip pub-feed-${row.result}`}>
                {row.result === 'allowed' ? copy.allowed : copy.denied}
              </span>
              {row.reason && <small>{row.reason}</small>}
            </div>
          </li>
        ))}
      </ul>
      <div className="pub-feed-footer">
        {reducedMotion !== true && (
          <button
            className="pub-feed-toggle"
            type="button"
            aria-pressed={paused}
            onClick={() => setControl(paused ? 'playing' : 'paused')}
          >
            {paused ? copy.resume : copy.pause}
          </button>
        )}
        <span>{copy.sample}</span>
      </div>
    </div>
  );
}
