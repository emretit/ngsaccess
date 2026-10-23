export type ReaderDirection = 'entry' | 'exit' | 'both';

export function readerMoveConflict(direction: ReaderDirection, occupied: readonly ReaderDirection[]): boolean {
  return occupied.some(existing => existing === direction || existing === 'both' || direction === 'both');
}

/**
 * Yön kullanıcıya sorulmaz (PDKS nokta tipi belirler); yalnız Hik okuyucu yuvasını (giriş/çıkış) seçer.
 * Mevcut yuva hedefte boşsa korunur, değilse ilk boş tek yönlü yuvaya geçilir; yer yoksa null.
 */
export function autoMoveDirection(current: ReaderDirection, occupied: readonly ReaderDirection[]): ReaderDirection | null {
  const candidates: ReaderDirection[] = [current, 'entry', 'exit'];
  return candidates.find(direction => !readerMoveConflict(direction, occupied)) ?? null;
}
