import { describe, expect, it } from 'vitest';
import { shiftExportRows } from './shiftExport';
import { safeRows, csvExport } from './spreadsheetExport';
import type { Employee, Shift, Assignment } from '@/components/shifts/lib/planning';
const employee = { _id: 'e', firstName: '=Ayşe', lastName: 'Test', payrollCode: '+123' } as Employee;
const fixed = { _id: 's', name: 'Gündüz', startTime: '09:00', endTime: '17:00' } as Shift;
const flex = { _id: 'f', name: 'Serbest', startTime: '08:00', endTime: '10:00', scheduleType: 'flexible', flexible: { requiredNetMinutes: 480, checkInStart: '08:00', checkInEnd: '10:00', checkOutStart: '16:00', checkOutEnd: '20:00', checkOutEndDayOffset: 0, maxSpanMinutes: 720, breakMode: 'duration', breakMinutes: 0 } } as Shift;
const assignment = (shiftId: string, day: string) => ({ _id: shiftId, employeeId: 'e', shiftId, startDate: day, endDate: day }) as Assignment;
describe('shift export grid', () => {
  it('exports fixed, flexible, empty cells, employee codes and Turkish day labels', () => {
    const rows = shiftExportRows([employee], ['2026-10-19','2026-10-20','2026-10-21'], [assignment('s','2026-10-19'), assignment('f','2026-10-20')], [fixed, flex]);
    expect(rows).toEqual([['Çalışan','Sicil','19.10 Pzt','20.10 Sal','21.10 Çar'],['=Ayşe Test','+123','Gündüz · 09:00–17:00','Serbest · Esnek · 8 sa','—']]);
    expect(safeRows(rows)[1]?.slice(0,2)).toEqual(["'=Ayşe Test","'+123"]);
    expect(csvExport(rows)).toContain('"Gündüz · 09:00–17:00";"Serbest · Esnek · 8 sa";"—"');
  });
  it('respects weekday patterns and shows night continuations like calendar', () => {
    const night = { ...fixed, startTime: '22:00', endTime: '06:00' };
    const a = { ...assignment('s','2026-10-19'), weekPattern: ['MON'] };
    const rows = shiftExportRows([employee], ['2026-10-20','2026-10-21'], [a], [night]);
    expect(rows[1]?.slice(2)).toEqual(['Gündüz · 22:00–06:00 (+1 gün) (devam)', '—']);
  });
});
