import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { marketingFacts } from './marketingFacts';

const prohibited =
  /Excel(?:'den| ile).{0,35}içe|push\s*bildirim|çevrimdışı|biyometr|deneme süresi|ücretsiz deneme|müşteri sayısı|referans sayısı|Türkiye’nin|Türkiye'nin|IT ekibin[ei].{0,15}gerek yok|tek satır kod|KVKK uyumlu|5 dakika|14 gün|₺|\b\d+\s*(?:TL|müşteri)\b/iu;

describe('public marketing claims', () => {
  it('uses approved copy without unsupported claims', () => {
    expect(JSON.stringify(marketingFacts)).not.toMatch(prohibited);
    const directory = resolve('src/components/landing');
    const files = readdirSync(directory).filter(
      (name) => /\.(tsx?|css)$/.test(name) && !name.includes('.test.'),
    );
    for (const file of [
      ...files.map((name) => resolve(directory, name)),
      resolve('src/pages/LandingPage.tsx'),
    ]) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(prohibited);
    }
  });
  it('keeps four visible features and the approved hardware integrations', () => {
    expect(marketingFacts.features).toHaveLength(4);
    expect(marketingFacts.hardwareBrands).toEqual(['Hikvision', 'IDE Smart']);
  });
});
