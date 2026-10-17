export type ReaderDirection = 'entry' | 'exit' | 'both';

export function readerMoveConflict(direction: ReaderDirection, occupied: readonly ReaderDirection[]): boolean {
  return occupied.some(existing => existing === direction || existing === 'both' || direction === 'both');
}

export function initialReaderMoveSelection(direction: ReaderDirection): { targetDoorId: ''; direction: ReaderDirection } {
  return { targetDoorId: '', direction };
}
