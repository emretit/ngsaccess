import { describe, expect, it } from 'vitest';
import { initialReaderMoveSelection, readerMoveConflict } from './readerMove';

describe('okuyucu taşıma yönü', () => {
  it('hedefi seçmez ve tüm mevcut yönleri aynen korur', () => {
    for (const direction of ['entry', 'exit', 'both'] as const) {
      expect(initialReaderMoveSelection(direction)).toEqual({ targetDoorId: '', direction });
    }
  });
  it('boş hedefte mevcut yönü kabul eder', () => {
    expect(readerMoveConflict('exit', [])).toBe(false);
    expect(readerMoveConflict('both', [])).toBe(false);
  });
  it('karşı yön varsa mevcut yönü değiştirmeye zorlamaz', () => {
    expect(readerMoveConflict('entry', ['exit'])).toBe(false);
    expect(readerMoveConflict('exit', ['entry'])).toBe(false);
  });
  it('aynı veya çift yön işgalini bildirir', () => {
    expect(readerMoveConflict('entry', ['entry'])).toBe(true);
    expect(readerMoveConflict('exit', ['exit'])).toBe(true);
    expect(readerMoveConflict('both', ['entry'])).toBe(true);
    expect(readerMoveConflict('entry', ['both'])).toBe(true);
  });
});
