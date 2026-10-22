import { cellData, shiftTimeLabel, type Employee, type Shift, type Assignment } from '@/components/shifts/lib/planning';
export function shiftExportRows(employees: Employee[], days: string[], assignments: Assignment[], shifts: Shift[]) {
  return [['Çalışan', 'Sicil', ...days.map(day => `${day.slice(8, 10)}.${day.slice(5, 7)} ${new Intl.DateTimeFormat('tr-TR', { weekday: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(`${day}T12:00:00Z`))}`)],
    ...employees.map(employee => [`${employee.firstName} ${employee.lastName}`, employee.payrollCode ?? '', ...days.map(day => {
      const records = cellData(employee, day, assignments, shifts, [], []).records;
      return records.map(record => `${record.shift.name} · ${shiftTimeLabel(record.shift)}${record.continuation ? ' (devam)' : ''}`).join('; ') || '—';
    })])];
}
