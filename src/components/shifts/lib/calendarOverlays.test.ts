import { describe, expect, it } from 'vitest';
import { assignmentOwnsDate, assignmentWorkingIntervalsOnDate, assignmentsConflictOnDate } from './calendarOverlays';
import type { Assignment, Shift } from './planning';

const morning = { _id: 'morning', startTime: '09:00', endTime: '17:00' } as Shift;
const night = { _id: 'night', startTime: '22:00', endTime: '06:00' } as Shift;
const row = { _id: 'row', employeeId: 'person', shiftId: morning._id, startDate: '2026-10-19', endDate: '2026-10-25', weekPattern: ['MON'] } as Assignment;

describe('Takvim sahipliği ve çalışma aralıkları', () => {
  it('seçilmeyen haftalık gün sahiplenilir, çalışma aralığı üretilmez', () => {
    expect(assignmentOwnsDate(row, '2026-10-24')).toBe(true);
    expect(assignmentWorkingIntervalsOnDate(row, '2026-10-24', [morning])).toEqual([]);
    expect(assignmentsConflictOnDate([row, { ...row, _id: 'other' as Assignment['_id'], weekPattern: ['SAT'] }], '2026-10-24', [morning])).toBe(true);
  });
  it('gece kuyruğu sahiplik aralığını uzatmaz ama çalışma çakışmasını korur', () => {
    const overnight = { ...row, shiftId: night._id, endDate: row.startDate };
    expect(assignmentOwnsDate(overnight, '2026-10-20')).toBe(false);
    expect(assignmentWorkingIntervalsOnDate(overnight, '2026-10-20', [night])).toHaveLength(1);
    const early = { ...morning, startTime: '05:00' };
    const next = { ...row, _id: 'next' as Assignment['_id'], startDate: '2026-10-20', weekPattern: ['TUE'] };
    expect(assignmentsConflictOnDate([overnight, next], next.startDate, [night, early])).toBe(true);
    expect(assignmentsConflictOnDate([overnight, next], next.startDate, [night, morning])).toBe(false);
  });
  it('başka kişinin ataması sahiplik çakışması oluşturmaz', () => {
    expect(assignmentsConflictOnDate([row, { ...row, employeeId: 'other' as Assignment['employeeId'] }], row.startDate, [morning])).toBe(false);
  });
});
