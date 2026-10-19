import { useEffect, useState } from "react";

export function visitorExpiryDelay(nextExpiry: number | null, now: number): number | null {
  if (nextExpiry === null) return null;
  return Math.min(Math.max(0, nextExpiry - now + 1), 2147483647);
}

/** One wakeup at the next lifecycle boundary; no periodic query invalidation. */
export function useVisitorClock() {
  const [now, setNow] = useState(() => Date.now());
  const [nextExpiry, setNextExpiry] = useState<number | null>(null);
  useEffect(() => {
    if (nextExpiry === null) return;
    let timer: number | undefined;
    const schedule = () => {
      const delay = visitorExpiryDelay(nextExpiry, Date.now());
      if (delay === null) return;
      timer = window.setTimeout(() => {
        const current = Date.now();
        // Long browser timers are capped; re-arm without refreshing any query early.
        if (current <= nextExpiry) schedule();
        else setNow(current);
      }, delay);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [nextExpiry, now]);
  return { now, onNextExpiry: setNextExpiry };
}
