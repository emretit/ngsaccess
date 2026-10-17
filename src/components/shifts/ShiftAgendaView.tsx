import type { CalendarProps } from "./ShiftCalendarGrid";
import { ShiftCalendarCell } from "./ShiftCalendarCell";
import { dayLabel } from "./lib/planning";
export function ShiftAgendaView({
  employees,
  days,
  getData,
  onOpen,
  selected,
  onSelect,
}: CalendarProps) {
  const day = days[0];
  if (!day) return null;
  return (
    <section
      aria-label={`${dayLabel(day)} ajandası`}
      className="min-w-0 border-y divide-y"
    >
      {employees.map((employee) => (
        <div key={employee._id} className="py-3 min-w-0">
          <label className="flex items-center gap-2 font-medium break-words">
            <input
              type="checkbox"
              checked={selected.has(employee._id)}
              onChange={() => onSelect(employee._id)}
              aria-label={`${employee.firstName} ${employee.lastName} seç`}
              className="size-4 accent-primary"
            />
            {employee.firstName} {employee.lastName}
          </label>
          <ShiftCalendarCell
            data={getData(employee, day)}
            date={day}
            employeeName={`${employee.firstName} ${employee.lastName}`}
            onOpen={() => onOpen(employee, day)}
          />
        </div>
      ))}
    </section>
  );
}
