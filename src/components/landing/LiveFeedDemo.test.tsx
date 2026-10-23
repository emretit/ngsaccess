import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LiveFeedDemo, { feedRows } from './LiveFeedDemo';
import { marketingFacts } from './marketingFacts';

const events = marketingFacts.liveFeed.events;
const minutes = (time: string) => {
  const [hours, minute] = time.split(':').map(Number);
  return hours * 60 + minute;
};

describe('feedRows', () => {
  it('starts deterministically at 09:14 with four newest-first examples', () => {
    const rows = feedRows(events, 0, 4);
    expect(rows.map((row) => row.name)).toEqual(events.slice(0, 4).map((event) => event.name));
    expect(rows.map((row) => row.time)).toEqual(['09:14', '09:12', '09:09', '09:07']);
    expect(feedRows(events, 0, 4)).toEqual(rows);
  });

  it('prepends the next event and keeps the previous three rows intact', () => {
    const rows = feedRows(events, 0, 4);
    const next = feedRows(events, 1, 4);
    expect(next[0].name).toBe(events[4].name);
    expect(next.slice(1)).toEqual(rows.slice(0, 3));
    expect(feedRows(events, 5, 4)[0].name).toBe(events[0].name);
  });

  it('advances by 1–3 minutes and wraps midnight without invalid times', () => {
    let crossedMidnight = false;
    for (let step = 1; step < 1500; step += 1) {
      const [current, previous] = feedRows(events, step, 2);
      const difference = (minutes(current.time) - minutes(previous.time) + 1440) % 1440;
      expect(difference).toBeGreaterThanOrEqual(1);
      expect(difference).toBeLessThanOrEqual(3);
      expect(current.time).toMatch(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
      if (previous.time === '23:59' && current.time === '00:00') crossedMidnight = true;
    }
    expect(crossedMidnight).toBe(true);
  });

  it('handles no events and no requested rows', () => {
    expect(feedRows([], 0, 4)).toEqual([]);
    expect(feedRows(events, 0, 0)).toEqual([]);
  });
});

describe('LiveFeedDemo SSR', () => {
  it('renders four decorative rows with an accessible group and pause button', () => {
    const html = renderToStaticMarkup(<LiveFeedDemo />);
    expect(html.match(/<li /g)).toHaveLength(4);
    expect(html).toContain(`aria-label="${marketingFacts.liveFeed.label}"`);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('type="button" aria-pressed="false"');
    expect(html).toContain('Örnek veri');
    expect(html).toContain('Reddedildi');
    expect(html).toContain('İzin verildi');
    expect(html).not.toContain('aria-live');
    expect(renderToStaticMarkup(<LiveFeedDemo />)).toBe(html);
  });
});
