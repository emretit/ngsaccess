import { describe, expect, it } from 'vitest';
import { monthPeriod, periodError, periodFromParams, presetPeriod } from './period';
describe('report periods', () => {
  it.each([
    ['today', '2026-10-19', '2026-10-19'], ['yesterday', '2026-10-18', '2026-10-18'],
    ['this-week', '2026-10-19', '2026-10-25'], ['last-week', '2026-10-12', '2026-10-18'],
    ['this-month', '2026-10-01', '2026-10-31'], ['last-month', '2026-09-01', '2026-09-30'], ['custom', '2026-10-19', '2026-10-19'],
  ] as const)('resolves %s from a fixed Turkish day', (preset, from, to) => { expect(presetPeriod(preset, '2026-10-19')).toEqual({ preset, from, to }); });
  it('preserves custom URL dates but uses the selected preset for stale dates', () => {
    expect(periodFromParams(new URLSearchParams('preset=custom&from=2026-10-01&to=2026-10-03')).to).toBe('2026-10-03');
    expect(periodFromParams(new URLSearchParams('preset=today&from=2000-01-01'), '2026-10-19').from).toBe('2026-10-19');
  });
  it('rejects more than 31 inclusive days, inverted dates and impossible dates', () => {
    expect(periodError('2026-10-01', '2026-10-31')).toBeUndefined();
    expect(periodError('2026-10-01', '2026-11-01')).toContain('31');
    expect(periodError('2026-10-20', '2026-10-19')).toContain('sonra');
    expect(periodError('2026-02-30', '2026-03-01')).toContain('Geçerli');
    expect(periodError('', '')).toContain('Geçerli');
  });
  it('validates months and leap year month boundaries', () => {
    expect(monthPeriod('2028-02')?.to).toBe('2028-02-29'); expect(monthPeriod('2026-13')).toBeUndefined(); expect(monthPeriod('0000-01')).toBeUndefined();
  });
});
