import { describe, expect, it } from 'vitest';
import { autoMoveDirection, readerMoveConflict } from './readerMove';

describe('okuyucu taşıma yönü', () => {
  it('yön sorulmaz: boşsa mevcut yuvayı korur, doluysa boş yuvaya geçer, yer yoksa null', () => {
    expect(autoMoveDirection('exit', [])).toBe('exit');
    expect(autoMoveDirection('both', [])).toBe('both');
    expect(autoMoveDirection('entry', ['entry'])).toBe('exit');
    expect(autoMoveDirection('exit', ['exit'])).toBe('entry');
    expect(autoMoveDirection('both', ['entry'])).toBe('exit');
    expect(autoMoveDirection('entry', ['entry', 'exit'])).toBeNull();
    expect(autoMoveDirection('entry', ['both'])).toBeNull();
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
