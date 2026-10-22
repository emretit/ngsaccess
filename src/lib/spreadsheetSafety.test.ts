import { describe, expect, it } from 'vitest';
import { neutralizeSpreadsheetFormula } from './spreadsheetSafety';

describe('neutralizeSpreadsheetFormula', () => {
  it('formül başlatan karakterleri metne çevirir', () => {
    for (const text of ['=cmd|"/c calc"!A1', '+1', '-2+3', '@SUM(A1)', '  =A1', '\tdüz metin', '\rdüz metin']) {
      expect(neutralizeSpreadsheetFormula(text)).toBe(`'${text}`);
    }
  });
  it('sıradan metne dokunmaz', () => {
    expect(neutralizeSpreadsheetFormula('Ahmet Yılmaz')).toBe('Ahmet Yılmaz');
    expect(neutralizeSpreadsheetFormula('')).toBe('');
    expect(neutralizeSpreadsheetFormula('-')).toBe('-');
  });
});
