import { ShiftCalendarCell } from "./ShiftCalendarCell";
import {
  dayLabel,
  istanbulToday,
  type Employee,
  type DayData,
} from "./lib/planning";
export interface CalendarProps {
  employees: Employee[];
  days: string[];
  getData: (employee: Employee, date: string) => DayData;
  onOpen: (employee: Employee, date: string) => void;
  selected: Set<string>;
  onSelect: (id: string) => void;
}
export function ShiftCalendarGrid({
  employees,
  days,
  getData,
  onOpen,
  selected,
  onSelect,
}: CalendarProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">
        Diğer günler için takvimi yatay kaydırın.
      </p>
      <div
        role="region"
        aria-label="Vardiya takvimi"
        tabIndex={0}
        className="max-w-full max-h-[65dvh] overflow-auto rounded-md border focus-visible:outline-2 focus-visible:outline-primary"
      >
        <table
          className="w-full table-fixed text-sm"
          style={{ minWidth: 216 + days.length * (days.length > 7 ? 92 : 112) }}
        >
          <caption className="sr-only">
            Çalışanlara göre {days[0]} – {days[days.length - 1]} vardiya planı
          </caption>
          <thead className="sticky top-0 z-20 bg-subtle">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 bg-subtle w-[216px] p-2 text-left"
              >
                Çalışan
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="p-2 text-xs font-medium border-l"
                >
                  {dayLabel(day)}
                  {day === istanbulToday() && (
                    <span className="block">Bugün</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee._id} className="border-t">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface p-2 text-left font-normal"
                >
                  <label className="flex gap-2 items-start">
                    <input
                      type="checkbox"
                      checked={selected.has(employee._id)}
                      onChange={() => onSelect(employee._id)}
                      aria-label={`${employee.firstName} ${employee.lastName} seç`}
                      className="mt-1 size-4 accent-primary"
                    />
                    <span className="min-w-0 break-words">
                      <span className="font-medium">
                        {employee.firstName} {employee.lastName}
                      </span>
                      <span className="block text-xs text-muted-foreground break-all">
                        {employee.email}
                      </span>
                    </span>
                  </label>
                </th>
                {days.map((day) => (
                  <td key={day} className="align-top border-l p-1">
                    <ShiftCalendarCell
                      data={getData(employee, day)}
                      date={day}
                      employeeName={`${employee.firstName} ${employee.lastName}`}
                      onOpen={() => onOpen(employee, day)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
