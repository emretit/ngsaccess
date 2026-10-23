import { cellData, dayDisplayRecords, shiftTimeLabel, type DayData, type Employee, type Shift, type Assignment } from '@/components/shifts/lib/planning';
export function shiftExportRows(employees: Employee[], days: string[], assignments: Assignment[], shifts: Shift[], getData?: (employee: Employee, date: string) => DayData) {
  return [['Çalışan', 'Sicil', ...days.map(day => `${day.slice(8, 10)}.${day.slice(5, 7)} ${new Intl.DateTimeFormat('tr-TR', { weekday: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(`${day}T12:00:00Z`))}`)],
    ...employees.map(employee => [`${employee.firstName} ${employee.lastName}`, employee.payrollCode ?? '', ...days.map(day => {
      const data: DayData = getData ? getData(employee, day) : cellData(employee, day, assignments, shifts, [], []);
      return [data.resolved?.cell.kind === 'rest' ? 'Boş' : '', ...dayDisplayRecords(data).map(record => `${record.shift.name} · ${shiftTimeLabel(record.shift)}${record.continuation ? ' (devam)' : ''}`)].filter(Boolean).join('; ') || '—';
    })])];
}
