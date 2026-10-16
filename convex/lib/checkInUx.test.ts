import { describe, expect, it } from 'vitest';
import { checkInTokenState, CHECK_IN_TOKEN_TTL_MS } from './checkInUx';

describe('QR token sonuç sözleşmesi', () => {
  const expiresAt = new Date(10_000).toISOString();
  it('olmayan tokenı reddeder', () => expect(checkInTokenState(null, 0)).toBe('invalid'));
  it('süre içinde ilk kullanımı kabul eder', () => expect(checkInTokenState({ expiresAt }, 9999)).toBe('ready'));
  it('süre sınırını ve geçmişini reddeder', () => {
    expect(checkInTokenState({ expiresAt }, 10000)).toBe('expired');
    expect(checkInTokenState({ expiresAt }, 10001)).toBe('expired');
  });
  it('bozuk tarihi reddeder', () => expect(checkInTokenState({ expiresAt: 'bad' }, 0)).toBe('expired'));
  it('tekrar istekte süre dolsa bile önceki başarıyı korur', () => expect(checkInTokenState({ expiresAt, usedAt: new Date(100).toISOString() }, 20000)).toBe('completed'));
  it('GPS beklemesi için yeterli süre tanır', () => expect(CHECK_IN_TOKEN_TTL_MS).toBeGreaterThan(5000));
});

import { vi } from 'vitest';
import { optionalLocationWithin } from './checkInUx';

describe('QR konum bekleme bütçesi', () => {
  it('izin reddinde konumsuz devam eder', async () => {
    expect(await optionalLocationWithin(async () => { throw new Error('permission denied'); }, 3000)).toBeNull();
  });
  it('cevapsız izin penceresini ve geç GPS sonucunu beklemez', async () => {
    vi.useFakeTimers();
    try {
      let resolvePosition: ((value: number) => void) | undefined;
      const result = optionalLocationWithin(() => new Promise<number>((resolve) => { resolvePosition = resolve; }), 3000);
      await vi.advanceTimersByTimeAsync(3000);
      expect(await result).toBeNull();
      resolvePosition?.(42);
      expect(await result).toBeNull();
    } finally { vi.useRealTimers(); }
  });
  it('zamanında gelen konumu korur', async () => {
    expect(await optionalLocationWithin(async () => ({ latitude: 41, longitude: 29 }), 3000)).toEqual({ latitude: 41, longitude: 29 });
  });
});
