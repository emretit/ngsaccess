import type { DayData, Employee } from "../lib/planning";

type AssignmentInitial = { employeeIds: string[]; startDate: string; endDate: string };

export function openCalendarDay(
  employee: Employee,
  date: string,
  canAssign: boolean,
  data: DayData,
  onAssign: (initial: AssignmentInitial) => void,
  onDetail: (detail: { employee: Employee; date: string }) => void,
) {
  if (canAssign && data.records.length === 0) {
    onAssign({ employeeIds: [employee._id], startDate: date, endDate: date });
  } else onDetail({ employee, date });
}
